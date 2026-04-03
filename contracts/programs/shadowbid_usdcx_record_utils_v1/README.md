# shadowbid_usdcx_record_utils_v1

Phase 1 scaffold for `v2.23` private `USDCx` record-splitting research.

## Current Scope

This program does not split token records yet.

It provides a small on-chain planning surface for:

- registering a split-plan intent
- marking a plan ready for benchmark use
- closing a plan once the experiment is complete

This is meant to anchor benchmark artifacts and keep the future program identity stable while the real private-transfer logic is still being proven.

## Intended Future Direction

If Phase 1 validates the custody model, this program is the natural place to evolve:

- denomination-aware split helpers
- executor-oriented record preparation
- benchmarked record output counts and operational notes

## Files

- `program.json`
- `src/main.leo`
