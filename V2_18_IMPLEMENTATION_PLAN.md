# V2.18 Implementation Plan - Minimal Viable RWA

## 🎯 Goal
Fix critical payment issue di V2.17 dengan menambahkan mekanisme seller claim payment yang proper untuk RWA marketplace.

---

## ✅ Must Have Features

### 1. **Confirm Receipt** (Winner)
Winner confirm bahwa item RWA sudah diterima dengan kondisi baik.

### 2. **Claim Winning Bid** (Seller)
Seller claim payment setelah winner confirm receipt.

### 3. **Basic Escrow Release**
Payment released dari escrow ke seller setelah confirmation.

---

## 🔧 Smart Contract Changes

### **A. Update AuctionInfo Struct**

**Add New Fields:**
```leo
struct AuctionInfo {
    seller: address,
    min_bid_amount: u128,
    currency_type: u8,
    end_time: i64,
    challenge_period: i64,
    state: u8,
    winner: address,
    winning_amount: u128,
    challenge_end_time: i64,
    total_escrowed: u128,
    
    // NEW FIELDS for V2.18
    item_received: bool,           // Winner confirmed receipt
    item_received_at: i64,         // Timestamp when confirmed
    payment_claimed: bool,         // Seller claimed payment
    payment_claimed_at: i64        // Timestamp when claimed
}
```

**Default Values:**
```leo
// In create_auction
item_received: false,
item_received_at: 0i64,
payment_claimed: false,
payment_claimed_at: 0i64
```

---

### **B. New Transition: confirm_receipt**

**Purpose:** Winner confirm item RWA sudah diterima

```leo
// -------------------------
// 8. Confirm Receipt (Winner)
// -------------------------

async transition confirm_receipt(
    public auction_id: field
) -> Future {
    return finalize_confirm_receipt(auction_id, self.signer);
}

async function finalize_confirm_receipt(
    auction_id: field,
    caller: address
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Validations
    assert_eq(auction.state, SETTLED);           // Must be finalized
    assert_eq(auction.winner, caller);           // Only winner can confirm
    assert(!auction.item_received);              // Cannot confirm twice
    
    // Get current time (use block height as proxy)
    let current_time: i64 = block.height as i64;
    
    // Update auction
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        challenge_period: auction.challenge_period,
        state: auction.state,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        challenge_end_time: auction.challenge_end_time,
        total_escrowed: auction.total_escrowed,
        item_received: true,                     // Mark as received
        item_received_at: current_time,          // Record timestamp
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}
```

**Validations:**
- ✅ Auction must be SETTLED (finalized)
- ✅ Only winner can call
- ✅ Cannot confirm twice
- ✅ Record timestamp

---

### **C. New Transition: claim_winning (Aleo)**

**Purpose:** Seller claim winning bid payment setelah winner confirm

```leo
// -------------------------
// 9. Claim Winning - Aleo Credits
// -------------------------

async transition claim_winning_aleo(
    public auction_id: field
) -> Future {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Transfer winning amount to seller
    let transfer_future: Future = credits.aleo/transfer_public(
        auction.seller,
        auction.winning_amount as u64
    );
    
    return finalize_claim_winning_aleo(
        auction_id,
        self.signer,
        transfer_future
    );
}

async function finalize_claim_winning_aleo(
    auction_id: field,
    caller: address,
    transfer_future: Future
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Validations
    assert_eq(auction.seller, caller);           // Only seller can claim
    assert_eq(auction.state, SETTLED);           // Must be finalized
    assert_eq(auction.currency_type, CURRENCY_ALEO);  // Must be Aleo auction
    assert(auction.item_received);               // Winner must confirm first
    assert(!auction.payment_claimed);            // Cannot claim twice
    
    // Wait for transfer to complete
    transfer_future.await();
    
    // Get current time
    let current_time: i64 = block.height as i64;
    
    // Update auction
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        challenge_period: auction.challenge_period,
        state: auction.state,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        challenge_end_time: auction.challenge_end_time,
        total_escrowed: auction.total_escrowed,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: true,                   // Mark as claimed
        payment_claimed_at: current_time         // Record timestamp
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
    
    // Update winner escrow (mark as paid)
    let winner_key: field = auction_id + BHP256::hash_to_field(auction.winner);
    let winner_escrow: Escrow = Mapping::get(escrow, winner_key);
    
    let updated_escrow: Escrow = Escrow {
        bidder: winner_escrow.bidder,
        amount: winner_escrow.amount,
        is_refunded: true,  // Reuse flag to mean "paid to seller"
        is_winner: winner_escrow.is_winner
    };
    Mapping::set(escrow, winner_key, updated_escrow);
}
```

