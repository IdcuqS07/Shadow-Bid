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
const DEFAULT_ADDRESS = 'aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8';

const args = parseArgs(process.argv.slice(2));
const repoRoot = repoRootFrom(import.meta.url);
const network = args.network || process.env.NETWORK || DEFAULT_NETWORK;
const endpoint = args.endpoint || process.env.ENDPOINT || DEFAULT_ENDPOINT;
const address = args.address || process.env.V223_ADDRESS || DEFAULT_ADDRESS;
const benchmarkDir = path.resolve(
  repoRoot,
  args.out || 'contracts/benchmarks/v223-private-usdcx'
);
const jsonOut = path.resolve(
  repoRoot,
  args['json-out'] || path.join(benchmarkDir, `preconditions-${timestampSlug()}.json`)
);
const markdownOut = path.resolve(
  repoRoot,
  args['md-out'] || 'docs/contracts/v2.23-usdcx-preconditions.md'
);

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

function boolValue(parsed, fallback = null) {
  if (parsed.kind === 'boolean') {
    return Boolean(parsed.boolean);
  }

  if (parsed.kind === 'null') {
    return fallback;
  }

  return fallback;
}

function roleFlags(roleNumber) {
  return {
    has_minter_role: (roleNumber & 1n) === 1n,
    has_burner_role: (roleNumber & 2n) === 2n,
    has_pause_role: (roleNumber & 4n) === 4n,
    has_admin_role: (roleNumber & 8n) === 8n,
    has_freezelist_role: (roleNumber & 16n) === 16n,
  };
}

const queries = {
  pause: runLeoQuery('test_usdcx_stablecoin.aleo', 'pause', 'true'),
  primary_root: runLeoQuery('test_usdcx_freezelist.aleo', 'freeze_list_root', '1u8'),
  fallback_root: runLeoQuery('test_usdcx_freezelist.aleo', 'freeze_list_root', '2u8'),
  block_height_window: runLeoQuery('test_usdcx_freezelist.aleo', 'block_height_window', 'true'),
  root_updated_height: runLeoQuery('test_usdcx_freezelist.aleo', 'root_updated_height', 'true'),
  address_role: runLeoQuery('test_usdcx_stablecoin.aleo', 'address_to_role', address),
  freeze_status: runLeoQuery('test_usdcx_freezelist.aleo', 'freeze_list', address),
  public_balance: runLeoQuery('test_usdcx_stablecoin.aleo', 'balances', address),
};

const parsed = Object.fromEntries(
  Object.entries(queries).map(([key, value]) => [key, parseLiteral(value.value)])
);

const roleNumber = numericValue(parsed.address_role) || 0n;
const flags = roleFlags(roleNumber);
const pauseFalse = boolValue(parsed.pause) === false;
const primaryRootPresent = parsed.primary_root.kind !== 'null';
const fallbackRootPresent = parsed.fallback_root.kind !== 'null';
const freezeStatus = boolValue(parsed.freeze_status, false);
const addressNotFrozen = freezeStatus !== true;
const publicBalance = numericValue(parsed.public_balance) || 0n;
const publicBalancePresent = publicBalance > 0n;

let fundingSourceStatus = 'unproven';
let fundingSourceNotes = [
  'No private Token record is visible from public mappings, so hidden-amount funding is still unproven.',
];

if (flags.has_minter_role) {
  fundingSourceStatus = 'mint-private-available';
  fundingSourceNotes = [
    'This address has the minter role, so a controlled `mint_private` spike is possible.',
    'That validates the rail, but it is still a privileged test path rather than a normal bidder path.',
  ];
} else if (publicBalancePresent) {
  fundingSourceStatus = 'public-balance-only';
  fundingSourceNotes = [
    'A public balance is visible for this address.',
    'The obvious public-to-private conversion path would leak the amount, so it does not satisfy the `v2.23` hidden-amount goal.',
  ];
}

const assessment = {
  can_attempt_get_credentials: primaryRootPresent,
  can_attempt_transfer_private_with_creds: pauseFalse && primaryRootPresent && addressNotFrozen,
  pause_allows_private_transfers: pauseFalse,
  primary_root_present: primaryRootPresent,
  fallback_root_present: fallbackRootPresent,
  address_not_frozen: addressNotFrozen,
  public_balance_present: publicBalancePresent,
  public_balance_literal: formatLiteral(parsed.public_balance),
  role_literal: formatLiteral(parsed.address_role),
  hidden_amount_funding_source_status: fundingSourceStatus,
  next_blocker: flags.has_minter_role
    ? 'Real private records, credentials, and proofs still need to be sourced for an end-to-end spike.'
    : 'A genuine private Token record source is still missing for this address; the visible balance today is public only.',
  ...flags,
};

