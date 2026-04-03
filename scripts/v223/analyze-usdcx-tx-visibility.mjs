import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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

const args = parseArgs(process.argv.slice(2));
const repoRoot = repoRootFrom(import.meta.url);
const endpoint = args.endpoint || process.env.ENDPOINT || DEFAULT_ENDPOINT;
const network = args.network || process.env.NETWORK || DEFAULT_NETWORK;
const txId = args.tx;
const compareTxId = args['compare-tx'];
const expectedAmount = args['expected-amount'] || null;
const outDir = path.resolve(
  repoRoot,
  args.out || 'contracts/benchmarks/v223-private-usdcx'
);

if (!txId) {
  console.error('Missing required --tx <transaction_id>');
  process.exit(1);
}

const defaultJsonOut = path.join(outDir, `visibility-${txId}.json`);
const defaultMdOut = path.join(outDir, `visibility-${txId}.md`);
const jsonOut = path.resolve(repoRoot, args['json-out'] || defaultJsonOut);
const markdownOut = path.resolve(repoRoot, args['md-out'] || defaultMdOut);

function fetchTransaction(transactionId) {
  const url = `${endpoint}/${network}/transaction/${transactionId}`;
  const raw = execFileSync('curl', ['-fsS', url], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  });

  return JSON.parse(raw);
}

function publicInputsFor(transition) {
  return (transition.inputs || []).filter((input) => input.type === 'public');
}

function publicU128InputsFor(transition) {
  return publicInputsFor(transition).filter((input) => /^\d+u128$/.test(input.value || ''));
}

function summarizeTransition(transition, expectedAmountLiteral) {
  const publicInputs = publicInputsFor(transition);
  const publicU128Inputs = publicU128InputsFor(transition);
  const stablecoinTransition = transition.program === 'test_usdcx_stablecoin.aleo';
  const amountLeakFunctions = new Set([
    'transfer_public',
    'transfer_public_as_signer',
    'transfer_public_to_private',
    'transfer_from_public_to_private',
    'transfer_private_to_public',
    'mint_private',
  ]);
  const hiddenAmountFunctions = new Set([
    'get_credentials',
    'transfer_private',
    'transfer_private_with_creds',
  ]);

  const exposesPublicAmount =
    stablecoinTransition &&
    (amountLeakFunctions.has(transition.function) || publicU128Inputs.length > 0);
  const hiddenAmountCandidate =
    stablecoinTransition &&
    hiddenAmountFunctions.has(transition.function) &&
    publicU128Inputs.length === 0;
  const exactExpectedAmountExposed = Boolean(
    expectedAmountLiteral &&
      publicInputs.some((input) => input.value === expectedAmountLiteral)
  );

  return {
    id: transition.id,
    program: transition.program,
    function: transition.function,
    public_inputs: publicInputs.map((input) => ({
      type: input.type,
      value: input.value,
    })),
    public_u128_inputs: publicU128Inputs.map((input) => input.value),
    output_types: (transition.outputs || []).map((output) => output.type),
    exposes_public_amount: exposesPublicAmount,
    hidden_amount_candidate: hiddenAmountCandidate,
    exact_expected_amount_exposed: exactExpectedAmountExposed,
  };
}

function summarizeTransaction(transactionId, payload, expectedAmountLiteral) {
  const transitions = payload.execution?.transitions || [];
  const summaries = transitions.map((transition) =>
    summarizeTransition(transition, expectedAmountLiteral)
  );
  const stablecoinTransitions = summaries.filter(
    (summary) => summary.program === 'test_usdcx_stablecoin.aleo'
  );
  const leakDetected = stablecoinTransitions.some(
    (summary) => summary.exposes_public_amount
  );
  const hiddenAmountCandidate = stablecoinTransitions.some(
    (summary) => summary.hidden_amount_candidate
  );
  const exactAmountExposed = stablecoinTransitions.some(
    (summary) => summary.exact_expected_amount_exposed
  );

  let verdict = 'no-stablecoin-transition';
  if (leakDetected) {
    verdict = 'public-amount-visible';
  } else if (hiddenAmountCandidate) {
    verdict = 'hidden-amount-compatible';
  }

  return {
    tx_id: transactionId,
    type: payload.type,
    stablecoin_transition_count: stablecoinTransitions.length,
    transition_summaries: summaries,
    stablecoin_transitions: stablecoinTransitions,
    leak_detected: leakDetected,
    hidden_amount_candidate: hiddenAmountCandidate,
    exact_expected_amount_exposed: exactAmountExposed,
    verdict,
  };
}

