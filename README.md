# ShadowBid

Sealed bids stay hidden until reveal, while settlement remains contract-verifiable. This repository tracks the active ShadowBid `v2.21` frontend, contract, and operations tooling.

## Overview

ShadowBid combines a React marketplace frontend, a `v2.21` Leo contract, and an operations layer for analytics, disputes, watchlists, and executor recommendations. The default user experience lives in the premium routes, while `/standard` remains available for legacy and compatibility testing.

## Live URLs

- App: <https://www.shadowbid.xyz/>
- Contract explorer: <https://testnet.explorer.provable.com/program/shadowbid_marketplace_v2_21.aleo>

## What Changed In V2.21

- split the old single challenge window into `reveal_period` and `dispute_period`
- store explicit `reveal_deadline` and `dispute_deadline`
- move the seller lifecycle from `determine_winner` to `settle_after_reveal_timeout`
- handle reserve misses inside timeout settlement instead of a separate seller cancel branch
- keep dispute, receipt, seller payout, and platform-fee claims aligned with the upgraded flow

## Privacy Model

- Hidden until reveal: bid amounts during commit phase, bidder-local nonce and commitment helpers, and private ALEO record details when the Shield private flow is used.
- Visible in contract or UI state: auction metadata, escrow totals, seller settlement account, dispute state, and the winner address plus winning amount once settlement completes.

## Supported Currencies

ShadowBid `v2.21` supports three auction currencies on Aleo testnet:

| Currency | Type | Program | Notes |
| --- | --- | --- | --- |
| `ALEO` | Native Aleo credits | `credits.aleo` | Used for native-credit auctions and settlements |
| `USDCx` | ARC-21 stablecoin | `test_usdcx_stablecoin.aleo` | Supported by the active contract and frontend flow |
| `USAD` | ARC-21 stablecoin | `test_usad_stablecoin.aleo` | Supported by the active contract and frontend flow |

At the contract level, the currency mapping is `0 = USDCx`, `1 = ALEO`, and `2 = USAD`. The frontend wallet provider is configured to request all three programs so users can create and settle auctions in the selected currency.

## Contract Explorer

- Active testnet program: <https://testnet.explorer.provable.com/program/shadowbid_marketplace_v2_21.aleo>
- Program ID: `shadowbid_marketplace_v2_21.aleo`

## Repository Layout

```text
shadow-bid/
├── frontend/          # React + Vite marketplace UI and live Ops Console API
├── contracts/         # Active ShadowBid v2.21 Leo program
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
│ Leo v2.21 program  │
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
- [contracts/README.md](contracts/README.md) summarizes the `v2.21` Leo program
- [docs/README.md](docs/README.md) indexes the guides moved out of the app folder
- [docs/frontend/ops-console.md](docs/frontend/ops-console.md) explains what `Ops Console` is, how it works, and how it is wired into the repo
- [docs/contracts/autonomous-lifecycle-design.md](docs/contracts/autonomous-lifecycle-design.md) proposes the next contract/protocol path for delegated reveal, encrypted reveal escrow, and non-reveal fallback
- [docs/contracts/v2.21-technical-spec.md](docs/contracts/v2.21-technical-spec.md) turns the `v2.21` path into an implementation-oriented contract draft
- [docs/contracts/v2.21-implementation-checklist.md](docs/contracts/v2.21-implementation-checklist.md) breaks the `v2.21` rollout into contract, frontend, ops, and deployment tasks

## Deployment Notes

- The live web bundle is built from `frontend/`
- The shared Ops backend can run through the Vercel entrypoint or the VPS/Node server
- Contract rollout references and historical deployment notes are collected under `docs/contracts/`

## References

- Aleo developer docs: <https://developer.aleo.org/>
- Leo language docs: <https://developer.aleo.org/leo/>
