# ShadowBid

<img src="Logo.png" alt="ShadowBid logo" width="160" />

ShadowBid is a commit-reveal auction marketplace on Aleo for sales that need better price discovery than a public live bid ladder. Sellers get contract-verifiable settlement, bidders get less anchoring during the commit phase, and operators get a shared Ops layer for disputes, verification, watchlists, analytics, and executor recommendations.

The active remediated testnet program is `shadowbid_marketplace_v2_24.aleo`. It closes the original code-level privacy flaws by replacing the additive commitment check with a contract-derived `BHP256` commitment and by removing per-bid amounts from the escrow mapping.

## Why ShadowBid

- reduce live bid anchoring with a commit -> reveal auction flow
- keep lifecycle state and fund settlement anchored on-chain
- support `ALEO`, `USDCx`, and `USAD` in one marketplace flow
- pair the contract with a shared Ops layer that improves trust and coordination without becoming the source of truth for auction funds

## Best-Fit Use Cases

- premium digital assets or collectibles where visible bidding distorts behavior
- curated marketplaces that want more trust and less manual settlement work
- Aleo-native product experiments around sealed-bid or privacy-aware commerce

## Status At A Glance

| Area | Current Status |
| --- | --- |
| App | <https://www.shadowbid.xyz/> |
| Network | `testnet` |
| Active program | `shadowbid_marketplace_v2_24.aleo` |
| Supported currencies | `ALEO`, `USDCx`, `USAD` |
| Privacy claim | Fixes the original code-level privacy flaws, but is not yet full hidden-amount sealed-bid privacy |
| Source of truth | On-chain for lifecycle and funds; shared Ops layer for metadata and coordination |
| Frontend default | Premium routes at `/`, `/premium-auctions`, `/premium-create`, `/premium-auction/:auctionId` |

## How It Works

1. A seller creates an auction with an end time, reveal period, dispute period, reserve, and currency.
2. Bidders commit bids before the auction ends.
3. The seller closes the auction after `end_time`, which opens the reveal window.
4. Bidders reveal before `reveal_deadline`.
5. After reveal timeout, the seller settles and the contract determines whether the auction should proceed or cancel.
6. After the dispute window, the winner is finalized and payout, fee, refund, or receipt flows can complete.

## Live URLs

- App: <https://www.shadowbid.xyz/>
- Contract explorer: <https://testnet.explorer.provable.com/program/shadowbid_marketplace_v2_24.aleo>

## Live Deployment

- Program ID: `shadowbid_marketplace_v2_24.aleo`
- Network: `testnet`
- Deployed on: `2026-04-10`
- Deployment transaction: `at1vfh332s5la6ewm232xh92ecclkqwpec3lxqtd554zuhc3x3z65pq9glkrj`
- Fee transaction: `at1qv6st7s7yvhy20sq540ahdv95hxs03s5vq45m944pakucddjlq8qscf3c4`
- Historical rollout: `shadowbid_marketplace_v2_23.aleo` remains a previous testnet deployment

## What Changed In V2.24

- make ALEO refund identity consistent by deriving refund commitments from `self.signer`
- keep the `v2.23` no-bid cancellation flow, seller-bid guard, and explicit `cancel_reason` tracking
- preserve the remediated in-contract commitment checks and amount-free escrow mapping design
- keep bidder-recovery-friendly state and frontend compatibility hooks aligned with the live ABI
- retain dispute, receipt, seller payout, and platform-fee flows across `ALEO`, `USDCx`, and `USAD`

## Privacy And Trust Boundaries

### Safe Claim For `v2.24`

- it closes the original code-level privacy flaws
- it does not yet provide full hidden-amount sealed-bid privacy

### Still Visible On-Chain

- auction metadata
- stored commitment roots
- aggregate escrow totals
- seller settlement account
- dispute state
- winner address and winning amount once settlement completes

### Browser-Local Only

- bidder nonce storage
- saved commitment cache
- recovery bundle handling used later for reveal and refund

### Where Data Lives

- On-chain: lifecycle state, escrow totals, reveal/refund eligibility, winner selection, seller payout, and platform fee state
- Shared read model: VPS or local indexer mirror of on-chain auction state for shared list/detail reads
- Browser-local: bidder nonce, saved commitment cache, and recovery bundle acknowledgements needed to recover reveal or refund on another browser
- Ops API: shared metadata such as watchlists, verification, disputes, offers, notifications, and admin workflow state

