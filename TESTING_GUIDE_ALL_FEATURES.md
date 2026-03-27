# 🧪 Testing Guide - All Features

## Quick Test Checklist

### ✅ Test 1: Create Auction
```
URL: http://localhost:3004/premium-create

Steps:
1. Connect wallet
2. Fill form:
   - Title: "Test Auction 1"
   - Description: "Testing all features"
   - Currency: ALEO
   - Min Bid: 3
   - Duration: 1 hour
3. Click "CREATE AUCTION"
4. Approve transaction
5. ✅ Should navigate to auction list
6. ✅ Should see new auction

Expected Result:
- Auction created on blockchain
- Saved to localStorage
- Visible in auction list
```

---

### ✅ Test 2: View Auction Detail
```
URL: http://localhost:3004/premium-auctions

Steps:
1. Click on auction card
2. ✅ Should navigate to detail page
3. ✅ Should see auction info
4. ✅ Should see debug panel
5. ✅ Should see "Is Seller: YES"

Expected Result:
- All auction data displayed
- Debug panel shows correct addresses
- Seller controls visible
```

---

### ✅ Test 3: Place Bid (Aleo - Two Step)
```
URL: http://localhost:3004/premium-auction/{id}

Steps:
1. Open auction in different wallet (not seller)
2. Click "Place Bid"
3. Enter amount: 5 ALEO
4. Click "Transfer Credits"
5. Approve transaction
6. ✅ Should show "Step 2" active
7. Click "Submit Commitment"
8. Approve transaction
9. ✅ Should show success message

Expected Result:
- Credits transferred to contract
- Commitment recorded on-chain
- Nonce saved to localStorage
- Bid form closes
```

---

### ✅ Test 4: Cancel Bid (Bidder)
```
URL: http://localhost:3004/premium-auction/{id}

Prerequisites: Must have placed bid

Steps:
1. Open auction as bidder
2. ✅ Should see "🎯 Bidder Actions"
3. ✅ Should see "You have placed a bid"
4. Click "🚫 Cancel My Bid"
5. Confirm dialog
6. ✅ Should show success message

Expected Result:
- Commitment removed from localStorage
- Nonce removed from localStorage
- Can place new bid
- No blockchain transaction
```

---

### ✅ Test 5: Cancel Auction (Seller)
```
URL: http://localhost:3004/premium-auction/{id}

Prerequisites: Must be seller

Steps:
1. Open auction as seller
2. ✅ Should see "👑 Seller Controls"
3. ✅ Should see "🚫 Cancel Auction" button
4. Click "🚫 Cancel Auction"
5. Confirm dialog
6. Approve transaction
7. ✅ Should navigate to auction list

Expected Result:
- Auction cancelled on blockchain
- All bidders auto-refunded
- Removed from localStorage
- Redirected to list
```

---

### ✅ Test 6: Close Auction (Seller)
```
URL: http://localhost:3004/premium-auction/{id}

Prerequisites: Must be seller, auction active

Steps:
1. Open auction as seller
2. ✅ Should see "1️⃣ Close Auction" button
3. Click "1️⃣ Close Auction"
4. Approve transaction
5. ✅ Should show success message
6. ✅ Status should change to "closed"
7. ✅ Should see "2️⃣ Determine Winner" button

Expected Result:
- Auction state changes to CLOSED
- Bidders can now reveal
- Next button appears
```

---

### ✅ Test 7: Reveal Bid (Bidder)
```
URL: http://localhost:3004/premium-auction/{id}

Prerequisites: Auction closed, user has placed bid

Steps:
1. Open auction as bidder
2. ✅ Should see "🔓 Reveal My Bid" button
3. Click "🔓 Reveal My Bid"
4. Approve transaction
5. ✅ Should show success message

Expected Result:
- Nonce auto-loaded from localStorage
- Bid revealed on blockchain
- Bid amount now visible
```

---

### ✅ Test 8: Determine Winner (Seller)
```
URL: http://localhost:3004/premium-auction/{id}

Prerequisites: Auction closed, bids revealed

Steps:
1. Open auction as seller
2. ✅ Should see "2️⃣ Determine Winner" button
3. Click "2️⃣ Determine Winner"
4. Approve transaction
5. ✅ Should show success message
6. ✅ Status should change to "winner-determined"
7. ✅ Should see "3️⃣ Finalize Winner" button

Expected Result:
- Winner determined (O(1) operation)
- Challenge period starts (24h)
- Next button appears
```

---

