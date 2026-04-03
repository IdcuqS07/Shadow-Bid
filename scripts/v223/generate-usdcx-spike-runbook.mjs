import fs from 'node:fs/promises';
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
  writeJson,
} from './utils.mjs';

const DEFAULT_SENDER = 'aleo1ecrqqyvaszpehqc967g5aau4uqt2dg3y5ardm0y5wf4hxjajzsyqm5cxke';
const DEFAULT_RECIPIENT = 'aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8';
const DEFAULT_BOOTSTRAP_TX = 'at1yez8a5zetyfzjf0pfh43zef0zjndk4hjwa9z32mza8t4q6qj8s8sz86uj6';

const args = parseArgs(process.argv.slice(2));
const repoRoot = repoRootFrom(import.meta.url);
const sender = args.sender || DEFAULT_SENDER;
const recipient = args.recipient || DEFAULT_RECIPIENT;
const bootstrapTxId = args['bootstrap-tx'] || DEFAULT_BOOTSTRAP_TX;
const amount = Number(args.amount || 20000);
const benchmarkDir = path.resolve(
  repoRoot,
  args.out || 'contracts/benchmarks/v223-private-usdcx'
);
const markdownOut = path.resolve(
  repoRoot,
  args['md-out'] || 'docs/contracts/v2.23-usdcx-spike-runbook.md'
);
const jsonOut = path.resolve(
  repoRoot,
  args['json-out'] || 'contracts/benchmarks/v223-private-usdcx/spike-runbook.json'
);
const createdAt = nowUnixSeconds();
const closedAt = createdAt + 3600;
const amountLiteral = literalU128(amount);
const probeId = stableField(`v223:runbook:${sender}:${recipient}:${amount}:${bootstrapTxId}`);

const registerTemplate = leoRunTemplate({
  programDir: 'contracts/programs/shadowbid_usdcx_private_probe_v1',
  transition: 'register_probe_target',
  inputs: [
    probeId,
    literalU8(1),
    'true',
    'true',
    'false',
    amountLiteral,
    literalI64(createdAt),
  ],
});

const getCredsTemplate = leoRunTemplate({
  programDir: 'contracts/programs/shadowbid_usdcx_private_probe_v1',
  transition: 'get_creds',
  inputs: ['<proof_array_private>'],
});

const xferTemplate = leoRunTemplate({
  programDir: 'contracts/programs/shadowbid_usdcx_private_probe_v1',
  transition: 'xfer_with_creds',
  inputs: [
    recipient,
    amountLiteral,
    '<private_token_record>',
    '<credentials_record>',
  ],
});

const closeTemplate = leoRunTemplate({
  programDir: 'contracts/programs/shadowbid_usdcx_private_probe_v1',
  transition: 'close_probe_target',
  inputs: [
    probeId,
    literalI64(closedAt),
  ],
});

const artifact = {
  artifact_type: 'usdcx-spike-runbook',
  generated_at: nowIso(),
  sender_wallet: sender,
  recipient_wallet: recipient,
  target_amount: amountLiteral,
  bootstrap_tx_id: bootstrapTxId,
  bootstrap_tx_url: `https://testnet.explorer.provable.com/transaction/${bootstrapTxId}`,
  probe_id: probeId,
  route: 'preseeded-private-record',
  assumptions: [
    'The sender wallet still shows an unspent private USDCx record sourced from the bootstrap transaction.',
    'The bootstrap transaction created a private record via transfer_public_to_private, so it is valid as a rail bootstrap but not as proof of full hidden-amount funding for normal users.',
    'The recipient wallet is a temporary rail-validation sink only, not the final custody model.',
  ],
  steps: [
    {
      step: 'confirm-private-record',
      description: 'Open the wallet UI and confirm the sender still shows 4.5 USDCx Private as spendable.',
      blocker_if_false: 'Stop here and do not attempt get_creds or xfer_with_creds.',
    },
    {
      step: 'register-probe',
      description: 'Register a probe target for the private transfer-with-credentials path.',
      command: registerTemplate,
    },
    {
      step: 'prepare-proofs',
      description: 'Collect the private Token.record plus the Merkle proof array required by get_creds.',
      command: getCredsTemplate,
    },
    {
      step: 'private-transfer',
      description: 'Send 0.02 USDCx privately to the recipient wallet using the private record and credentials record.',
      command: xferTemplate,
    },
    {
      step: 'leak-check',
      description: 'Inspect the resulting transaction and confirm the transfer amount does not appear as a public input or public mapping delta.',
      checks: [
        'No public 20000u128 input should appear in the transfer_private_with_creds transition.',
        'Public balances mapping for sender and recipient should remain unrelated to the private transfer amount.',
        'Record the tx id and compare explorer-visible fields with the bootstrap transfer_public_to_private transaction.',
      ],
    },
    {
      step: 'close-probe',
      description: 'Close the probe metadata after the experiment is recorded.',
      command: closeTemplate,
    },
  ],
  references: [
    'docs/contracts/v2.23-usdcx-preconditions-candidate.md',
    'docs/contracts/v2.23-usdcx-funding-paths.md',
    'docs/contracts/v2.23-benchmark-findings.md',
  ],
};

