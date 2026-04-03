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
const scenario = args.scenario || 'private-usdcx-funding';
const createdAt = nowUnixSeconds();
const artifactName = `spike-${timestampSlug()}.json`;
const artifactPath = path.join(outputDir, artifactName);
const suiteName = args.suite || 'shadowbid-v223-phase-1';
const targetValue = Number(args['target-value'] || 20000);
const expectedOutputs = Number(args['expected-outputs'] || 2);
const expectedCredentials = Number(args['expected-credentials'] || 1);
const seedBase = `${suiteName}:${scenario}`;
const recordPlanId = stableField(`${seedBase}:record-plan`);
const credentialBatchId = stableField(`${seedBase}:credential-batch`);
const denominationRoot = stableField(`${seedBase}:denominations`);
const purposeRoot = stableField(`${seedBase}:purpose`);
const policyRoot = stableField(`${seedBase}:policy`);
const benchmarkRoot = stableField(`${seedBase}:benchmark`);

const artifact = {
  artifact_type: 'private-usdcx-spike',
  artifact_version: 2,
  generated_at: nowIso(),
  scenario,
  status: 'scaffolded',
  goal:
    'Prove a private USDCx funding path that does not leak bid amount through the public transfer path.',
  references: [
    'docs/contracts/v2.23-phase-1-feasibility-spike.md',
    'docs/contracts/v2.23-custody-decision.md',
    'docs/contracts/v2.23-benchmark-findings.md',
  ],
  program_bindings: {
    record_utils: {
      program_id: 'shadowbid_usdcx_record_utils_v1.aleo',
      program_dir: 'contracts/programs/shadowbid_usdcx_record_utils_v1',
    },
    credential_utils: {
      program_id: 'shadowbid_usdcx_cred_utils_v1.aleo',
      program_dir: 'contracts/programs/shadowbid_usdcx_credential_utils_v1',
    },
  },
  manual_steps: [
    'Prepare private USDCx records and required credentials.',
    'Bind the funding attempt to one concrete auction and bidder identity.',
    'Capture the transaction IDs or local proving artifacts.',
    'Inspect public explorer-visible state for amount leakage.',
    'Record any trust assumptions used by the custody model.',
  ],
  evidence_required: [
    'Public leak check result',
    'Record count and credential count',
    'User actions required',
    'Notes on custody and settlement implications',
  ],
  sidecar_plans: {
    record_plan: {
      plan_id: recordPlanId,
      denomination_root: denominationRoot,
      purpose_root: purposeRoot,
      expected_outputs: expectedOutputs,
      target_value: literalU128(targetValue),
      command_templates: {
        register: leoRunTemplate({
          programDir: 'contracts/programs/shadowbid_usdcx_record_utils_v1',
          transition: 'register_split_plan',
          inputs: [
            recordPlanId,
            denominationRoot,
            purposeRoot,
            literalU8(expectedOutputs),
            literalU128(targetValue),
            literalI64(createdAt),
          ],
        }),
        mark_ready: leoRunTemplate({
          programDir: 'contracts/programs/shadowbid_usdcx_record_utils_v1',
          transition: 'mark_split_plan_ready',
          inputs: [
            recordPlanId,
            literalU8(expectedOutputs),
            literalI64(createdAt + 60),
          ],
        }),
      },
    },
    credential_batch: {
      batch_id: credentialBatchId,
      policy_root: policyRoot,
      benchmark_root: benchmarkRoot,
      expected_credentials: expectedCredentials,
      command_templates: {
        register: leoRunTemplate({
          programDir: 'contracts/programs/shadowbid_usdcx_credential_utils_v1',
          transition: 'register_credential_batch',
          inputs: [
            credentialBatchId,
            policyRoot,
            benchmarkRoot,
            literalU8(expectedCredentials),
            literalI64(createdAt),
          ],
        }),
        mark_ready: leoRunTemplate({
          programDir: 'contracts/programs/shadowbid_usdcx_credential_utils_v1',
          transition: 'mark_credential_batch_ready',
          inputs: [
            credentialBatchId,
            literalU8(expectedCredentials),
            literalI64(createdAt + 60),
          ],
        }),
      },
    },
  },
  result_template: {
    network: args.network || 'pending',
    auction_id: args.auction || 'pending',
    bidder: args.bidder || 'pending',
    tx_ids: [],
    public_leak_check: 'pending',
    records_used: 'pending',
    credentials_used: 'pending',
    user_actions_required: 'pending',
    trust_assumptions: 'pending',
    notes: args.notes || '',
  },
};

await ensureDir(outputDir);
await writeJson(artifactPath, artifact);

console.log(`Wrote ${path.relative(repoRoot, artifactPath)}`);
