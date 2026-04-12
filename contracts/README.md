# ShadowBid Contracts

This directory contains the active ShadowBid `v2.24` Leo program.

Safe privacy claim for `v2.24`: it closes the original code-level privacy flaws, but it does not yet provide full hidden-amount sealed-bid privacy because the live funding flows still expose transfer amounts.

## Contents

- `src/main.leo` - marketplace logic for commit-reveal auctions, reserve handling, settlement, and disputes
- `program.json` - Leo program metadata
- `programs/` - Phase 1 `v2.23` sidecar scaffolds for record-utils and credential-utils research

## Supported Currencies

The active `v2.24` contract supports one native currency and two ARC-21 stablecoins:

| `currency_type` | Currency | Program | Contract path |
| --- | --- | --- | --- |
| `1` | `ALEO` | `credits.aleo` | Native-credit commit, refund, payout, and fee flows |
| `0` | `USDCx` | `test_usdcx_stablecoin.aleo` | ARC-21 public token flow |
| `2` | `USAD` | `test_usad_stablecoin.aleo` | ARC-21 public token flow |

Each auction is created with one selected currency, and the same currency is used through bid escrow, winner settlement, refunds, seller claims, and platform fee claims.

## Build

```bash
cd contracts
leo build
```

## Deploy and Validation

- Historical V2.20 deployment guide: [docs/contracts/deploy.md](../docs/contracts/deploy.md)
- Historical V2.20 manual instructions: [docs/contracts/deployment-instructions.md](../docs/contracts/deployment-instructions.md)
- Historical V2.20 deployment record: [docs/contracts/deployment-success.md](../docs/contracts/deployment-success.md)
- Next-step autonomy design: [docs/contracts/autonomous-lifecycle-design.md](../docs/contracts/autonomous-lifecycle-design.md)
- `v2.23` private escrow proposal reference: [docs/contracts/v2.23-private-escrow-proposal.md](../docs/contracts/v2.23-private-escrow-proposal.md)
- `v2.23` Phase 1 spike: [docs/contracts/v2.23-phase-1-feasibility-spike.md](../docs/contracts/v2.23-phase-1-feasibility-spike.md)
- `v2.23` implementation checklist: [docs/contracts/v2.23-implementation-checklist.md](../docs/contracts/v2.23-implementation-checklist.md)
- `v2.23` custody decision record: [docs/contracts/v2.23-custody-decision.md](../docs/contracts/v2.23-custody-decision.md)
- `v2.23` benchmark findings and pause decision: [docs/contracts/v2.23-benchmark-findings.md](../docs/contracts/v2.23-benchmark-findings.md)
- `v2.23` private USDCx primitive map: [docs/contracts/v2.23-usdcx-private-primitives.md](../docs/contracts/v2.23-usdcx-private-primitives.md)
- `v2.23` live USDCx preconditions and proof blocker: [docs/contracts/v2.23-usdcx-preconditions.md](../docs/contracts/v2.23-usdcx-preconditions.md)
- `v2.23` funding-route planner and pause rationale: [docs/contracts/v2.23-usdcx-funding-paths.md](../docs/contracts/v2.23-usdcx-funding-paths.md)
- `v2.23` historical spike runbook: [docs/contracts/v2.23-usdcx-spike-runbook.md](../docs/contracts/v2.23-usdcx-spike-runbook.md)
- `v2.23` sidecar program scaffolds: [programs/README.md](./programs/README.md)
- `v2.21` lifecycle spec: [docs/contracts/v2.21-technical-spec.md](../docs/contracts/v2.21-technical-spec.md)
- `v2.21` rollout checklist: [docs/contracts/v2.21-implementation-checklist.md](../docs/contracts/v2.21-implementation-checklist.md)