**Validations:**
- ✅ Only seller can call
- ✅ Auction must be SETTLED
- ✅ Must be Aleo auction
- ✅ Winner must confirm first (`item_received = true`)
- ✅ Cannot claim twice
- ✅ Transfer winning amount to seller
- ✅ Mark escrow as paid

---

### **D. New Transition: claim_winning (USDCx)**

**Purpose:** Seller claim winning bid untuk USDCx auction

```leo
// -------------------------
// 9b. Claim Winning - USDCx
// -------------------------

async transition claim_winning_usdcx(
    public auction_id: field
) -> Future {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Transfer winning amount to seller
    let transfer_future: Future = test_usdcx_stablecoin.aleo/transfer_public(
        auction.seller,
        auction.winning_amount
    );
    
    return finalize_claim_winning_usdcx(
        auction_id,
        self.signer,
        transfer_future
    );
}

async function finalize_claim_winning_usdcx(
    auction_id: field,
    caller: address,
    transfer_future: Future
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Validations
    assert_eq(auction.seller, caller);
    assert_eq(auction.state, SETTLED);
    assert_eq(auction.currency_type, CURRENCY_USDX);
    assert(auction.item_received);
    assert(!auction.payment_claimed);
    
    // Wait for transfer
    transfer_future.await();
    
    // Get current time
    let current_time: i64 = block.height as i64;
    
    // Update auction (same as Aleo version)
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        challenge_period: auction.challenge_period,
        state: auction.state,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        challenge_end_time: auction.challenge_end_time,
        total_escrowed: auction.total_escrowed,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: true,
        payment_claimed_at: current_time
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
    
    // Update winner escrow
    let winner_key: field = auction_id + BHP256::hash_to_field(auction.winner);
    let winner_escrow: Escrow = Mapping::get(escrow, winner_key);
    
    let updated_escrow: Escrow = Escrow {
        bidder: winner_escrow.bidder,
        amount: winner_escrow.amount,
        is_refunded: true,
        is_winner: winner_escrow.is_winner
    };
    Mapping::set(escrow, winner_key, updated_escrow);
}
```

---

## 🎨 UI Implementation

### **A. Update aleoServiceV2.js**

**Add New Functions:**

```javascript
// Confirm receipt (winner)
export const confirmReceipt = async (executeTransaction, auctionId) => {
  try {
    console.log('✅ Confirming receipt for auction:', auctionId);
    
    const result = await executeTransaction({
      program: 'shadowbid_marketplace_v2_18.aleo',
      function: 'confirm_receipt',
      inputs: [`${auctionId}field`],
      fee: 1_000_000,
      privateFee: false,
    });
    
    console.log('✅ Receipt confirmed:', result);
    return result;
  } catch (error) {
    console.error('❌ Error confirming receipt:', error);
    throw error;
  }
};

// Claim winning bid (seller) - Aleo
export const claimWinningAleo = async (executeTransaction, auctionId) => {
  try {
    console.log('💰 Claiming winning bid for auction:', auctionId);
    
    const result = await executeTransaction({
      program: 'shadowbid_marketplace_v2_18.aleo',
      function: 'claim_winning_aleo',
      inputs: [`${auctionId}field`],
      fee: 1_000_000,
      privateFee: false,
    });
    
    console.log('✅ Winning bid claimed:', result);
    return result;
  } catch (error) {
    console.error('❌ Error claiming winning bid:', error);
    throw error;
  }
};

// Claim winning bid (seller) - USDCx
export const claimWinningUSDCx = async (executeTransaction, auctionId) => {
  try {
    console.log('💰 Claiming winning bid (USDCx) for auction:', auctionId);
    
    const result = await executeTransaction({
      program: 'shadowbid_marketplace_v2_18.aleo',
      function: 'claim_winning_usdcx',
      inputs: [`${auctionId}field`],
      fee: 1_000_000,
      privateFee: false,
    });
    
    console.log('✅ Winning bid claimed:', result);
    return result;
  } catch (error) {
    console.error('❌ Error claiming winning bid:', error);
    throw error;
  }
};
```

