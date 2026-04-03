import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  ensureDir,
  leoRunTemplate,
  literalI64,
  literalU128,
  literalU8,
  nowIso,
  nowUnixSeconds,
  parseArgs,
  readJsonFiles,
  repoRootFrom,
  stableField,
  timestampSlug,
  writeJson,
} from './utils.mjs';

const DEFAULT_ENDPOINT = 'https://api.explorer.provable.com/v1';
const DEFAULT_NETWORK = 'testnet';
const DEFAULT_ADDRESS = 'aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8';
const STABLECOIN_PROGRAM_OWNER = 'aleo17pmtmh8t7zwh0qfj8z0cmg0rqt4rtg4t85dy5ldrst5u0c4yvufq3gl9lf';

const args = parseArgs(process.argv.slice(2));
const repoRoot = repoRootFrom(import.meta.url);
const network = args.network || process.env.NETWORK || DEFAULT_NETWORK;
const endpoint = args.endpoint || process.env.ENDPOINT || DEFAULT_ENDPOINT;
const benchmarkDir = path.resolve(
  repoRoot,
  args.out || 'contracts/benchmarks/v223-private-usdcx'
);
const markdownOut = path.resolve(
  repoRoot,
  args['md-out'] || 'docs/contracts/v2.23-usdcx-funding-paths.md'
);
const jsonOut = path.resolve(
  repoRoot,
  args['json-out'] || path.join(benchmarkDir, `funding-paths-${timestampSlug()}.json`)
);
const targetAmount = Number(args.amount || 20000);
const createdAt = nowUnixSeconds();

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

  return {
    kind: 'raw',
    literal: raw,
    numeric: null,
  };
}

function formatLiteral(parsed) {
  return parsed.literal === null ? 'null' : parsed.literal;
}

function roleFlags(value) {
  const role = typeof value === 'bigint' ? value : 0n;
  return {
    has_minter_role: (role & 1n) === 1n,
    has_burner_role: (role & 2n) === 2n,
    has_pause_role: (role & 4n) === 4n,
    has_admin_role: (role & 8n) === 8n,
    has_freezelist_role: (role & 16n) === 16n,
  };
}

function latestOfType(files, type) {
  return [...files]
    .filter((file) => file.data.artifact_type === type)
    .sort((left, right) => left.path.localeCompare(right.path))
    .at(-1);
}

function routeTemplate(transition, inputs) {
  return leoRunTemplate({
    programDir: 'contracts/programs/shadowbid_usdcx_private_probe_v1',
    transition,
    inputs,
  });
}

const files = await readJsonFiles(benchmarkDir).catch((error) => {
  if (error && error.code === 'ENOENT') {
    return [];
  }

  throw error;
});

const preconditions = latestOfType(files, 'usdcx-preconditions');
const defaultAddress = preconditions?.data?.address || DEFAULT_ADDRESS;

const candidates = [
  {
    label: 'platform_wallet',
    address: defaultAddress,
    source: 'Current ShadowBid platform wallet and latest precondition target.',
  },
  {
    label: 'stablecoin_program_owner',
    address: STABLECOIN_PROGRAM_OWNER,
    source: 'Visible in imported stablecoin/freezelist initialize and constructor assertions.',
  },
];

const candidateSnapshots = candidates.map((candidate) => {
  const stablecoinRole = parseLiteral(
    runLeoQuery('test_usdcx_stablecoin.aleo', 'address_to_role', candidate.address).value
  );
  const freezelistRole = parseLiteral(
    runLeoQuery('test_usdcx_freezelist.aleo', 'address_to_role', candidate.address).value
  );
  const publicBalance = parseLiteral(
    runLeoQuery('test_usdcx_stablecoin.aleo', 'balances', candidate.address).value
  );
  const freezeStatus = parseLiteral(
    runLeoQuery('test_usdcx_freezelist.aleo', 'freeze_list', candidate.address).value
  );
  const flags = roleFlags(stablecoinRole.numeric);

  return {
    ...candidate,
    stablecoin_role: formatLiteral(stablecoinRole),
    freezelist_role: formatLiteral(freezelistRole),
    public_balance: formatLiteral(publicBalance),
    freeze_status: formatLiteral(freezeStatus),
    ...flags,
  };
});

