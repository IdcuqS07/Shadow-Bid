# shadowbid_usdcx_credential_utils_v1

Phase 1 scaffold for `v2.23` private `USDCx` credential-batch research.

Current program id: `shadowbid_usdcx_cred_utils_v1.aleo`

The on-disk folder keeps the longer descriptive name, but the Leo program id uses `cred` because the full `credential_utils` variant exceeds Leo's identifier length limit.

## Current Scope

This program does not mint or validate real credentials yet.

It provides a small on-chain planning surface for:

- registering a credential batch intent
- marking a batch ready for benchmark use
- closing a batch after the experiment is complete

This keeps the future sidecar program identity stable while the real private `USDCx` credential flow is still under validation.

## Intended Future Direction

If Phase 1 succeeds, this program is the natural place to evolve:

- repeated credential setup helpers
- benchmarked credential-count strategies
- operational metadata for executor and wallet setup

## Files

- `program.json`
- `src/main.leo`
