import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir, nowIso, parseArgs, repoRootFrom, writeJson } from './utils.mjs';

const args = parseArgs(process.argv.slice(2));
const repoRoot = repoRootFrom(import.meta.url);
const importPath = path.resolve(
  repoRoot,
  args.input || 'contracts/build/imports/test_usdcx_stablecoin.aleo'
);
const markdownOut = path.resolve(
  repoRoot,
  args['md-out'] || 'docs/contracts/v2.23-usdcx-private-primitives.md'
);
const jsonOut = path.resolve(
  repoRoot,
  args['json-out'] || 'contracts/benchmarks/v223-private-usdcx/private-primitives.json'
);

const source = await fs.readFile(importPath, 'utf8');
const lines = source.split('\n');

function extractBlock(header) {
  const start = lines.findIndex((line) => line.trim() === header);

  if (start === -1) {
    return null;
  }

  const block = [lines[start]];

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (
      line.startsWith('record ') ||
      line.startsWith('struct ') ||
      line.startsWith('mapping ') ||
      line.startsWith('function ') ||
      line.startsWith('finalize ') ||
      line.startsWith('constructor:')
    ) {
      break;
    }

    if (line.trim() === '') {
      break;
    }

    block.push(line);
  }

  return block;
}

function extractSignature(functionName) {
  const block = extractBlock(`function ${functionName}:`);

  if (!block) {
    return null;
  }

  return {
    function_name: functionName,
    inputs: block
      .filter((line) => line.trim().startsWith('input '))
      .map((line) => line.trim().replace(/^input /, '').replace(/;$/, '')),
    outputs: block
      .filter((line) => line.trim().startsWith('output '))
      .map((line) => line.trim().replace(/^output /, '').replace(/;$/, '')),
  };
}

const targets = [
  {
    function_name: 'get_credentials',
    classification: 'private-credentials',
    hidden_amount_path: true,
    leaks_public_amount: false,
    notes: [
      'Produces a Credentials record tied to the current freeze-list root.',
      'Requires private Merkle proofs as input.',
      'Needed before using transfer_private_with_creds.',
    ],
  },
  {
    function_name: 'mint_private',
    classification: 'private-seeding',
    hidden_amount_path: true,
    leaks_public_amount: false,
    notes: [
      'Useful for controlled local/test seeding only.',
      'Requires a minter role in the stablecoin program.',
      'Not a user-facing auction funding primitive.',
    ],
  },
  {
    function_name: 'transfer_public_to_private',
    classification: 'public-to-private',
    hidden_amount_path: false,
    leaks_public_amount: true,
    notes: [
      'Creates a private Token record from a public transfer.',
      'Amount is public at transition time, so it does not satisfy hidden-amount bidding.',
    ],
  },
  {
    function_name: 'transfer_private',
    classification: 'private-transfer',
    hidden_amount_path: true,
    leaks_public_amount: false,
    notes: [
      'Moves a private Token record using Merkle proofs.',
      'Candidate primitive when credentials are not required or not refreshed.',
    ],
  },
  {
    function_name: 'transfer_private_to_public',
    classification: 'private-to-public',
    hidden_amount_path: false,
    leaks_public_amount: true,
    notes: [
      'Useful as an exit rail or fallback, not as the hidden-amount commit path.',
      'Public recipient and public amount leak the transfer amount by design.',
    ],
  },
  {
    function_name: 'transfer_private_with_creds',
    classification: 'private-transfer-with-creds',
    hidden_amount_path: true,
    leaks_public_amount: false,
    notes: [
      'Strongest candidate primitive for a private USDCx bid funding rail.',
      'Consumes a private Token record and a Credentials record.',
      'Returns change, recipient Token, refreshed Credentials, and a ComplianceRecord.',
    ],
  },
];

const records = [
  'record Token:',
  'record ComplianceRecord:',
  'record Credentials:',
  'struct MerkleProof:',
]
  .map((header) => extractBlock(header))
  .filter(Boolean)
  .map((block) => block.join('\n'));

const functions = targets
  .map((target) => ({
    ...target,
    signature: extractSignature(target.function_name),
  }))
  .filter((target) => target.signature);

const artifact = {
  generated_at: nowIso(),
  source_file: path.relative(repoRoot, importPath),
  records,
  functions,
  discovery_notes: [
    'The imported stablecoin program exposes a real private USDCx rail.',
    'The recommended hidden-amount path is get_credentials -> transfer_private_with_creds.',
    'Public/private conversion helpers exist, but public amount paths are not suitable for sealed-bid privacy.',
    'The local probe wrapper now compiles as shadowbid_usdcx_probe_v1.aleo, but real execution still needs genuine proofs, credentials, and private Token records.',
  ],
};

const markdown = `# ShadowBid V2.23 USDCx Private Primitives

## Status

Generated from the local imported stablecoin instructions at \`${path.relative(repoRoot, importPath)}\`.

Last generated: \`${artifact.generated_at}\`

## Why This Exists

\`v2.23\` needs a private \`USDCx\` funding rail that avoids public amount leakage.

This document captures the concrete primitives already available in the imported \`test_usdcx_stablecoin.aleo\` program so the team can design the spike around real rails instead of assumptions.

## Key Discovery

The local import already exposes the primitives we need to explore a hidden-amount rail:

- \`get_credentials\`
- \`transfer_private\`
- \`transfer_private_with_creds\`
- \`transfer_private_to_public\`

The recommended hidden-amount path is:

1. obtain a \`Credentials\` record with \`get_credentials\`
2. move a private \`Token\` record with \`transfer_private_with_creds\`
3. avoid \`transfer_public_to_private\` and \`transfer_private_to_public\` for the commit path because they expose the amount publicly

## Record Types

\`\`\`text
${records.join('\n\n')}
\`\`\`

## Function Map

${functions.map((fn) => `### ${fn.function_name}

- Classification: \`${fn.classification}\`
- Hidden-amount candidate: \`${fn.hidden_amount_path}\`
- Public amount leak: \`${fn.leaks_public_amount}\`
- Inputs:
${fn.signature.inputs.map((input) => `  - ${input}`).join('\n')}
- Outputs:
${fn.signature.outputs.map((output) => `  - ${output}`).join('\n')}
- Notes:
${fn.notes.map((note) => `  - ${note}`).join('\n')}
`).join('\n')}

## Current Integration State

The local probe wrapper now compiles with the shortened program id \`shadowbid_usdcx_probe_v1.aleo\`.

Practical implication:

- the private rail is present and callable from a local probe package
- the next blocker is no longer parser visibility
- the next blocker is sourcing real private \`Token\` records, \`Credentials\` records, and Merkle proofs for an end-to-end spike

## Recommended Next Step

Use \`transfer_private_with_creds\` as the primary target for the next real funding spike, treat \`get_credentials\` as the prerequisite setup step, and validate live preconditions before assuming a hidden-amount funding source exists.
`;

await ensureDir(path.dirname(markdownOut));
await fs.writeFile(markdownOut, `${markdown}\n`, 'utf8');
await writeJson(jsonOut, artifact);

console.log(`Wrote ${path.relative(repoRoot, markdownOut)}`);
console.log(`Wrote ${path.relative(repoRoot, jsonOut)}`);
