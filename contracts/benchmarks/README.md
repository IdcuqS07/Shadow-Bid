# Contract Benchmarks

This directory is reserved for contract-focused benchmark outputs and harness assets.

Recommended layout:

- `v223-private-usdcx/`
  benchmark outputs for the `v2.23` private `USDCx` feasibility spike

Suggested output types:

- raw JSON or JSONL benchmark runs
- summarized result tables
- leak-check notes tied to concrete transaction IDs

The initial scaffold in this repo writes:

- `spike-*.json`
- `benchmark-suite-*.json`
- `preconditions-*.json`
- `funding-paths-*.json`
- `visibility-*.json`
- optional `summary.md`

Primary design references:

- `docs/contracts/v2.23-phase-1-feasibility-spike.md`
- `docs/contracts/v2.23-implementation-checklist.md`
