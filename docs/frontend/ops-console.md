# Ops Console Guide

## What Ops Console Is

`Ops Console` is ShadowBid's admin-side workspace for the active `v2.21` marketplace flow.

It is not the buyer-facing auction UI. Instead, it helps the platform owner monitor:

- shared Ops API health
- synced auction analytics
- executor recommendations
- seller verification and proof readiness
- dispute review and on-chain dispute resolution
- post-settlement fee readiness

The canonical route is:

- `/ops`

Legacy routes such as `/admin-v3` and `/standard/admin-v3` redirect to `/ops`.

## Who Can Access It

`Ops Console` is wallet-gated for the platform owner wallet.

- route protection is handled by `AdminOnlyRoute`
- the premium nav only shows the entry when the connected wallet matches the platform owner
- non-admin wallets are redirected away from the page

## What It Tracks

Main areas in the UI:

- `Ops API health`
  Confirms whether the frontend can reach the shared operations backend
- `Analytics`
  Totals for auctions, disputes, offers, watchlists, GMV, and fee potential
- `Auto Lifecycle Executor`
  Recommends contract-aligned actions such as `close_auction`, `settle_after_reveal_timeout`, `finalize_winner`, `seller_claim_ready`, and `claim_platform_fee`
- `Verification readiness`
  Surfaces seller verification and proof-bundle context synced from premium pages
- `Dispute center`
  Lets the platform owner review disputes and submit the v2.21 on-chain dispute resolution transitions

## What It Is Not

`Ops Console` is not the source of truth for contract state.

- on-chain state still comes from the Aleo contract and explorer-backed reads
- premium auction pages remain the main place where users create, bid, reveal, settle, and claim
- `Ops Console` organizes the operational context around those flows so admin review is faster

## How Data Reaches Ops Console

The console depends on the shared Ops backend. That backend stores and serves application-layer state such as:

- synced auction snapshots
- wallet roles and watchlists
- notifications
- seller verification records
- proof bundles
- private offers
- disputes
- executor settings and recent runs

High-level flow:

1. Premium pages read auction details and user actions from the live `v2.21` contract.
2. The frontend syncs selected lifecycle snapshots into the Ops backend.
3. The Ops backend derives analytics, notifications, and executor recommendations.
4. `Ops Console` reads those endpoints and renders the admin workspace.

Because of that design, `Ops Console` can look empty if premium pages have not synced any auction snapshots into the shared operations store yet.

## Backend Modes Supported By The Repo

The repo supports two backend modes for the Ops layer.

### 1. Vercel Function mode

This mode is shipped from `frontend/api/index.js`.

- good for serverless deployment
- uses shared logic from `frontend/ops-api/core.js`
- can persist through the Vercel Blob adapter

### 2. Node or VPS mode

This mode is served by `frontend/local-api/server.mjs`.

- good for VPS deployments and long-running admin workloads
- uses the same shared logic from `frontend/ops-api/core.js`
- can persist through the filesystem-backed store
- is typically exposed behind Nginx, for example `https://api.shadowbid.xyz`

The frontend resolves both patterns through `frontend/src/services/localOpsService.js`.

## Frontend API Resolution

`localOpsService.js` resolves the backend in this order:

1. `VITE_LOCAL_API_URL`
2. local dev fallback `http://127.0.0.1:8787`
3. inferred production fallback `https://api.shadowbid.xyz` for `shadowbid.xyz` and `www.shadowbid.xyz`

That lets the UI run against:

- a local Ops server during development
- a VPS-hosted Ops backend in production
- or the Vercel Function path when configured that way

## Key Files

Frontend and routing:

- `frontend/src/pages/AdminDashboardV3.jsx`
- `frontend/src/components/auth/AdminOnlyRoute.jsx`
- `frontend/src/components/premium/PremiumNav.jsx`
- `frontend/src/App.jsx`

Ops backend logic:

- `frontend/src/services/localOpsService.js`
- `frontend/ops-api/core.js`
- `frontend/api/index.js`
- `frontend/local-api/server.mjs`

Deployment helpers:

- `frontend/deploy/backend.env.example`
- `frontend/deploy/ops-api.service`
- `frontend/deploy/nginx-shadowbid-ops.conf`

## Local Development

To run the UI with the local Ops backend:

```bash
cd frontend
npm ci
npm run dev:api
npm run dev
```

Then open:

- frontend: `http://localhost:3007`
- ops health: `http://127.0.0.1:8787/api/health`
- admin console: `http://localhost:3007/ops`

## Review Checklist

When reviewing `Ops Console`, these are the most useful questions:

- Is the frontend reaching the shared Ops backend?
- Have premium auction pages already synced snapshots into the operations store?
- Do executor recommendations match the current contract state and deadlines?
- Are dispute actions visible only to the platform owner wallet?
- Is seller-claim and platform-fee readiness shown only when the lifecycle actually allows it?

## Practical Summary

`Ops Console` is the admin-side operational lens for ShadowBid `v2.21`.

- premium pages remain the user workflow
- `/ops` is the admin workflow
- the shared Ops backend ties the two together
