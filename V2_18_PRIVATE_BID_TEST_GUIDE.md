# V2.18 Private Bid - Testing Guide 🧪

**Date:** 25 March 2026  
**Status:** Ready for Testing  
**Environment:** http://localhost:3007/

---

## 🎯 Test Objectives

1. ✅ Verify privacy toggle appears for ALEO auctions
2. ✅ Test private bid flow (if wallet supports)
3. ✅ Test public bid fallback (current working solution)
4. ✅ Verify error handling for unsupported wallets
5. ✅ Confirm UI/UX is clear and intuitive

---

## 📋 Pre-Test Checklist

### Environment Setup
- [ ] Application running on `http://localhost:3007/`
- [ ] Wallet connected (Shield/Leo/Puzzle)
- [ ] V2.18 contract deployed on testnet
- [ ] At least 2 test accounts (seller + bidder)

### Test Data Needed
- [ ] ALEO auction (currency_type = 1)
- [ ] Minimum bid amount noted
- [ ] Wallet has sufficient balance (bid amount + ~0.002 ALEO fees)

---

## 🧪 Test Cases

### TEST 1: Privacy Toggle Visibility ✅

**Objective:** Verify privacy toggle only shows for ALEO auctions

**Steps:**
1. Navigate to ALEO auction detail page
2. Click "Place Bid" button
3. Look for privacy toggle in bid form

**Expected Results:**
- ✅ Privacy toggle visible with gold theme
- ✅ "Privacy Mode" label with V2.18 badge
- ✅ Toggle switch (OFF by default)
- ✅ Description text visible

**Screenshot Checklist:**
- [ ] Toggle switch visible
- [ ] V2.18 badge present
- [ ] Gold color theme
- [ ] Shield icon present

---

### TEST 2: Privacy Toggle Interaction ✅

**Objective:** Verify toggle changes UI state

**Steps:**
1. In bid form, toggle privacy mode ON
2. Observe UI changes
3. Toggle privacy mode OFF
4. Observe UI changes

**Expected Results:**

**When Privacy ON:**
- ✅ Toggle switch moves right (gold background)
- ✅ Text changes to "🔒 Private: Transfer hidden on-chain"
- ✅ Warning appears: "Private mode requires private ALEO credits"
- ✅ 2-step UI disappears
- ✅ Single "🔒 Commit Private Bid" button appears

**When Privacy OFF:**
- ✅ Toggle switch moves left (gray background)
- ✅ Text changes to "👁️ Public: Transfer visible on-chain"
- ✅ Warning disappears
- ✅ 2-step UI appears (Transfer + Commit)
- ✅ Private bid button disappears

---

### TEST 3: Public Bid Flow (Current Working Solution) ✅

**Objective:** Verify public bid still works perfectly

**Steps:**
1. Toggle privacy mode OFF (or leave default)
2. Enter bid amount (>= minimum bid)
3. Click "Transfer Credits" (Step 1)
4. Approve in wallet
5. Wait for confirmation
6. Click "Submit Commitment" (Step 2)
7. Approve in wallet
8. Wait for confirmation

**Expected Results:**
- ✅ Step 1 completes successfully
- ✅ UI moves to Step 2
- ✅ Step 2 completes successfully
- ✅ Success message shown
- ✅ Bid saved to localStorage
- ✅ Form resets
- ✅ "Bid Placed Successfully" card appears

**Console Logs to Check:**
```
📤 Step 1: Transferring Aleo Credits...
✅ Step 1 complete - transaction accepted
📝 Step 2: Submitting commitment...
✅ Step 2 complete - transaction accepted
💾 Saved to localStorage
```

---

### TEST 4: Private Bid - Wallet Not Supported ⚠️

**Objective:** Verify error handling for unsupported wallets

**Steps:**
1. Toggle privacy mode ON
2. Enter bid amount
3. Click "🔒 Commit Private Bid"

**Expected Results (Shield Wallet Current Version):**
- ✅ Alert appears immediately
- ✅ Error message: "❌ Wallet Not Supported"
- ✅ Explanation: "Your wallet does not support private transactions yet"
- ✅ Suggestions provided:
  - Use public bid (toggle off)
  - Try Shield Wallet (recommended)
  - Try Leo Wallet
  - Try Puzzle Wallet

**Console Logs:**
```
🔒 Private Bid Flow
❌ Private bid error: wallet.requestRecords is not a function
```

---

### TEST 5: Private Bid - Wallet Supports (Future Test) 🔮

