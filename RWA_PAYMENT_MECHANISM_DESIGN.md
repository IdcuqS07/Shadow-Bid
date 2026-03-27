# Mekanisme Pembayaran RWA Marketplace - V2.18/V3.0

## 🎯 Context: ShadowBid sebagai RWA Marketplace

**RWA (Real World Assets)** = Aset fisik yang ditokenisasi dan dijual di blockchain
- Contoh: Real estate, art, collectibles, luxury goods, equipment

**Tantangan Khusus RWA:**
- ✅ Pembayaran digital (blockchain)
- ❌ Pengiriman fisik (off-chain)
- ⚠️ Perlu mekanisme escrow yang aman
- ⚠️ Perlu buyer protection
- ⚠️ Perlu seller protection

---

## 🏪 Perbandingan: Online Marketplace vs Blockchain Auction

### **Online Marketplace (Tokopedia, Shopee)**

```
1. Buyer Order & Pay
   ↓
2. 💰 Payment → Platform Escrow
   ↓
3. Seller Ship Item
   ↓
4. Buyer Receive & Confirm
   ↓
5. 💰 Escrow → Seller (Auto after 7 days or manual confirm)
   ↓
6. ✅ Transaction Complete
```

**Protection:**
- Buyer: Bisa komplain jika barang tidak sesuai
- Seller: Dapat payment setelah buyer confirm
- Platform: Hold escrow, handle dispute

---

### **Traditional Auction House (Sotheby's, Christie's)**

```
1. Bidders Place Bids
   ↓
2. Auction Close → Winner Announced
   ↓
3. Winner Pay (Wire transfer, 7-14 days)
   ↓
4. Auction House Verify Payment
   ↓
5. Winner Collect Item (or shipping)
   ↓
6. Auction House Pay Seller (minus commission)
   ↓
7. ✅ Transaction Complete
```

**Protection:**
- Buyer: Inspect item before payment
- Seller: Get payment after buyer pays
- Auction House: Verify authenticity, handle logistics

---

## 🎨 Design: ShadowBid RWA Mechanism

### **Workflow yang Disarankan:**

```
PHASE 1: BIDDING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Seller: Create Auction (list RWA item)
2. Bidders: Place Bids (transfer credits to escrow)
3. Seller: Close Auction

PHASE 2: REVEAL & DETERMINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. Bidders: Reveal Bids
5. Seller: Determine Winner (O(1))
6. Seller: Finalize Winner (mark winner, start escrow hold)

PHASE 3: DELIVERY & SETTLEMENT (RWA SPECIFIC)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. Winner: Confirm Shipping Details (off-chain or on-chain)
8. Seller: Ship Item & Upload Proof (tracking number, photos)
9. Winner: Confirm Receipt (on-chain transaction)
   ↓
   [OPTION A: Auto-Release]
   10a. 💰 Escrow → Seller (automatic after confirm)
   
   [OPTION B: Manual Claim]
   10b. Seller: Claim Winning Bid (manual withdrawal)
   
11. Losers: Claim Refund
12. ✅ Transaction Complete
```

---

## 🔐 Mekanisme Escrow untuk RWA

### **OPSI A: Auto-Release (Seperti Marketplace)**

**Karakteristik:**
- Winner confirm receipt → Auto transfer ke seller
- Seller tidak perlu claim manual
- Lebih cepat dan otomatis

**Smart Contract:**
```leo
async transition confirm_receipt(
    public auction_id: field
) -> Future {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Auto-transfer winning amount to seller
    let transfer_future: Future = credits.aleo/transfer_public(
        auction.seller,
        auction.winning_amount as u64
    );
    
    return finalize_confirm_receipt(
        auction_id,
        self.signer,  // winner
        transfer_future
    );
}
```

**Pros:**
- ✅ Otomatis, tidak perlu claim
- ✅ Seller langsung dapat payment
- ✅ UX seperti marketplace familiar