const minterCandidates = candidateSnapshots.filter((candidate) => candidate.has_minter_role);
const publicBalanceCandidate = candidateSnapshots.find(
  (candidate) => candidate.public_balance !== 'null' && candidate.public_balance !== '0u128'
);
const preconditionAssessment = preconditions?.data?.assessment || {};
const amountLiteral = literalU128(targetAmount);

const routeSeeds = {
  preseeded: stableField(`v223:funding:preseeded:${defaultAddress}:${targetAmount}`),
  minter: stableField(`v223:funding:minter:${defaultAddress}:${targetAmount}`),
  publicToPrivate: stableField(`v223:funding:public-to-private:${defaultAddress}:${targetAmount}`),
};

const routes = [
  {
    route_id: 'preseeded-private-record',
    status:
      preconditionAssessment.can_attempt_transfer_private_with_creds
        ? 'recommended-next-spike'
        : 'blocked-by-live-state',
    hidden_amount: true,
    funding_source: 'existing private Token.record supplied out of band',
    reason:
      preconditionAssessment.can_attempt_transfer_private_with_creds
        ? 'This is the cleanest honest path because it avoids public amount leakage and does not rely on privileged minting.'
        : 'Live stablecoin state does not currently allow the credentialed private transfer path.',
    blocker:
      'A usable private Token.record plus Merkle proofs and Credentials record still need to be sourced.',
    templates: {
      register: routeTemplate('register_probe_target', [
        routeSeeds.preseeded,
        literalU8(1),
        'true',
        'true',
        'false',
        amountLiteral,
        literalI64(createdAt),
      ]),
      get_creds: routeTemplate('get_creds', ['<proof_array_private>']),
      xfer_with_creds: routeTemplate('xfer_with_creds', [
        '<auction_custody_address_private>',
        amountLiteral,
        '<private_token_record>',
        '<credentials_record>',
      ]),
    },
  },
  {
    route_id: 'minter-assisted-private-record',
    status: minterCandidates.length > 0 ? 'candidate' : 'blocked-no-known-minter',
    hidden_amount: true,
    funding_source: 'controlled mint_private seeding before credentialed transfer',
    reason:
      minterCandidates.length > 0
        ? `Known minter candidate(s): ${minterCandidates.map((candidate) => candidate.address).join(', ')}`
        : 'No repo-known address currently shows the stablecoin minter role on testnet.',
    blocker:
      minterCandidates.length > 0
        ? 'Still requires a safe test procedure and real private proofs/credentials afterward.'
        : 'A real minter address must be identified before this privileged spike can be attempted.',
    templates: {
      register: routeTemplate('register_probe_target', [
        routeSeeds.minter,
        literalU8(5),
        'false',
        'false',
        'false',
        amountLiteral,
        literalI64(createdAt),
      ]),
      mint_priv: routeTemplate('mint_priv', [
        '<bidder_private_address>',
        amountLiteral,
      ]),
      get_creds: routeTemplate('get_creds', ['<proof_array_private>']),
      xfer_with_creds: routeTemplate('xfer_with_creds', [
        '<auction_custody_address_private>',
        amountLiteral,
        '<private_token_record>',
        '<credentials_record>',
      ]),
    },
  },
  {
    route_id: 'public-to-private-control',
    status: publicBalanceCandidate ? 'available-but-not-private' : 'pending-balance',
    hidden_amount: false,
    funding_source: 'transfer_public_to_private control path',
    reason:
      publicBalanceCandidate
        ? `A public balance is visible for ${publicBalanceCandidate.address}, so this control path can likely be exercised.`
        : 'No repo-known candidate currently shows a public balance to use in the control path.',
    blocker:
      'This route leaks the amount publicly by design and must never be used as evidence of sealed-bid privacy.',
    templates: {
      register: routeTemplate('register_probe_target', [
        routeSeeds.publicToPrivate,
        literalU8(4),
        'false',
        'false',
        'true',
        amountLiteral,
        literalI64(createdAt),
      ]),
      xfer_pub_to_priv: routeTemplate('xfer_pub_to_priv', [
        '<bidder_private_address>',
        amountLiteral,
      ]),
    },
  },
];

