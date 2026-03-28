# ShadowBid Frontend

React + Vite marketplace UI for ShadowBid, including the admin-facing Ops Console and the shared Ops backend integration used by premium lifecycle flows.

The active frontend targets `shadowbid_marketplace_v2_21.aleo` by default.

## What Lives Here

- Marketplace pages for create, bid, reveal, settlement, and admin flows
- Wallet integration for Aleo-compatible wallets, with Shield Wallet as the recommended option
- Vercel Function entrypoint for the Ops backend
- Node/VPS-friendly ops server for development or external hosting

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

## Primary Routes

- `/` premium landing page
- `/premium-auctions` premium marketplace list
- `/premium-create` premium create-auction flow
- `/premium-auction/:auctionId` premium auction detail and lifecycle actions
- `/ops` admin-only operations console
- `/dev/test-fixtures` local browser-only V2.21 fixture seeder
- `/standard/*` compatibility routes kept for older flows and diagnostics

## Environment

```env
VITE_ALEO_NETWORK=testnet
VITE_PROGRAM_ID=shadowbid_marketplace_v2_21.aleo
VITE_REVEAL_PERIOD_SECONDS=900
VITE_DISPUTE_PERIOD_SECONDS=900
VITE_AUCTIONEER_ADDRESS=aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8
VITE_API_BASE=https://api.explorer.provable.com/v1/testnet
```

Optional:

```env
VITE_LOCAL_API_URL=http://127.0.0.1:8787
```

## V2.21 Flow Notes

- Auction creation now sends `reveal_period` and `dispute_period` instead of one shared challenge window.
- Seller flow is `close_auction` -> `settle_after_reveal_timeout` -> `finalize_winner`.
- `finalize_winner` must wait for `dispute_deadline`.
- Private ALEO bids require Shield private-record access; reconnect and approve the request if you see `Decrypt permission denied`.

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

- Quick start: [docs/frontend/quick-start.md](../docs/frontend/quick-start.md)
- User guide: [docs/frontend/user-guide.md](../docs/frontend/user-guide.md)
- Troubleshooting: [docs/frontend/troubleshooting.md](../docs/frontend/troubleshooting.md)
- Integration notes: [docs/frontend/integration.md](../docs/frontend/integration.md)
- Ops storage notes: [docs/frontend/local-storage.md](../docs/frontend/local-storage.md)
- Ops Console guide: [docs/frontend/ops-console.md](../docs/frontend/ops-console.md)
