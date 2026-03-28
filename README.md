# ShadowBid

Maximum privacy. Zero information leakage. Cryptographically verifiable. The future of fair auctions is here.

## Overview

ShadowBid combines a React marketplace frontend with the active `v2.20` Leo contract. The repository is now structured closer to a production app repo, with clear separation between the frontend, contract source, and supporting documentation.

## Supported Currencies

ShadowBid `v2.20` supports three auction currencies on Aleo testnet:

| Currency | Type | Program | Notes |
| --- | --- | --- | --- |
| `ALEO` | Native Aleo credits | `credits.aleo` | Used for native-credit auctions and settlements |
| `USDCx` | ARC-21 stablecoin | `test_usdcx_stablecoin.aleo` | Supported by the active contract and frontend flow |
| `USAD` | ARC-21 stablecoin | `test_usad_stablecoin.aleo` | Supported by the active contract and frontend flow |

At the contract level, the currency mapping is `0 = USDCx`, `1 = ALEO`, and `2 = USAD`. The frontend wallet provider is configured to request all three programs so users can create and settle auctions in the selected currency.

## Repository Layout

```text
shadow-bid/
├── frontend/          # React + Vite marketplace UI and live Ops Console API
├── contracts/         # Active ShadowBid v2.20 Leo program
├── docs/              # Frontend and contract guides
├── package.json       # Root shortcuts for frontend and contract workflows
└── README.md
```

## Architecture

```text
┌────────────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
│ frontend/          │─────▶│ Vercel Functions     │─────▶│ Vercel Blob         │
│ React + Vite UI    │      │ Ops Console API      │      │ Persistent ops data │
│ Wallet adapters    │      │ Notifications/state  │      │ executor runs       │
└─────────┬──────────┘      └──────────────────────┘      └─────────────────────┘
          │
          ▼
┌────────────────────┐
│ contracts/         │
│ Leo v2.20 program  │
│ Commit-reveal flow │
│ Reserve/settlement │
└────────────────────┘
```

## Quick Start

### Frontend

```bash
npm run install:frontend
npm run dev
```

The marketplace runs on `http://localhost:3007`.

### Ops API for local development

```bash
npm run dev:ops
```

### Contract

```bash
npm run build:contracts
```

## Key Paths

- [frontend/README.md](frontend/README.md) explains the app and local workflow
- [contracts/README.md](contracts/README.md) summarizes the `v2.20` Leo program
- [docs/README.md](docs/README.md) indexes the guides moved out of the app folder

## Deployment Notes

- The live marketplace is deployed from `frontend/`
- The production Ops Console backend is served by `frontend/api/index.js`
- Contract deployment references are collected under `docs/contracts/`

## References

- Aleo developer docs: <https://developer.aleo.org/>
- Leo language docs: <https://developer.aleo.org/leo/>
