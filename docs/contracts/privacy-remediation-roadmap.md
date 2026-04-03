# ShadowBid Privacy Remediation Roadmap

## Status

- Remediated source landed in this repository
- Remediated deployment is now live on Aleo testnet as `shadowbid_marketplace_v2_22.aleo`
- Frontend defaults in this repo now target `v2.22`
- Motivated by Wave 4 feedback and confirmed against `contracts/src/main.leo` plus the live `v2.22` deployment

## Current `v2.22` Reality

The active deployed contract closes the original Wave 4 code-level flaws, but it is still not yet a fully hidden-amount sealed-bid system.

The two original Wave 4 issues were:

1. `escrow.amount` is written into a public mapping during commit.
2. `reveal_bid` recomputes the commitment as `nonce + amount as field`.

The live `v2.22` program now means:

- a bidder's per-bid escrow amount is no longer queryable from the `escrow` mapping before reveal
- commitment verification is cryptographic and contract-derived
- private ALEO funding still hides wallet record details, but public funding flows can still leak transfer amounts

## Remediation Shipped

The repository source and live `v2.22` program now do two important things:

1. It stops storing per-bid `escrow.amount` in the public mapping.
2. It replaces `nonce + amount as field` with an in-contract `BHP256` commitment over `auction_id`, `bidder`, `amount`, and `nonce`.

That closes the exact code-level flaws called out in Wave 4, but it does not by itself make the live program fully hidden-amount private.

## Remaining Contract Changes

### 1. Hide Transfer Amounts During Funding

The next deployed version still needs to avoid leaking bid amounts through public funding transitions.

Preferred direction:

- hold bid funds in private records or an equivalent privacy-preserving escrow path
- keep only the minimum public state needed for lifecycle progress and final settlement
- avoid any public funding path that exposes the bid amount before reveal

### 2. Preserve Cryptographic Commitment Verification In Future Upgrades

The live `v2.22` program already verifies a cryptographic commitment instead of linear addition. Future upgrades must preserve that scheme.

Recommended shape:

- preimage includes `auction_id`, `bidder`, and `amount`
- randomness is bidder-generated high-entropy secret material
- commitment uses a cryptographic hash or commitment function that matches the contract exactly

This binds the bid to the auction and bidder while making brute-force or structural attacks materially harder.

### 3. Keep Reveal Verification Decoupled From Public Escrow Amounts

`reveal_bid` should:

- accept the private randomness in the correct type
- recompute the cryptographic commitment from the reveal preimage
- compare against the stored commitment without relying on a public escrow amount equality check

### 4. Preserve Refund And Settlement Semantics

The privacy fix cannot regress auction mechanics that already work well in `v2.21`.

The upgraded flow still needs:

- deterministic timeout settlement
- reserve checks
- loser refunds
- seller payout and platform-fee ordering
- dispute compatibility

## Frontend And Wallet Changes

The premium UI and transaction helpers will need a coordinated upgrade:

- generate and store a `scalar` nonce instead of the current field-style helper
- compute commitments with the same cryptographic scheme as the contract
- update reveal inputs and local storage expectations
- rewrite privacy-facing copy so it matches the upgraded contract exactly

## Deployment Implication

This is not a silent patch to the existing program.

Because the commitment scheme and escrow semantics changed, the privacy remediation shipped under a new Aleo program deployment and corresponding frontend configuration update: `shadowbid_marketplace_v2_22.aleo`.

For the recommended follow-up design direction, see `v2.23-private-escrow-proposal.md`.

## Acceptance Criteria

The follow-up version should only be marketed as hidden-amount sealed-bid privacy if all of the following are true:

- no public mapping exposes per-bid committed amounts before reveal
- commitments are cryptographic, not arithmetic placeholders
- reveal validates against the cryptographic commitment
- refunds, settlement, and dispute flows still work end to end
