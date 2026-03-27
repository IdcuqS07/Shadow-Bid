# ShadowBid V2.19 - Implementation Guide

## Overview

V2.19 adds 3 major features to V2.18:
1. Settlement Timing Fix (settled_at, claimable_at)
2. Platform Fee (2.5% revenue)
3. Reserve Price (seller protection)

---

## Contract Changes Summary

### 1. New Constants

```leo
// Platform fee configuration
const PLATFORM_FEE_RATE: u16 = 250u16;  // 2.5% in basis points

// Platform owner address (CHANGE THIS to your address)
const PLATFORM_ADDRESS: address = aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc;
```

### 2. Updated AuctionInfo Struct

**Added 8 new fields:**

```leo
struct AuctionInfo {
    // ... all V2.18 fields ...
    
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

### 3. Modified Functions

#### create_auction
- **Added parameter:** `reserve_price: u128`
- **New validation:** `assert(reserve_price >= min_bid_amount)`
- **Initialize:** `reserve_price`, `reserve_met: false`

#### determine_winner
- **New logic:** Check if `winning_amount >= reserve_price`
- **Set:** `reserve_met` flag

#### finalize_winner
- **Added parameter:** `finalized_at: i64`
- **New validation:** `assert(auction.reserve_met)`
- **Calculate:** Platform fee and seller net amount
- **Set:** `settled_at`, `claimable_at`, `platform_fee_amount`, `seller_net_amount`

#### claim_winning_aleo/usdcx/usad
- **Modified:** Transfer `seller_net_amount` instead of `winning_amount`
- **Updated gate:** `assert(auction.item_received || claim_at >= auction.claimable_at)`

### 4. New Functions

#### claim_platform_fee
```leo
async transition claim_platform_fee(
    public auction_id: field
) -> Future
```
- Platform owner claims accumulated fee
- Only callable by PLATFORM_ADDRESS
- Only after seller claimed payment

#### cancel_auction_reserve_not_met
```leo
async transition cancel_auction_reserve_not_met(
    public auction_id: field
) -> Future
```
- Seller cancels auction when reserve not met
- Sets state to CANCELLED
- Allows all bidders to claim refunds

---

## Implementation Steps

### Phase 1: Contract Core (Priority: HIGH)
1. ✅ Copy V2.18 contract to V2.19
2. ✅ Add new constants (PLATFORM_FEE_RATE, PLATFORM_ADDRESS)
3. ✅ Update AuctionInfo struct with 8 new fields
4. ✅ Modify create_auction (add reserve_price parameter)
5. ✅ Modify determine_winner (add reserve check)
6. ✅ Modify finalize_winner (add fee calculation + timing)
7. ✅ Modify claim_winning_* (use seller_net_amount + claimable_at)
8. ✅ Add claim_platform_fee function
9. ✅ Add cancel_auction_reserve_not_met function

### Phase 2: Service Functions (Priority: HIGH)
1. ✅ Add createAuctionV2_19 (with reserve_price)
2. ✅ Add finalizeWinnerV2_19 (with timestamp)
3. ✅ Add claimPlatformFee
4. ✅ Add cancelAuctionReserveNotMet
5. ✅ Add helper functions (calculatePlatformFee, etc.)

### Phase 3: UI Components (Priority: MEDIUM)
1. ✅ Update PremiumCreateAuction (add reserve price input)
2. ✅ Update PremiumAuctionDetail (show fee breakdown)
3. ✅ Create PlatformAdminDashboard (fee management)
4. ✅ Add settlement countdown display
5. ✅ Add reserve status indicators

### Phase 4: Testing (Priority: HIGH)
1. ⏳ Test settlement timing
2. ⏳ Test platform fee calculation
3. ⏳ Test reserve price validation
4. ⏳ Test integration scenarios

---

## Key Implementation Notes

### 1. Platform Address Configuration

**CRITICAL:** Before deployment, update PLATFORM_ADDRESS:

```leo
const PLATFORM_ADDRESS: address = aleo1your_actual_platform_address_here;
```

This address will be the only one that can claim platform fees.

### 2. Fee Calculation

Fee is calculated in `finalize_winner`:

```leo
let fee_amount: u128 = (winning_amount * (PLATFORM_FEE_RATE as u128)) / 10000u128;
let seller_amount: u128 = winning_amount - fee_amount;
```

Example:
- Winning bid: 100 ALEO
- Fee (2.5%): 2.5 ALEO
- Seller net: 97.5 ALEO

### 3. Settlement Timing

```leo
settled_at = finalized_at;
claimable_at = finalized_at + confirmation_timeout;
```

Seller can claim:
- Immediately if winner confirms receipt
- After `claimable_at` timeout (even without confirmation)

### 4. Reserve Price Flow

```
determine_winner:
  reserve_met = (winning_amount >= reserve_price)

finalize_winner:
  assert(reserve_met)  // Must be true to proceed

cancel_auction_reserve_not_met:
  assert(!reserve_met)  // Can only cancel if false
```

---

## Testing Checklist

### Settlement Timing
- [ ] settled_at set correctly
- [ ] claimable_at calculated correctly
- [ ] Countdown displays accurate time
- [ ] Seller can claim after timeout
- [ ] Seller cannot claim before timeout (without confirmation)

### Platform Fee
- [ ] Fee calculated correctly (2.5%)
- [ ] Seller receives net amount
- [ ] Platform can claim after seller
- [ ] Platform cannot claim twice
- [ ] Only platform address can claim

### Reserve Price
- [ ] Reserve >= min_bid validated
- [ ] reserve_met set correctly
- [ ] Seller can finalize if met
- [ ] Seller cannot finalize if not met
- [ ] Seller can cancel if not met
- [ ] Bidders can refund after cancel

### Integration
- [ ] All features work together
- [ ] Multi-currency support (ALEO, USDCx, USAD)
- [ ] Private bid still works
- [ ] Asset categories still work

---

## Deployment Strategy

### Testnet Deployment
1. Update PLATFORM_ADDRESS to testnet address
2. Deploy contract: `leo deploy`
3. Test all functions thoroughly
4. Verify fee calculations
5. Test reserve price scenarios

### Mainnet Deployment
1. Update PLATFORM_ADDRESS to mainnet address
2. Audit contract code
3. Deploy to mainnet
4. Update UI environment variables
5. Monitor first few auctions closely

---

## Migration from V2.18

### Contract
- V2.18 and V2.19 can coexist
- No data migration needed
- Old auctions stay on V2.18
- New auctions use V2.19

### UI
- Detect contract version
- Route to appropriate service functions
- Show version indicator
- Support both versions simultaneously

---

## Next Steps

1. **Implement contract** - Start with Phase 1
2. **Test locally** - Use leo test
3. **Deploy to testnet** - Verify all functions
4. **Build UI** - Implement Phase 3
5. **Integration testing** - End-to-end scenarios
6. **Mainnet deployment** - Production ready

---

**Status:** 📋 Implementation guide ready
**Next:** Start Phase 1 - Contract implementation
