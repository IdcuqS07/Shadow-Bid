# Autonomous Lifecycle Design

This document captures the next-step contract and protocol options for making the ShadowBid auction lifecycle more autonomous than the current `v2.20` flow.

It is a design document, not an implementation record. The active on-chain program remains `shadowbid_marketplace_v2_20.aleo`.

## Why `v2.20` Is Not Enough For Full Autonomy

`v2.20` already supports the full sealed-bid lifecycle:

- `close_auction`
- `reveal_bid`
- `determine_winner`
- `finalize_winner`
- reserve-price cancellation
- dispute open and resolution
- refund, seller claim, and platform fee claim

The main blocker for full autonomy is `reveal_bid`.

In the live contract, `reveal_bid` still requires bidder-local secret material:

- `amount`
- `nonce`
- `self.signer` of the bidder

That means a backend keeper cannot safely reveal on behalf of the bidder today unless the protocol changes. This is why client-side auto-catch-up is possible on `v2.20`, but fully autonomous reveal is not.

## Current State Machine Constraints

The active contract stores auction lifecycle state in `AuctionInfo` and commitment/escrow records in:

- `auctions`
- `commitments`
- `escrow`
- `highest_bid`
- `highest_bidder`
- `auction_dispute_root`

Two important constraints in the current design:

1. `challenge_end_time` is overloaded.
   After `close_auction`, it behaves like a reveal deadline.
   After `determine_winner`, it behaves like a dispute/challenge deadline.

2. `confirm_receipt` is explicitly winner-driven.
   The winner must still call it directly.

For a more autonomous design, a follow-up contract should split lifecycle deadlines more clearly, for example:

- `reveal_deadline`
- `dispute_deadline`
- `claim_deadline`

## Option 1: Delegated Reveal Authority

This is the most direct way to let a keeper reveal later without waiting for the bidder to come back online.

### User Experience

At commit time, the bidder does three things:

1. Commits the bid normally.
2. Grants a keeper the right to reveal for this auction.
3. Produces a reveal package that the keeper can use later if needed.

The reveal itself still happens only after the auction is closed. The difference is that the keeper is now authorized to submit it.

### Contract Changes

Recommended additions:

- `mapping reveal_delegate: field => RevealDelegate`
- `mapping reveal_package_root: field => field`
- `mapping reveal_delegate_status: field => u8`

Suggested structs:

```text
RevealDelegate {
  bidder: address,
  keeper: address,
  expiry: i64,
  mode: u8,          // one-shot, renewable, auction-scoped
  is_revoked: bool
}
```

```text
RevealPackageMeta {
  package_root: field,
  submitted_at: i64,
  used_at: i64,
  used_by: address
}
```

Suggested new transitions:

- `authorize_reveal_delegate`
- `revoke_reveal_delegate`
- `reveal_bid_by_delegate`

### Protocol Changes

The bidder would prepare a reveal package containing the equivalent of:

- `auction_id`
- `amount`
- `nonce`
- `bidder`
- optional expiry or one-time-use metadata

The contract should verify that:

- the delegate is authorized for that auction and bidder
- the delegation has not expired or been revoked
- the delegated reveal still matches the original bid commitment

### Benefits

- Makes reveal possible even when the bidder returns late or not at all
- Keeps the commit-reveal design intact
- More operationally realistic than full threshold cryptography

### Risks

- Requires a real trust model for the keeper
- Delegation and revocation logic add contract complexity
- A badly designed delegation format could over-authorize the keeper

## Option 2: Encrypted Reveal Escrow

This design lets the bidder store reveal secrets in encrypted form at commit time, so a keeper can later obtain them only when the reveal window opens.

### User Experience

At commit time, the bidder encrypts the reveal payload and publishes or stores:

- ciphertext
- metadata
- on-chain root or hash anchor

The keeper later fetches the encrypted package and decrypts it only when the auction is eligible for reveal.

### Contract Changes

Recommended additions:

- `mapping reveal_ciphertext_root: field => field`
- `mapping reveal_escrow_mode: field => u8`
- optional `mapping reveal_escrow_status: field => u8`

