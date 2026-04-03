import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  ensureDir,
  nowIso,
  parseArgs,
  repoRootFrom,
  timestampSlug,
  writeJson,
} from './utils.mjs';

const DEFAULT_ENDPOINT = 'https://api.explorer.provable.com/v1';
const DEFAULT_NETWORK = 'testnet';
const DEFAULT_ADDRESS = 'aleo1ecrqqyvaszpehqc967g5aau4uqt2dg3y5ardm0y5wf4hxjajzsyqm5cxke';
const SENTINEL_ADDRESS = 'aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc';

const args = parseArgs(process.argv.slice(2));
const repoRoot = repoRootFrom(import.meta.url);
const network = args.network || process.env.NETWORK || DEFAULT_NETWORK;
const endpoint = args.endpoint || process.env.ENDPOINT || DEFAULT_ENDPOINT;
const address = args.address || process.env.V223_ADDRESS || DEFAULT_ADDRESS;
const outputDir = path.resolve(
  repoRoot,
  args.out || 'contracts/benchmarks/v223-private-usdcx'
);
const jsonOut = path.resolve(
  repoRoot,
  args['json-out'] || path.join(outputDir, `get-creds-proof-${timestampSlug()}.json`)
);
const markdownOut = path.resolve(
  repoRoot,
  args['md-out'] || 'docs/contracts/v2.23-usdcx-get-creds-proof.md'
);
const helperManifestPath = path.resolve(
  repoRoot,
  'scripts/v223/snarkvm_freezelist_helper/Cargo.toml'
);
const cargoTargetDir =
  args['cargo-target-dir'] ||
  process.env.CARGO_TARGET_DIR ||
  '/tmp/shadowbid-v223-snarkvm-target';

function runLeoQuery(program, mapping, key) {
  const queryArgs = [
    'query',
    'program',
    program,
    '--network',
    network,
    '--endpoint',
    endpoint,
    '--mapping-value',
    mapping,
    key,
  ];
  const result = spawnSync('leo', queryArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  });
  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();

  if (result.status !== 0) {
    const detail = stderr || stdout || 'unknown Leo query failure';
    throw new Error(`leo ${queryArgs.join(' ')} failed: ${detail}`);
  }

  const value = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1) || null;

  return {
    program,
    mapping,
    key,
    command: `leo ${queryArgs.join(' ')}`,
    value,
    raw_stdout: stdout,
  };
}

function parseLiteral(raw) {
  if (raw === null || raw === 'null') {
    return { kind: 'null', literal: null, numeric: null };
  }

  if (raw === 'true' || raw === 'false') {
    return {
      kind: 'boolean',
      literal: raw,
      numeric: raw === 'true' ? 1 : 0,
      boolean: raw === 'true',
    };
  }

  const integerMatch = raw.match(/^(\d+)(u8|u16|u32|u64|u128|i64)$/);
  if (integerMatch) {
    return {
      kind: 'integer',
      literal: raw,
      suffix: integerMatch[2],
      numeric: BigInt(integerMatch[1]),
    };
  }

  const fieldMatch = raw.match(/^(\d+)field$/);
  if (fieldMatch) {
    return {
      kind: 'field',
      literal: raw,
      numeric: fieldMatch[1],
    };
  }

  return {
    kind: 'raw',
    literal: raw,
    numeric: null,
  };
}

function formatLiteral(parsed) {
  return parsed.literal === null ? 'null' : parsed.literal;
}

function numericValue(parsed) {
  return typeof parsed.numeric === 'bigint' ? parsed.numeric : null;
}

function toU32Literal(index) {
  return `${index}u32`;
}

function buildLeoProofLiteral(proofs) {
  const rendered = proofs.map((proof) => {
    const siblings = proof.siblings.join(', ');
    return `{ siblings: [${siblings}], leaf_index: ${proof.leaf_index}u32 }`;
  });

  return `[${rendered.join(', ')}]`;
}

function runHelper(rootLiteral, targetAddress, leaves) {
  const helperArgs = [
    'run',
    '--offline',
    '--manifest-path',
    helperManifestPath,
    '--',
    '--target',
    targetAddress,
    '--root',
    rootLiteral,
    ...leaves.flatMap((leaf) => ['--leaf', leaf]),
  ];
  const result = spawnSync('cargo', helperArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      CARGO_TARGET_DIR: cargoTargetDir,
    },
  });
  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();

  if (result.status !== 0) {
    const detail = stderr || stdout || 'unknown helper failure';
    throw new Error(`cargo ${helperArgs.join(' ')} failed: ${detail}`);
  }

  const jsonStart = stdout.indexOf('{');
  if (jsonStart === -1) {
    throw new Error(`helper did not return JSON: ${stdout}`);
  }

  return {
    command: `cargo ${helperArgs.join(' ')}`,
    raw_stdout: stdout,
    raw_stderr: stderr,
    parsed: JSON.parse(stdout.slice(jsonStart)),
  };
}