const artifact = {
  artifact_type: 'usdcx-funding-paths',
  generated_at: nowIso(),
  network,
  endpoint,
  target_address: defaultAddress,
  target_amount: amountLiteral,
  latest_preconditions_artifact: preconditions ? path.relative(repoRoot, preconditions.path) : null,
  candidate_snapshots: candidateSnapshots,
  routes,
  recommendation: {
    route_id: 'preseeded-private-record',
    reason:
      'Use a genuinely private Token.record as the next spike input. Treat minter-assisted and public-to-private routes only as controlled support experiments.',
  },
};

const markdown = `# ShadowBid V2.23 USDCx Funding Paths

## Status

Generated from the latest live precondition snapshot plus candidate role queries on \`${network}\`.

Last generated: \`${artifact.generated_at}\`

Primary target wallet: \`${defaultAddress}\`

Target amount for templates: \`${amountLiteral}\`

## Why This Exists

The current blocker for \`v2.23\` is no longer primitive discovery.

The blocker is choosing a funding-source path that can produce a real private \`Token.record\` without accidentally treating a leaky or privileged path as proof of sealed-bid privacy.

## Candidate Addresses

| Candidate | Address | Stablecoin role | Freezelist role | Public balance | Freeze status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
${candidateSnapshots.map((candidate) => `| ${candidate.label} | \`${candidate.address}\` | \`${candidate.stablecoin_role}\` | \`${candidate.freezelist_role}\` | \`${candidate.public_balance}\` | \`${candidate.freeze_status}\` | ${candidate.source} |`).join('\n')}

## Route Matrix

| Route | Status | Hidden amount | Funding source | Why it matters | Current blocker |
| --- | --- | --- | --- | --- | --- |
${routes.map((route) => `| ${route.route_id} | \`${route.status}\` | \`${route.hidden_amount}\` | ${route.funding_source} | ${route.reason} | ${route.blocker} |`).join('\n')}

## Recommended Route

- Recommended next spike: \`${artifact.recommendation.route_id}\`
- Reason: ${artifact.recommendation.reason}
- Guardrail: do not promote \`mint_private\` or \`transfer_public_to_private\` as proof that \`v2.23\` solved hidden-amount funding for normal bidders

## Command Templates

### preseeded-private-record

- Register probe:
  \`${routes[0].templates.register.example_cli}\`
- Obtain credentials:
  \`${routes[0].templates.get_creds.example_cli}\`
- Transfer privately with credentials:
  \`${routes[0].templates.xfer_with_creds.example_cli}\`

### minter-assisted-private-record

- Register probe:
  \`${routes[1].templates.register.example_cli}\`
- Mint a private record:
  \`${routes[1].templates.mint_priv.example_cli}\`
- Obtain credentials:
  \`${routes[1].templates.get_creds.example_cli}\`
- Transfer privately with credentials:
  \`${routes[1].templates.xfer_with_creds.example_cli}\`

### public-to-private-control

- Register probe:
  \`${routes[2].templates.register.example_cli}\`
- Convert public balance into a private record:
  \`${routes[2].templates.xfer_pub_to_priv.example_cli}\`

## Recommendation For Phase 1

- Use the preseeded private-record route as the honest target proof.
- Keep the minter-assisted route only as a controlled support experiment if a real minter becomes known.
- Use the public-to-private route only as a negative control to demonstrate why a visible public balance is not good enough for privacy claims.

## Related Documents

- \`docs/contracts/v2.23-usdcx-preconditions.md\`
- \`docs/contracts/v2.23-usdcx-private-primitives.md\`
- \`docs/contracts/v2.23-benchmark-findings.md\`
- \`docs/contracts/v2.23-custody-decision.md\`
`;

await writeJson(jsonOut, artifact);
await ensureDir(path.dirname(markdownOut));
await fs.writeFile(markdownOut, `${markdown}\n`, 'utf8');

console.log(`Wrote ${path.relative(repoRoot, jsonOut)}`);
console.log(`Wrote ${path.relative(repoRoot, markdownOut)}`);