---

### **B. Update PremiumAuctionDetail.jsx**

**Add New Handlers:**

```javascript
const handleConfirmReceipt = async () => {
  if (!connected) {
    alert('Please connect your wallet first');
    return;
  }
  
  // Check if user is winner
  if (auction.winner?.toLowerCase() !== address?.toLowerCase()) {
    alert('❌ Only the winner can confirm receipt');
    return;
  }
  
  const confirmDialog = window.confirm(
    '✅ Confirm Item Receipt?\n\n' +
    'By confirming, you acknowledge that:\n' +
    '• You have received the item\n' +
    '• The item matches the description\n' +
    '• The item is in acceptable condition\n\n' +
    'After confirmation, the seller can claim payment.\n\n' +
    'Continue?'
  );
  
  if (!confirmDialog) return;
  
  setIsSubmitting(true);
  
  try {
    console.log('✅ Confirming receipt...');
    
    const result = await confirmReceipt(executeTransaction, parseInt(auctionId));
    
    console.log('✅ Receipt confirmed:', result);
    alert('✅ Receipt Confirmed!\n\nThank you. The seller can now claim payment.');
    
    await loadAuctionData();
    
  } catch (error) {
    console.error('❌ Error confirming receipt:', error);
    alert(`❌ Failed to confirm receipt:\n\n${error.message || error}`);
  } finally {
    setIsSubmitting(false);
  }
};

const handleClaimWinning = async () => {
  if (!connected) {
    alert('Please connect your wallet first');
    return;
  }
  
  // Check if user is seller
  if (auction.seller?.toLowerCase() !== address?.toLowerCase()) {
    alert('❌ Only the seller can claim winning bid');
    return;
  }
  
  setIsSubmitting(true);
  
  try {
    console.log('💰 Claiming winning bid...');
    
    // Choose function based on currency type
    const result = auction.currencyType === 1
      ? await claimWinningAleo(executeTransaction, parseInt(auctionId))
      : await claimWinningUSDCx(executeTransaction, parseInt(auctionId));
    
    console.log('✅ Winning bid claimed:', result);
    alert(`✅ Payment Claimed Successfully!\n\nYou received ${auction.winningAmount} ${auction.token}`);
    
    await loadAuctionData();
    
  } catch (error) {
    console.error('❌ Error claiming winning bid:', error);
    alert(`❌ Failed to claim payment:\n\n${error.message || error}`);
  } finally {
    setIsSubmitting(false);
  }
};
```

---

### **C. Update loadAuctionData**

**Parse New Fields:**

```javascript
const loadAuctionData = async () => {
  // ... existing code
  
  const onChainData = await getAuctionInfo(auctionId);
  
  // Parse new fields
  const itemReceived = onChainData?.item_received 
    ? onChainData.item_received === 'true'
    : false;
  
  const paymentClaimed = onChainData?.payment_claimed
    ? onChainData.payment_claimed === 'true'
    : false;
  
  const auctionData = {
    // ... existing fields
    itemReceived,
    paymentClaimed,
  };
  
  setAuction(auctionData);
};
```

---

### **D. Add UI Components**

**Winner Actions (After Finalized):**