**Cons:**
- ⚠️ Winner bayar gas fee untuk transfer ke seller
- ⚠️ Jika transfer gagal, confirm gagal
- ⚠️ Tidak ada grace period untuk dispute

---

### **OPSI B: Manual Claim (Flexible)**

**Karakteristik:**
- Winner confirm receipt → Mark as received
- Seller claim winning → Transfer payment
- Seller control kapan withdraw

**Smart Contract:**
```leo
// Step 1: Winner confirm receipt
async transition confirm_receipt(
    public auction_id: field
) -> Future {
    return finalize_confirm_receipt(auction_id, self.signer);
}

async function finalize_confirm_receipt(
    auction_id: field,
    winner: address
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    assert_eq(auction.winner, winner);
    assert_eq(auction.state, SETTLED);
    
    // Mark as received (add new field to AuctionInfo)
    let updated_auction: AuctionInfo = AuctionInfo {
        // ... existing fields
        item_received: true  // NEW field
    };
    Mapping::set(auctions, auction_id, updated_auction);
}

// Step 2: Seller claim winning
async transition claim_winning(
    public auction_id: field
) -> Future {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    let transfer_future: Future = credits.aleo/transfer_public(
        auction.seller,
        auction.winning_amount as u64
    );
    
    return finalize_claim_winning(
        auction_id,
        self.signer,
        transfer_future
    );
}

async function finalize_claim_winning(
    auction_id: field,
    seller: address,
    transfer_future: Future
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    assert_eq(auction.seller, seller);
    assert_eq(auction.state, SETTLED);
    assert(auction.item_received);  // Must be confirmed first
    
    transfer_future.await();
    
    // Mark as claimed
    let updated_auction: AuctionInfo = AuctionInfo {
        // ... existing fields
        payment_claimed: true  // NEW field
    };
    Mapping::set(auctions, auction_id, updated_auction);
}
```

**Pros:**
- ✅ Seller control kapan withdraw
- ✅ Seller bayar gas fee sendiri
- ✅ Clear separation of concerns
- ✅ Audit trail lebih jelas

**Cons:**
- ⚠️ Seller harus claim manual (extra step)
- ⚠️ Payment bisa tertunda jika seller lupa claim

---

### **OPSI C: Hybrid dengan Timeout (Best for RWA)**

**Karakteristik:**
- Winner confirm receipt → Enable seller claim
- Seller claim dalam 30 hari
- Jika seller tidak claim, winner bisa dispute
- Jika tidak ada confirm dalam 14 hari, auto-enable claim

**Smart Contract:**
```leo
struct AuctionInfo {
    // ... existing fields
    item_received: bool,
    item_received_at: i64,
    payment_claimed: bool,
    payment_claimed_at: i64
}

// Winner confirm receipt
async transition confirm_receipt(
    public auction_id: field
) -> Future {
    return finalize_confirm_receipt(auction_id, self.signer);
}

async function finalize_confirm_receipt(
    auction_id: field,
    winner: address
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    assert_eq(auction.winner, winner);
    assert_eq(auction.state, SETTLED);
    
    let current_time: i64 = block.height as i64;  // Use block height as proxy
    
    let updated_auction: AuctionInfo = AuctionInfo {
        // ... existing fields
        item_received: true,
        item_received_at: current_time
    };
    Mapping::set(auctions, auction_id, updated_auction);
}

// Seller claim winning (after confirm OR timeout)
async transition claim_winning(
    public auction_id: field
) -> Future {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    let transfer_future: Future = credits.aleo/transfer_public(
        auction.seller,
        auction.winning_amount as u64
    );
    
    return finalize_claim_winning(
        auction_id,
        self.signer,
        transfer_future
    );
}

async function finalize_claim_winning(
    auction_id: field,
    seller: address,
    transfer_future: Future
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    assert_eq(auction.seller, seller);
    assert_eq(auction.state, SETTLED);
    assert(!auction.payment_claimed);
    
    let current_time: i64 = block.height as i64;
    let finalized_time: i64 = auction.challenge_end_time;
    let time_elapsed: i64 = current_time - finalized_time;
    
    // Can claim if:
    // 1. Winner confirmed receipt, OR
    // 2. 14 days passed without confirmation (auto-enable)
    let auto_enable_time: i64 = 14i64 * 24i64 * 3600i64;  // 14 days
    assert(auction.item_received || time_elapsed > auto_enable_time);
    
    transfer_future.await();
    
    let updated_auction: AuctionInfo = AuctionInfo {
        // ... existing fields
        payment_claimed: true,
        payment_claimed_at: current_time
    };
    Mapping::set(auctions, auction_id, updated_auction);
}
```