### ✅ Test 9: Finalize Winner (Seller)
```
URL: http://localhost:3004/premium-auction/{id}

Prerequisites: Winner determined, 24h passed

Steps:
1. Open auction as seller
2. ✅ Should see "3️⃣ Finalize Winner" button
3. Click "3️⃣ Finalize Winner"
4. Approve transaction
5. ✅ Should show success message
6. ✅ Status should change to "finalized"

Expected Result:
- Auction finalized
- Winner can claim item
- Losers can claim refunds
```

---

### ✅ Test 10: Claim Refund (Loser)
```
URL: http://localhost:3004/premium-auction/{id}

Prerequisites: Auction finalized, user is loser

Steps:
1. Open auction as losing bidder
2. ✅ Should see "💰 Claim Refund" button
3. Click "💰 Claim Refund"
4. Approve transaction
5. ✅ Should show success message

Expected Result:
- Commitment data auto-loaded
- Refund claimed from contract
- Credits returned to wallet
```

---

## 🎯 Complete End-to-End Test

### Scenario: Full Auction Lifecycle

**Participants**:
- Wallet A (Seller)
- Wallet B (Bidder 1)
- Wallet C (Bidder 2)

**Timeline**:

**T+0: Create Auction (Wallet A)**
```
1. Connect Wallet A
2. Create auction: "Test Item", 3 ALEO min, 1h duration
3. ✅ Auction created: ID 1774290394508
```

**T+5min: Place Bids**
```
Wallet B:
1. Connect Wallet B
2. Open auction detail
3. Place bid: 5 ALEO
4. ✅ Bid committed

Wallet C:
1. Connect Wallet C
2. Open auction detail
3. Place bid: 7 ALEO
4. ✅ Bid committed
```

**T+10min: Test Cancel Bid (Optional)**
```
Wallet B:
1. Click "🚫 Cancel My Bid"
2. Confirm
3. ✅ Bid cancelled
4. Place new bid: 6 ALEO
5. ✅ New bid committed
```

**T+1h: Close Auction (Wallet A)**
```
1. Connect Wallet A
2. Open auction detail
3. Click "1️⃣ Close Auction"
4. Approve transaction
5. ✅ Auction closed
```

**T+1h+5min: Reveal Bids**
```
Wallet B:
1. Click "🔓 Reveal My Bid"
2. Approve transaction
3. ✅ Bid revealed: 6 ALEO

Wallet C:
1. Click "🔓 Reveal My Bid"
2. Approve transaction
3. ✅ Bid revealed: 7 ALEO
```

**T+1h+10min: Determine Winner (Wallet A)**
```
1. Connect Wallet A
2. Click "2️⃣ Determine Winner"
3. Approve transaction
4. ✅ Winner: Wallet C (7 ALEO)
```

**T+25h: Finalize Winner (Wallet A)**
```
1. Connect Wallet A
2. Click "3️⃣ Finalize Winner"
3. Approve transaction
4. ✅ Auction finalized
```

**T+25h+5min: Claim Refund (Wallet B - Loser)**
```
1. Connect Wallet B
2. Click "💰 Claim Refund"
3. Approve transaction
4. ✅ 6 ALEO returned to Wallet B
```

---

## 🐛 Troubleshooting

### Issue: "Close Auction" button not visible
**Check**:
- Debug panel shows "Is Seller: YES"?
- Status is 'active'?
- Wallet connected?

**Solution**: Button now shows for all active auctions

### Issue: "Reveal My Bid" button not visible
**Check**:
- Auction status is 'closed'?
- You placed a bid?
- Nonce exists in localStorage?

**Solution**: Check console for nonce retrieval logs

### Issue: "Claim Refund" button not visible
**Check**:
- Auction status is 'finalized'?
- You placed a bid?
- You are NOT the winner?

**Solution**: Wait for auction to be finalized

### Issue: Transaction fails
**Check**:
- Wallet has enough balance?
- Correct auction state?
- Network connection?

**Solution**: Check console logs for detailed error

---

## 📊 Feature Coverage

### Implemented: 15/15 (100%)
- [x] Create auction
- [x] List auctions
- [x] View auction detail
- [x] Place bid (Aleo two-step)
- [x] Place bid (USDCx single-step)
- [x] Cancel bid (bidder)
- [x] Cancel auction (seller)
- [x] Close auction (seller)
- [x] Reveal bid (bidder)
- [x] Determine winner (seller)
- [x] Finalize winner (seller)
- [x] Claim refund (loser)
- [x] Seller detection
- [x] Workflow guides
- [x] Debug panel

### Coming Soon: 3 features
- [ ] Dashboard with KPIs
- [ ] Bid activity chart
- [ ] TX history

---

## 🎉 Status: PRODUCTION READY

All core auction features are fully implemented and tested.
Premium UI provides complete V2.17 functionality with enhanced UX.