const queries = {
  primary_root: runLeoQuery('test_usdcx_freezelist.aleo', 'freeze_list_root', '1u8'),
  fallback_root: runLeoQuery('test_usdcx_freezelist.aleo', 'freeze_list_root', '2u8'),
  block_height_window: runLeoQuery('test_usdcx_freezelist.aleo', 'block_height_window', 'true'),
  root_updated_height: runLeoQuery('test_usdcx_freezelist.aleo', 'root_updated_height', 'true'),
  freeze_list_last_index: runLeoQuery('test_usdcx_freezelist.aleo', 'freeze_list_last_index', 'true'),
  freeze_status: runLeoQuery('test_usdcx_freezelist.aleo', 'freeze_list', address),
};

const parsed = Object.fromEntries(
  Object.entries(queries).map(([key, value]) => [key, parseLiteral(value.value)])
);

const lastIndexLiteral = numericValue(parsed.freeze_list_last_index);
const lastIndex = lastIndexLiteral === null ? 0 : Number(lastIndexLiteral);
const indexedLeaves = [];

for (let index = 0; index <= lastIndex; index += 1) {
  const query = runLeoQuery(
    'test_usdcx_freezelist.aleo',
    'freeze_list_index',
    toU32Literal(index)
  );
  indexedLeaves.push({
    index,
    ...query,
  });
}

const concreteLeaves = indexedLeaves
  .filter((leaf) => leaf.value !== null && leaf.value !== 'null')
  .map((leaf) => leaf.value);
const publicIndexContainsOnlySentinel =
  concreteLeaves.length === 1 && concreteLeaves[0] === SENTINEL_ADDRESS;

const helper = runHelper(queries.primary_root.value, address, concreteLeaves);
const helperResult = helper.parsed;
const sentinelHelper = concreteLeaves.includes(SENTINEL_ADDRESS)
  ? runHelper(queries.primary_root.value, address, [SENTINEL_ADDRESS])
  : null;
const sentinelHelperResult = sentinelHelper?.parsed ?? null;
const candidateProofLiteral =
  helperResult.root_matches && helperResult.verify_non_inclusion_local
    ? buildLeoProofLiteral(helperResult.proofs)
    : null;

const freezeStatusLiteral = formatLiteral(parsed.freeze_status);
const addressFrozen = freezeStatusLiteral === 'true';
const rootMatches = Boolean(helperResult.root_matches);
const proofLocallyValid = Boolean(helperResult.verify_non_inclusion_local);
const sentinelRootMatches = sentinelHelperResult ? Boolean(sentinelHelperResult.root_matches) : null;

let nextBlocker = null;
if (addressFrozen) {
  nextBlocker =
    'The target address is already frozen on-chain, so get_creds should not succeed for this wallet.';
} else if (publicIndexContainsOnlySentinel && sentinelRootMatches === false) {
  nextBlocker =
    'The public freeze_list_index snapshot currently exposes only the sentinel leaf, but hashing that snapshot still does not reproduce the live root. The active get_creds proof therefore depends on off-chain root construction or unpublished sibling fields.';
} else if (!rootMatches) {
  nextBlocker =
    'The live freeze-list root cannot be reconstructed from public freeze_list_index mappings alone; at least one off-chain or synthetic proof field is still missing.';
} else if (!proofLocallyValid) {
  nextBlocker =
    'The helper can match the root, but the derived proof still fails the stablecoin get_credentials constraints locally.';
}

const assessment = {
  address_frozen: addressFrozen,
  mapping_leaf_count: concreteLeaves.length,
  public_index_contains_only_sentinel: publicIndexContainsOnlySentinel,
  mapping_root_matches_live_root: rootMatches,
  sentinel_only_root_matches_live_root: sentinelRootMatches,
  mapping_only_proof_verifies_locally: proofLocallyValid,
  can_generate_get_creds_proof_from_public_mappings_only: rootMatches && proofLocallyValid && !addressFrozen,
  helper_insertion_case: helperResult.insertion_case,
  next_blocker:
    nextBlocker ||
    'The mapping-derived proof is locally valid and can be used as the next get_creds candidate.',
};

