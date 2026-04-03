import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir, nowIso, parseArgs, readJsonFiles, repoRootFrom } from './utils.mjs';

const args = parseArgs(process.argv.slice(2));
const repoRoot = repoRootFrom(import.meta.url);
const benchmarkDir = path.resolve(
  repoRoot,
  args.out || 'contracts/benchmarks/v223-private-usdcx'
);
const findingsPath = path.resolve(
  repoRoot,
  args['md-out'] || 'docs/contracts/v2.23-benchmark-findings.md'
);

function sortByPath(files) {
  return [...files].sort((left, right) => left.path.localeCompare(right.path));
}

function latestOfType(files, type) {
  const matches = sortByPath(
    files.filter((file) => file.data.artifact_type === type)
  );
  return matches.at(-1);
}

function isExecutionLog(file) {
  return Boolean(file.data.actions && file.data.artifact_path);
}

function latestExecutionForScenario(executions, scenarioId) {
  const matches = sortByPath(
    executions.filter((file) => file.data.scenario_filter === scenarioId)
  );
  return matches.at(-1);
}

function msToHuman(ms) {
  if (typeof ms !== 'number') {
    return 'Pending';
  }

  if (ms < 1000) {
    return `${ms} ms`;
  }

  return `${(ms / 1000).toFixed(2)} s`;
}

const files = await readJsonFiles(benchmarkDir).catch((error) => {
  if (error && error.code === 'ENOENT') {
    return [];
  }

  throw error;
});

const suite = sortByPath(
  files.filter((file) => file.data.artifact_type === 'benchmark-suite' && !isExecutionLog(file))
).at(-1);
const spike = latestOfType(files, 'private-usdcx-spike');
const preconditions = latestOfType(files, 'usdcx-preconditions');
const fundingPaths = latestOfType(files, 'usdcx-funding-paths');
const visibilityReport = latestOfType(files, 'usdcx-visibility');
const executions = files.filter(isExecutionLog);

if (!suite) {
  console.error('No benchmark-suite artifact found.');
  process.exit(1);
}

const scenarios = suite.data.scenarios || [];
const generatedAt = nowIso();
const latestExecution = sortByPath(executions).at(-1);
const executedScenarioCount = scenarios.filter((scenario) => latestExecutionForScenario(executions, scenario.id)).length;
const liveStateKnown = Boolean(preconditions);
const preconditionAssessment = preconditions?.data?.assessment || {};
const fundingRecommendation = fundingPaths?.data?.recommendation || {};
const fundingRouteCount = fundingPaths?.data?.routes?.length || 0;
const visibilityVerdict = visibilityReport?.data?.primary?.verdict || null;

const tableRows = scenarios.map((scenario) => {
  const execution = latestExecutionForScenario(executions, scenario.id);
  const metrics = scenario.metrics || {};
  const successful = execution && execution.data.failed_actions === 0;
  const failed = execution && execution.data.failed_actions > 0;
  const totalDuration = execution
    ? execution.data.actions.reduce((sum, action) => sum + (action.duration_ms || 0), 0)
    : null;
  const status = successful
    ? 'Local sidecar executed'
    : failed
      ? 'Local sidecar failed'
      : 'Pending';
  const recordsUsed = scenario.sidecar_plans?.record_plan?.expected_outputs
    ? `${scenario.sidecar_plans.record_plan.expected_outputs} planned`
    : 'Pending';
  const credentialsUsed = scenario.sidecar_plans?.credential_batch?.expected_credentials
    ? `${scenario.sidecar_plans.credential_batch.expected_credentials} planned`
    : 'Pending';
  const notes = successful
    ? `Local sidecar flow passed (${execution.data.total_actions} actions). Private funding, fee, and leak check still pending.`
    : failed
      ? `Local sidecar flow has failures; inspect ${path.relative(repoRoot, execution.path)}.`
      : 'No local sidecar execution recorded yet.';

  return `| ${scenario.id} | ${status} | Pending | ${successful || failed ? msToHuman(totalDuration) : 'Pending'} | Pending | ${recordsUsed} | ${credentialsUsed} | Pending | ${notes} |`;
});

const leakLines = [
  latestExecution
    ? `- Latest execution log: \`${path.relative(repoRoot, latestExecution.path)}\``
    : '- No local execution log recorded yet.',
  visibilityReport
    ? `- Latest visibility artifact: \`${path.relative(repoRoot, visibilityReport.path)}\``
    : '- No visibility artifact recorded yet.',
  visibilityReport
    ? `- Latest visibility verdict: \`${visibilityVerdict}\``
    : '- No public explorer/API leak verdict recorded yet.',
  visibilityReport
    ? '- The current baseline proves the bootstrap transfer_public_to_private path leaks amount publicly.'
    : '- No public explorer leak-check evidence has been recorded yet.',
  '- No private USDCx funding transaction has been demonstrated yet.',
];

const custodyLines = executedScenarioCount > 0
  ? [
      '- Current local evidence shows the record-plan and credential-batch scaffolds execute successfully for at least one scenario.',
      '- This does not yet prove locked-funds custody, refund authorization, seller payout authorization, or platform fee authorization.',
      '- The target custody model remains `contract-verifiable-private-custody` from `docs/contracts/v2.23-custody-decision.md`.',
      '- Off-chain trust assumptions for real private escrow are still unresolved.',
    ]
  : [
      '- custody validation still pending',
    ];

