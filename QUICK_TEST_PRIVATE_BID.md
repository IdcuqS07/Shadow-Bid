# Quick Test: Private Bid V2.18 ⚡

**URL:** http://localhost:3007/premium-auctions  
**Time:** ~5 minutes per scenario

---

## 🎯 Test Scenario 1: Public Bid (WORKS NOW)

```
✅ GUARANTEED TO WORK - Use this for actual bidding
```

### Steps
1. Open any ALEO auction
2. Click "Place Bid"
3. **Leave privacy toggle OFF** (default)
4. Enter amount: `1.5` ALEO
5. Click "Transfer Credits" → Approve
6. Wait 5 seconds
7. Click "Submit Commitment" → Approve
8. ✅ Success!

### Expected
- 2 transactions
- Both approved
- Bid saved
- Success message

---

## 🎯 Test Scenario 2: Privacy Toggle UI

```
✅ TEST THE NEW UI - See V2.18 features
```

### Steps
1. Open any ALEO auction
2. Click "Place Bid"
3. **Toggle privacy ON** (gold switch)
4. See changes:
   - ✅ Warning about private credits
   - ✅ Single "🔒 Commit Private Bid" button
   - ✅ 2-step UI hidden
5. **Toggle privacy OFF**
6. See changes:
   - ✅ Warning disappears
   - ✅ 2-step UI returns

### Expected
- Toggle works smoothly
- UI changes correctly
- V2.18 badge visible
- Gold theme present

---

## 🎯 Test Scenario 3: Wallet Not Supported

```
⚠️ EXPECTED ERROR - This is normal with current Shield Wallet
```

### Steps
1. Open any ALEO auction
2. Click "Place Bid"
3. **Toggle privacy ON**
4. Enter amount: `1.5` ALEO
5. Click "🔒 Commit Private Bid"
6. See error:
   ```
   ❌ Wallet Not Supported
   
   Your wallet does not support private transactions yet.
   
   Please use public bid (toggle off privacy mode) or try:
   • Shield Wallet (recommended)
   • Leo Wallet
   • Puzzle Wallet
   ```

### Expected
- Error appears immediately
- Clear explanation
- Helpful suggestions
- Can toggle OFF and use public bid

---

## 🎯 Test Scenario 4: Duplicate Bid Prevention

```
✅ SECURITY TEST - Verify cannot bid twice
```

### Steps
1. Place a bid successfully (Scenario 1)
2. Try to bid again on same auction
3. See error:
   ```
   ❌ You Already Have a Bid!
   
   Your bid: 1.50 ALEO
   
   ⚠️ Bids are final and cannot be changed or canceled.
   ```

### Expected
- Blocked immediately
- Shows existing bid
- Clear explanation
- Cannot place second bid

---

## 📊 Quick Checklist

### UI Elements (Visual Check)
- [ ] Privacy toggle visible (ALEO auctions only)
- [ ] V2.18 badge present
- [ ] Gold color theme
- [ ] Shield icon present
- [ ] Toggle switch animates
- [ ] Warning text changes

### Functionality (Interaction Check)
- [ ] Public bid works (2-step)
- [ ] Privacy toggle changes UI
- [ ] Private bid shows error (expected)
- [ ] Duplicate bid blocked
- [ ] Success messages clear
- [ ] Error messages helpful

### Console Logs (DevTools Check)
- [ ] No red errors (except expected wallet error)
- [ ] Transaction IDs logged
- [ ] "✅" success indicators
- [ ] Clear step descriptions

---

## 🐛 Troubleshooting

### Problem: Privacy toggle not visible
**Solution:** Make sure it's an ALEO auction (not USDCx)

### Problem: Public bid fails
**Solution:** 
- Check wallet balance (need bid + 0.002 ALEO)
- Verify wallet connected
- Check contract deployed

### Problem: "Wallet Not Supported" error
**Solution:** This is EXPECTED! Use public bid instead (toggle OFF)

### Problem: Cannot place bid
**Solution:** Check if you already have a bid (duplicate prevention)

---

## ✅ Success = All These Work

1. ✅ Privacy toggle appears and works
2. ✅ Public bid completes successfully
3. ✅ Error handling is clear
4. ✅ Duplicate bid prevention works
5. ✅ UI is intuitive and responsive

---

## 🎉 Ready to Test!

**Start with Scenario 1** (Public Bid) to verify everything works.

**Then test Scenario 2** (Privacy Toggle) to see the new UI.

**Total time:** ~10 minutes for all scenarios

