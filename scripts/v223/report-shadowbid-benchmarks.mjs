import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir, parseArgs, readJsonFiles, repoRootFrom } from './utils.mjs';

const args = parseArgs(process.argv.slice(2));
const repoRoot = repoRootFrom(import.meta.url);
const benchmarkDir = path.resolve(
  repoRoot,
  args.out || 'contracts/benchmarks/v223-private-usdcx'
);
const files = await readJsonFiles(benchmarkDir).catch((error) => {
  if (error && error.code === 'ENOENT') {
    return [];
  }

  throw error;
});
files.sort((left, right) => left.path.localeCompare(right.path));

function isExecutionLog(file) {
  return Boolean(file.data.actions && file.data.artifact_path);
}

const spikes = files.filter((file) => file.data.artifact_type === 'private-usdcx-spike');
const executions = files.filter(isExecutionLog);
const suites = files.filter(
  (file) => file.data.artifact_type === 'benchmark-suite' && !isExecutionLog(file)
);
const preconditions = files.filter((file) => file.data.artifact_type === 'usdcx-preconditions');
const fundingPaths = files.filter((file) => file.data.artifact_type === 'usdcx-funding-paths');
const visibilityReports = files.filter((file) => file.data.artifact_type === 'usdcx-visibility');
const sidecarLinkedSpikes = spikes.filter((file) => file.data.sidecar_plans).length;
const executedScenarioIds = new Set(
  executions
    .map((file) => file.data.scenario_filter)
    .filter(Boolean)
);
const totalScenarioCount = suites
  .flatMap((suite) => suite.data.scenarios || [])
  .map((scenario) => scenario.id)
  .filter((value, index, array) => array.indexOf(value) === index)
  .length;
const sidecarLinkedScenarios = suites
  .flatMap((suite) => suite.data.scenarios || [])
  .filter((scenario) => scenario.sidecar_plans)
  .length;
const successfulExecutions = executions.filter((file) => file.data.failed_actions === 0).length;
const scenarioCounts = suites
  .flatMap((suite) => suite.data.scenarios || [])
  .reduce((counts, scenario) => {
    const status = scenario.status || 'pending';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

const lines = [
  '# V2.23 Benchmark Summary',
  '',
  `Artifact directory: \`${path.relative(repoRoot, benchmarkDir)}\``,
  '',
  `- Spike artifacts: ${spikes.length}`,
  `- Benchmark suites: ${suites.length}`,
  `- Live precondition snapshots: ${preconditions.length}`,
  `- Funding-path snapshots: ${fundingPaths.length}`,
  `- Visibility snapshots: ${visibilityReports.length}`,
  `- Sidecar execution logs: ${executions.length}`,
  `- Successful execution logs: ${successfulExecutions}`,
  `- Executed scenarios: ${executedScenarioIds.size}/${totalScenarioCount || 0}`,
  `- Sidecar-linked spikes: ${sidecarLinkedSpikes}`,
  `- Sidecar-linked scenarios: ${sidecarLinkedScenarios}`,
  `- Scenario status counts: ${Object.keys(scenarioCounts).length ? JSON.stringify(scenarioCounts) : 'none'}`,
];

if (spikes.length > 0) {
  lines.push('');
  lines.push('## Spike Artifacts');

  for (const spike of spikes) {
    lines.push(`- ${path.relative(repoRoot, spike.path)}: ${spike.data.status || 'unknown'}`);
  }
}

if (suites.length > 0) {
  lines.push('');
  lines.push('## Benchmark Suites');

  for (const suite of suites) {
    lines.push(`- ${path.relative(repoRoot, suite.path)}: ${suite.data.status || 'unknown'}`);
  }
}

if (preconditions.length > 0) {
  lines.push('');
  lines.push('## Live Preconditions');

  for (const snapshot of preconditions) {
    const status = snapshot.data.assessment?.hidden_amount_funding_source_status || 'unknown';
    lines.push(`- ${path.relative(repoRoot, snapshot.path)}: funding=${status}`);
  }
}

if (fundingPaths.length > 0) {
  lines.push('');
  lines.push('## Funding Paths');

  for (const snapshot of fundingPaths) {
    const routeId = snapshot.data.recommendation?.route_id || 'unknown';
    lines.push(`- ${path.relative(repoRoot, snapshot.path)}: recommended=${routeId}`);
  }
}

if (visibilityReports.length > 0) {
  lines.push('');
  lines.push('## Visibility Reports');

  for (const snapshot of visibilityReports) {
    const verdict = snapshot.data.primary?.verdict || 'unknown';
    lines.push(`- ${path.relative(repoRoot, snapshot.path)}: verdict=${verdict}`);
  }
}

if (executions.length > 0) {
  lines.push('');
  lines.push('## Sidecar Executions');

  for (const execution of executions) {
    lines.push(
      `- ${path.relative(repoRoot, execution.path)}: mode=${execution.data.mode} success=${execution.data.failed_actions === 0}`
    );
  }
}

const summary = `${lines.join('\n')}\n`;

if (args['md-out']) {
  const outputPath = path.resolve(repoRoot, args['md-out']);
  await ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, summary, 'utf8');
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
} else {
  process.stdout.write(summary);
}