**Objective:** Test private bid when wallet supports requestRecords()

**Prerequisites:**
- Wallet that supports `wallet.requestRecords()` API
- Private ALEO credits in wallet

**Steps:**
1. Toggle privacy mode ON
2. Enter bid amount (>= minimum bid)
3. Click "🔒 Commit Private Bid"
4. Wallet shows private records selection
5. Select record with sufficient balance
6. Approve transaction
7. Wait for confirmation

**Expected Results:**
- ✅ Wallet shows private records
- ✅ Records filtered by balance
- ✅ Transaction submitted
- ✅ Success message shown
- ✅ Bid saved to localStorage
- ✅ Form resets
- ✅ Single transaction (not 2 steps)

**Console Logs:**
```
🔒 Private Bid Flow
  - Amount: X.XX ALEO
  - Commitment: XXXfield
📋 Requesting private records...
📋 Found X records
✅ Selected record with X.XX ALEO
✅ Private bid result: { transactionId: "at1xxx..." }
💾 Saved to localStorage
```

---

### TEST 6: No Private Credits Error 🔮

**Objective:** Verify error when no private credits available

**Prerequisites:**
- Wallet supports requestRecords()
- No private ALEO credits in wallet

**Steps:**
1. Toggle privacy mode ON
2. Enter bid amount
3. Click "🔒 Commit Private Bid"

**Expected Results:**
- ✅ Alert appears
- ✅ Error: "❌ No Private Credits Available"
- ✅ Explanation provided
- ✅ Options listed:
  1. Use public bid
  2. Transfer ALEO to private first
- ✅ Required amount shown

---

### TEST 7: Insufficient Private Balance 🔮

**Objective:** Verify error when private balance too low

**Prerequisites:**
- Wallet supports requestRecords()
- Has private credits but less than bid amount

**Steps:**
1. Toggle privacy mode ON
2. Enter large bid amount (more than private balance)
3. Click "🔒 Commit Private Bid"

**Expected Results:**
- ✅ Alert appears
- ✅ Error: "❌ No Private Credits Available"
- ✅ Message explains insufficient balance
- ✅ Suggestions provided

---

### TEST 8: USDCx Auction - No Privacy Toggle ✅

**Objective:** Verify privacy toggle doesn't appear for USDCx

**Steps:**
1. Navigate to USDCx auction (currency_type = 0)
2. Click "Place Bid"
3. Look for privacy toggle

**Expected Results:**
- ✅ NO privacy toggle visible
- ✅ Only single-step bid form shown
- ✅ "Confirm Bid" button visible
- ✅ No V2.18 private bid features

**Reason:** Private transactions only supported for ALEO in V2.18

---

### TEST 9: Transaction Cancelled by User ✅

**Objective:** Verify error handling when user rejects transaction

**Steps:**
1. Toggle privacy mode ON (or OFF for public)
2. Enter bid amount
3. Click bid button
4. Click "Reject" in wallet popup

**Expected Results:**
- ✅ Error message shown
- ✅ "Transaction was cancelled by user" or similar
- ✅ Form remains filled (can retry)
- ✅ No data saved to localStorage
- ✅ Can try again

---

### TEST 10: Duplicate Bid Prevention ✅

**Objective:** Verify user cannot place multiple bids

**Steps:**
1. Place a bid successfully (public or private)
2. Try to place another bid on same auction

**Expected Results:**
- ✅ Alert appears immediately
- ✅ Error: "❌ You Already Have a Bid!"
- ✅ Shows existing bid amount
- ✅ Explains bids are final
- ✅ Cannot place second bid

---

## 📊 Test Results Template

### Test Session Info
- **Date:** _____________
- **Tester:** _____________
- **Wallet:** Shield / Leo / Puzzle (circle one)
- **Wallet Version:** _____________
- **Browser:** _____________

### Results Summary

| Test # | Test Name | Status | Notes |
|--------|-----------|--------|-------|
| 1 | Privacy Toggle Visibility | ⬜ Pass / ⬜ Fail | |
| 2 | Privacy Toggle Interaction | ⬜ Pass / ⬜ Fail | |
| 3 | Public Bid Flow | ⬜ Pass / ⬜ Fail | |
| 4 | Wallet Not Supported Error | ⬜ Pass / ⬜ Fail | |
| 5 | Private Bid Success | ⬜ Pass / ⬜ Fail / ⬜ Skip | |
| 6 | No Private Credits Error | ⬜ Pass / ⬜ Fail / ⬜ Skip | |
| 7 | Insufficient Balance Error | ⬜ Pass / ⬜ Fail / ⬜ Skip | |
| 8 | USDCx No Privacy Toggle | ⬜ Pass / ⬜ Fail | |
| 9 | Transaction Cancelled | ⬜ Pass / ⬜ Fail | |
| 10 | Duplicate Bid Prevention | ⬜ Pass / ⬜ Fail | |