const preconditionLines = liveStateKnown
  ? [
      `- Latest preconditions artifact: \`${path.relative(repoRoot, preconditions.path)}\``,
      `- Live testnet pause flag currently allows private transfers: \`${preconditionAssessment.pause_allows_private_transfers}\``,
      `- Primary freeze-list root present: \`${preconditionAssessment.primary_root_present}\``,
      `- Target address not frozen: \`${preconditionAssessment.address_not_frozen}\``,
      `- Target address stablecoin role: \`${preconditionAssessment.role_literal}\``,
      `- Hidden-amount funding source status: \`${preconditionAssessment.hidden_amount_funding_source_status}\``,
      `- Current blocker: ${preconditionAssessment.next_blocker}`,
    ]
  : [
      '- no live testnet precondition snapshot recorded yet',
    ];

const fundingLines = fundingPaths
  ? [
      `- Latest funding-path artifact: \`${path.relative(repoRoot, fundingPaths.path)}\``,
      `- Route count: ${fundingRouteCount}`,
      `- Recommended route: \`${fundingRecommendation.route_id}\``,
      `- Recommendation reason: ${fundingRecommendation.reason}`,
    ]
  : [
      '- no funding-path planner artifact recorded yet',
    ];

const currentResult = executedScenarioCount > 0
  ? [
      `Local sidecar execution evidence now exists for ${executedScenarioCount}/${scenarios.length} benchmark scenarios.`,
      liveStateKnown
        ? `Live testnet state also permits credentialed private transfers, but hidden-amount funding is still ${preconditionAssessment.hidden_amount_funding_source_status}.`
        : 'Live testnet preconditions have not been captured yet.',
      fundingPaths
        ? `The current route recommendation is ${fundingRecommendation.route_id}.`
        : 'No funding-route recommendation has been recorded yet.',
      '',
      'Current recommendation:',
      '',
      '- continue Phase 1 benchmarking',
      '- keep the `v2.23` ABI unfrozen',
      '- treat current evidence as sidecar-readiness only, not private-escrow proof',
    ].join('\n')
  : [
      'No benchmark evidence has been recorded yet.',
      '',
      'Current recommendation:',
      '',
      '- continue Phase 1 benchmarking',
      '- do not freeze the `v2.23` ABI',
      '- do not market `v2.23` as full private sealed-bid',
    ].join('\n');

const decisionLines = executedScenarioCount > 0
  ? [
      `- local sidecar coverage is now ${executedScenarioCount}/${scenarios.length} scenarios`,
      liveStateKnown
        ? `- live testnet state says the next blocker is: ${preconditionAssessment.next_blocker}`
        : '- live testnet preconditions still need to be captured',
      '- continue `v2.23` research, but keep the custody model open',
      '- do not freeze the ABI yet',
      '- next required proof is private funding without public amount leakage',
    ]
  : [
      '- pending benchmark execution',
    ];

const markdown = `# ShadowBid V2.23 Benchmark Findings

## Status

In progress. This file is the running report for the \`v2.23\` Phase 1 feasibility spike.

It is generated from benchmark artifacts under \`contracts/benchmarks/v223-private-usdcx/\`.

Last generated: \`${generatedAt}\`

## Purpose

This report converts raw benchmark artifacts into a release decision for \`v2.23\`.

It should answer:

- does the tested private funding path hide the bid amount from the public path we are replacing?
- are proving time and fee cost acceptable for a user-facing auction flow?
- does the tested custody model preserve refund and winner settlement semantics?
- should the team continue, redesign, or stop before freezing the \`v2.23\` ABI?

## Current Result

${currentResult}

## Benchmark Metadata

| Field | Value |
| --- | --- |
| Benchmark window | ${latestExecution ? `Through \`${latestExecution.data.generated_at}\`` : 'Pending'} |
| Network | Local Leo VM |
| Program version | Sidecar scaffold phase |
| Token rail | \`USDCx\` private-first |
| Benchmark owner | Local workspace execution |
| Artifact directory | \`contracts/benchmarks/v223-private-usdcx/\` |
| Latest suite artifact | \`${path.relative(repoRoot, suite.path)}\` |
| Latest spike artifact | ${spike ? `\`${path.relative(repoRoot, spike.path)}\`` : 'Pending'} |
| Latest preconditions artifact | ${preconditions ? `\`${path.relative(repoRoot, preconditions.path)}\`` : 'Pending'} |
| Latest funding-path artifact | ${fundingPaths ? `\`${path.relative(repoRoot, fundingPaths.path)}\`` : 'Pending'} |
| Latest visibility artifact | ${visibilityReport ? `\`${path.relative(repoRoot, visibilityReport.path)}\`` : 'Pending'} |
| Execution logs | ${executions.length} |

## Scenario Matrix

| Scenario | Status | Proving time | Wall-clock | Fee total | Records | Credentials | Public leak check | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${tableRows.join('\n')}

## Leak Check Notes

${leakLines.join('\n')}

## Live Testnet Preconditions

${preconditionLines.join('\n')}

## Funding Path Notes

${fundingLines.join('\n')}

## Custody Model Notes

${custodyLines.join('\n')}

## Decision Section

${decisionLines.join('\n')}

## Related Documents

- \`docs/contracts/v2.23-phase-1-feasibility-spike.md\`
- \`docs/contracts/v2.23-custody-decision.md\`
- \`docs/contracts/v2.23-implementation-checklist.md\`
- \`docs/contracts/v2.23-usdcx-funding-paths.md\`
`;

await ensureDir(path.dirname(findingsPath));
await fs.writeFile(findingsPath, `${markdown}\n`, 'utf8');

console.log(`Wrote ${path.relative(repoRoot, findingsPath)}`);