Suggested new transitions:

- `set_reveal_ciphertext_root`
- `register_reveal_escrow`
- optionally `reveal_bid_from_escrow`

The contract may still not need to store the ciphertext itself. It can store a root or hash that anchors the off-chain encrypted payload.

### Cryptographic Model Choices

There are two major ways to do this:

1. Single keeper public key
   The bidder encrypts to one keeper-controlled key.
   This is simpler but more trust-heavy.

2. Threshold or committee key
   The bidder encrypts to a distributed keeper set.
   This is stronger, but significantly more complex operationally.

### Benefits

- Stronger path to true unattended reveal
- Better long-term architecture if the product wants keeper-operated autonomy
- More flexible than raw delegation if multiple keepers are needed

### Risks

- Largest protocol complexity of all options
- Introduces key-management and escrow-availability requirements
- Harder to reason about and test than plain delegated authority

## Option 3: Penalize Non-Reveal Or Add Fallback Logic

This does not make reveal itself automatic. Instead, it makes the protocol robust when a bidder fails to reveal in time.

### What Changes

After the reveal deadline passes, the contract would not block the auction forever. It would apply deterministic fallback rules.

Possible rules:

- unrevealed bids are ignored for winner determination
- unrevealed bids lose a penalty deposit
- no valid reveals means cancel and refund according to policy
- repeated non-reveal behavior can be made economically costly

### Contract Changes

Recommended additions:

- split `challenge_end_time` into separate lifecycle deadlines
- add `non_reveal_penalty_bps` or fixed penalty settings
- add fields for `reveal_deadline` and `dispute_deadline`
- add a transition such as `finalize_after_reveal_timeout`

Possible state additions:

- `state = REVEAL_EXPIRED`
- `state = AUTO_CANCELLED`

Possible new transitions:

- `settle_after_reveal_timeout`
- `slash_non_revealed_bid`
- `cancel_if_no_valid_reveals`

### Benefits

- Much easier than encrypted escrow
- Prevents auctions from stalling forever
- Creates a clear economic incentive to reveal on time

### Risks

- Does not by itself create automatic reveal
- Penalty sizing needs careful product design
- Users need very clear disclosure before bidding

## Recommended Direction For ShadowBid

The most realistic roadmap is phased, not all-at-once.

### Phase 1: Strengthen `v2.20` Operations Without Contract Change

- Keep client-side auto-catch-up
- Add global pending-action scanning after wallet connect
- Add strong reveal reminders and notifications

This gets the best practical improvement with minimal risk.

### Phase 2: Add Non-Reveal Fallback In `v2.21`

- Split lifecycle deadlines
- Ignore or penalize unrevealed bids after timeout
- Allow deterministic continuation of the auction lifecycle

This is the best first contract upgrade if the goal is operational reliability.

### Phase 3: Add Delegated Reveal Authority

- Auction-scoped delegated reveal
- Revocation and expiry controls
- Keeper-triggered reveal with constrained authority

This is the best next step if the goal is unattended lifecycle progression.

### Phase 4: Evaluate Encrypted Reveal Escrow

- Only pursue this if the product truly needs trust-minimized unattended reveal
- Treat it as a protocol project, not a UI improvement

## Suggested `v2.21` Data Model Changes

At minimum, a follow-up contract should consider replacing the overloaded timing model with:

```text
AuctionInfoV21 {
  end_time: i64,
  reveal_deadline: i64,
  dispute_deadline: i64,
  claimable_at: i64,
  ...
}
```

And adding one or both of:

```text
reveal_delegate: field => RevealDelegate
reveal_ciphertext_root: field => field
```

## Recommendation Summary

If the goal is "make the auction keep moving even when users are late", the best order is:

1. `v2.21` fallback and non-reveal handling
2. delegated reveal authority
3. encrypted reveal escrow only if still needed

If the goal is "full autonomous lifecycle with the least user dependency", delegated reveal plus a penalty-backed fallback is the strongest practical direction.

## What This Document Does Not Change

This document does not modify the live `v2.20` contract.

It is an implementation blueprint for a future contract revision, most likely `v2.21` or a later protocol release.