---

## 🐛 Known Issues & Workarounds

### Issue 1: Shield Wallet - requestRecords Not Supported
**Status:** Expected (not a bug)  
**Workaround:** Use public bid (toggle privacy OFF)  
**Future:** Wait for Shield Wallet update

### Issue 2: Private Credits Not Available
**Status:** User needs to transfer public → private first  
**Workaround:** Use public bid or transfer to private  
**Future:** Add "Transfer to Private" button in UI

---

## 🎬 Quick Test Script

### Scenario A: Public Bid (Current Working)
```
1. Open http://localhost:3007/premium-auctions
2. Click any ALEO auction
3. Click "Place Bid"
4. Leave privacy toggle OFF
5. Enter bid amount: 1.5 ALEO
6. Click "Transfer Credits"
7. Approve in wallet
8. Wait 5 seconds
9. Click "Submit Commitment"
10. Approve in wallet
11. ✅ Should see success message
```

### Scenario B: Privacy Toggle Test
```
1. Open auction detail
2. Click "Place Bid"
3. Toggle privacy ON
4. ✅ Should see warning about private credits
5. ✅ Should see single "🔒 Commit Private Bid" button
6. Toggle privacy OFF
7. ✅ Should see 2-step UI again
```

### Scenario C: Wallet Not Supported (Expected)
```
1. Open auction detail
2. Click "Place Bid"
3. Toggle privacy ON
4. Enter bid amount: 1.5 ALEO
5. Click "🔒 Commit Private Bid"
6. ✅ Should see "Wallet Not Supported" error
7. ✅ Should suggest using public bid
```

---

## 📸 Screenshots to Capture

### UI Screenshots
1. [ ] Privacy toggle OFF (default state)
2. [ ] Privacy toggle ON (with warning)
3. [ ] 2-step public bid UI
4. [ ] Single-step private bid button
5. [ ] "Wallet Not Supported" error
6. [ ] "Bid Placed Successfully" card
7. [ ] Duplicate bid prevention error

### Console Screenshots
1. [ ] Public bid success logs
2. [ ] Private bid attempt logs
3. [ ] Wallet not supported error
4. [ ] Transaction IDs

---

## ✅ Success Criteria

### Must Pass (Critical)
- ✅ Privacy toggle appears for ALEO auctions
- ✅ Privacy toggle changes UI correctly
- ✅ Public bid works perfectly (2-step)
- ✅ Error handling for unsupported wallet
- ✅ Duplicate bid prevention works
- ✅ No privacy toggle for USDCx auctions

### Should Pass (Important)
- ✅ Clear error messages
- ✅ Helpful suggestions in errors
- ✅ UI is intuitive
- ✅ V2.18 branding visible
- ✅ Console logs helpful for debugging

### Nice to Have (Future)
- 🔮 Private bid works with compatible wallet
- 🔮 Record selection UI
- 🔮 Manual record input option
- 🔮 "Transfer to Private" helper button

---

## 🚀 Next Steps After Testing

### If All Tests Pass
1. Document test results
2. Create user guide
3. Prepare for production deployment
4. Monitor wallet ecosystem for requestRecords() support

### If Issues Found
1. Document specific failures
2. Check console logs
3. Verify contract deployment
4. Check wallet version
5. Report to development team

---

## 📞 Support & Debugging

### Console Commands for Debugging
```javascript
// Check wallet capabilities
console.log('Wallet:', wallet);
console.log('Has requestRecords:', typeof wallet?.requestRecords);

// Check localStorage
console.log('My Auctions:', localStorage.getItem('myAuctions'));
console.log('Commitment:', localStorage.getItem('commitment_1_aleo1xxx'));

// Check contract version
console.log('Program ID:', import.meta.env.VITE_PROGRAM_ID);
```

### Common Debug Steps
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors (red text)
4. Check Network tab for failed requests
5. Check Application > Local Storage

---

**Ready to Test!** 🎉

Start with **Scenario A (Public Bid)** to verify basic functionality, then test privacy toggle UI with **Scenario B**.

