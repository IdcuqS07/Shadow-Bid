# V2.18 Deployment Guide

## ✅ Build Status
Contract compiled successfully!
- Program size: 20.88 KB / 97.66 KB
- Checksum: `[41u8, 220u8, 93u8, 136u8, 44u8, 249u8, 149u8, 177u8, 197u8, 94u8, 115u8, 4u8, 170u8, 150u8, 154u8, 80u8, 221u8, 36u8, 64u8, 247u8, 56u8, 168u8, 116u8, 194u8, 1u8, 30u8, 88u8, 134u8, 145u8, 5u8, 121u8, 109u8]`

## 🚀 Deployment Options

### Option 1: Deploy via Shield Wallet (RECOMMENDED)

1. Open Shield Wallet
2. Go to "Deploy" tab
3. Select `shadowbid_marketplace_v2_18/build/main.aleo`
4. Set fee: 10-20 ALEO (recommended)
5. Click "Deploy"
6. Wait for confirmation
7. Copy deployed program ID

### Option 2: Deploy via Leo CLI

```bash
cd shadowbid_marketplace_v2_18

# Set private key (temporary, for this session only)
export PRIVATE_KEY="your_private_key_here"

# Deploy to testnet
leo deploy --network testnet --fee 10000000

# Or with specific endpoint
leo deploy \
  --network testnet \
  --endpoint https://api.explorer.provable.com/v1 \
  --fee 10000000
```

## 📋 Post-Deployment Checklist

After successful deployment:

1. ✅ Copy deployed program ID
2. ✅ Update `.env` file:
   ```
   VITE_PROGRAM_ID_V2_18=shadowbid_marketplace_v2_18.aleo
   ```
3. ✅ Update UI to use V2.18 contract
4. ✅ Test all new functions:
   - `create_auction` with asset_type
   - `commit_bid_aleo_private` (private ALEO)
   - `confirm_receipt` (winner)
   - `claim_winning_aleo` (seller)
   - `claim_winning_usdcx` (seller)
   - `claim_winning_usad` (seller)

## 🎯 V2.18 Features

### 3 Currencies Supported:
- **ALEO** (currency_type = 1) - Native credits
- **USDCx** (currency_type = 0) - test_usdcx_stablecoin.aleo
- **USAD** (currency_type = 2) - test_usad_stablecoin.aleo

### Public Bidding (9 functions):
- `commit_bid_aleo` - ALEO public (2-step)
- `commit_bid` - USDCx public (1-step)
- `commit_bid_usad` - USAD public (1-step)
- `claim_refund_aleo` - ALEO refund
- `claim_refund` - USDCx refund
- `claim_refund_usad` - USAD refund
- `claim_winning_aleo` - Seller claims ALEO
- `claim_winning_usdcx` - Seller claims USDCx
- `claim_winning_usad` - Seller claims USAD

### Private Bidding (2 functions - ALEO only):
- `commit_bid_aleo_private` - Private ALEO → Public escrow
- `claim_refund_aleo_private` - Public escrow → Private ALEO

**Note:** USDCx/USAD private transactions require ComplianceRecord handling - deferred to V3.0

### RWA Settlement (1 function):
- `confirm_receipt` - Winner confirms item received

### Asset Categories (8 types):
- Physical Goods (14 days timeout)
- Collectibles (21 days timeout)
- Real Estate (90 days timeout)
- Digital Assets (3 days timeout)
- Services (30 days timeout)
- Tickets/Events (7 days timeout)
- Vehicles (30 days timeout)
- Intellectual Property (90 days timeout)

## 🔐 Security Features

- ✅ Only winner can confirm receipt
- ✅ Only seller can claim payment
- ✅ Payment released after confirmation OR timeout
- ✅ Cannot claim twice
- ✅ Auction must be SETTLED
- ✅ Timeout based on asset category

## 📊 Comparison with V2.17

| Feature | V2.17 | V2.18 |
|---------|-------|-------|
| Currencies | 2 (ALEO, USDCx) | 3 (ALEO, USDCx, USAD) |
| Private ALEO | ❌ | ✅ |
| Private USDCx/USAD | ❌ | ❌ (V3.0) |
| RWA Settlement | ❌ | ✅ |
| Asset Categories | ❌ | ✅ (8 types) |
| Confirm Receipt | ❌ | ✅ |
| Claim Payment | ❌ | ✅ |
| Seller Payment Stuck | ⚠️ YES | ✅ FIXED |

## 🎉 Major Improvements

1. **Seller can now claim payment** - No more stuck funds!
2. **Private ALEO bidding** - Enhanced privacy for native token
3. **USAD support** - Third stablecoin option
4. **Asset categorization** - Smart timeout based on item type
5. **Buyer protection** - Confirm receipt before payment release

---

**Last Updated:** 24 March 2026  
**Status:** ✅ Ready to Deploy
