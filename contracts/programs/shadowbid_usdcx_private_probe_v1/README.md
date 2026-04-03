# shadowbid_usdcx_private_probe_v1

Probe wrapper for the private `USDCx` primitives needed by the `v2.23` feasibility spike.

Current program id: `shadowbid_usdcx_probe_v1.aleo`

## Purpose

This program gives the repo a local Leo package for tracking and organizing imported `test_usdcx_stablecoin.aleo` private rail experiments.

The goal is not to solve private escrow yet. The goal is to keep the probe work anchored in-repo while the real primitive behavior is documented and tested:

- `transfer_private_with_creds`
- `get_credentials`
- `transfer_private`
- `transfer_private_to_public`
- `mint_private`
- `transfer_public_to_private`

## Why It Matters

The live `v2.22` marketplace still funds bids through public paths. This probe is the first concrete step toward testing a private `USDCx` funding rail inside the repo itself.

## Current Scope

This program is only a probe scaffold:

- it records probe targets and intent
- it does not implement auction logic
- it does not prove private custody
- it does not replace the live `v2.22` contract

Primitive kind mapping used by the scaffold:

- `0`: `get_credentials`
- `1`: `transfer_private_with_creds`
- `2`: `transfer_private`
- `3`: `transfer_private_to_public`
- `4`: `transfer_public_to_private`
- `5`: `mint_private`

Current limitation:

- the local wrapper now compiles, but end-to-end execution still needs real private `Token` records, `Credentials` records, and Merkle proofs
- the live-state checklist for this work is documented in `docs/contracts/v2.23-usdcx-preconditions.md`
- the funding-route planner for this work is documented in `docs/contracts/v2.23-usdcx-funding-paths.md`
- the primitive map itself is documented in `docs/contracts/v2.23-usdcx-private-primitives.md`

## Files

- `program.json`
- `src/main.leo`
