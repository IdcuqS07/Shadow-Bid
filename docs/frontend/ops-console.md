# Ops Console Guide

## What Ops Console Is

`Ops Console` is ShadowBid's admin operations workspace. It is not the buyer-facing auction UI. It exists to help the platform owner review lifecycle health, analytics, executor recommendations, dispute cases, and post-settlement fee readiness around the live `v2.20` auction flow.

The canonical frontend route is:

- `/ops`

Legacy routes such as `/admin-v3` and `/standard/admin-v3` redirect to `/ops`.

## Who Can Access It

`Ops Console` is wallet-gated. The page is intended for the platform owner wallet only.

- Route protection is handled by `AdminOnlyRoute`
- The premium nav and standard sidebar only show the entry when the connected wallet matches the platform owner
- Non-admin wallets are redirected away from the page

## What It Does

The console combines application-side operational data with the current on-chain lifecycle.

Main areas in the UI:

- `Ops API health`
  Shows whether the frontend can reach the shared operations backend
- `Analytics`
  Surfaces totals for auctions, watchlists, disputes, offers, GMV, fee potential, and settlement rates
- `Executor`
  Shows recommended lifecycle jobs such as close, determine winner, finalize, cancel on reserve miss, seller payout readiness, and platform-fee follow-up
- `Verification readiness`
  Displays seller verification and proof-readiness context derived from synced app data
- `Dispute resolution`
  Lets the platform owner submit dispute-resolution transactions for the `v2.20` flow

## What It Is Not

`Ops Console` is intentionally not the source of truth for the auction contract.

- On-chain state still comes from the Aleo contract and explorer-backed reads
- Premium auction pages remain the main place where users create, bid, reveal, settle, and claim
- `Ops Console` reads and organizes operational context around those flows so admin review is easier

## How Data Reaches Ops Console

The console depends on the shared Ops backend. That backend stores and serves application-layer state such as:

- synced auction snapshots
- wallet engagement roles
- watchlists and saved searches
- notifications
- proof bundles
- seller verification records
- disputes
- executor settings and run history

High-level flow:

1. Premium pages load auction details and user actions from the live `v2.20` contract.
2. The frontend syncs selected lifecycle snapshots into the Ops backend.
3. The Ops backend computes analytics, notifications, and executor recommendations.
4. `Ops Console` reads those endpoints and renders the admin-facing workspace.

Because of that design, `Ops Console` can look empty if premium pages have not yet synced any auction snapshots into the shared operations store.

## Backend Modes Supported by the Repo

The repo supports two backend modes for the Ops layer.

### 1. Vercel Function mode

This is the serverless mode shipped from `frontend/api/index.js`.

- good for simpler managed deployment
- uses shared Ops API logic from `frontend/ops-api/core.js`
- can persist through the Vercel Blob adapter

### 2. Node/VPS mode

This is the long-running backend mode served by `frontend/local-api/server.mjs`.

- good for VPS deployments and background-style operational workloads
- uses the same shared Ops API logic from `frontend/ops-api/core.js`
- can persist through the filesystem-backed store
- is typically exposed behind Nginx, for example `https://api.shadowbid.xyz`

The frontend supports both patterns through `frontend/src/services/localOpsService.js`.

## Frontend Routing and API Resolution

`localOpsService.js` resolves the backend in this order:

1. `VITE_LOCAL_API_URL`
2. local dev fallback `http://127.0.0.1:8787`
3. inferred production fallback `https://api.shadowbid.xyz` for `shadowbid.xyz` and `www.shadowbid.xyz`

That means the UI can run against:

- a local Ops server during development
- a VPS-hosted Ops backend in production
- or the built-in Vercel Function path when configured that way

## Key Files

Frontend and routing:

- `frontend/src/pages/AdminDashboardV3.jsx`
- `frontend/src/components/auth/AdminOnlyRoute.jsx`
- `frontend/src/components/premium/PremiumNav.jsx`
- `frontend/src/components/layout/Sidebar.jsx`
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

## Local Development Notes

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

## Evaluation Checklist

When reviewing `Ops Console`, these are the most useful questions to ask:

- Is the frontend reaching the shared Ops backend?
- Have premium auction pages already synced snapshots into the operations store?
- Do analytics totals line up with the synced auction lifecycle?
- Are executor recommendations aligned with the current contract state?
- Are dispute actions only available to the platform owner wallet?
- Is fee-claim readiness shown only after seller payout is complete?

## Practical Summary

`Ops Console` is the admin-side operational lens for ShadowBid `v2.20`.

- Premium pages remain the user workflow
- `/ops` is the admin workflow
- the shared Ops backend ties the two together
