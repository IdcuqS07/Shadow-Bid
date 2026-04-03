# ShadowBid Sidecar Programs

This directory holds sidecar Leo programs for the `v2.23` private escrow effort.

These programs are intentionally separate from the live `v2.22` marketplace contract. They are Phase 1 scaffolds for private `USDCx` research and benchmark orchestration, not proof that private escrow is already solved.

## Current Programs

- `shadowbid_usdcx_record_utils_v1/`
  scaffold for recording split-plan metadata and benchmark readiness for private `USDCx` records
- `shadowbid_usdcx_credential_utils_v1/`
  scaffold for recording credential-batch metadata and benchmark readiness for private `USDCx` actions
  program id: `shadowbid_usdcx_cred_utils_v1.aleo`
- `shadowbid_usdcx_private_probe_v1/`
  probe scaffold for tracking imported private-rail experiments
  program id: `shadowbid_usdcx_probe_v1.aleo`
  currently wraps `get_credentials`, `transfer_private_with_creds`, `transfer_private`, `transfer_private_to_public`, `mint_private`, and `transfer_public_to_private`

## Why They Exist

The `batch-payments-benchmarking` research pointed to three useful layers for `v2.23`:

- record splitting
- credential setup
- benchmark-first validation

These scaffolds give the repo stable program identities and a place to evolve sidecar logic without overloading the main auction contract.

## Current Limitation

The sidecar programs currently track planning and readiness state only.

They do not yet:

- move private `USDCx` records
- mint credentials
- solve private escrow custody
- replace the live `v2.22` flow

Primary references:

- `../README.md`
- `../benchmarks/README.md`
- `../../docs/contracts/v2.23-private-escrow-proposal.md`
- `../../docs/contracts/v2.23-phase-1-feasibility-spike.md`
- `../../docs/contracts/v2.23-implementation-checklist.md`
- `../../docs/contracts/v2.23-usdcx-private-primitives.md`
- `../../docs/contracts/v2.23-usdcx-preconditions.md`
- `../../docs/contracts/v2.23-usdcx-funding-paths.md`
