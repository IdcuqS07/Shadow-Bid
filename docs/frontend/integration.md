# Smart Contract Integration Guide

## Scope

The production marketplace integration now centers on `frontend/src/services/aleoServiceV2.js` and the active program `shadowbid_marketplace_v2_21.aleo`.

`frontend/src/services/aleoService.js` still exists as a compatibility helper for older standard pages, but new work should target `aleoServiceV2.js`.

## Active Contract

- Program ID: `shadowbid_marketplace_v2_21.aleo`
- Network: Aleo Testnet
- Platform address: `aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8`

## Environment

```env
VITE_ALEO_NETWORK=testnet
VITE_PROGRAM_ID=shadowbid_marketplace_v2_21.aleo
VITE_REVEAL_PERIOD_SECONDS=900
VITE_DISPUTE_PERIOD_SECONDS=900
VITE_AUCTIONEER_ADDRESS=aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8
VITE_API_BASE=https://api.explorer.provable.com/v1/testnet
```

Optional for local Ops development:

```env
VITE_LOCAL_API_URL=http://127.0.0.1:8787
```

## Core Integration Files

- `frontend/src/services/aleoServiceV2.js`
  Active transaction helpers, mapping readers, amount conversions, and lifecycle helpers
- `frontend/src/services/aleoService.js`
  Compatibility layer for older standard flows
- `frontend/src/services/localOpsService.js`
  Shared Ops API client for watchlists, offers, disputes, analytics, and executor state
- `frontend/src/utils/auctionStateValidator.js`
  Contract-program targeting and state validation helpers

## V2.21 Lifecycle Helpers

The main transaction helpers exposed by `aleoServiceV2.js` are:

- `createAuction(executeTransaction, auctionId, minBidAmount, reservePrice, currencyType, assetType, endTime, revealPeriod, disputePeriod)`
- `closeAuction(executeTransaction, auctionId, closedAt?)`
- `revealBid(executeTransaction, auctionId, amount, nonce, revealedAt?)`
- `settleAfterRevealTimeout(executeTransaction, auctionId, settledAt?)`
- `finalizeWinner(executeTransaction, auctionId, finalizedAt?)`
- `confirmReceipt(executeTransaction, auctionId)`
- `openDisputeOnChain(executeTransaction, auctionId, disputeRoot, openedAt?)`

Currency-specific bid and refund helpers:

- `commitBid(...)` and `claimRefund(...)` for the default USDCx path
- `commitBidAleo(...)` and `claimRefundAleo(...)` for public ALEO credits
- `commitBidAleoPrivate(...)` and `claimRefundAleoPrivate(...)` for private ALEO credits
- `commitBidUSAD(...)` and `claimRefundUSAD(...)` for USAD

Post-settlement payout helpers:

- `claimWinningAleo(...)`
- `claimWinningUSDCx(...)`
- `claimWinningUSAD(...)`
- `claimPlatformFeeAleo(...)`
- `claimPlatformFeeUsdcx(...)`
- `claimPlatformFeeUsad(...)`

## Parsed On-Chain Fields

The active parser reads the `v2.21` lifecycle fields:

- `reveal_period`
- `dispute_period`
- `reveal_deadline`
- `dispute_deadline`
- `reserve_price`
- `reserve_met`
- `settled_at`
- `claimable_at`
- `platform_fee_amount`
- `seller_net_amount`
- `platform_fee_claimed`
- `item_received`
- `payment_claimed`

For backward compatibility, the parser can still fall back to:

- `challenge_period`
- `challenge_end_time`

That fallback is intentional so older data or partially migrated UI paths do not break immediately.

## State Mapping

The app maps the contract lifecycle into the following UI statuses:

- `open`
- `closed`
- `challenge`
- `disputed`
- `settled`
- `cancelled`

The key behavioral shift in `v2.21` is that `closed` now leads to `settle_after_reveal_timeout`, not `determine_winner`.

## Privacy And Wallet Notes

- Sealed bids remain hidden during the commit phase.
- Private ALEO flows require wallet record access. The app requests decrypt permission on demand so Shield can expose private credits only when needed.
- If the wallet session was connected without that permission, private bidding can fail with `Decrypt permission denied`. Reconnect Shield and approve the private-record request.
- The app masks seller addresses in the main marketplace UI, but the seller settlement account still exists on-chain.
- Winner address and winning amount become visible after the settlement flow completes.

## Local Browser State

The frontend stores bidder-local helpers in browser storage:

- `nonce_<auctionId>_<wallet>`
- `commitment_<auctionId>_<wallet>`

That means reveal is typically expected from the same browser and wallet session that created the bid, unless the user restores the saved nonce and commitment data.

## Ops Integration

Premium pages sync contract-derived snapshots into the shared Ops backend so `/ops` can compute:

- analytics
- executor recommendations
- dispute review queues
- watchlists and notifications
- seller verification and proof readiness

This sync layer is intentionally separate from the on-chain source of truth.

## Minimal Example

```javascript
import {
  createAuction,
  closeAuction,
  revealBid,
  settleAfterRevealTimeout,
  finalizeWinner,
} from '@/services/aleoServiceV2';

await createAuction(executeTransaction, auctionId, minBid, reservePrice, 1, 0, endTime, 900, 900);
await closeAuction(executeTransaction, auctionId);
await revealBid(executeTransaction, auctionId, amountMicro, nonce);
await settleAfterRevealTimeout(executeTransaction, auctionId);
await finalizeWinner(executeTransaction, auctionId);
```
