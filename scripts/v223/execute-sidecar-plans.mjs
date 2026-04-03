import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  ensureDir,
  nowIso,
  parseArgs,
  readJsonFiles,
  repoRootFrom,
  timestampSlug,
  writeJson,
} from './utils.mjs';

const args = parseArgs(process.argv.slice(2));
const repoRoot = repoRootFrom(import.meta.url);
const benchmarkDir = path.resolve(
  repoRoot,
  args.out || 'contracts/benchmarks/v223-private-usdcx'
);
const artifactType = args.type || 'benchmark-suite';
const selectedScenarioId = args.scenario || null;
const execute = Boolean(args.execute);
const includeClose = Boolean(args['include-close']);
const stopOnError = Boolean(args['stop-on-error']);

function sortByPath(files) {
  return [...files].sort((left, right) => left.path.localeCompare(right.path));
}

function isExecutionLog(file) {
  return Boolean(file.data.actions && file.data.artifact_path);
}

function latestOfType(files, type) {
  const matches = sortByPath(
    files.filter((file) => file.data.artifact_type === type && !isExecutionLog(file))
  );
  return matches.at(-1);
}

function buildActionList(artifact) {
  const steps = includeClose ? ['register', 'mark_ready', 'close'] : ['register', 'mark_ready'];
  const scenarios = artifact.data.artifact_type === 'private-usdcx-spike'
    ? [{
        id: artifact.data.scenario,
        sidecar_plans: artifact.data.sidecar_plans,
      }]
    : artifact.data.scenarios || [];

  const filteredScenarios = selectedScenarioId
    ? scenarios.filter((scenario) => scenario.id === selectedScenarioId)
    : scenarios;

  const actions = [];

  for (const scenario of filteredScenarios) {
    const planEntries = Object.entries(scenario.sidecar_plans || {});

    for (const [planType, plan] of planEntries) {
      const templates = plan.command_templates || {};

      for (const step of steps) {
        const template = templates[step];

        if (!template) {
          continue;
        }

        actions.push({
          scenario_id: scenario.id,
          plan_type: planType,
          step,
          program_dir: template.program_dir,
          transition: template.transition,
          inputs: template.inputs,
          example_cli: template.example_cli,
        });
      }
    }
  }

  return actions;
}

function runLeoAction(action) {
  return new Promise((resolve) => {
    const startedAt = nowIso();
    const startedMs = Date.now();
    const child = spawn(
      'leo',
      ['run', action.transition, ...action.inputs],
      {
        cwd: path.resolve(repoRoot, action.program_dir),
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code, signal) => {
      resolve({
        ...action,
        mode: 'execute',
        started_at: startedAt,
        finished_at: nowIso(),
        duration_ms: Date.now() - startedMs,
        exit_code: code,
        signal,
        success: code === 0,
        stdout,
        stderr,
      });
    });

    child.on('error', (error) => {
      resolve({
        ...action,
        mode: 'execute',
        started_at: startedAt,
        finished_at: nowIso(),
        duration_ms: Date.now() - startedMs,
        exit_code: null,
        signal: null,
        success: false,
        stdout,
        stderr: `${stderr}${error.message}\n`,
      });
    });
  });
}

const files = await readJsonFiles(benchmarkDir).catch((error) => {
  if (error && error.code === 'ENOENT') {
    return [];
  }

  throw error;
});

const artifact = args.artifact
  ? sortByPath(files).find((file) => file.path === path.resolve(repoRoot, args.artifact))
  : latestOfType(files, artifactType);

if (!artifact) {
  console.error('No matching artifact found.');
  process.exit(1);
}

const actions = buildActionList(artifact);

if (actions.length === 0) {
  console.error('No sidecar actions found for the selected artifact or scenario.');
  process.exit(1);
}

const results = [];

for (const action of actions) {
  if (!execute) {
    results.push({
      ...action,
      mode: 'dry-run',
      success: null,
    });
    continue;
  }

  const result = await runLeoAction(action);
  results.push(result);

  if (!result.success && stopOnError) {
    break;
  }
}

const summary = {
  artifact_path: path.relative(repoRoot, artifact.path),
  artifact_type: artifact.data.artifact_type,
  scenario_filter: selectedScenarioId,
  mode: execute ? 'execute' : 'dry-run',
  include_close: includeClose,
  generated_at: nowIso(),
  total_actions: results.length,
  successful_actions: results.filter((item) => item.success === true).length,
  failed_actions: results.filter((item) => item.success === false).length,
  actions: results,
};

const lines = [
  '# V2.23 Sidecar Runner',
  '',
  `Artifact: \`${summary.artifact_path}\``,
  `Mode: \`${summary.mode}\``,
  `Total actions: ${summary.total_actions}`,
];

if (selectedScenarioId) {
  lines.push(`Scenario filter: \`${selectedScenarioId}\``);
}

for (const result of results) {
  lines.push('');
  lines.push(`## ${result.scenario_id} :: ${result.plan_type} :: ${result.step}`);
  lines.push(result.example_cli);

  if (execute) {
    lines.push(`success=${result.success} exit_code=${result.exit_code}`);
  }
}

process.stdout.write(`${lines.join('\n')}\n`);

if (execute || args['json-out']) {
  const jsonOut = args['json-out']
    ? path.resolve(repoRoot, args['json-out'])
    : path.resolve(
        repoRoot,
        benchmarkDir,
        'executions',
        `sidecar-exec-${timestampSlug()}.json`
      );

  await ensureDir(path.dirname(jsonOut));
  await writeJson(jsonOut, summary);
  console.log(`Wrote ${path.relative(repoRoot, jsonOut)}`);
}
