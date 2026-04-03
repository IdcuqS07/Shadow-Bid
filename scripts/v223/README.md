# V2.23 Scripts

This directory is reserved for the `v2.23` private escrow feasibility spike and benchmark tooling.

Current scaffolds:

- `run-private-usdcx-spike.mjs`
- `run-shadowbid-benchmarks.mjs`
- `report-shadowbid-benchmarks.mjs`
- `utils.mjs`

The scripts here should focus on:

- private `USDCx` funding experiments
- ShadowBid-shaped benchmark scenarios
- reproducible logs and benchmark artifacts

## Commands

Run the current scaffold commands from the repo root:

```bash
npm run v223:spike
npm run v223:bench
npm run v223:report
npm run v223:commands
npm run v223:sidecar
npm run v223:findings
npm run v223:primitives
npm run v223:preconditions
npm run v223:funding
npm run v223:runbook
npm run v223:get-creds-proof
npm run v223:visibility -- --tx <transaction_id>
```

The generated artifacts are written under `contracts/benchmarks/v223-private-usdcx/` unless a custom `--out` path is provided.

## Current Scope

These scripts are intentionally light-weight. They do not yet broadcast transactions or benchmark Leo programs directly.

Right now they provide:

- a reproducible artifact format for the private `USDCx` feasibility spike
- a standard scenario matrix for ShadowBid-shaped benchmarks
- sidecar plan metadata for `record_utils` and `cred_utils`
- example `leo run` command templates for registering and updating sidecar plans
- a report command that rolls existing JSON artifacts into a short Markdown summary
- a command printer that turns the latest artifact into copyable Leo sidecar commands
- a sidecar runner with dry-run default and execute mode for local Leo experiments
- a findings generator that converts artifacts and execution logs into the Phase 1 benchmark report
- a primitive-map generator for the imported `test_usdcx_stablecoin.aleo` private rail
- a live precondition snapshot generator for `pause`, freeze-list roots, roles, and funding-source hints
- a funding-path planner that scores preseeded, minter-assisted, and public-to-private control routes
- a wallet-specific runbook generator for the next `get_creds -> xfer_with_creds` spike
- a get_creds proof analyzer that checks whether the live freeze-list root can be reconstructed from public mappings alone
- a tx visibility checker that classifies whether a `USDCx` transaction still exposes the amount publicly

## Sidecar Runner

Use the sidecar runner to turn the latest artifact into executable `leo run` steps.

Dry-run the latest benchmark suite:

```bash
npm run v223:sidecar
```

Dry-run one scenario only:

```bash
npm run v223:sidecar -- --scenario private-commit-1-bidder
```

Execute the sidecar commands and write a JSON log:

```bash
npm run v223:sidecar -- --execute
```

Include the `close` transitions too:

```bash
npm run v223:sidecar -- --execute --include-close
```

Current note:

- local `leo run` execution currently hits `No space left on device` on this machine when disk headroom is too low, so the dry-run mode is the safe default

This keeps Phase 1 executable with Node built-ins before the repo commits to a heavier benchmark harness.

Primary design references:

- `docs/contracts/v2.23-phase-1-feasibility-spike.md`
- `docs/contracts/v2.23-implementation-checklist.md`
- `docs/contracts/v2.23-private-escrow-proposal.md`