function comparisonNotes(primary, secondary) {
  if (!secondary) {
    return [];
  }

  const notes = [];

  if (primary.verdict === secondary.verdict) {
    notes.push('Both transactions currently produce the same visibility verdict.');
  } else {
    notes.push(
      `Visibility verdict changed from \`${secondary.verdict}\` to \`${primary.verdict}\`.`
    );
  }

  if (secondary.leak_detected && !primary.leak_detected) {
    notes.push('The primary transaction improves on the comparison transaction by avoiding public amount exposure.');
  }

  if (!secondary.hidden_amount_candidate && primary.hidden_amount_candidate) {
    notes.push('The primary transaction reaches a hidden-amount-compatible function shape that the comparison transaction did not.');
  }

  return notes;
}

const expectedAmountLiteral = expectedAmount ? `${expectedAmount}u128` : null;
const primaryPayload = fetchTransaction(txId);
const primarySummary = summarizeTransaction(txId, primaryPayload, expectedAmountLiteral);

let compareSummary = null;
if (compareTxId) {
  const comparePayload = fetchTransaction(compareTxId);
  compareSummary = summarizeTransaction(compareTxId, comparePayload, expectedAmountLiteral);
}

const artifact = {
  artifact_type: 'usdcx-visibility',
  generated_at: nowIso(),
  endpoint,
  network,
  expected_amount_literal: expectedAmountLiteral,
  primary: primarySummary,
  comparison: compareSummary,
  comparison_notes: comparisonNotes(primarySummary, compareSummary),
};

function transitionRow(summary) {
  return `| \`${summary.program}/${summary.function}\` | \`${summary.public_u128_inputs.join(', ') || 'none'}\` | \`${summary.exposes_public_amount}\` | \`${summary.hidden_amount_candidate}\` | \`${summary.output_types.join(', ') || 'none'}\` |`;
}

const markdown = `# ShadowBid V2.23 USDCx Visibility Report

## Status

Generated from the Provable transaction API on \`${network}\`.

Last generated: \`${artifact.generated_at}\`

## Primary Transaction

- Tx id: \`${primarySummary.tx_id}\`
- Verdict: \`${primarySummary.verdict}\`
- Stablecoin transition count: ${primarySummary.stablecoin_transition_count}
- Leak detected: \`${primarySummary.leak_detected}\`
- Hidden-amount-compatible shape: \`${primarySummary.hidden_amount_candidate}\`
- Exact expected amount exposed: \`${primarySummary.exact_expected_amount_exposed}\`

## Stablecoin Transition Matrix

| Transition | Public u128 inputs | Exposes public amount | Hidden-amount candidate | Output types |
| --- | --- | --- | --- | --- |
${primarySummary.stablecoin_transitions.map(transitionRow).join('\n') || '| none | none | `false` | `false` | none |'}

## Interpretation

${primarySummary.verdict === 'public-amount-visible'
  ? '- This transaction visibly exposes amount data through the public path and should be treated as a leaky control or bootstrap transaction.'
  : primarySummary.verdict === 'hidden-amount-compatible'
    ? '- This transaction has the right function shape for a hidden-amount transfer and does not expose a public u128 amount in the stablecoin transition.'
    : '- No stablecoin transition was detected, so this transaction is not useful for the USDCx privacy check.'}

${expectedAmountLiteral
  ? `- Expected amount checked: \`${expectedAmountLiteral}\``
  : '- No expected amount literal was provided for exact-match checking.'}

## Comparison

${compareSummary
  ? `- Comparison tx id: \`${compareSummary.tx_id}\`
- Comparison verdict: \`${compareSummary.verdict}\`
${artifact.comparison_notes.map((note) => `- ${note}`).join('\n') || '- No comparison notes.'}`
  : '- No comparison transaction supplied.'}
`;

await writeJson(jsonOut, artifact);
await ensureDir(path.dirname(markdownOut));
await fs.writeFile(markdownOut, `${markdown}\n`, 'utf8');

console.log(`Wrote ${path.relative(repoRoot, jsonOut)}`);
console.log(`Wrote ${path.relative(repoRoot, markdownOut)}`);
