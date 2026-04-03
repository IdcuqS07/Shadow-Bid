# ShadowBid

ShadowBid ships commit-reveal auctions on Aleo with contract-verifiable settlement. The active remediated testnet program is now `shadowbid_marketplace_v2_22.aleo`, which closes the original code-level privacy flaws by replacing the additive commitment check with a contract-derived `BHP256` commitment and removing per-bid amounts from the escrow mapping.

## Overview

ShadowBid combines a React marketplace frontend, the live `v2.22` Leo contract, and an operations layer for analytics, disputes, watchlists, and executor recommendations. The default user experience lives in the premium routes, while `/standard` remains available for legacy and compatibility testing.

## Live URLs

- App: <https://www.shadowbid.xyz/>
- Contract explorer: <https://testnet.explorer.provable.com/program/shadowbid_marketplace_v2_22.aleo>

## Live Deployment

- Program ID: `shadowbid_marketplace_v2_22.aleo`
- Network: `testnet`
- Deployed on: `2026-04-03`
- Deployment transaction: `at1puerrl94esarswkfgc0f97glpy6h03ke2zf2yzn5qtdme5rcqgysf85m38`
- Fee transaction: `at15wnry665ddtac4al2y9nr3z5v992xxz7esvju4kpp7jpxuz2avzqlcvz7n`

## What Changed In V2.21

- split the old single challenge window into `reveal_period` and `dispute_period`
- store explicit `reveal_deadline` and `dispute_deadline`
- move the seller lifecycle from `determine_winner` to `settle_after_reveal_timeout`
- handle reserve misses inside timeout settlement instead of a separate seller cancel branch
- keep dispute, receipt, seller payout, and platform-fee claims aligned with the upgraded flow

## Privacy Status

- Safe claim for `v2.22`: it closes the original code-level privacy flaws, but it does not yet provide full hidden-amount sealed-bid privacy.
- Patched source in this repo: per-bid escrow mappings no longer store bid amounts, and commit/reveal/refund verification now derives commitments in-contract from `auction_id`, `bidder`, `amount`, and `nonce`.
- Still visible on-chain after the patch: auction metadata, stored commitment roots, aggregate escrow totals, seller settlement account, dispute state, and the winner address plus winning amount once settlement completes.
- Still not full hidden-amount sealed-bid privacy: the live public funding flows for `ALEO`, `USDCx`, and `USAD` expose transfer amounts at transaction time. A true sealed-bid rollout still needs a new private-record-backed escrow deployment plus a frontend config update.

## Deployment Note

- The repo source and frontend helpers now target the live remediated ABI at `shadowbid_marketplace_v2_22.aleo`.
- The legacy `shadowbid_marketplace_v2_21.aleo` testnet program remains the older public-escrow ABI and should be treated as historical.

## Supported Currencies

ShadowBid `v2.22` supports three auction currencies on Aleo testnet:

| Currency | Type | Program | Notes |
| --- | --- | --- | --- |
| `ALEO` | Native Aleo credits | `credits.aleo` | Used for native-credit auctions and settlements |
| `USDCx` | ARC-21 stablecoin | `test_usdcx_stablecoin.aleo` | Supported by the active contract and frontend flow |
| `USAD` | ARC-21 stablecoin | `test_usad_stablecoin.aleo` | Supported by the active contract and frontend flow |

At the contract level, the currency mapping is `0 = USDCx`, `1 = ALEO`, and `2 = USAD`. The frontend wallet provider is configured to request all three programs so users can create and settle auctions in the selected currency.

## Contract Explorer

- Active remediated testnet program: <https://testnet.explorer.provable.com/program/shadowbid_marketplace_v2_22.aleo>
- Program ID: `shadowbid_marketplace_v2_22.aleo`

## Repository Layout

```text
shadow-bid/
├── frontend/          # React + Vite marketplace UI and live Ops Console API
├── contracts/         # Active ShadowBid v2.22 Leo program
├── docs/              # Frontend and contract guides
├── package.json       # Root shortcuts for frontend and contract workflows
└── README.md
```

## Architecture

