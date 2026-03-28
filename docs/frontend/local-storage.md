# Local Storage Guide

## Overview

ShadowBid uses browser local storage for user convenience and for a few bidder-local workflow helpers that the contract cannot keep for the user.

This data is local to one browser profile. It is not automatically synced across devices.

## Current Keys Used By The App

### Auction And Bid Lists

- `shadowbid_auctions`
  Local auction cards used by standard compatibility pages
- `myAuctions`
  Locally tracked auctions created from the current browser
- `shadowbid_bids`
  Local bid history used by compatibility flows

### Reveal Helpers

- `nonce_<auctionId>_<wallet>`
  Saved nonce needed to reveal a bid later
- `commitment_<auctionId>_<wallet>`
  Saved commitment metadata, bid amount, currency, and transaction status

These two keys are the most important local state for the `v2.21` reveal flow.

### Legacy Or Auxiliary Keys

- `auction_<auctionId>_bids`
  Local bid-record helper used by some older pages
- `private_record_locks_<wallet>`
  Prevents reusing the same private ALEO record while a prior action is still pending
- `close_auction_lock_<auctionId>_<wallet>`
  Tracks pending seller close actions while the UI waits for confirmation

### Fixture Testing

- `__shadowbid_v221_fixture_bundle`
  Metadata for the local V2.21 test-fixture seeder

## Why This Matters

### Reveal Depends On Local Data

The contract can validate a reveal only if the bidder supplies the original amount and nonce.

Because of that, the frontend saves:

- the generated nonce
- the commitment metadata

If a user clears browser storage or switches devices before reveal, the on-chain bid can still exist, but the reveal button may not appear because the local helper data is gone.

### Local Storage Is Not The Source Of Truth

- auctions and settlement state still live on-chain
- clearing local storage does not cancel or erase an on-chain bid
- dispute state, payouts, and final outcomes still come from the contract

## Privacy Notes

What local storage can contain:

- your own bid amount
- your saved nonce and commitment
- your created-auction metadata
- local fixture bundles

What it should not contain:

- private keys
- other users' private reveal secrets
- full shared Ops backend state

## Safe Usage Guidelines

1. Avoid clearing browser data before reveal if you still need to open your bid.
2. If you rely on private ALEO bidding, keep the same browser profile until reveal is complete.
3. Do not assume local storage is portable across devices.
4. Treat local bid amounts and saved nonces as sensitive user data.

## Fixture Seeder Behavior

The `/dev/test-fixtures` page writes auction fixtures into browser-local storage.

- if the app is pointing at a local Ops target, fixture ops data can also be synced there
- if the app is pointing at production Ops, the seeder avoids touching shared production state and stays browser-local

## Clearing Data

Clearing local storage can help with stale UI state, but it also removes saved reveal helpers.

Before clearing data, consider whether you still need:

- `nonce_<auctionId>_<wallet>`
- `commitment_<auctionId>_<wallet>`

If you remove them before reveal, you may need to restore them manually to continue the reveal flow from that browser.