```jsx
{/* Winner: Confirm Receipt */}
{auction.winner?.toLowerCase() === address?.toLowerCase() && 
 auction.status === 'finalized' && 
 !auction.itemReceived && (
  <div className="space-y-3">
    <div className="p-4 bg-gold-500/10 border border-gold-500/30 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-5 h-5 text-gold-400" />
        <div className="font-mono text-sm text-gold-400">Action Required</div>
      </div>
      <div className="text-xs text-white/60 mb-3">
        You won this auction! Please confirm receipt after receiving the item.
      </div>
      <div className="text-xs text-white/40">
        Winning Bid: {auction.winningAmount} {auction.token}
      </div>
    </div>
    
    <PremiumButton 
      className="w-full"
      onClick={handleConfirmReceipt}
      disabled={isSubmitting}
    >
      {isSubmitting ? 'Confirming...' : '✅ Confirm Item Received'}
    </PremiumButton>
    
    <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
      <div className="text-xs text-white/60">
        <div className="font-mono text-cyan-400 mb-2">Winner Checklist:</div>
        <div className="space-y-1">
          <div>✓ Item received</div>
          <div>✓ Item matches description</div>
          <div>✓ Item condition acceptable</div>
        </div>
        <div className="mt-2 text-amber-400">
          Only confirm after inspecting the item!
        </div>
      </div>
    </div>
  </div>
)}

{/* Winner: Already Confirmed */}
{auction.winner?.toLowerCase() === address?.toLowerCase() && 
 auction.status === 'finalized' && 
 auction.itemReceived && (
  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
    <div className="flex items-center gap-2 mb-2">
      <CheckCircle className="w-5 h-5 text-green-400" />
      <div className="font-mono text-sm text-green-400">Receipt Confirmed</div>
    </div>
    <div className="text-xs text-white/60">
      You have confirmed receipt. The seller can now claim payment.
    </div>
  </div>
)}
```

**Seller Actions (After Finalized):**

```jsx
{/* Seller: Waiting for Confirmation */}
{auction.seller?.toLowerCase() === address?.toLowerCase() && 
 auction.status === 'finalized' && 
 !auction.itemReceived && (
  <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
    <div className="flex items-center gap-2 mb-2">
      <Clock className="w-5 h-5 text-cyan-400" />
      <div className="font-mono text-sm text-cyan-400">Waiting for Winner</div>
    </div>
    <div className="text-xs text-white/60 mb-2">
      Winner must confirm receipt before you can claim payment.
    </div>
    <div className="text-xs text-white/40">
      Winning Amount: {auction.winningAmount} {auction.token}
    </div>
  </div>
)}

{/* Seller: Ready to Claim */}
{auction.seller?.toLowerCase() === address?.toLowerCase() && 
 auction.status === 'finalized' && 
 auction.itemReceived && 
 !auction.paymentClaimed && (
  <div className="space-y-3">
    <div className="p-4 bg-gold-500/10 border border-gold-500/30 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle className="w-5 h-5 text-gold-400" />
        <div className="font-mono text-sm text-gold-400">Ready to Claim</div>
      </div>
      <div className="text-xs text-white/60 mb-3">
        Winner has confirmed receipt. You can now claim your payment!
      </div>
      <div className="text-xl font-display font-bold text-gold-500">
        {auction.winningAmount} <span className="text-sm text-cyan-400">{auction.token}</span>
      </div>
    </div>
    
    <PremiumButton 
      className="w-full"
      onClick={handleClaimWinning}
      disabled={isSubmitting}
    >
      {isSubmitting ? 'Claiming...' : '💰 Claim Winning Bid'}
    </PremiumButton>
  </div>
)}

{/* Seller: Already Claimed */}
{auction.seller?.toLowerCase() === address?.toLowerCase() && 
 auction.status === 'finalized' && 
 auction.paymentClaimed && (
  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
    <div className="flex items-center gap-2 mb-2">
      <CheckCircle className="w-5 h-5 text-green-400" />
      <div className="font-mono text-sm text-green-400">Payment Claimed</div>
    </div>
    <div className="text-xs text-white/60">
      You have successfully claimed the winning bid payment.
    </div>
  </div>
)}
```

---

## 🔄 Complete Workflow V2.18

### **Seller Workflow:**

```
1. Create Auction
   ↓
2. Wait for bids
   ↓
3. Close Auction
   ↓
4. Wait for reveals
   ↓
5. Determine Winner
   ↓
6. Finalize Winner
   ↓
7. ⏳ Wait for Winner Confirmation
   ↓
8. 💰 Claim Winning Bid ← NEW!
   ↓
9. ✅ Complete
```

### **Winner Workflow:**

```
1. Place Bid
   ↓
2. Wait for close
   ↓
3. Reveal Bid
   ↓
4. Wait for finalize
   ↓
5. 🏆 You Won!
   ↓
6. ⏳ Wait for Item Delivery
   ↓
7. ✅ Confirm Receipt ← NEW!
   ↓
8. ✅ Complete
```