```text
┌────────────────────┐      ┌──────────────────────────┐
│ frontend/          │─────▶│ Aleo wallets + explorer  │
│ React + Vite UI    │      │ On-chain reads/writes    │
│ Premium routes     │      └──────────────────────────┘
│ Standard fallback  │
└─────────┬──────────┘
          │
          ├────────────────────▶┌──────────────────────────┐
          │                     │ Shared Ops API           │
          │                     │ VPS or Vercel deployment │
          │                     │ Analytics / disputes     │
          │                     │ watchlists / executor    │
          │                     └──────────────────────────┘
          │
          ▼
┌────────────────────┐
│ contracts/         │
│ Leo v2.22 program  │
│ Split deadlines    │
│ Timeout settlement │
│ Dispute-aware flow │
└────────────────────┘
```

## Quick Start

### Frontend

```bash
npm run install:frontend
npm run dev
```

The marketplace runs on `http://localhost:3007`, with premium routes mounted at `/`, `/premium-auctions`, `/premium-create`, and `/premium-auction/:auctionId`.

### Ops API for local development

```bash
npm run dev:ops
```

The admin operations console is available at `/ops` when the platform owner wallet is connected.

### Contract

```bash
npm run build:contracts
```

## Key Paths

- [frontend/README.md](frontend/README.md) explains the app and local workflow
- [contracts/README.md](contracts/README.md) summarizes the active `v2.22` Leo program
- [docs/README.md](docs/README.md) indexes the guides moved out of the app folder
- [docs/frontend/ops-console.md](docs/frontend/ops-console.md) explains what `Ops Console` is, how it works, and how it is wired into the repo
- [docs/frontend/wave-5-milestone.md](docs/frontend/wave-5-milestone.md) turns the Wave 5 trust, ops, and premium UX goal into a `must ship` backlog on top of `v2.22`
- [docs/contracts/autonomous-lifecycle-design.md](docs/contracts/autonomous-lifecycle-design.md) proposes the next contract/protocol path for delegated reveal, encrypted reveal escrow, and non-reveal fallback
- [docs/contracts/privacy-remediation-roadmap.md](docs/contracts/privacy-remediation-roadmap.md) captures the concrete follow-up needed to make bid amounts actually private on-chain
- [docs/contracts/v2.23-private-escrow-proposal.md](docs/contracts/v2.23-private-escrow-proposal.md) preserves the paused `USDCx`-private-first design as a reference proposal for a possible future reopen
- [docs/contracts/v2.23-phase-1-feasibility-spike.md](docs/contracts/v2.23-phase-1-feasibility-spike.md) defines the benchmark-first execution phase that must pass before the `v2.23` ABI is frozen
- [docs/contracts/v2.23-implementation-checklist.md](docs/contracts/v2.23-implementation-checklist.md) breaks `v2.23` into decision gates, benchmark work, contract work, frontend changes, and launch criteria
- [docs/contracts/v2.23-custody-decision.md](docs/contracts/v2.23-custody-decision.md) records the blocking escrow custody choices that must be resolved before the `v2.23` ABI is frozen
- [docs/contracts/v2.23-benchmark-findings.md](docs/contracts/v2.23-benchmark-findings.md) records the current pause / no-go decision for the `USDCx` private-first feasibility spike
- [docs/contracts/v2.23-usdcx-private-primitives.md](docs/contracts/v2.23-usdcx-private-primitives.md) maps the imported `test_usdcx_stablecoin.aleo` private rail and explains why its current proof source is still blocked
- [docs/contracts/v2.23-usdcx-preconditions.md](docs/contracts/v2.23-usdcx-preconditions.md) captures the live testnet state and the current proof-source blocker for private `USDCx`
- [docs/contracts/v2.23-usdcx-funding-paths.md](docs/contracts/v2.23-usdcx-funding-paths.md) records why the candidate private funding routes are currently paused
- [docs/contracts/v2.23-usdcx-spike-runbook.md](docs/contracts/v2.23-usdcx-spike-runbook.md) preserves the old command-level spike runbook as historical reference only
- [docs/contracts/v2.21-technical-spec.md](docs/contracts/v2.21-technical-spec.md) turns the `v2.21` path into an implementation-oriented contract draft
- [docs/contracts/v2.21-implementation-checklist.md](docs/contracts/v2.21-implementation-checklist.md) breaks the `v2.21` rollout into contract, frontend, ops, and deployment tasks

## Deployment Notes

- The live web bundle is built from `frontend/`
- The shared Ops backend can run through the Vercel entrypoint or the VPS/Node server
- Contract rollout references and historical deployment notes are collected under `docs/contracts/`

## References

- Aleo developer docs: <https://developer.aleo.org/>
- Leo language docs: <https://developer.aleo.org/leo/>
