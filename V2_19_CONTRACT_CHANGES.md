# V2.19 Contract Changes from V2.18

## Quick Reference: What Changed

This document shows ONLY the changes from V2.18 to V2.19. Use this as a guide to modify the V2.18 contract.

---

## 1. Add Constants (After line 12)

```leo
// V2.19 NEW: Platform fee configuration
const PLATFORM_FEE_RATE: u16 = 250u16;  // 2.5% (250 basis points / 10000)

// V2.19 NEW: Platform owner address
// IMPORTANT: Change this to your actual platform wallet address before deployment
const PLATFORM_ADDRESS: address = aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc;
```

---

## 2. Update AuctionInfo Struct (Around line 90)

**ADD these 8 fields at the end:**

```leo
struct AuctionInfo {
    seller: address,
    min_bid_amount: u128,
    currency_type: u8,
    end_time: i64,
    challenge_period: i64,
    state: u8,
    winner: address,
    winning_amount: u128,
    challenge_end_time: i64,
    total_escrowed: u128,
    asset_type: u8,
    item_received: bool,
    item_received_at: i64,
    payment_claimed: bool,
    payment_claimed_at: i64,
    confirmation_timeout: i64,
    
    // V2.19 NEW: Settlement timing
    settled_at: i64,
    claimable_at: i64,
    
    // V2.19 NEW: Platform fee
    platform_fee_amount: u128,
    seller_net_amount: u128,
    platform_fee_claimed: bool,
    platform_fee_claimed_at: i64,
    
    // V2.19 NEW: Reserve price
    reserve_price: u128,
    reserve_met: bool
}
```

---

## 3. Modify create_auction Function

**CHANGE signature (add reserve_price parameter):**

```leo
async transition create_auction(
    public auction_id: field,
    public min_bid_amount: u128,
    public reserve_price: u128,     // V2.19 NEW
    public currency_type: u8,
    public asset_type: u8,
    public end_time: i64,
    public challenge_period: i64
) -> (AuctionRecord, Future) {
    
    // V2.19 NEW: Validate reserve price
    assert(reserve_price >= min_bid_amount);
    
    // ... rest of function
    
    return (receipt, finalize_create_auction(
        auction_id,
        self.signer,
        min_bid_amount,
        reserve_price,          // V2.19 NEW: Pass to finalize
        currency_type,
        asset_type,
        end_time,
        challenge_period
    ));
}
```

**UPDATE finalize function:**

```leo
async function finalize_create_auction(
    auction_id: field,
    seller: address,
    min_bid_amount: u128,
    reserve_price: u128,        // V2.19 NEW
    currency_type: u8,
    asset_type: u8,
    end_time: i64,
    challenge_period: i64
) {
    // ... existing validations ...
    
    Mapping::set(auctions, auction_id, AuctionInfo {
        seller,
        min_bid_amount,
        currency_type,
        end_time,
        challenge_period,
        state: OPEN,
        winner: aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc,
        winning_amount: 0u128,
        challenge_end_time: 0i64,
        total_escrowed: 0u128,
        asset_type,
        item_received: false,
        item_received_at: 0i64,
        payment_claimed: false,
        payment_claimed_at: 0i64,
        confirmation_timeout: timeout,
        
        // V2.19 NEW: Initialize new fields
        settled_at: 0i64,
        claimable_at: 0i64,
        platform_fee_amount: 0u128,
        seller_net_amount: 0u128,
        platform_fee_claimed: false,
        platform_fee_claimed_at: 0i64,
        reserve_price,
        reserve_met: false
    });
}
```

---

## 4. Modify determine_winner Function

**ADD reserve price check in finalize:**

```leo
async function finalize_determine_winner(
    auction_id: field,
    caller: address
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    assert_eq(auction.seller, caller);
    assert_eq(auction.state, CLOSED);
    
    let winning_amount: u128 = Mapping::get(highest_bid, auction_id);
    let winner: address = Mapping::get(highest_bidder, auction_id);
    
    assert(winning_amount > 0u128);
    
    // V2.19 NEW: Check if reserve price met
    let reserve_met: bool = winning_amount >= auction.reserve_price;
    
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        challenge_period: auction.challenge_period,
        state: CHALLENGE,
        winner,
        winning_amount,
        challenge_end_time: auction.challenge_end_time,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met                                    // V2.19 NEW: Set flag
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}
```