const markdown = `# ShadowBid V2.23 USDCx Spike Runbook

## Status

Generated for the current best bidder-test candidate wallet.

Last generated: \`${artifact.generated_at}\`

## Scope

This runbook is for a narrow rail-validation spike only.

It does not prove final escrow custody. It only tests whether the repo can drive \`get_creds -> xfer_with_creds\` from a wallet that already appears to have a private \`USDCx\` record available.

## Wallets

- Sender wallet: \`${sender}\`
- Recipient wallet: \`${recipient}\`
- Target amount: \`${amountLiteral}\` (\`0.02 USDCx\`)
- Bootstrap tx: [\`${bootstrapTxId}\`](https://testnet.explorer.provable.com/transaction/${bootstrapTxId})

## Why This Wallet

- The sender wallet has a known bootstrap transaction that called \`transfer_public_to_private\` for \`4500000u128\`.
- The sender wallet also shows a public balance of \`4500000u128\` in the latest candidate precondition snapshot.
- If the wallet UI still shows \`4.5 USDCx Private\`, this is currently the strongest practical candidate for the next private rail test.

## Assumptions

- The sender wallet still holds an unspent private \`Token.record\`.
- The recipient wallet is only a temporary sink for rail validation.
- This test should be described as \`private transfer rail validation\`, not \`full privacy proven\`.

## Steps

1. Confirm in the wallet UI that the sender still shows \`4.5 USDCx Private\` as spendable.
2. Register the probe target:
   \`${registerTemplate.example_cli}\`
3. Prepare the proof array and request credentials:
   \`${getCredsTemplate.example_cli}\`
4. Transfer privately with credentials:
   \`${xferTemplate.example_cli}\`
5. Record the tx id and inspect the explorer/API output for public amount leakage.
6. Close the probe metadata:
   \`${closeTemplate.example_cli}\`

## Leak Check Checklist

- The private transfer transaction should not expose \`${amountLiteral}\` as a public input.
- The transaction should not resemble the bootstrap \`transfer_public_to_private\` shape, which exposed \`4500000u128\` publicly.
- Public balance mappings for sender and recipient should not become the evidence source for the private transfer amount.

## Go Or No-Go

- Go if the sender wallet still shows the private balance and can surface the private record/proof inputs.
- No-go if the private record is already spent, hidden by wallet limitations, or cannot provide the proof array needed by \`get_creds\`.

## Related Documents

- \`docs/contracts/v2.23-usdcx-preconditions-candidate.md\`
- \`docs/contracts/v2.23-usdcx-funding-paths.md\`
- \`docs/contracts/v2.23-benchmark-findings.md\`
`;

await ensureDir(path.dirname(markdownOut));
await fs.writeFile(markdownOut, `${markdown}\n`, 'utf8');
await writeJson(jsonOut, artifact);

console.log(`Wrote ${path.relative(repoRoot, markdownOut)}`);
console.log(`Wrote ${path.relative(repoRoot, jsonOut)}`);
