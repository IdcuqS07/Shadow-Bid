# ShadowBid Marketplace

ShadowBid is a privacy-focused sealed-bid auction marketplace built on Aleo.
This repository now contains the active `v2.20` Leo contract and the restored React frontend that previously ran on `http://localhost:3007`.

## Repository Structure

- `shadowbid_marketplace_v2_20/` - active Leo smart contract source and deployment notes
- `shadowbid-marketplace/` - React + Vite frontend used for the marketplace UI

## Frontend Quick Start

```bash
cd shadowbid-marketplace
npm ci
npm run dev
```

The frontend runs on `http://localhost:3007`.

## Contract Quick Start

```bash
cd shadowbid_marketplace_v2_20
leo build
```

## V2.20 Highlights

- Commit-reveal sealed bidding
- Aleo, USDCx, and USAD support
- Reserve price and platform fee accounting
- Keeper-friendly lifecycle timestamps
- Dispute handling and proof anchor mappings

## Deployment

- Frontend production deployment is managed through Vercel
- Contract deployment guidance lives in `shadowbid_marketplace_v2_20/DEPLOY.md`

## Links

- Aleo developer docs: <https://developer.aleo.org/>
- Leo language docs: <https://developer.aleo.org/leo/>
