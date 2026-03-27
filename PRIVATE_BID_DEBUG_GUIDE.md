# Private Bid Debug Guide 🔍

**Date:** 25 March 2026  
**Issue:** "Wallet Not Supported" error - investigating if it's code bug or wallet limitation

---

## 🐛 Problem Statement

User reported: "ini bukan limitation dari wallet tapi ini adalah kesalahkan kode"

**Translation:** "This is not a wallet limitation but a code error"

**Investigation:** Need to determine if Shield Wallet actually supports `requestRecords()` API and if our implementation is correct.

---

## 🔍 Debug Steps Applied

### Step 1: Enhanced Wallet Detection ✅

**Added comprehensive logging:**
```javascript
console.log('🔍 Checking wallet capabilities...');
console.log('  - Wallet object:', wallet);
console.log('  - Has requestRecords:', typeof wallet?.requestRecords);
console.log('  - Has requestRecordPlaintexts:', typeof wallet?.requestRecordPlaintexts);
console.log('  - Wallet methods:', wallet ? Object.keys(wallet) : 'no wallet');
```

**Purpose:** See exactly what methods the wallet object has

---

### Step 2: Support Multiple API Methods ✅

**Added fallback to different API names:**
```javascript
let requestRecordsMethod = null;

if (wallet?.requestRecords && typeof wallet.requestRecords === 'function') {
  requestRecordsMethod = wallet.requestRecords.bind(wallet);
  console.log('✅ Using wallet.requestRecords');
} else if (wallet?.requestRecordPlaintexts && typeof wallet.requestRecordPlaintexts === 'function') {
  requestRecordsMethod = wallet.requestRecordPlaintexts.bind(wallet);
  console.log('✅ Using wallet.requestRecordPlaintexts');
}
```

**Reason:** Different wallets might use different method names

---

### Step 3: Enhanced Record Format Support ✅

**Added support for multiple record formats:**
```javascript
// Format 1: { data: { microcredits: "1000000u64" } }
if (r.data && r.data.microcredits) {
  microcredits = parseInt(r.data.microcredits.replace('u64', ''));
}
// Format 2: { microcredits: "1000000u64" }
else if (r.microcredits) {
  microcredits = parseInt(r.microcredits.replace('u64', ''));
}
// Format 3: plaintext string
else if (typeof r === 'string') {
  const match = r.match(/microcredits:\s*(\d+)u64/);
  if (match) {
    microcredits = parseInt(match[1]);
  }
}
```

**Reason:** Wallet might return records in different formats

---

### Step 4: Detailed Error Messages ✅

**Added specific error messages for each failure point:**

1. **No API method found:**
```
❌ Wallet API Not Available

Cannot access private records from wallet.

Debug Info:
• Wallet connected: true/false
• requestRecords: function/undefined
• requestRecordPlaintexts: function/undefined

Please use public bid or check console for details.
```

2. **Invalid response:**
```
❌ Invalid Response from Wallet

Wallet returned invalid records format.

Response type: object/array/string
Is array: true/false

Please check console for details or use public bid.
```

3. **No private records:**
```
❌ No Private Records Found

Your wallet has no private ALEO credits.

Options:
1. Transfer ALEO to private (use SHIELD button)
2. Use public bid (toggle off privacy mode)
```

---

## 🧪 How to Test with New Debug Code

### Test 1: Check Console Logs

1. Open browser DevTools (F12)
2. Go to Console tab
3. Clear console (Cmd+K)
4. Toggle privacy ON
5. Enter bid amount
6. Click "🔒 COMMIT PRIVATE BID"
7. **Look for these logs:**

```
🔍 Checking wallet capabilities...
  - Wallet object: {...}
  - Has requestRecords: function/undefined
  - Has requestRecordPlaintexts: function/undefined
  - Wallet methods: [array of method names]
```

**What to look for:**
- Is wallet object present?
- Which methods are available?
- Does it have requestRecords or requestRecordPlaintexts?

---

### Test 2: Check Wallet Methods

**In console, type:**
```javascript
// Get wallet object
const wallet = window.wallet || window.aleo?.wallet;

// List all methods
console.log('Wallet methods:', Object.keys(wallet).filter(k => typeof wallet[k] === 'function'));

// Check specific methods
console.log('Has requestRecords:', typeof wallet.requestRecords);
console.log('Has requestRecordPlaintexts:', typeof wallet.requestRecordPlaintexts);
console.log('Has getRecords:', typeof wallet.getRecords);
console.log('Has records:', typeof wallet.records);
```