---

## 5. Modify finalize_winner Function

**CHANGE signature (add timestamp parameter):**

```leo
async transition finalize_winner(
    public auction_id: field,
    public finalized_at: i64        // V2.19 NEW
) -> (WinnerRecord, Future) {
    
    let placeholder_record: WinnerRecord = WinnerRecord {
        owner: self.signer,
        auction_id,
        winning_amount: 0u128,
        currency_type: 0u8,
        finalized_at: 0i64
    };
    
    return (placeholder_record, finalize_finalize_winner(auction_id, self.signer, finalized_at));
}
```

**UPDATE finalize function with fee calculation:**

```leo
async function finalize_finalize_winner(
    auction_id: field,
    caller: address,
    finalized_at: i64               // V2.19 NEW
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    assert_eq(auction.seller, caller);
    assert_eq(auction.state, CHALLENGE);
    
    // V2.19 NEW: Reserve must be met to finalize
    assert(auction.reserve_met);
    
    // V2.19 NEW: Calculate platform fee and seller net amount
    let winning_amount_u128: u128 = auction.winning_amount;
    let fee_amount: u128 = (winning_amount_u128 * (PLATFORM_FEE_RATE as u128)) / 10000u128;
    let seller_amount: u128 = winning_amount_u128 - fee_amount;
    
    // V2.19 NEW: Calculate claimable_at
    let claimable_at: i64 = finalized_at + auction.confirmation_timeout;
    
    // Mark winner in escrow
    let winner_key: field = auction_id + BHP256::hash_to_field(auction.winner);
    if (Mapping::contains(escrow, winner_key)) {
        let winner_escrow: Escrow = Mapping::get(escrow, winner_key);
        let updated_escrow: Escrow = Escrow {
            bidder: winner_escrow.bidder,
            amount: winner_escrow.amount,
            is_refunded: winner_escrow.is_refunded,
            is_winner: true
        };
        Mapping::set(escrow, winner_key, updated_escrow);
    }
    
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        challenge_period: auction.challenge_period,
        state: SETTLED,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        challenge_end_time: auction.challenge_end_time,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        
        // V2.19 NEW: Set settlement timing
        settled_at: finalized_at,
        claimable_at,
        
        // V2.19 NEW: Set fee amounts
        platform_fee_amount: fee_amount,
        seller_net_amount: seller_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}
```

---

## 6. Modify claim_winning_aleo Function

**CHANGE to use seller_net_amount and claimable_at:**

```leo
async transition claim_winning_aleo(
    public auction_id: field,
    public claim_at: i64
) -> Future {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // V2.19 CHANGED: Transfer NET AMOUNT (not full winning_amount)
    let seller_amount_u64: u64 = auction.seller_net_amount as u64;
    let transfer_future: Future = credits.aleo/transfer_public(
        auction.seller,
        seller_amount_u64
    );
    
    return finalize_claim_winning_aleo(
        auction_id,
        self.signer,
        claim_at,
        transfer_future
    );
}

async function finalize_claim_winning_aleo(
    auction_id: field,
    caller: address,
    claim_at: i64,
    transfer_future: Future
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    assert_eq(auction.seller, caller);
    assert_eq(auction.currency_type, CURRENCY_ALEO);
    assert_eq(auction.state, SETTLED);
    assert(!auction.payment_claimed);
    
    // V2.19 CHANGED: Use claimable_at instead of item_received_at + timeout
    let timeout_passed: bool = claim_at >= auction.claimable_at;
    assert(auction.item_received || timeout_passed);
    
    transfer_future.await();
    
    let updated_auction: AuctionInfo = AuctionInfo {
        // ... all fields ...
        payment_claimed: true,
        payment_claimed_at: claim_at,
        // ... rest of fields ...
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}
```

