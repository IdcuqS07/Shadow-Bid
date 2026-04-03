import path from 'node:path';
import { parseArgs, readJsonFiles, repoRootFrom } from './utils.mjs';

const args = parseArgs(process.argv.slice(2));
const repoRoot = repoRootFrom(import.meta.url);
const benchmarkDir = path.resolve(
  repoRoot,
  args.out || 'contracts/benchmarks/v223-private-usdcx'
);
const artifactType = args.type || 'benchmark-suite';
const explicitArtifact = args.artifact
  ? path.resolve(repoRoot, args.artifact)
  : null;

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

function renderCommandBlock(title, templates) {
  const lines = [`## ${title}`];

  for (const [name, template] of Object.entries(templates)) {
    lines.push('');
    lines.push(`### ${name}`);
    lines.push(template.example_cli);
  }

  return lines.join('\n');
}

const files = await readJsonFiles(benchmarkDir).catch((error) => {
  if (error && error.code === 'ENOENT') {
    return [];
  }

  throw error;
});

let artifact;

if (explicitArtifact) {
  artifact = sortByPath(files).find((file) => file.path === explicitArtifact);
} else {
  artifact = latestOfType(files, artifactType);
}

if (!artifact) {
  console.error('No matching artifact found.');
  process.exit(1);
}

const lines = [
  '# V2.23 Sidecar Commands',
  '',
  `Artifact: \`${path.relative(repoRoot, artifact.path)}\``,
  `Artifact type: \`${artifact.data.artifact_type}\``,
];

if (artifact.data.artifact_type === 'private-usdcx-spike') {
  lines.push('');
  lines.push(`Scenario: \`${artifact.data.scenario}\``);
  lines.push('');
  lines.push(renderCommandBlock('Record Plan', artifact.data.sidecar_plans.record_plan.command_templates));
  lines.push('');
  lines.push(renderCommandBlock('Credential Batch', artifact.data.sidecar_plans.credential_batch.command_templates));
} else {
  for (const scenario of artifact.data.scenarios || []) {
    lines.push('');
    lines.push(`# Scenario: ${scenario.id}`);
    lines.push('');
    lines.push(renderCommandBlock('Record Plan', scenario.sidecar_plans.record_plan.command_templates));
    lines.push('');
    lines.push(renderCommandBlock('Credential Batch', scenario.sidecar_plans.credential_batch.command_templates));
  }
}

process.stdout.write(`${lines.join('\n')}\n`);
