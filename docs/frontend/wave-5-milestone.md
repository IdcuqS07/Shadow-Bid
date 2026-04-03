# Wave 5 Milestone

## Scope

Wave 5 should build ShadowBid's marketplace trust and operations layer on top of the live `v2.22` stack.

This wave is a `v2.22` product and operations milestone, not a `v2.23` privacy-protocol milestone.

- base contract target: `shadowbid_marketplace_v2_22.aleo`
- base frontend target: premium routes plus `/ops`
- base ops target: shared Ops API and admin console
- explicit non-goal: private `USDCx` funding via the paused `v2.23` `get_credentials` path

## Goal

Make ShadowBid materially more usable for higher-trust and higher-value listings by shipping:

- seller verification workflows
- proof-bundle workflows
- dispute handling
- watchlists and notifications
- admin analytics and executor visibility
- premium UX improvements across `ALEO`, `USDCx`, and `USAD`

## Current Foundation

The repo already contains a meaningful partial foundation for Wave 5:

| Area | Current state in repo | Readiness |
| --- | --- | --- |
| Seller verification | Ops storage and premium create/detail surfaces already exist | partial |
| Proof bundles | Ops storage, premium create flow, and detail-page display already exist | partial |
| Disputes | Shared dispute store and admin on-chain resolution flow already exist | partial |
| Watchlists | Wallet-scoped watchlist APIs and list/detail consumers already exist | partial |
| Notifications | Wallet-scoped notification APIs and premium notification center already exist | partial |
| Admin analytics | `/ops` dashboard, analytics summary, executor state, and dispute review already exist | partial |
| Multi-currency premium UX | `ALEO`, `USDCx`, and `USAD` are already wired into the active `v2.22` flows | partial |

Wave 5 is therefore realistic because it is mostly a completion and hardening milestone, not a greenfield build.

## Must Ship

These are the items that should define Wave 5 as complete.

### 1. Seller Verification Baseline

- seller verification data can be created, edited, persisted, and reloaded across sessions
- premium create/detail pages show verification status, tier, authority, certificate metadata, and seller display name consistently
- `/ops` can review verification state without relying on fixture-only data
- on-chain seller profile root anchoring remains visible and understandable in the UI

Acceptance:

- a seller can publish a premium auction with verification metadata
- another wallet can load the auction later and see the same verification state
- the admin console can inspect that seller record

### 2. Proof-Bundle Workflow Baseline

- proof bundles can be attached to auctions and reloaded from the shared ops store
- detail pages show summary, authenticity note, and evidence references cleanly
- proof bundle state is tied to the auction ID, not only local browser storage
- on-chain proof/disclosure roots are surfaced as anchors, not hidden implementation details

Acceptance:

- creating an auction stores proof-bundle metadata in shared ops storage
- auction detail shows the proof bundle after reload on another session
- the on-chain proof root shown in the UI matches the stored anchor state when available

### 3. Dispute Flow End-to-End

- bidders or sellers can open dispute records with evidence and timeline entries
- `/ops` can review disputes, append timeline updates, and resolve them through the platform-owner wallet flow
- dispute UI clearly distinguishes app-layer dispute records from on-chain dispute root state
- status transitions stay consistent between premium pages, ops console, and on-chain lifecycle

Acceptance:

- a dispute can be opened against an auction and is visible on both premium detail and `/ops`
- the platform owner can submit release-to-seller or refund-to-winner on-chain resolution
- the stored dispute record reflects the chosen resolution and transaction ID

### 4. Watchlists And Notifications

- wallets can follow auctions, sellers, and categories
- saved searches are durable and easy to re-apply from the premium list page
- notifications cover the minimum lifecycle moments that affect user action:
  close due, reveal due, reveal expired, winner selected, seller claimable, platform-fee claimable
- unread, read, and dismiss behavior works consistently for connected wallets

Acceptance:

- a wallet can save a search and restore it later
- a wallet can watch an auction and receive lifecycle notifications in the premium nav
- notification counts and read state survive page reloads

### 5. Admin Analytics And Executor Readiness

- `/ops` stays usable as the admin source of truth for auctions, disputes, watchlists, offers, and executor jobs
- analytics totals are driven by synced shared data, not only local fixtures
- executor state and recent runs are visible enough for operational debugging
- health/offline states degrade clearly when the ops backend is unavailable

Acceptance:

- `/ops` shows health, analytics totals, executor queue, and disputes against the live shared store
- the platform owner can tell whether the ops backend is online and whether lifecycle jobs are waiting

### 6. Premium UX Across ALEO, USDCx, And USAD

- premium create/list/detail/commit/settlement flows behave coherently across all three supported rails
- token labels, balances, and amount formatting are consistent
- user-facing copy is honest about privacy: `v2.22` fixes the original code-level flaw but public funding amounts are still visible on-chain
- higher-value listing UX should feel intentional, not like a fixture/demo path

Acceptance:

- a seller can create auctions in `ALEO`, `USDCx`, and `USAD`
- the list/detail pages render the correct token and settlement context
- the app does not imply hidden-amount privacy where the live contract does not provide it

## Should Ship

These items would make Wave 5 stronger, but they should not block release if the `Must Ship` set is complete.

- richer proof-bundle previews and file metadata
- notification preferences and quieter alert tuning
- stronger wallet reputation scoring and seller trust heuristics
- saved-search to watchlist shortcuts
- admin export/report views for disputes and settlement operations
- improved executor automation beyond manual scan-first operation

## Out Of Scope

These should stay out of Wave 5 unless priorities change.

- reopening `v2.23` as a private-`USDCx` release candidate
- building `get_credentials` from public mappings
- raw issuer/vendor proof-source discovery as a release dependency
- claiming full hidden-amount sealed-bid privacy on the live `v2.22` contract
- major contract ABI changes that would force a new deployment track

## Delivery Order

The safest implementation order is:

1. harden shared ops persistence and schema assumptions
2. finish seller verification and proof-bundle persistence
3. complete dispute creation, review, and resolution flows
4. tighten watchlists, saved searches, and notifications
5. polish `/ops` analytics and executor visibility
6. run multi-currency UX regression across `ALEO`, `USDCx`, and `USAD`

## Release Gate

Wave 5 should be considered ready only if all of the following are true:

- `v2.22` remains the active deployment target
- seller verification and proof-bundle data survive reloads and cross-session checks
- disputes can be opened, reviewed, and resolved end-to-end
- watchlists, saved searches, and notifications behave correctly for connected wallets
- `/ops` gives the platform owner a dependable operational view
- premium routes behave consistently across all supported currencies

## Product Claim

Safe product claim for Wave 5:

`Wave 5 makes ShadowBid more trustworthy and operable for real listings on top of v2.22, but it does not change the current privacy ceiling of the live funding rails.`