---

### Test 3: Try Manual Record Request

**In console, type:**
```javascript
// Try different API calls
try {
  const records1 = await wallet.requestRecords({ program: 'credits.aleo' });
  console.log('requestRecords worked:', records1);
} catch (e) {
  console.error('requestRecords failed:', e);
}

try {
  const records2 = await wallet.requestRecordPlaintexts({ program: 'credits.aleo' });
  console.log('requestRecordPlaintexts worked:', records2);
} catch (e) {
  console.error('requestRecordPlaintexts failed:', e);
}

try {
  const records3 = await wallet.getRecords('credits.aleo');
  console.log('getRecords worked:', records3);
} catch (e) {
  console.error('getRecords failed:', e);
}
```

---

## 📊 Expected Debug Output

### Scenario A: Wallet Supports API (Code Bug)

**Console should show:**
```
🔍 Checking wallet capabilities...
  - Wallet object: {requestRecords: ƒ, ...}
  - Has requestRecords: function
  - Wallet methods: ["connect", "disconnect", "requestRecords", ...]
✅ Using wallet.requestRecords
📋 Requesting private records...
  - Using method: requestRecords
  - Program: credits.aleo
📋 Records response: [...]
📋 Found X records
```

**If this happens:** Code should work! If it still fails, there's a bug in how we handle the response.

---

### Scenario B: Wallet Doesn't Support API (Wallet Limitation)

**Console should show:**
```
🔍 Checking wallet capabilities...
  - Wallet object: {connect: ƒ, disconnect: ƒ, ...}
  - Has requestRecords: undefined
  - Has requestRecordPlaintexts: undefined
  - Wallet methods: ["connect", "disconnect", "signMessage", ...]
❌ No record request method found
Available wallet methods: ["connect", "disconnect", ...]
```

**If this happens:** It IS a wallet limitation, not a code bug.

---

## 🔧 Possible Fixes Based on Results

### Fix 1: If Wallet Has Different Method Name

**Example:** Wallet uses `getPrivateRecords` instead of `requestRecords`

**Solution:**
```javascript
else if (wallet?.getPrivateRecords && typeof wallet.getPrivateRecords === 'function') {
  requestRecordsMethod = wallet.getPrivateRecords.bind(wallet);
  console.log('✅ Using wallet.getPrivateRecords');
}
```

---

### Fix 2: If Wallet Requires Different Parameters

**Example:** Wallet needs `{ programId: 'credits.aleo' }` instead of `{ program: 'credits.aleo' }`

**Solution:**
```javascript
const records = await requestRecordsMethod({
  programId: 'credits.aleo',  // Changed from 'program'
});
```

---

### Fix 3: If Records Format is Different

**Example:** Records come as plaintext strings

**Solution:** Already handled in Step 3 above - we now support multiple formats

---

### Fix 4: If Need to Use executeTransaction Instead

**Example:** Shield Wallet requires using executeTransaction with special function

**Solution:**
```javascript
// Instead of requestRecords, use a query transaction
const result = await executeTransaction({
  program: 'credits.aleo',
  function: 'get_records',  // hypothetical
  inputs: [],
  fee: 0,
  privateFee: false,
});
```

---

## 📝 Next Steps

### Immediate (Now)
1. ✅ Code updated with enhanced debugging
2. ⏳ User needs to test again and check console
3. ⏳ Share console output to identify exact issue

### After Console Output
1. Identify which scenario (A or B) applies
2. If Scenario A: Fix record handling
3. If Scenario B: Document wallet limitation
4. If neither: Investigate alternative approaches

---

## 🎯 How to Report Results

### Please provide:

1. **Console logs** (copy all text from console)
2. **Wallet methods list** (from Test 2)
3. **Manual API test results** (from Test 3)
4. **Any error messages** (full text)

### Format:
```
=== Console Logs ===
[paste console output here]

=== Wallet Methods ===
[paste wallet methods list]

=== Manual Tests ===
[paste results of manual API calls]

=== Errors ===
[paste any error messages]
```

---

## 🔍 Investigation Checklist

- [ ] Console shows wallet object
- [ ] Console shows available methods
- [ ] Identified which API method wallet has
- [ ] Tested manual record request
- [ ] Checked record format
- [ ] Verified error messages
- [ ] Determined if code bug or wallet limitation

---

**Status:** Debug code deployed, waiting for test results

**Next:** User tests and provides console output for analysis