### **Loser Workflow:**

```
1. Place Bid
   ↓
2. Wait for close
   ↓
3. Reveal Bid
   ↓
4. Wait for finalize
   ↓
5. ❌ You Lost
   ↓
6. 💰 Claim Refund
   ↓
7. ✅ Complete
```

---

## 📊 State Diagram

```
SETTLED (Finalized)
  ↓
  ├─ Winner: item_received = false
  │    ↓
  │    [Confirm Receipt]
  │    ↓
  │    item_received = true
  │    ↓
  │    Seller: payment_claimed = false
  │    ↓
  │    [Claim Winning]
  │    ↓
  │    payment_claimed = true
  │    ↓
  │    ✅ COMPLETE
  │
  └─ Losers: Claim Refund
       ↓
       ✅ COMPLETE
```

---

## 🧪 Testing Scenarios

### **Scenario 1: Happy Path**
1. ✅ Winner confirm receipt
2. ✅ Seller claim winning
3. ✅ Losers claim refund
4. ✅ All parties satisfied

### **Scenario 2: Winner Tidak Confirm**
1. ❌ Winner tidak confirm receipt
2. ⏳ Seller tunggu (stuck)
3. ⚠️ **Problem:** Payment held indefinitely
4. 🔮 **Solution:** Timeout di V2.19

### **Scenario 3: Seller Tidak Ship**
1. ✅ Winner waiting for item
2. ❌ Seller tidak ship
3. ❌ Winner tidak confirm
4. ⚠️ **Problem:** No recourse untuk winner
5. 🔮 **Solution:** Dispute system di V3.0

### **Scenario 4: Double Claim Attempt**
1. ✅ Seller claim winning
2. ❌ Seller coba claim lagi
3. ✅ Contract reject (payment_claimed = true)
4. ✅ Protection works

---

## 📝 Implementation Checklist

### **Phase 1: Smart Contract**
- [ ] Update AuctionInfo struct (add 4 new fields)
- [ ] Implement confirm_receipt transition
- [ ] Implement claim_winning_aleo transition
- [ ] Implement claim_winning_usdcx transition
- [ ] Update all create_auction calls (add default values)
- [ ] Test all transitions
- [ ] Deploy to testnet

### **Phase 2: Services**
- [ ] Add confirmReceipt function
- [ ] Add claimWinningAleo function
- [ ] Add claimWinningUSDCx function
- [ ] Update getAuctionInfo parser
- [ ] Test all service functions

### **Phase 3: UI**
- [ ] Add handleConfirmReceipt handler
- [ ] Add handleClaimWinning handler
- [ ] Add winner action buttons
- [ ] Add seller action buttons
- [ ] Update workflow guides
- [ ] Add status indicators
- [ ] Test complete flow

### **Phase 4: Testing**
- [ ] Test happy path
- [ ] Test edge cases
- [ ] Test security validations
- [ ] Test with multiple auctions
- [ ] Test with both currencies
- [ ] User acceptance testing

---

## ⏱️ Timeline

**Week 1:**
- Day 1-2: Smart contract implementation
- Day 3: Services implementation
- Day 4-5: UI implementation
- Day 6-7: Testing & bug fixes

**Total: 1 week untuk V2.18 MVP**

---

## 🎯 Success Criteria

V2.18 dianggap sukses jika:
- ✅ Winner bisa confirm receipt
- ✅ Seller bisa claim payment setelah confirm
- ✅ Payment tidak stuck di contract
- ✅ Losers tetap bisa claim refund
- ✅ No double claim
- ✅ Clear UI untuk both parties
- ✅ All validations working

---

## 🚀 After V2.18

### **V2.19 (Enhanced):**
- Timeout mechanism (14 days auto-enable)
- Shipping tracking upload
- Better status indicators

### **V3.0 (Full RWA):**
- Dispute resolution
- Platform fee (2.5%)
- Arbitrator system
- Encrypted shipping info
- Multiple auction formats

---

**Last Updated:** 24 Maret 2026  
**Status:** Ready for Implementation  
**Priority:** CRITICAL (Fix V2.17 payment issue)