**Pros:**
- ✅ Buyer protection (confirm receipt required)
- ✅ Seller protection (auto-enable after timeout)
- ✅ Clear audit trail
- ✅ Prevents scam dari both sides

**Cons:**
- ⚠️ Lebih kompleks
- ⚠️ Perlu track timestamps
- ⚠️ Perlu dispute mechanism jika ada masalah

---

## 🏗️ RWA Marketplace Requirements

### **Untuk RWA, kita perlu:**

#### **1. Item Verification**
- Seller upload proof of ownership
- Platform verify authenticity (optional)
- Item description & photos
- Condition report

#### **2. Shipping & Logistics**
- Winner provide shipping address (encrypted?)
- Seller ship item dengan tracking
- Upload tracking number on-chain
- Proof of shipment

#### **3. Receipt Confirmation**
- Winner confirm item received
- Winner confirm item condition matches description
- Grace period untuk inspection (3-7 days)

#### **4. Payment Release**
- After winner confirm → Seller can claim
- Or after timeout (14 days) → Auto-enable claim
- Escrow released to seller

#### **5. Dispute Resolution (V3.0)**
- Winner can dispute jika item tidak sesuai
- Arbitrator review evidence
- Decision: refund buyer or pay seller
- Escrow held until resolved

---

## 🎯 Rekomendasi untuk ShadowBid RWA

### **V2.18 (Minimal Viable)**

**Workflow:**
```
1. Seller: Close Auction
2. Bidders: Reveal Bids
3. Seller: Determine Winner
4. Seller: Finalize Winner
5. Winner: Confirm Receipt (on-chain)
6. Seller: Claim Winning Bid (after confirm)
7. Losers: Claim Refund
```

**New Functions:**
- `confirm_receipt(auction_id)` - Winner confirm
- `claim_winning(auction_id)` - Seller claim payment

**New Fields in AuctionInfo:**
- `item_received: bool`
- `payment_claimed: bool`

**Protection:**
- Winner must confirm before seller can claim
- Simple and clear

---

### **V3.0 (Full RWA Features)**

**Workflow:**
```
1. Seller: Create Auction + Upload Item Proof
2. Bidders: Place Bids
3. Seller: Close Auction
4. Bidders: Reveal Bids
5. Seller: Determine Winner
6. Seller: Finalize Winner
7. Winner: Submit Shipping Info (encrypted)
8. Seller: Ship Item + Upload Tracking
9. Winner: Confirm Receipt (3-7 days grace period)
   ↓
   [If OK]
   10a. Winner: Confirm Receipt
   11a. Seller: Claim Winning Bid
   
   [If Problem]
   10b. Winner: Open Dispute
   11b. Arbitrator: Review Evidence
   12b. Decision: Refund or Pay Seller
   
12. Losers: Claim Refund
13. ✅ Transaction Complete
```

**New Functions:**
- `submit_shipping_info(auction_id, encrypted_address)`
- `upload_tracking(auction_id, tracking_number)`
- `confirm_receipt(auction_id)`
- `open_dispute(auction_id, reason)`
- `resolve_dispute(auction_id, decision)`
- `claim_winning(auction_id)`

