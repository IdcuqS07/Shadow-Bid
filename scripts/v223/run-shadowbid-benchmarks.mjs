import path from 'node:path';
import {
  ensureDir,
  leoRunTemplate,
  literalI64,
  literalU128,
  literalU8,
  nowIso,
  nowUnixSeconds,
  parseArgs,
  repoRootFrom,
  stableField,
  timestampSlug,
  writeJson,
} from './utils.mjs';

const args = parseArgs(process.argv.slice(2));
const repoRoot = repoRootFrom(import.meta.url);
const outputDir = path.resolve(
  repoRoot,
  args.out || 'contracts/benchmarks/v223-private-usdcx'
);
const artifactName = `benchmark-suite-${timestampSlug()}.json`;
const artifactPath = path.join(outputDir, artifactName);
const createdAt = nowUnixSeconds();

const programBindings = {
  record_utils: {
    program_id: 'shadowbid_usdcx_record_utils_v1.aleo',
    program_dir: 'contracts/programs/shadowbid_usdcx_record_utils_v1',
    register_transition: 'register_split_plan',
    ready_transition: 'mark_split_plan_ready',
    close_transition: 'close_split_plan',
  },
  credential_utils: {
    program_id: 'shadowbid_usdcx_cred_utils_v1.aleo',
    program_dir: 'contracts/programs/shadowbid_usdcx_credential_utils_v1',
    register_transition: 'register_credential_batch',
    ready_transition: 'mark_credential_batch_ready',
    close_transition: 'close_credential_batch',
  },
};

const scenarios = [
  {
    id: 'private-commit-1-bidder',
    description: 'Basic private USDCx commit path with one bidder.',
    bidder_count: 1,
    auction_count: 1,
    target_value: 20000,
    expected_outputs: 2,
    expected_credentials: 1,
    recommended_custody_model: 'contract-verifiable-private-custody',
  },
  {
    id: 'private-commit-reveal-1-bidder',
    description: 'Private commit followed by reveal compatibility check.',
    bidder_count: 1,
    auction_count: 1,
    target_value: 20000,
    expected_outputs: 2,
    expected_credentials: 1,
    recommended_custody_model: 'contract-verifiable-private-custody',
  },
  {
    id: 'private-commit-cancelled-refund',
    description: 'Cancelled auction path with refund semantics.',
    bidder_count: 2,
    auction_count: 1,
    target_value: 20000,
    expected_outputs: 3,
    expected_credentials: 2,
    recommended_custody_model: 'contract-verifiable-private-custody',
  },
  {
    id: 'private-commit-winner-settlement',
    description: 'Winner settlement path with seller and fee implications.',
    bidder_count: 2,
    auction_count: 1,
    target_value: 25000,
    expected_outputs: 4,
    expected_credentials: 2,
    recommended_custody_model: 'contract-verifiable-private-custody',
  },
  {
    id: 'parallel-2-auctions',
    description: 'Two auctions settling in parallel to expose bottlenecks.',
    bidder_count: 4,
    auction_count: 2,
    target_value: 50000,
    expected_outputs: 6,
    expected_credentials: 4,
    recommended_custody_model: 'contract-verifiable-private-custody',
  },
];

function buildSidecarPlans(suiteName, scenario) {
  const seedBase = `${suiteName}:${scenario.id}`;
  const recordPlanId = stableField(`${seedBase}:record-plan`);
  const credentialBatchId = stableField(`${seedBase}:credential-batch`);
  const denominationRoot = stableField(`${seedBase}:denominations`);
  const purposeRoot = stableField(`${seedBase}:purpose`);
  const policyRoot = stableField(`${seedBase}:policy`);
  const benchmarkRoot = stableField(`${seedBase}:benchmark`);

  return {
    record_plan: {
      plan_id: recordPlanId,
      denomination_root: denominationRoot,
      purpose_root: purposeRoot,
      expected_outputs: scenario.expected_outputs,
      target_value: literalU128(scenario.target_value),
      command_templates: {
        register: leoRunTemplate({
          programDir: programBindings.record_utils.program_dir,
          transition: programBindings.record_utils.register_transition,
          inputs: [
            recordPlanId,
            denominationRoot,
            purposeRoot,
            literalU8(scenario.expected_outputs),
            literalU128(scenario.target_value),
            literalI64(createdAt),
          ],
        }),
        mark_ready: leoRunTemplate({
          programDir: programBindings.record_utils.program_dir,
          transition: programBindings.record_utils.ready_transition,
          inputs: [
            recordPlanId,
            literalU8(scenario.expected_outputs),
            literalI64(createdAt + 60),
          ],
        }),
        close: leoRunTemplate({
          programDir: programBindings.record_utils.program_dir,
          transition: programBindings.record_utils.close_transition,
          inputs: [
            recordPlanId,
            literalI64(createdAt + 120),
          ],
        }),
      },
    },
    credential_batch: {
      batch_id: credentialBatchId,
      policy_root: policyRoot,
      benchmark_root: benchmarkRoot,
      expected_credentials: scenario.expected_credentials,
      command_templates: {
        register: leoRunTemplate({
          programDir: programBindings.credential_utils.program_dir,
          transition: programBindings.credential_utils.register_transition,
          inputs: [
            credentialBatchId,
            policyRoot,
            benchmarkRoot,
            literalU8(scenario.expected_credentials),
            literalI64(createdAt),
          ],
        }),
        mark_ready: leoRunTemplate({
          programDir: programBindings.credential_utils.program_dir,
          transition: programBindings.credential_utils.ready_transition,
          inputs: [
            credentialBatchId,
            literalU8(scenario.expected_credentials),
            literalI64(createdAt + 60),
          ],
        }),
        close: leoRunTemplate({
          programDir: programBindings.credential_utils.program_dir,
          transition: programBindings.credential_utils.close_transition,
          inputs: [
            credentialBatchId,
            literalI64(createdAt + 120),
          ],
        }),
      },
    },
  };
}

const artifact = {
  artifact_type: 'benchmark-suite',
  artifact_version: 2,
  generated_at: nowIso(),
  suite: args.suite || 'shadowbid-v223-phase-1',
  status: 'scaffolded',
  references: [
    'docs/contracts/v2.23-phase-1-feasibility-spike.md',
    'docs/contracts/v2.23-custody-decision.md',
    'docs/contracts/v2.23-benchmark-findings.md',
  ],
  program_bindings: programBindings,
  required_metrics: [
    'proving_time_ms',
    'wall_clock_ms',
    'fee_total',
    'records_used',
    'credentials_used',
    'user_actions_required',
    'public_leak_check',
  ],
  scenarios: scenarios.map((scenario) => ({
    ...scenario,
    status: 'pending',
    sidecar_plans: buildSidecarPlans(args.suite || 'shadowbid-v223-phase-1', scenario),
    metrics: {
      proving_time_ms: null,
      wall_clock_ms: null,
      fee_total: null,
      records_used: null,
      credentials_used: null,
      user_actions_required: null,
      public_leak_check: 'pending',
    },
    custody_model: scenario.recommended_custody_model,
    evidence: [],
    notes: '',
  })),
};

await ensureDir(outputDir);
await writeJson(artifactPath, artifact);

console.log(`Wrote ${path.relative(repoRoot, artifactPath)}`);
