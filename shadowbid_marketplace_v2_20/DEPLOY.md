# V2.19 Deployment Guide

## Contract Information

- **Program Name:** `shadowbid_marketplace_v2_19.aleo`
- **Version:** 2.19
- **Platform Address:** `aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8`
- **Program Size:** 28.17 KB / 97.66 KB
- **Status:** ✅ Ready for deployment

## New Features in V2.19

1. **Platform Fee (2.5%)**
   - Automatic fee calculation
   - Split payment: Seller 97.5%, Platform 2.5%
   - Platform claims after seller

2. **Reserve Price**
   - Seller protection with minimum acceptable price
   - Seller can cancel if reserve not met

3. **Settlement Timing Fix**
   - Predictable claim timing
   - claimable_at = settled_at + confirmation_timeout

## Deployment Steps

### 1. Pre-Deployment Checklist

- [x] Contract compiled successfully
- [x] PLATFORM_ADDRESS updated
- [x] All tests passed
- [ ] Testnet deployment ready

### 2. Deploy to Testnet

```bash
cd shadowbid_marketplace_v2_19

# Deploy
leo deploy --network testnet

# Save the program ID from output
```

### 3. Verify Deployment

After deployment, verify:
- Program ID is generated
- All transitions are available
- Constants are correct

### 4. Test on Testnet

Test scenarios:
1. Create auction with reserve price
2. Bid below reserve → cancel flow
3. Bid above reserve → normal flow
4. Seller claims net amount
5. Platform claims fee

### 5. Deploy to Mainnet

```bash
# After testnet verification
leo deploy --network mainnet
```

## Important Notes

### Platform Fee Collection

Platform owner (address: `aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8`) must:

1. Wait for seller to claim payment first
2. Call appropriate claim function:
   - `claim_platform_fee_aleo(auction_id, fee_amount_u64)` for Aleo
   - `claim_platform_fee_usdcx(auction_id, fee_amount)` for USDCx
   - `claim_platform_fee_usad(auction_id, fee_amount)` for USAD

### Reserve Price Flow

If winning bid < reserve price:
1. Seller calls `cancel_auction_reserve_not_met(auction_id)`
2. Auction state changes to CANCELLED
3. All bidders can claim refunds

## Function Signatures

### Modified Functions

```leo
// Create auction with reserve price
create_auction(
    auction_id: field,
    min_bid_amount: u128,
    reserve_price: u128,        // NEW
    currency_type: u8,
    asset_type: u8,
    end_time: i64,
    challenge_period: i64
)

// Finalize with timestamp
finalize_winner(
    auction_id: field,
    finalized_at: i64           // NEW
)

// Claim with net amount
claim_winning_aleo(
    auction_id: field,
    seller_net_amount_u64: u64, // CHANGED
    seller_address: address,
    claim_at: i64
)
```

### New Functions

```leo
// Platform fee claims
claim_platform_fee_aleo(auction_id: field, fee_amount_u64: u64)
claim_platform_fee_usdcx(auction_id: field, fee_amount: u128)
claim_platform_fee_usad(auction_id: field, fee_amount: u128)

// Cancel if reserve not met
cancel_auction_reserve_not_met(auction_id: field)
```

## UI Integration Required

Update `aleoServiceV2.js` to support:

1. Reserve price input in create auction
2. Calculate platform fee (2.5%)
3. Display seller net amount
4. Platform fee claim interface
5. Reserve not met cancellation

## Fee Calculation Example

```javascript
// In UI/Service layer
const winningAmount = 1000000; // 1 ALEO
const platformFeeRate = 250; // 2.5% = 250/10000
const platformFee = Math.floor((winningAmount * platformFeeRate) / 10000);
const sellerNetAmount = winningAmount - platformFee;

// Result:
// platformFee = 25000 (0.025 ALEO)
// sellerNetAmount = 975000 (0.975 ALEO)
```

## Monitoring

After deployment, monitor:
- Platform fee collection rate
- Reserve price usage
- Cancellation rate due to reserve not met
- Settlement timing accuracy

## Rollback Plan

If issues occur:
1. Pause new auction creation
2. Allow existing auctions to complete
3. Deploy hotfix or revert to V2.18
4. Migrate data if necessary

## Support

For issues or questions:
- Check contract logs
- Verify transaction status
- Review error messages
- Test on testnet first

---

**Deployment Status:** Ready
**Next Step:** Deploy to testnet
**Documentation:** V2_19_CONTRACT_READY.md
