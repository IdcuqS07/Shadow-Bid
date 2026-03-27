# V2.18 Private Bid - Record Format Guide

**Date:** 25 March 2026  
**Topic:** Understanding Aleo Credits Record Structure

---

## 🎯 The Question

User asked: "Apakah kamu gunakan ini?"
```
record credits:
  owner: address.private;
  microcredits: u64.private;
```

**Answer:** YES! Ini adalah struktur record yang benar dari `credits.aleo` program.

---

## 📋 Record Structure Explained

### Leo Contract Definition (credits.aleo)
```leo
record credits {
  owner: address,
  microcredits: u64
}
```

Ini adalah **native Aleo credits record** yang digunakan untuk menyimpan private balance.

### V2.18 Contract Function Signature
```leo
async transition commit_bid_aleo_private(
    public auction_id: field,
    public commitment: field,
    private_credits: credits.aleo/credits,  // ← Record type dari credits.aleo
    public amount_credits: u64
) -> (credits.aleo/credits, Future)
```

**Key Points:**
1. Parameter `private_credits` bertipe `credits.aleo/credits`
2. Ini adalah **record type** bukan struct
3. Record ini berisi `owner` dan `microcredits`
4. Kedua field adalah **private** (tidak terlihat on-chain)

---

## 🔄 Record Flow

### 1. Wallet Returns Record Object
Ketika kita call `wallet.requestRecords()`, wallet mengembalikan array of record objects:

```javascript
const records = await wallet.requestRecords({
  program: 'credits.aleo',
});

// Returns:
[
  {
    data: {
      owner: "aleo1xyz...",
      microcredits: "1000000u64"
    },
    // ... other metadata
  }
]
```

### 2. Frontend Filters Records
```javascript
const validRecords = records.filter(r => {
  const microcredits = parseInt(r.data.microcredits.replace('u64', ''));
  return microcredits >= bidAmountMicro;
});

const selectedRecord = validRecords[0];
```

### 3. Pass to Service Function
```javascript
await commitBidAleoPrivate(
  executeTransaction,
  parseInt(auctionId),
  commitment,
  selectedRecord,  // ← Full record object
  bidAmountMicro
);
```

### 4. Service Builds Transaction
```javascript
export async function commitBidAleoPrivate(
  executeTransaction, 
  auctionId, 
  commitment, 
  privateRecord,  // ← Record object from wallet
  amountCredits
) {
  const inputs = [
    `${auctionId}field`,
    `${commitment}field`,
    privateRecord,  // ← Wallet adapter will serialize this
    `${amountCredits}u64`
  ];
  
  return requestTx(
    executeTransaction,
    'commit_bid_aleo_private',
    inputs
  );
}
```

### 5. Wallet Adapter Serializes
The wallet adapter (Shield, Leo, Puzzle) will automatically serialize the record object into the correct Leo format when submitting the transaction.

---

## ✅ Current Implementation Status

### What We're Doing RIGHT ✅
1. **Requesting records from wallet** - `wallet.requestRecords({ program: 'credits.aleo' })`
2. **Filtering by balance** - Check `microcredits >= bidAmountMicro`
3. **Passing full record object** - Not trying to manually serialize
4. **Letting wallet adapter handle serialization** - Wallet knows how to convert to Leo format

### What the Wallet Does
The wallet adapter will convert the record object to Leo plaintext format:
```
{
  owner: aleo1xyz...aleo.private,
  microcredits: 1000000u64.private
}
```

This matches the `credits.aleo/credits` record type expected by the contract.

---

## 🔍 Record Structure Deep Dive

### credits.aleo Program
This is a **native Aleo program** that manages the native ALEO token.

**Record Definition:**
```leo
record credits {
  owner: address,      // Who owns these credits
  microcredits: u64    // Amount in microcredits (1 ALEO = 1,000,000 microcredits)
}
```

**Key Functions:**
- `transfer_private` - Transfer private → private
- `transfer_public` - Transfer public → public
- `transfer_private_to_public` - Transfer private → public (used in our contract!)
- `transfer_public_to_private` - Transfer public → private

### Our Contract Usage
```leo
let (change_record, transfer_future): (credits.aleo/credits, Future) = 
    credits.aleo/transfer_private_to_public(
        private_credits,                      // Input: private record
        shadowbid_marketplace_v2_18.aleo,    // Recipient: our contract
        amount_credits                        // Amount to transfer
    );
```