**New Structs:**
```leo
struct ShippingInfo {
    winner: address,
    encrypted_address: field,  // ZK encrypted
    submitted_at: i64
}

struct TrackingInfo {
    seller: address,
    tracking_number: field,
    carrier: field,
    uploaded_at: i64
}

struct DisputeInfo {
    auction_id: field,
    opener: address,
    reason: field,
    status: u8,  // 0=Open, 1=Resolved
    decision: u8,  // 0=None, 1=RefundBuyer, 2=PaySeller
    resolved_at: i64
}
```

---

## 💡 Mekanisme yang Seharusnya untuk RWA

### **Prinsip Utama:**

#### **1. Escrow Hold Until Delivery Confirmed**
```
Bid Amount → Contract Escrow
  ↓
Winner Determined
  ↓
Item Shipped
  ↓
Winner Confirm Receipt
  ↓
Escrow Released to Seller
```

**Kenapa?**
- Protect buyer: Jika item tidak dikirim, bisa refund
- Protect seller: Jika item dikirim dan confirmed, pasti dapat payment
- Fair untuk both parties

---

#### **2. Timeout Mechanism**

**Scenario A: Winner Tidak Confirm**
```
Winner determined
  ↓
14 days passed, no confirmation
  ↓
Auto-enable seller claim
  ↓
Seller can claim payment
```

**Kenapa?**
- Prevent winner holding payment hostage
- Seller tidak stuck menunggu forever
- Reasonable time untuk delivery & inspection

**Scenario B: Seller Tidak Ship**
```
Winner determined
  ↓
30 days passed, no tracking uploaded
  ↓
Winner can claim refund
  ↓
Auction marked as failed
```

**Kenapa?**
- Prevent seller taking payment without shipping
- Winner get refund jika seller tidak deliver
- Clear deadline untuk seller

---

#### **3. Dispute Resolution**

**When Needed:**
- Item tidak sesuai deskripsi
- Item rusak saat diterima
- Item tidak pernah dikirim
- Tracking number fake

**Process:**
```
Winner: Open Dispute
  ↓
Upload Evidence (photos, messages)
  ↓
Seller: Respond with Counter-Evidence
  ↓
Arbitrator: Review (DAO vote or admin)
  ↓
Decision: Refund Buyer OR Pay Seller
  ↓
Execute Decision (transfer from escrow)
```

**Arbitrator Options:**
- Platform admin (centralized)
- DAO voting (decentralized)
- Multi-sig committee (hybrid)

---

## 📊 Comparison Table

| Feature | Online Marketplace | Traditional Auction | ShadowBid V2.17 | ShadowBid V3.0 (Recommended) |
|---------|-------------------|---------------------|-----------------|------------------------------|
| **Escrow** | ✅ Platform | ✅ Auction House | ✅ Smart Contract | ✅ Smart Contract |
| **Payment Hold** | ✅ Until confirm | ✅ Until payment | ❌ Stuck forever | ✅ Until confirm |
| **Seller Claim** | ✅ Auto/Manual | ✅ Manual | ❌ No function | ✅ Manual after confirm |
| **Buyer Protection** | ✅ Dispute | ✅ Inspection | ❌ None | ✅ Dispute system |
| **Seller Protection** | ✅ Confirm required | ✅ Payment first | ❌ No payment | ✅ Timeout mechanism |
| **Shipping Tracking** | ✅ Integrated | ✅ Manual | ❌ None | ✅ On-chain proof |
| **Dispute Resolution** | ✅ Platform | ✅ Auction house | ❌ None | ✅ DAO/Admin |
| **Timeout** | ✅ Auto-confirm | ❌ None | ❌ None | ✅ 14 days |
| **Refund** | ✅ If dispute | ❌ Rare | ✅ Losers only | ✅ Losers + disputed |

---

## 🎯 Recommended Flow untuk ShadowBid RWA

### **V2.18 (Minimal Viable)**

