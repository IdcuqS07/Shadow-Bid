# ShadowBid Contracts

This directory contains the active ShadowBid `v2.21` Leo program.

## Contents

- `src/main.leo` - marketplace logic for commit-reveal auctions, reserve handling, settlement, and disputes
- `program.json` - Leo program metadata

## Supported Currencies

The active `v2.21` contract supports one native currency and two ARC-21 stablecoins:

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
- `v2.21` contract spec: [docs/contracts/v2.21-technical-spec.md](../docs/contracts/v2.21-technical-spec.md)
- `v2.21` rollout checklist: [docs/contracts/v2.21-implementation-checklist.md](../docs/contracts/v2.21-implementation-checklist.md)
