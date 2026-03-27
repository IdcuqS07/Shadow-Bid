# Claim Winning Aleo Error Analysis

## Error Message
```
"Failed to parse input #1 ('u64.public') for 'shadowbid_marketplace_v2_18.aleo/claim_winning_aleo'"
```

## Contract Signature (V2.18)
```leo
async transition claim_winning_aleo(
    public auction_id: field,              // Input #0
    public winning_amount_u64: u64,        // Input #1 ← ERROR HERE
    public seller_address: address,        // Input #2
    public claim_at: i64                   // Input #3
) -> Future
```

## Service Implementation
```javascript
export async function claimWinningAleoV2_18(executeTransaction, auctionId, winningAmount, sellerAddress) {
  const claimAt = Math.floor(Date.now() / 1000);
  const inputs = [
    `${auctionId}field`,           // Input #0 ✓
    `${winningAmount}u64`,         // Input #1 ← ERROR HERE
    sellerAddress,                 // Input #2 ✓
    `${claimAt}i64`                // Input #3 ✓
  ];
  
  return requestTx(executeTransaction, 'claim_winning_aleo', inputs);
}
```

## Problem Analysis

The error indicates that **input #1** (the `winning_amount_u64` parameter) cannot be parsed as `u64.public`.

### Possible Causes:

1. **Value too large for u64**
   - u64 max value: `18,446,744,073,709,551,615`
   - If `winningAmount` exceeds this, it will fail
   - Aleo uses microcredits (1 ALEO = 1,000,000 microcredits)
   - Max representable: ~18.4 million ALEO

2. **Invalid number format**
   - `winningAmount` might be:
     - `undefined`
     - `null`
     - A string that can't be parsed
     - A floating point number
     - Already has type suffix (e.g., "1000000u64")

3. **Wrong data type from UI**
   - UI might be passing `winning_amount` as u128 (from auction info)
   - Contract expects u64 for ALEO
   - Need to ensure conversion from u128 to u64

## Solution

### Check 1: Verify winningAmount value
```javascript
console.log('Winning amount:', winningAmount);
console.log('Type:', typeof winningAmount);
console.log('As u64:', `${winningAmount}u64`);
```

### Check 2: Ensure proper conversion
The contract stores `winning_amount` as `u128` in `AuctionInfo`, but `claim_winning_aleo` expects `u64`.

Need to ensure:
```javascript
// If winningAmount comes from auction.winning_amount (u128)
// Convert to u64 safely
const winningAmountU64 = BigInt(winningAmount) & 0xFFFFFFFFFFFFFFFFn; // Mask to u64
const inputs = [
  `${auctionId}field`,
  `${winningAmountU64}u64`,  // Use converted value
  sellerAddress,
  `${claimAt}i64`
];
```

### Check 3: Validate before sending
```javascript
export async function claimWinningAleoV2_18(executeTransaction, auctionId, winningAmount, sellerAddress) {
  // Validate winningAmount
  if (!winningAmount || winningAmount === 0) {
    throw new Error('Invalid winning amount');
  }
  
  // Ensure it's a valid u64
  const amount = BigInt(winningAmount);
  if (amount > 18446744073709551615n) {
    throw new Error('Winning amount exceeds u64 max value');
  }
  
  const claimAt = Math.floor(Date.now() / 1000);
  const inputs = [
    `${auctionId}field`,
    `${amount}u64`,  // Use BigInt to ensure proper formatting
    sellerAddress,
    `${claimAt}i64`
  ];
  
  return requestTx(executeTransaction, 'claim_winning_aleo', inputs);
}
```

## Comparison with Other Functions

### commit_bid_aleo (WORKS)
```javascript
const inputs = [
  `${auctionId}field`,
  commitment,
  `${amountCredits}u64`  // Same pattern
];
```

### claim_refund_aleo (WORKS)
```javascript
const inputs = [
  `${auctionId}field`,
  `${refundAmount}u64`  // Same pattern
];
```

Both of these work, so the pattern `${value}u64` should be correct.

## ROOT CAUSE FOUND! 🎯

### Problem 1: Wrong Field Name
In `PremiumAuctionDetail.jsx` line 1734:
```javascript
await claimWinningAleo(executeTransaction, parseInt(auctionId, 10), auction.winningAmount, auction.seller)
```

**`auction.winningAmount` DOES NOT EXIST!**

The actual field name is **`auction.winningBid`** (line 713).

### Problem 2: Wrong Unit
From line 666-668:
```javascript
const winningAmount = parseAleoInteger(onChainData?.winning_amount);  // microcredits from chain
if (winningAmount !== null && winningAmount > 0) {
  winningBid = winningAmount / 1_000_000;  // ← Converted to ALEO units
}
```

And line 713:
```javascript
winningBid,  // ← This is in ALEO units (already divided)
```

So `auction.winningBid` is in **ALEO units** (e.g., 1.5 ALEO), but the contract expects **microcredits** (e.g., 1500000u64).

### The Fix

Need to:
1. Change `auction.winningAmount` → `auction.winningBid`
2. Convert back to microcredits: `Math.floor(auction.winningBid * 1_000_000)`

OR better:
1. Store the original microcredits value in auction object
2. Use that value directly

### Recommended Solution

Option A - Quick Fix (use winningBid and convert):
```javascript
const winningAmountMicro = Math.floor(auction.winningBid * 1_000_000);
await claimWinningAleo(executeTransaction, parseInt(auctionId, 10), winningAmountMicro, auction.seller)
```

Option B - Better Fix (store microcredits in auction object):
In loadAuctionData (line 666-668):
```javascript
const winningAmount = parseAleoInteger(onChainData?.winning_amount);
if (winningAmount !== null && winningAmount > 0) {
  winningBid = winningAmount / 1_000_000;
  winningAmountMicro = winningAmount;  // ← ADD THIS
}
```

Then in auction object (line 713):
```javascript
winningBid,
winningAmountMicro,  // ← ADD THIS
```

Then in handleClaimWinning:
```javascript
await claimWinningAleo(executeTransaction, parseInt(auctionId, 10), auction.winningAmountMicro, auction.seller)
```

---

**Status:** ROOT CAUSE IDENTIFIED - Ready to fix
**Priority:** High - blocking seller payment claim feature
**Fix Complexity:** Simple - just field name and unit conversion