```
1. Seller: Close Auction
2. Bidders: Reveal Bids
3. Seller: Determine Winner (O(1))
4. Seller: Finalize Winner (mark winner)
5. Winner: Confirm Receipt ← NEW!
6. Seller: Claim Winning Bid (get payment) ← NEW!
7. Losers: Claim Refund
```

**New Functions Needed:**
- `confirm_receipt(auction_id)` - Winner only
- `claim_winning(auction_id)` - Seller only, after confirm

**New Fields:**
- `item_received: bool`
- `payment_claimed: bool`

---

### **V3.0 (Full RWA Features)**

```
1. Seller: Close Auction
2. Bidders: Reveal Bids
3. Seller: Determine Winner (O(1))
4. Seller: Finalize Winner (mark winner)
5. Winner: Submit Shipping Info ← NEW!
6. Seller: Upload Tracking Number ← NEW!
7. Winner: Confirm Receipt (or auto after 14 days) ← NEW!
8. Seller: Claim Winning Bid (get payment)
9. Losers: Claim Refund

[If Problem]
7b. Winner: Open Dispute ← NEW!
8b. Arbitrator: Resolve Dispute ← NEW!
9b. Execute Decision (refund or pay)
```

**New Functions:**
- `submit_shipping_info(auction_id, encrypted_address)`
- `upload_tracking(auction_id, tracking_number, carrier)`
- `confirm_receipt(auction_id)`
- `open_dispute(auction_id, reason)`
- `resolve_dispute(auction_id, decision)`
- `claim_winning(auction_id)`
- `claim_dispute_refund(auction_id)` - Winner if dispute won

**New Structs:**
- `ShippingInfo`
- `TrackingInfo`
- `DisputeInfo`

**New Mappings:**
- `shipping: field => ShippingInfo`
- `tracking: field => TrackingInfo`
- `disputes: field => DisputeInfo`

---

## 🔒 Security Considerations

### **1. Prevent Seller Scam**
- ✅ Escrow hold until winner confirm
- ✅ Timeout untuk enable refund jika tidak ship
- ✅ Dispute system jika item tidak sesuai

### **2. Prevent Winner Scam**
- ✅ Timeout untuk auto-enable seller claim
- ✅ Tracking proof required
- ✅ Cannot claim refund after confirm receipt

### **3. Privacy Protection**
- ✅ Shipping address encrypted (ZK proof)
- ✅ Only seller can decrypt
- ✅ Tracking number on-chain (public)

---

## 💼 Business Logic

### **Fee Structure (V3.0)**

**Platform Fee:**
- 2.5% dari winning bid
- Deducted saat seller claim
- Goes to platform treasury

**Example:**
```
Winning Bid: 100 ALEO
Platform Fee: 2.5 ALEO (2.5%)
Seller Receives: 97.5 ALEO
```

**Implementation:**
```leo
async function finalize_claim_winning(
    auction_id: field,
    seller: address,
    transfer_future: Future
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Calculate fee
    let winning_amount: u64 = auction.winning_amount as u64;
    let platform_fee: u64 = winning_amount / 40u64;  // 2.5%
    let seller_amount: u64 = winning_amount - platform_fee;
    
    // Transfer to seller (minus fee)
    let seller_transfer: Future = credits.aleo/transfer_public(
        seller,
        seller_amount
    );
    
    // Transfer fee to platform
    let fee_transfer: Future = credits.aleo/transfer_public(
        PLATFORM_ADDRESS,
        platform_fee
    );
    
    seller_transfer.await();
    fee_transfer.await();
    
    // Mark as claimed
    // ...
}
```

---

## 🎨 UI/UX untuk RWA Flow

### **Winner Dashboard:**

```
┌─────────────────────────────────────────┐
│ 🏆 You Won the Auction!                 │
├─────────────────────────────────────────┤
│ Item: Rare Collectible Card             │
│ Winning Bid: 100.00 ALEO                │
│                                          │
│ Status: ⏳ Waiting for Delivery          │
│                                          │
│ Next Steps:                              │
│ 1. ✅ Payment escrowed                   │
│ 2. ⏳ Waiting for seller to ship         │
│ 3. ⏸️  Confirm receipt when delivered    │
│                                          │
│ Tracking: [Not available yet]           │
│                                          │
│ [Open Dispute] [Contact Seller]         │
└─────────────────────────────────────────┘
```

