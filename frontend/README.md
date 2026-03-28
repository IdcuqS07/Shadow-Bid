# ShadowBid Frontend

React + Vite marketplace UI for ShadowBid, including the live Ops Console API integration that runs on Vercel.

## What Lives Here

- Marketplace pages for create, bid, reveal, settlement, and admin flows
- Wallet integration for Aleo-compatible wallets
- Vercel Function entrypoint for the live Ops backend
- Local fallback ops server for development

## Local Development

```bash
npm ci
cp .env.local.example .env.local
npm run dev
```

The app runs on `http://localhost:3007`.

To run the local Ops API during development:

```bash
npm run dev:api
```

## Environment

```env
VITE_ALEO_NETWORK=testnet
VITE_PROGRAM_ID=shadowbid_marketplace_v2_20.aleo
VITE_AUCTIONEER_ADDRESS=aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8
VITE_API_BASE=https://api.explorer.provable.com/v1/testnet
```

## Structure

```text
frontend/
├── api/         # Vercel function entrypoint for Ops Console
├── local-api/   # Local JSON-backed ops server for dev
├── ops-api/     # Shared API logic and storage adapters
├── public/      # Static assets
├── src/         # App pages, components, hooks, services
└── vercel.json  # Frontend + API routing
```

## Supporting Guides

- Quick start: [docs/frontend/quick-start.md](/Users/idcuq/Documents/Bid%20Market/docs/frontend/quick-start.md)
- User guide: [docs/frontend/user-guide.md](/Users/idcuq/Documents/Bid%20Market/docs/frontend/user-guide.md)
- Troubleshooting: [docs/frontend/troubleshooting.md](/Users/idcuq/Documents/Bid%20Market/docs/frontend/troubleshooting.md)
- Integration notes: [docs/frontend/integration.md](/Users/idcuq/Documents/Bid%20Market/docs/frontend/integration.md)
- Ops storage notes: [docs/frontend/local-storage.md](/Users/idcuq/Documents/Bid%20Market/docs/frontend/local-storage.md)
