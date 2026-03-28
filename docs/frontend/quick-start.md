# Quick Start Guide

## Default Routes

The current user-facing app defaults to the premium flow:

- `/`
- `/premium-auctions`
- `/premium-create`
- `/premium-auction/:auctionId`

Compatibility routes still exist under `/standard/*`.

## 1. Connect A Wallet

1. Open the site and click `Connect Wallet`.
2. Choose a wallet. Shield is the recommended path for private ALEO bidding.
3. Approve the connection request.
4. If you plan to use private ALEO credits, be ready to approve private-record access when the bid flow asks for it.

## 2. Create A V2.21 Auction

1. Open `/premium-create`.
2. Fill in the auction details:
   - title and description
   - minimum bid
   - reserve price
   - currency: `ALEO`, `USDCx`, or `USAD`
   - asset type
   - auction end time
   - reveal period
   - dispute period
3. Submit the create transaction in your wallet.
4. After confirmation, the auction appears in `/premium-auctions`.

## 3. Submit A Bid

1. Open the auction detail page.
2. Choose the bidding path that matches the auction currency.
3. Submit the bid.
4. If you use private ALEO:
   - Shield may request access to private records
   - approve the request
   - the app will save bidder-local nonce and commitment data for reveal later

## 4. Close The Auction

When the end time passes, the contract still remains `OPEN` until the seller closes it.

1. The seller opens the auction detail page.
2. Use `Close Auction`.
3. After confirmation, the auction moves to `CLOSED` and the reveal window starts.

## 5. Reveal Before The Deadline

1. Bidders who committed must reveal before `reveal_deadline`.
2. Reveal should usually happen from the same browser and wallet session that placed the bid, because the saved nonce and commitment are stored locally.
3. Valid reveals become eligible for settlement. Unrevealed bids do not overtake valid revealed bids.

## 6. Settle After Reveal Timeout

After the reveal window ends:

1. The seller uses `Settle After Reveal Timeout`.
2. If the reserve is met, the auction moves into `CHALLENGE`.
3. If no valid reveal remains or the reserve is not met, the contract can cancel the auction.

## 7. Finalize After The Dispute Window

1. During `CHALLENGE`, users can open a dispute if needed.
2. Once `dispute_deadline` passes and there is no active dispute block, the seller can run `Finalize Winner`.
3. The auction then moves into settlement completion.

## 8. Complete Claims

After settlement:

- the winner can confirm receipt
- the seller can claim the net payout after receipt confirmation or the confirmation timeout
- the platform owner can claim the platform fee after seller payment is claimed
- losing bidders or cancelled-auction participants can claim refunds through the currency-specific refund flow

## Local Testing Shortcut

For UI testing without touching production Ops state:

1. Run the frontend locally.
2. Open `/dev/test-fixtures`.
3. Click `Seed Fixtures`.

This seeds browser-local V2.21 auction scenarios so the premium list, detail page, and Ops console can be exercised quickly.