**NOTE:** Apply same changes to `claim_winning_usdcx` and `claim_winning_usad`

---

## 7. ADD New Function: claim_platform_fee

**Add this NEW function (around line 1100):**

```leo
// -------------------------
// V2.19 NEW: Platform Fee Claim
// -------------------------

async transition claim_platform_fee(
    public auction_id: field
) -> Future {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Determine currency and transfer fee
    if (auction.currency_type == CURRENCY_ALEO) {
        let fee_amount_u64: u64 = auction.platform_fee_amount as u64;
        let transfer_future: Future = credits.aleo/transfer_public(
            PLATFORM_ADDRESS,
            fee_amount_u64
        );
        return finalize_claim_platform_fee(auction_id, self.signer, transfer_future);
    } else if (auction.currency_type == CURRENCY_USDX) {
        let transfer_future: Future = test_usdcx_stablecoin.aleo/transfer_public(
            PLATFORM_ADDRESS,
            auction.platform_fee_amount
        );
        return finalize_claim_platform_fee(auction_id, self.signer, transfer_future);
    } else {
        let transfer_future: Future = test_usad_stablecoin.aleo/transfer_public(
            PLATFORM_ADDRESS,
            auction.platform_fee_amount
        );
        return finalize_claim_platform_fee(auction_id, self.signer, transfer_future);
    }
}

async function finalize_claim_platform_fee(
    auction_id: field,
    caller: address,
    transfer_future: Future
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Only platform owner can claim
    assert_eq(caller, PLATFORM_ADDRESS);
    
    // Auction must be SETTLED
    assert_eq(auction.state, SETTLED);
    
    // Seller must have claimed first
    assert(auction.payment_claimed);
    
    // Fee not claimed yet
    assert(!auction.platform_fee_claimed);
    
    // Execute transfer
    transfer_future.await();
    
    let claim_at: i64 = 0i64;  // TODO: Get current timestamp if needed
    
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        challenge_period: auction.challenge_period,
        state: auction.state,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        challenge_end_time: auction.challenge_end_time,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: true,
        platform_fee_claimed_at: claim_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}
```

---

## 8. ADD New Function: cancel_auction_reserve_not_met

**Add this NEW function (around line 1200):**

```leo
// -------------------------
// V2.19 NEW: Cancel Auction (Reserve Not Met)
// -------------------------

async transition cancel_auction_reserve_not_met(
    public auction_id: field
) -> Future {
    return finalize_cancel_reserve_not_met(auction_id, self.signer);
}

async function finalize_cancel_reserve_not_met(
    auction_id: field,
    caller: address
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Only seller can cancel
    assert_eq(auction.seller, caller);
    
    // Must be in CHALLENGE state
    assert_eq(auction.state, CHALLENGE);
    
    // Reserve must NOT be met
    assert(!auction.reserve_met);
    
    // Cancel auction
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        challenge_period: auction.challenge_period,
        state: CANCELLED,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        challenge_end_time: auction.challenge_end_time,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}
```

---

## 9. Update claim_refund Functions

**MODIFY to allow refunds for CANCELLED auctions:**

In all `finalize_claim_refund*` functions, change:

```leo
// OLD:
assert_eq(auction.state, SETTLED);

// NEW:
assert(auction.state == SETTLED || auction.state == CANCELLED);
```

This allows bidders to get refunds when auction is cancelled due to reserve not met.

---

## Summary of Changes

✅ **2 new constants** (PLATFORM_FEE_RATE, PLATFORM_ADDRESS)
✅ **8 new fields** in AuctionInfo
✅ **5 modified functions** (create_auction, determine_winner, finalize_winner, claim_winning_*)
✅ **2 new functions** (claim_platform_fee, cancel_auction_reserve_not_met)
✅ **1 modified validation** (claim_refund allows CANCELLED state)

---

**Next Step:** Apply these changes to create `shadowbid_marketplace_v2_19/src/main.leo`
