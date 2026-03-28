# Smart Contract Integration Guide

This guide documents the lightweight helper service in `frontend/src/services/aleoService.js`.
The production marketplace flow now centers on the `v2.20` program and `aleoServiceV2.js`.

## Contract Information

- **Program ID**: `shadowbid_marketplace_v2_20.aleo`
- **Network**: Aleo Testnet
- **Auctioneer Address**: `aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8`

## Available Functions

### 1. create_auction
Creates a new sealed-bid auction.

**Parameters:**
- `auction_id` (u64): Unique auction identifier
- `min_bid` (u64): Minimum bid in microcredits
- `end_block` (u32): Block number when bidding ends

**Returns:** AuctionRecord (private receipt for seller)

### 2. place_bid
Submit a sealed bid to an auction.

**Parameters:**
- `auction_id` (u64): Target auction ID
- `auctioneer` (address): Auctioneer's address
- `bidder` (address): Bidder's address (must be caller)
- `amount` (u64): Bid amount in microcredits (private)

**Returns:** Bid record (owned by auctioneer, keeps amount private)

### 3. close_auction
Close bidding for an auction (seller only).

**Parameters:**
- `auction_id` (u64): Auction to close

### 4. resolve
Compare two bids privately (auctioneer only).

**Parameters:**
- `first` (Bid): First bid record
- `second` (Bid): Second bid record

**Returns:** The higher bid record

### 5. finish
Declare the winner and settle the auction (auctioneer only).

**Parameters:**
- `auction_id` (u64): Auction ID
- `winning_bid` (Bid): The winning bid record

**Returns:** Winner's bid record with `is_winner: true`

## Environment Configuration

Create `.env.local` file:

```env
VITE_ALEO_NETWORK=testnet
VITE_PROGRAM_ID=shadowbid_marketplace_v2_20.aleo
VITE_AUCTIONEER_ADDRESS=aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8
VITE_API_BASE=https://api.explorer.provable.com/v1/testnet
```

## Usage Example

```javascript
import { createAuction, placeBid, closeAuction } from './services/aleoService';

// Create auction
const auctionId = Date.now();
const minBid = 10; // 10 credits
const endBlock = 5000000;
await createAuction(executeTransaction, auctionId, minBid, endBlock);

// Place bid
const bidAmount = 15; // 15 credits
await placeBid(executeTransaction, auctionId, bidAmount, bidderAddress);

// Close auction (seller only)
await closeAuction(executeTransaction, auctionId);
```

## Privacy Features

- Bid amounts are stored in private records, never revealed on-chain
- Only the auctioneer can compare bids using the `resolve` function
- Losing bids remain completely private
- Winner is declared without revealing the winning amount publicly