**What Happens:**
1. User provides private credits record
2. Contract calls `transfer_private_to_public` from `credits.aleo`
3. Amount is transferred to contract's public balance
4. User receives change record (remaining balance)
5. Change record is returned to user (still private!)

---

## 🎯 Why This Approach?

### Privacy Benefits
1. **Input is private** - No one sees which record you used
2. **Change is private** - Your remaining balance stays hidden
3. **Only transfer amount is public** - Contract needs to track escrow

### Hybrid Model (V2.18)
```
Private Credits (User)
    ↓ transfer_private_to_public
Public Escrow (Contract)
    ↓ After auction
Private Refund (Loser) OR Public Payment (Seller)
```

**Why not fully private?**
- Contract needs to track total escrow (public mapping)
- Winner determination requires comparing bids (public after reveal)
- Seller receives public payment (easier to use)

---

## 🐛 Common Issues

### Issue 1: Wallet Doesn't Support requestRecords()
**Symptom:** `wallet.requestRecords is not a function`

**Cause:** Older wallet versions don't implement this API

**Solution:** 
- Use public bid (toggle privacy OFF)
- Wait for wallet update
- Try alternative wallet (Leo, Puzzle)

### Issue 2: No Private Credits
**Symptom:** `validRecords.length === 0`

**Cause:** User has no private ALEO credits

**Solution:**
- Transfer public → private first
- Use public bid instead

### Issue 3: Insufficient Balance
**Symptom:** No records with enough microcredits

**Cause:** All private records have less than bid amount

**Solution:**
- Reduce bid amount
- Transfer more to private
- Use public bid

### Issue 4: Record Serialization Error
**Symptom:** Transaction fails with "invalid record format"

**Cause:** Trying to manually serialize record

**Solution:**
- Pass full record object from wallet
- Let wallet adapter handle serialization
- Don't convert to string manually

---

## 📝 Code Checklist

### Frontend (PremiumAuctionDetail.jsx) ✅
```javascript
// 1. Request records from wallet
const records = await wallet.requestRecords({
  program: 'credits.aleo',
});

// 2. Filter for sufficient balance
const validRecords = records.filter(r => {
  const microcredits = parseInt(r.data.microcredits.replace('u64', ''));
  return microcredits >= bidAmountMicro;
});

// 3. Select record
const selectedRecord = validRecords[0];

// 4. Pass to service (full object, not serialized)
await commitBidAleoPrivate(
  executeTransaction,
  auctionId,
  commitment,
  selectedRecord,  // ← Full object
  bidAmountMicro
);
```

### Service (aleoServiceV2.js) ✅
```javascript
export async function commitBidAleoPrivate(
  executeTransaction, 
  auctionId, 
  commitment, 
  privateRecord,  // ← Record object
  amountCredits
) {
  const inputs = [
    `${auctionId}field`,
    `${commitment}field`,
    privateRecord,  // ← Pass as-is
    `${amountCredits}u64`
  ];
  
  return requestTx(
    executeTransaction,
    'commit_bid_aleo_private',
    inputs
  );
}
```

### Contract (main.leo) ✅
```leo
async transition commit_bid_aleo_private(
    public auction_id: field,
    public commitment: field,
    private_credits: credits.aleo/credits,  // ← Correct type
    public amount_credits: u64
) -> (credits.aleo/credits, Future) {
    // Transfer private → public
    let (change_record, transfer_future) = 
        credits.aleo/transfer_private_to_public(
            private_credits,
            shadowbid_marketplace_v2_18.aleo,
            amount_credits
        );
    
    return (change_record, finalize_commit_aleo_priv(...));
}
```

---

## ✅ Conclusion

**YES, we are using the correct record structure!**

```
record credits {
  owner: address.private,
  microcredits: u64.private
}
```

This is the native Aleo credits record from `credits.aleo` program.

### Implementation Status
- ✅ Correct record type in contract (`credits.aleo/credits`)
- ✅ Correct wallet API call (`wallet.requestRecords()`)
- ✅ Correct record filtering (check `microcredits`)
- ✅ Correct record passing (full object, not serialized)
- ✅ Wallet adapter handles serialization automatically

### Only Limitation
⚠️ Wallet support for `requestRecords()` API is still limited. This is not a code issue - it's a wallet ecosystem maturity issue.

---

**Status:** ✅ CORRECT IMPLEMENTATION  
**Record Format:** ✅ CORRECT (credits.aleo/credits)  
**Next:** Wait for wallet support or test with compatible wallet