### **Seller Dashboard:**

```
┌─────────────────────────────────────────┐
│ 💰 Auction Finalized                    │
├─────────────────────────────────────────┤
│ Winner: aleo1abc...xyz                  │
│ Winning Bid: 100.00 ALEO                │
│                                          │
│ Status: 📦 Ready to Ship                │
│                                          │
│ Next Steps:                              │
│ 1. ✅ Winner determined                  │
│ 2. 📦 Ship item to winner                │
│ 3. 📝 Upload tracking number             │
│ 4. ⏳ Wait for winner confirmation       │
│ 5. 💰 Claim payment (97.5 ALEO)          │
│                                          │
│ [Upload Tracking] [View Shipping Info]  │
└─────────────────────────────────────────┘
```

---

## 🚀 Implementation Priority

### **Phase 1: V2.18 (Critical Fix)**
- ✅ Add `claim_winning` function
- ✅ Add `confirm_receipt` function
- ✅ Basic escrow release mechanism
- ⏱️ **Timeline: 1-2 weeks**

### **Phase 2: V2.19 (Enhanced)**
- ✅ Add timeout mechanism
- ✅ Add shipping tracking
- ✅ Add encrypted shipping info
- ⏱️ **Timeline: 2-3 weeks**

### **Phase 3: V3.0 (Full RWA)**
- ✅ Add dispute resolution
- ✅ Add platform fee
- ✅ Add arbitrator system
- ✅ Add multiple auction formats
- ⏱️ **Timeline: 1-2 months**

---

## 📝 Catatan Penting

### **Untuk V2.17 (Current):**
⚠️ **CRITICAL BUG:** Seller tidak bisa claim payment!
- Winner's credits stuck di contract forever
- Perlu upgrade ke V2.18 ASAP
- Jangan deploy V2.17 ke production

### **Untuk V2.18 (Next):**
✅ **Minimal viable untuk RWA:**
- Seller bisa claim payment
- Winner confirm receipt required
- Basic protection untuk both parties

### **Untuk V3.0 (Future):**
✅ **Full-featured RWA marketplace:**
- Complete buyer/seller protection
- Dispute resolution
- Platform fee
- Multiple auction formats
- Shipping integration

---

## ❓ Pertanyaan untuk Diskusi

1. **Apakah winner harus confirm receipt?** Atau seller bisa claim langsung?
2. **Berapa lama timeout?** 7 days? 14 days? 30 days?
3. **Siapa yang jadi arbitrator?** Admin? DAO? Multi-sig?
4. **Platform fee berapa persen?** 2.5%? 5%? 10%?
5. **Shipping info on-chain atau off-chain?** Privacy vs transparency?

---

## 🎯 Kesimpulan

**Untuk RWA Marketplace yang proper, mekanisme seharusnya:**

1. ✅ **Escrow hold** sampai delivery confirmed
2. ✅ **Winner confirm receipt** sebelum seller claim
3. ✅ **Timeout mechanism** untuk prevent holding hostage
4. ✅ **Dispute resolution** untuk handle masalah
5. ✅ **Platform fee** untuk sustainability
6. ✅ **Shipping tracking** untuk transparency
7. ✅ **Privacy protection** untuk shipping address

**V2.17 tidak punya ini semua** - perlu upgrade ke V2.18 minimal, atau V3.0 untuk full features.

---

**Next Steps:**
1. Design V2.18 dengan `claim_winning` + `confirm_receipt`
2. Test flow dengan real scenario
3. Plan V3.0 dengan full RWA features
4. Implement dispute resolution system

**Last Updated:** 24 Maret 2026
