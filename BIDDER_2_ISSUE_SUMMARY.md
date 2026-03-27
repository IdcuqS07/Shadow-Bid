# Bidder 2 Rejection Issue - Root Cause Found

## 🎯 Root Cause

**Error:** "Failed to parse input #0 ('address.public') for 'credits.aleo/transfer_public'"

**Cause:** We're passing **program name** (`shadowbid_marketplace_v2_17`) to `transfer_public`, but it expects **account address** format (`aleo1xxx...`).

## 📊 Evidence from Console Log

```
Contract Address: shadowbid_marketplace_v2_17
Transfer Inputs: ["shadowbid_marketplace_v2_17","5000000u64"]
```

**Problem:** `shadowbid_marketplace_v2_17` is NOT a valid address format!

## 🔍 Why This Matters

From smart contract `claim_refund_aleo`:
```leo
let transfer_future: Future = credits.aleo/transfer_public(
    self.caller,
    refund_amount
);
```

Contract **transfers credits FROM its account TO bidder**. This means:
1. Contract MUST have an account that holds credits
2. Users MUST transfer TO contract's account address in Step 1
3. Contract's account address ≠ program name

## 💡 Solution

We need **program's account address**, not program name.

### Option A: Query from Blockchain

Program account address can be queried from Aleo blockchain API or explorer.

### Option B: Compute from Program ID

In Aleo, program account address is derived from program ID using specific hash function.

### Option C: Hardcode Known Address

If we know the deployed program's account address, hardcode it in .env:
```
VITE_PROGRAM_ADDRESS=aleo1xxx...  # Program's account address
VITE_PROGRAM_ID=shadowbid_marketplace_v2_17.aleo  # Program ID
```

## 🧪 How to Find Program Account Address

### Method 1: Check Deployment Transaction

1. Go to deployment transaction on explorer
2. Look for program's account address in transaction details
3. It's the address that received deployment fee

### Method 2: Query Blockchain

```bash
curl "https://api.explorer.provable.com/v1/testnet/program/shadowbid_marketplace_v2_17.aleo/account"
```

### Method 3: Check Contract Balance

Program account should have balance if anyone transferred to it:
```bash
curl "https://api.explorer.provable.com/v1/testnet/program/credits.aleo/mapping/account/[PROGRAM_ADDRESS]"
```

## 🔧 Code Fix

Once we have program account address:

```javascript
// In PremiumAuctionDetail.jsx
const programAddress = import.meta.env.VITE_PROGRAM_ADDRESS || 'aleo1xxx...'; // ACTUAL address

const transferResult = await executeTransaction({
  program: 'credits.aleo',
  function: 'transfer_public',
  inputs: [
    programAddress,  // Use actual address, not program name!
    `${bidAmountMicro}u64`
  ],
  fee: 1_000_000,
  privateFee: false,
});
```

## ❓ Why Did Bidder 1 Succeed?

**Possible reasons:**
1. Bidder 1 used **different UI** that has correct address
2. Bidder 1's wallet **cached** correct address from previous interaction
3. Bidder 1 used **older wallet version** that auto-resolves program names
4. Bidder 1 bid on **different auction** with different setup

**Need to verify:**
- Which exact UI did bidder 1 use?
- What's in bidder 1's console log?
- Did bidder 1 use same auction as bidder 2?

## 🚀 Next Steps

1. **Find program account address** using one of the methods above
2. **Add to .env file** as `VITE_PROGRAM_ADDRESS`
3. **Update code** to use program address instead of program name
4. **Test with bidder 2**
5. **Verify bidder 1's setup** to understand why it worked

## 📝 Temporary Workaround

**For immediate testing:**
1. Check if old UI (`/commit-bid/:id`) has correct address
2. If yes, use old UI for bidding
3. Copy correct address from old UI to new UI

**Or:**
1. Find program account address manually
2. Hardcode in PremiumAuctionDetail.jsx temporarily
3. Test and verify it works
4. Then move to .env file

---

**Status:** ROOT CAUSE IDENTIFIED - Need program account address to fix

**Priority:** HIGH - Blocks all bidding in new UI

**Last Updated:** 24 Maret 2026