A true hidden-amount sealed-bid rollout still needs a new private-record-backed escrow deployment plus a frontend configuration update.

## Supported Currencies

ShadowBid `v2.24` supports three auction currencies on Aleo testnet:

| Currency | Type | Program | Notes |
| --- | --- | --- | --- |
| `ALEO` | Native Aleo credits | `credits.aleo` | Used for native-credit auctions and settlements |
| `USDCx` | ARC-21 stablecoin | `test_usdcx_stablecoin.aleo` | Supported by the active contract and frontend flow |
| `USAD` | ARC-21 stablecoin | `test_usad_stablecoin.aleo` | Supported by the active contract and frontend flow |

At the contract level, the currency mapping is `0 = USDCx`, `1 = ALEO`, and `2 = USAD`. The frontend wallet provider is configured to request all three programs so users can create and settle auctions in the selected currency.

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
          │                     │ Shared Auction Read Model│
          │                     │ VPS or local indexer     │
          │                     │ Chain-mirror list/detail │
          │                     └──────────────────────────┘
          │
          ├────────────────────▶┌──────────────────────────┐
          │                     │ Shared Ops API           │
          │                     │ VPS or Vercel deployment │
          │                     │ Metadata / disputes      │
          │                     │ watchlists / executor    │
          │                     └──────────────────────────┘
          │
          ▼
┌────────────────────┐
│ contracts/         │
│ Leo v2.24 program  │
│ No-bid cancel      │
│ Timeout settlement │
│ Dispute-aware flow │
└────────────────────┘
```

## Quick Start

### Prerequisites

- `Node.js` and `npm`
- `Leo` CLI if you want to build the contract locally
- an Aleo-compatible wallet if you want to exercise the live bidding flow

### Run The Marketplace Locally

```bash
npm run install:frontend
cp frontend/.env.local.example frontend/.env.local
npm run dev
```

The marketplace runs on `http://localhost:3007`.

### Run The Local Ops API

```bash
npm run dev:ops
```

The admin operations console is available at `/ops` when the platform owner wallet is connected. The same Ops role can run on a VPS or Vercel deployment in shared environments.

### Build The Contract

```bash
npm run build:contracts
```

### Helpful Routes

- `/`
- `/premium-auctions`
- `/premium-create`
- `/premium-auction/:auctionId`
- `/ops`
- `/dev/test-fixtures`
- `/standard/*` for compatibility and legacy testing

## Repository Layout

```text
shadow-bid/
├── frontend/          # React + Vite marketplace UI and Ops API entrypoints
├── contracts/         # Active ShadowBid v2.24 Leo program
├── docs/              # Product, frontend, and contract guides
├── package.json       # Root shortcuts for frontend and contract workflows
└── README.md
```

## Read Next

- [frontend/README.md](frontend/README.md) for frontend setup, routes, and environment
- [contracts/README.md](contracts/README.md) for the active `v2.24` contract summary
- [docs/frontend/quick-start.md](docs/frontend/quick-start.md) for the fastest route through the premium flow
- [docs/frontend/user-guide.md](docs/frontend/user-guide.md) for seller, bidder, winner, and platform-owner walkthroughs
- [docs/frontend/ops-console.md](docs/frontend/ops-console.md) for the admin-facing Ops workspace
- [docs/contracts/privacy-remediation-roadmap.md](docs/contracts/privacy-remediation-roadmap.md) for the concrete path to stronger privacy
- [docs/contracts/autonomous-lifecycle-design.md](docs/contracts/autonomous-lifecycle-design.md) for the next contract and protocol direction
- [docs/README.md](docs/README.md) for the broader documentation index

## Roadmap Direction

- Live now: remediated `v2.24` commit-reveal marketplace on testnet
- Next: stronger delegated reveal and recovery-friendly lifecycle tooling
- Research track: private-record-backed escrow for actual hidden-amount sealed-bid privacy

## References

- Aleo developer docs: <https://developer.aleo.org/>
- Leo language docs: <https://developer.aleo.org/leo/>
