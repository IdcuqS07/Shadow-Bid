# Shield Wallet Private Transaction Issue 🔍

**Date:** 25 Maret 2026  
**Error:** `Invalid transaction payload`  
**Status:** 🔍 INVESTIGATING

---

## 🐛 Problem

**Error Message:**
```
ShieldWalletAdapter executeTransaction error 
Error: Invalid transaction payload
```

**Context:**
- Trying to call `commit_bid_aleo_private` function
- Function requires 4 inputs including private credits record
- Shield wallet rejects the transaction with "Invalid transaction payload"

---

## 🔍 What We've Tried

### Attempt 1: Empty Object `{}`
```javascript
inputs: [
  `${auctionId}field`,
  commitment,
  {},  // Empty object as placeholder
  `${amountCredits}u64`
]
```
**Result:** ❌ Invalid transaction payload

### Attempt 2: String "private"
```javascript
inputs: [
  `${auctionId}field`,
  commitment,
  "private",  // String keyword
  `${amountCredits}u64`
]
```
**Result:** ❌ Invalid transaction payload

### Attempt 3: null
```javascript
inputs: [
  `${auctionId}field`,
  commitment,
  null,  // Null value
  `${amountCredits}u64`
]
```
**Result:** ❌ Invalid transaction payload

### Attempt 4: Record Type String
```javascript
inputs: [
  `${auctionId}field`,
  commitment,
  'credits.aleo/credits',  // Type hint
  `${amountCredits}u64`
]
```
**Result:** ❌ Invalid transaction payload

### Attempt 5: Empty String
```javascript
inputs: [
  `${auctionId}field`,
  commitment,
  '',  // Empty string
  `${amountCredits}u64`
]
```
**Result:** ❌ Invalid transaction payload

### Attempt 6: Only 3 Inputs (Let Wallet Inject)
```javascript
inputs: [
  `${auctionId}field`,
  commitment,
  `${amountCredits}u64`
  // Omit 3rd parameter
]
```
**Result:** ❌ expects 4 inputs, but 3 were provided

---

## 🤔 The Real Question

**How does Shield wallet expect private record inputs to be passed?**

Shield wallet is designed specifically for private transactions, so it MUST have a way to handle private record inputs. We just need to find the correct format.

---

## 📚 Possible Solutions

### Solution 1: Check Shield Wallet Documentation
Shield wallet might have specific documentation on how to pass private record inputs in `executeTransaction`.

**Action Items:**
- [ ] Check Shield wallet GitHub repo
- [ ] Check Shield wallet documentation site
- [ ] Look for example dApps using Shield wallet
- [ ] Check Shield wallet adapter source code

### Solution 2: Use Wallet's Record Selection API
Maybe Shield wallet has a separate API to request records first, then pass the selected record to transaction.

**Possible API:**
```javascript
// Hypothetical API
const records = await wallet.requestRecords({
  program: 'credits.aleo',
  minAmount: bidAmountMicro
});

const selectedRecord = records[0];

// Then pass the actual record object
inputs: [
  `${auctionId}field`,
  commitment,
  selectedRecord,  // Actual record object
  `${amountCredits}u64`
]
```

### Solution 3: Use Different Transaction Method
Maybe Shield wallet has a different method for private transactions:

**Possible Methods:**
```javascript
// Instead of executeTransaction
await wallet.executePrivateTransaction({...});
// Or
await wallet.executeTransactionWithRecords({...});
```

### Solution 4: Pass Record as Plaintext String
Maybe we need to pass the record in Leo plaintext format:

```javascript
inputs: [
  `${auctionId}field`,
  commitment,
  `{
    owner: ${userAddress}.private,
    microcredits: ${amount}u64.private
  }`,  // Record plaintext
  `${amountCredits}u64`
]
```

But we don't know user's actual record values...

### Solution 5: Use Record Ciphertext
Maybe we need to pass record ciphertext instead of plaintext:

```javascript
inputs: [
  `${auctionId}field`,
  commitment,
  'record1xxx...ciphertext',  // Record ciphertext
  `${amountCredits}u64`
]
```

But again, we don't have user's record ciphertext...

---

## 🔧 What We Need

### Information Needed:
1. **Shield Wallet Documentation** - How to pass private record inputs?
2. **Example Code** - Any dApp successfully using Shield wallet for private transactions?
3. **Wallet Adapter API** - What methods/properties does Shield wallet adapter expose?
4. **Function Signature** - How does Shield wallet parse function signatures to detect private inputs?

### Questions for Shield Wallet Team:
1. How should we pass private record inputs in `executeTransaction`?
2. Does Shield wallet auto-detect private record requirements from function signature?
3. Is there a separate API to request records before transaction?
4. What format should private record inputs be in the inputs array?
5. Are there any example dApps we can reference?

---

## 🎯 Current Workaround

**For now, users should use PUBLIC bid (2-step process):**

1. Toggle Privacy Mode OFF
2. Use "Transfer Credits" button (Step 1)
3. Use "Submit Commitment" button (Step 2)

This works perfectly and is already tested. The only difference is:
- **Public bid:** Transfer amount is visible on-chain
- **Private bid:** Transfer amount is hidden on-chain

Both methods still hide the actual bid amount (commitment only).

---

## 📝 Next Steps

### Immediate:
1. ✅ Update error message to be more helpful
2. ✅ Guide users to use public bid as workaround
3. ⏳ Search for Shield wallet documentation
4. ⏳ Check Shield wallet GitHub repo
5. ⏳ Look for example dApps

### Short-term:
1. Contact Shield wallet team for guidance
2. Check if other wallets (Leo, Puzzle) handle this differently
3. Test with different wallet to see if issue is Shield-specific

### Long-term:
1. Implement proper private record handling once we know the format
2. Add wallet-specific logic if different wallets need different formats
3. Update documentation with correct implementation

---

## 💡 Hypothesis

**My current hypothesis:**

Shield wallet probably expects us to:
1. NOT pass the record in inputs array at all (or pass placeholder)
2. Wallet detects function signature needs `credits.aleo/credits` record
3. Wallet automatically prompts user to select record
4. Wallet injects the selected record into the transaction before signing

**But the "Invalid transaction payload" error suggests:**
- Either our placeholder format is wrong
- Or wallet can't parse our transaction payload structure
- Or there's a bug in how we're building the transaction

**Need to investigate:**
- What does `requestTx` function do exactly?
- How does it build the transaction payload?
- Is there something wrong with our payload structure?

---

## 🔍 Debug Information

### Transaction Payload Structure:
```javascript
{
  program: 'shadowbid_marketplace_v2_18.aleo',
  function: 'commit_bid_aleo_private',
  inputs: [
    '1field',
    '123456789field',
    ???,  // This is the problem
    '1500000u64'
  ],
  fee: 2000000,
  privateFee: false
}
```

### Contract Function Signature:
```leo
async transition commit_bid_aleo_private(
    public auction_id: field,
    public commitment: field,
    private_credits: credits.aleo/credits,  // ← This parameter
    public amount_credits: u64
) -> (credits.aleo/credits, Future)
```

---

## 📞 Help Needed

**If you know how Shield wallet handles private record inputs, please share!**

Possible resources:
- Shield wallet documentation
- Shield wallet GitHub repo
- Example dApps using Shield wallet
- Shield wallet team contact

---

**Status:** 🔍 INVESTIGATING  
**Workaround:** ✅ Use public bid (toggle privacy OFF)  
**Next:** Contact Shield wallet team or find documentation

