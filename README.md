
# Private Sealed-Bid Marketplace

## Overview
Private Sealed-Bid Marketplace adalah sistem lelang berbasis zero‑knowledge di Aleo.

## Architecture

Frontend (React / Next.js)
→ Wallet
→ Leo Smart Contract
→ Private Records

## Commitment
```
commitment = hash(bid_amount || secret)
```

## Core Smart Contract Functions
- create_auction()
- submit_bid()
- reveal_bid()
- close_auction()
- settle_auction()

## Auction Flow
1. Create Auction
2. Submit Commitment
3. Close Auction
4. Reveal Bid
5. Determine Winner
