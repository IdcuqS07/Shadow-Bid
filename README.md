# ShadowBid Marketplace V2.20

This repository now contains only the active `v2.20` Leo contract for ShadowBid Marketplace.
Older contract versions, frontend code, and historical working notes were intentionally removed so the GitHub repository stays focused on the live contract source.

## Repository Scope

- Active contract source: `shadowbid_marketplace_v2_20/src/main.leo`
- Leo manifest: `shadowbid_marketplace_v2_20/program.json`
- Deployment guides: `shadowbid_marketplace_v2_20/DEPLOY.md` and `shadowbid_marketplace_v2_20/DEPLOYMENT_INSTRUCTIONS.md`
- Deployment record: `shadowbid_marketplace_v2_20/DEPLOYMENT_SUCCESS.md`

## V2.20 Highlights

- Sealed-bid commit-reveal auction flow
- Multi-currency bidding with Aleo credits, USDCx, and USAD
- Reserve price support and platform fee accounting
- Keeper-friendly lifecycle timestamps
- Dispute handling and proof anchor mappings
- RWA settlement flow with configurable confirmation windows

## Quick Start

### Prerequisites

- Leo `3.5.0`
- Access to an Aleo wallet or deployment key
- Sufficient Aleo credits for build and deploy operations

### Build

```bash
cd shadowbid_marketplace_v2_20
leo build
```

### Deploy

```bash
cd shadowbid_marketplace_v2_20
leo deploy --network testnet
```

For a step-by-step flow, use `shadowbid_marketplace_v2_20/DEPLOYMENT_INSTRUCTIONS.md`.

## Notes

- This repo is intentionally contract-only.
- Generated artifacts such as `build/`, `outputs/`, and local `.env` files are not part of the tracked source.

## Links

- Aleo developer docs: <https://developer.aleo.org/>
- Leo language docs: <https://developer.aleo.org/leo/>