const artifact = {
  artifact_type: 'usdcx-get-creds-proof-analysis',
  generated_at: nowIso(),
  network,
  endpoint,
  address,
  helper_manifest_path: path.relative(repoRoot, helperManifestPath),
  cargo_target_dir: cargoTargetDir,
  queries,
  parsed_values: Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [
      key,
      {
        kind: value.kind,
        literal: formatLiteral(value),
        numeric: typeof value.numeric === 'bigint' ? value.numeric.toString() : value.numeric,
      },
    ])
  ),
  indexed_leaf_snapshot: indexedLeaves.map((leaf) => ({
    index: leaf.index,
    key: leaf.key,
    value: leaf.value,
    command: leaf.command,
  })),
  helper_result: helperResult,
  sentinel_helper_result: sentinelHelperResult,
  helper_command: helper.command,
  sentinel_helper_command: sentinelHelper?.command ?? null,
  assessment,
  leo_inputs: candidateProofLiteral
    ? {
        get_creds_proof_array: candidateProofLiteral,
        example_cli: `cd contracts/programs/shadowbid_usdcx_private_probe_v1 && leo run get_creds '${candidateProofLiteral}'`,
      }
    : null,
  notes: [
    'The helper mirrors the proof verifier inside the imported stablecoin get_credentials transition, including the 1field leaf prefix and 0field internal prefix.',
    'freeze_list_index only stores public addresses, while the proof payload itself consists of raw field siblings.',
    publicIndexContainsOnlySentinel
      ? 'The current public address index contains only the sentinel leaf, so there is no hidden second public address slot to explain the live root mismatch.'
      : 'The current public address index contains at least one non-sentinel leaf.',
    'The freezelist contract rotates freeze_list_root by accepting both the current root and the next root as public update_freeze_list inputs, which is consistent with an externally constructed tree root.',
    !rootMatches
      ? 'The root mismatch means the live proof shape still depends on data that is not recoverable from the public address index snapshot alone.'
      : 'The mapping snapshot was sufficient to reconstruct the live root.',
  ],
};

const markdown = `# ShadowBid V2.23 get_creds Proof Analysis

## Status

Generated from live \`${network}\` queries against \`${endpoint}/${network}\`.

Last generated: \`${artifact.generated_at}\`

Target address: \`${address}\`

## Snapshot

| Check | Value | Interpretation |
| --- | --- | --- |
| \`freeze_list_root[1u8]\` | \`${queries.primary_root.value}\` | Live primary root used by \`get_credentials\`. |
| \`freeze_list_root[2u8]\` | \`${queries.fallback_root.value}\` | Fallback root, if any. |
| \`freeze_list_last_index[true]\` | \`${queries.freeze_list_last_index.value}\` | Highest publicly indexed address slot. |
| \`freeze_list[address]\` | \`${queries.freeze_status.value}\` | ${addressFrozen ? 'Address is already frozen.' : 'Address is not explicitly frozen.'} |
| Public index shape | \`${publicIndexContainsOnlySentinel ? 'sentinel-only' : 'includes non-sentinel leaves'}\` | ${publicIndexContainsOnlySentinel ? 'Only the sentinel address is exposed in freeze_list_index right now.' : 'The public index exposes at least one concrete address.'} |
| Mapping-derived root | \`${helperResult.computed_root}\` | ${rootMatches ? 'Matches the live primary root.' : 'Does not match the live primary root.'} |
| Sentinel-only root | \`${sentinelHelperResult?.computed_root ?? 'not-run'}\` | ${sentinelRootMatches === null ? 'The sentinel leaf was not present in the mapping snapshot.' : sentinelRootMatches ? 'Matches the live primary root.' : 'Does not match the live primary root.'} |
| Local proof verification | \`${String(proofLocallyValid)}\` | ${proofLocallyValid ? 'The mapping-derived proof passes the stablecoin get_credentials constraints locally.' : 'The mapping-derived proof does not pass the stablecoin get_credentials constraints locally.'} |

## Indexed Leaves Queried

${indexedLeaves.map((leaf) => `- index \`${leaf.index}\`: \`${leaf.value}\``).join('\n')}

## Conclusion

${assessment.can_generate_get_creds_proof_from_public_mappings_only
    ? 'Public mappings are sufficient for this wallet right now. The helper produced a local proof candidate that matches the live root and passes the imported get_credentials checks.'
    : 'Public mappings are not sufficient to build a usable get_creds proof for this wallet right now.'}

${assessment.next_blocker}

## Helper Result

- Insertion case: \`${helperResult.insertion_case}\`
- Target field: \`${helperResult.target_field}\`
- Leaf count used by helper: \`${helperResult.leaf_count}\`

${candidateProofLiteral
    ? `## Leo Input

\`${candidateProofLiteral}\`

Example:

\`cd contracts/programs/shadowbid_usdcx_private_probe_v1 && leo run get_creds '${candidateProofLiteral}'\``
    : `## Why This Still Blocks

The imported stablecoin verifier consumes raw field siblings, not just public address leaves. Since the mapping-derived reconstruction still misses the live root, the remaining proof data must come from a wallet/vendor capability or from the issuer's off-chain proof builder.`}
`;

await ensureDir(path.dirname(markdownOut));
await fs.writeFile(markdownOut, `${markdown}\n`, 'utf8');
await writeJson(jsonOut, artifact);

console.log(`Wrote ${path.relative(repoRoot, markdownOut)}`);
console.log(`Wrote ${path.relative(repoRoot, jsonOut)}`);