const artifact = {
  artifact_type: 'usdcx-preconditions',
  generated_at: nowIso(),
  network,
  endpoint,
  address,
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
  assessment,
  notes: [
    'This snapshot only checks public contract state and public balances.',
    'It cannot prove that a usable private Token record already exists for the address.',
    ...fundingSourceNotes,
  ],
};

const markdown = `# ShadowBid V2.23 USDCx Preconditions

## Status

Generated from live \`${network}\` mapping queries against \`${endpoint}/${network}\`.

Last generated: \`${artifact.generated_at}\`

Target address: \`${address}\`

## Why This Exists

\`v2.23\` needs more than a primitive map.

Before running a real \`get_credentials -> transfer_private_with_creds\` spike, the repo needs to know whether the live stablecoin state actually permits the experiment and whether the chosen wallet has a plausible private funding source.

## Snapshot

| Query | Value | Interpretation |
| --- | --- | --- |
| \`pause[true]\` | \`${formatLiteral(parsed.pause)}\` | ${pauseFalse ? 'Private transfer finalizers are not paused.' : 'Private transfer finalizers are blocked by pause.'} |
| \`freeze_list_root[1u8]\` | \`${formatLiteral(parsed.primary_root)}\` | ${primaryRootPresent ? 'Primary freeze-list root is present for `get_credentials` and credentialed transfers.' : 'Primary freeze-list root is missing.'} |
| \`freeze_list_root[2u8]\` | \`${formatLiteral(parsed.fallback_root)}\` | ${fallbackRootPresent ? 'Fallback root is staged.' : 'No fallback root is currently staged.'} |
| \`block_height_window[true]\` | \`${formatLiteral(parsed.block_height_window)}\` | Window used when a fallback root is active. |
| \`root_updated_height[true]\` | \`${formatLiteral(parsed.root_updated_height)}\` | ${parsed.root_updated_height.kind === 'null' ? 'No staged-root update height is recorded right now.' : 'A staged-root update height exists.'} |
| \`address_to_role[address]\` | \`${formatLiteral(parsed.address_role)}\` | ${flags.has_minter_role ? 'Address can use `mint_private` for a privileged spike.' : 'Address does not have a stablecoin admin/minter role.'} |
| \`freeze_list[address]\` | \`${formatLiteral(parsed.freeze_status)}\` | ${addressNotFrozen ? 'Address is not explicitly frozen; the stablecoin finalizers treat missing entries as `false`.' : 'Address is frozen and cannot use the private rail.'} |
| \`balances[address]\` | \`${formatLiteral(parsed.public_balance)}\` | ${publicBalancePresent ? 'A public balance exists, but converting it to private would leak the amount.' : 'No public balance is visible for the address.'} |

## Assessment

- \`get_credentials\`: ${assessment.can_attempt_get_credentials ? 'ready from live contract state' : 'blocked by missing freeze-list root'}
- \`transfer_private_with_creds\`: ${assessment.can_attempt_transfer_private_with_creds ? 'ready from live contract state' : 'blocked by pause or freeze-list state'}
- Hidden-amount funding source: \`${assessment.hidden_amount_funding_source_status}\`
- Current blocker: ${assessment.next_blocker}

## Recommendation

- Keep \`transfer_private_with_creds\` as the target primitive for the next real spike.
- Do not treat a visible public balance as evidence that full hidden-amount funding is solved.
- Source a genuine private \`Token\` record first, either from a dedicated pre-seeded test address or a controlled minter-assisted experiment.

## Related Documents

- \`docs/contracts/v2.23-usdcx-private-primitives.md\`
- \`docs/contracts/v2.23-benchmark-findings.md\`
- \`docs/contracts/v2.23-phase-1-feasibility-spike.md\`
`;

await writeJson(jsonOut, artifact);
await ensureDir(path.dirname(markdownOut));
await fs.writeFile(markdownOut, `${markdown}\n`, 'utf8');

console.log(`Wrote ${path.relative(repoRoot, jsonOut)}`);
console.log(`Wrote ${path.relative(repoRoot, markdownOut)}`);
