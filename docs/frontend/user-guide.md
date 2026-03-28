# ShadowBid Marketplace User Guide

## Overview

ShadowBid `v2.21` is a sealed-bid marketplace on Aleo with:

- three supported currencies: `ALEO`, `USDCx`, and `USAD`
- split reveal and dispute deadlines
- dispute-aware settlement
- seller, winner, and platform-fee claim flows after settlement

The default user routes are the premium pages:

- `/premium-auctions`
- `/premium-create`
- `/premium-auction/:auctionId`

## For Sellers

### Create An Auction

1. Open `/premium-create`.
2. Fill in:
   - title, description, and asset details
   - minimum bid
   - reserve price
   - currency
   - reveal period
   - dispute period
3. Submit the transaction from your wallet.

Optional seller metadata:

- seller display name
- proof bundle summary
- verification details
- on-chain proof and profile roots

### Close The Auction

After the end time passes, the contract still waits for the seller to close the auction.

1. Open the auction detail page.
2. Click `Close Auction`.
3. The reveal window begins.

### Settle After Reveal Timeout

Once the reveal window ends:

1. Use `Settle After Reveal Timeout`.
2. The contract decides whether the auction continues into `CHALLENGE` or cancels.
3. Reserve handling is part of this timeout settlement in `v2.21`.

### Finalize The Winner

If the auction enters `CHALLENGE`:

1. wait until `dispute_deadline`
2. make sure there is no unresolved on-chain dispute
3. use `Finalize Winner`

### Claim Seller Payment

After settlement:

- if the winner confirms receipt, the seller can claim sooner
- otherwise the seller waits until `claimable_at`
- the seller then claims the net amount after platform fee calculation

## For Bidders

### Commit A Bid

1. Open the auction detail page.
2. Choose the correct currency flow:
   - public ALEO
   - private ALEO
   - USDCx
   - USAD
3. Submit the bid transaction.

If you use private ALEO:

- Shield may prompt for private-record access
- approve the request
- the app stores your nonce and commitment locally for the reveal step

### Reveal The Bid

If you committed a bid:

1. return after the seller closes the auction
2. reveal before `reveal_deadline`
3. use the same browser and wallet session when possible, because reveal depends on the locally saved nonce and commitment

### Claim A Refund

Refunds are available when:

- the auction is cancelled
- the auction settles and you are not the winner

Use the refund action that matches the auction currency.

## For Winners

After the seller finalizes the winner:

1. review the auction detail page
2. confirm receipt once the item or outcome is delivered
3. this unlocks seller payout sooner than waiting for the timeout

## For The Platform Owner

The platform owner has two extra responsibilities:

- review lifecycle readiness, disputes, and executor recommendations in `/ops`
- claim the platform fee after seller payment has been claimed

If a dispute is escalated, the platform owner can use the dispute resolution actions from the admin console.

## Privacy Model

### Hidden During Commit Phase

- bid amounts
- private ALEO transfer details when the private record flow is used
- bidder-local nonce and commitment helpers stored in the browser

### Visible During Or After Settlement

- auction metadata
- escrow totals
- dispute state
- seller settlement account on-chain
- winner address and winning amount after settlement completes

The marketplace masks seller addresses in the main UI by default, but the contract still settles against the seller account on-chain.

## Legacy Standard Pages

The repo still contains `/standard/*` pages for compatibility and diagnostics. The premium flow is the primary user path for current `v2.21` behavior.
