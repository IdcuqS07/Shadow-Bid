# Asset Categorization System - ShadowBid RWA

## 🎯 Purpose
Mengelompokkan jenis aset RWA untuk memudahkan mekanisme payment, shipping, verification, dan dispute resolution yang berbeda untuk setiap kategori.

---

## 📦 Asset Categories

### **1. PHYSICAL_GOODS (Barang Fisik)**
**Contoh:** Electronics, furniture, equipment, vehicles

**Karakteristik:**
- ✅ Perlu shipping fisik
- ✅ Perlu tracking number
- ✅ Perlu confirm receipt
- ✅ Risk: Damage during shipping
- ⏱️ Settlement: After delivery (7-30 days)

**Payment Mechanism:**
```
Finalize → Ship → Confirm Receipt → Seller Claim
```

**Shipping Required:** YES  
**Inspection Period:** 3-7 days  
**Dispute Risk:** MEDIUM  
**Timeout:** 14 days (auto-enable claim)

---

### **2. COLLECTIBLES (Koleksi Berharga)**
**Contoh:** Art, rare cards, antiques, memorabilia, luxury items

**Karakteristik:**
- ✅ Perlu shipping dengan insurance
- ✅ Perlu authenticity verification
- ✅ Perlu condition report
- ✅ Risk: Authenticity fraud, damage
- ⏱️ Settlement: After authentication (7-14 days)

**Payment Mechanism:**
```
Finalize → Ship (insured) → Authenticate → Confirm Receipt → Seller Claim
```

**Shipping Required:** YES (insured)  
**Inspection Period:** 7-14 days  
**Dispute Risk:** HIGH  
**Timeout:** 21 days (longer for authentication)  
**Special:** May require third-party authentication

---

### **3. REAL_ESTATE (Properti)**
**Contoh:** Land, houses, apartments, commercial property

**Karakteristik:**
- ❌ No shipping (location-based)
- ✅ Perlu legal documentation
- ✅ Perlu title transfer
- ✅ Risk: Legal issues, liens
- ⏱️ Settlement: After legal transfer (30-90 days)

**Payment Mechanism:**
```
Finalize → Legal Process → Title Transfer → Confirm Transfer → Seller Claim
```

**Shipping Required:** NO  
**Inspection Period:** 30-90 days (legal process)  
**Dispute Risk:** HIGH  
**Timeout:** 90 days (legal complexity)  
**Special:** Requires legal documentation, notary

---

### **4. DIGITAL_ASSETS (Aset Digital)**
**Contoh:** NFTs, domain names, digital art, software licenses

**Karakteristik:**
- ❌ No shipping (instant transfer)
- ✅ Instant delivery possible
- ✅ Easy verification (on-chain)
- ✅ Risk: Low (instant, verifiable)
- ⏱️ Settlement: Immediate or 24 hours

**Payment Mechanism:**
```
Finalize → Transfer Digital Asset → Auto-Confirm → Seller Claim
OR
Finalize → Instant Settlement (no confirm needed)
```

**Shipping Required:** NO  
**Inspection Period:** 0-24 hours  
**Dispute Risk:** LOW  
**Timeout:** 3 days (short)  
**Special:** Can be instant settlement

---

### **5. SERVICES (Jasa/Layanan)**
**Contoh:** Consulting, design work, development, professional services

**Karakteristik:**
- ❌ No shipping (service delivery)
- ✅ Milestone-based delivery
- ✅ Perlu work verification
- ✅ Risk: Quality disputes
- ⏱️ Settlement: After service completion (varies)

**Payment Mechanism:**
```
Finalize → Service Delivery → Review Work → Confirm Completion → Seller Claim
```

**Shipping Required:** NO  
**Inspection Period:** Varies (7-30 days)  
**Dispute Risk:** MEDIUM  
**Timeout:** 30 days  
**Special:** May need milestone payments

---

### **6. TICKETS_EVENTS (Tiket & Event)**
**Contoh:** Concert tickets, sports events, conference passes

**Karakteristik:**
- ✅ Digital or physical delivery
- ✅ Time-sensitive (event date)
- ✅ Instant transfer possible
- ✅ Risk: Fake tickets
- ⏱️ Settlement: Before event or after event

**Payment Mechanism:**
```
Finalize → Transfer Ticket → Verify Ticket → Auto-Confirm → Seller Claim
```

**Shipping Required:** NO (usually digital)  
**Inspection Period:** 1-3 days  
**Dispute Risk:** MEDIUM  
**Timeout:** 7 days or event date  
**Special:** Time-sensitive, may need instant settlement

---

### **7. VEHICLES (Kendaraan)**
**Contoh:** Cars, motorcycles, boats, aircraft

**Karakteristik:**
- ✅ Perlu inspection
- ✅ Perlu title transfer
- ✅ Perlu registration
- ✅ Risk: Mechanical issues, legal issues
- ⏱️ Settlement: After inspection & transfer (14-30 days)

**Payment Mechanism:**
```
Finalize → Inspection → Title Transfer → Registration → Confirm → Seller Claim
```

**Shipping Required:** YES (or pickup)  
**Inspection Period:** 14-30 days  
**Dispute Risk:** HIGH  
**Timeout:** 30 days  
**Special:** Requires inspection, title transfer, registration

---

### **8. INTELLECTUAL_PROPERTY (IP)**
**Contoh:** Patents, trademarks, copyrights, royalty rights

**Karakteristik:**
- ❌ No shipping (legal transfer)
- ✅ Perlu legal documentation
- ✅ Perlu IP transfer registration
- ✅ Risk: Legal disputes, validity
- ⏱️ Settlement: After legal transfer (30-90 days)

**Payment Mechanism:**
```
Finalize → Legal Transfer → IP Registration → Confirm Transfer → Seller Claim
```

**Shipping Required:** NO  
**Inspection Period:** 30-90 days  
**Dispute Risk:** HIGH  
**Timeout:** 90 days  
**Special:** Requires legal process, IP office registration

---

## 🏗️ Smart Contract Implementation

### **A. Add Asset Type to Contract**

```leo
// Asset type constants
const ASSET_PHYSICAL_GOODS: u8 = 0u8;
const ASSET_COLLECTIBLES: u8 = 1u8;
const ASSET_REAL_ESTATE: u8 = 2u8;
const ASSET_DIGITAL_ASSETS: u8 = 3u8;
const ASSET_SERVICES: u8 = 4u8;
const ASSET_TICKETS_EVENTS: u8 = 5u8;
const ASSET_VEHICLES: u8 = 6u8;
const ASSET_INTELLECTUAL_PROPERTY: u8 = 7u8;

struct AuctionInfo {
    seller: address,
    min_bid_amount: u128,
    currency_type: u8,
    asset_type: u8,              // NEW: Asset category
    end_time: i64,
    challenge_period: i64,
    state: u8,
    winner: address,
    winning_amount: u128,
    challenge_end_time: i64,
    total_escrowed: u128,
    item_received: bool,
    item_received_at: i64,
    payment_claimed: bool,
    payment_claimed_at: i64,
    confirmation_timeout: i64    // NEW: Timeout based on asset type
}
```

---

### **B. Update create_auction**

```leo
async transition create_auction(
    public auction_id: field,
    public min_bid_amount: u128,
    public currency_type: u8,
    public asset_type: u8,          // NEW: Asset category
    public end_time: i64,
    public challenge_period: i64
) -> (AuctionRecord, Future) {
    
    // Validate asset type
    assert(
        asset_type == ASSET_PHYSICAL_GOODS ||
        asset_type == ASSET_COLLECTIBLES ||
        asset_type == ASSET_REAL_ESTATE ||
        asset_type == ASSET_DIGITAL_ASSETS ||
        asset_type == ASSET_SERVICES ||
        asset_type == ASSET_TICKETS_EVENTS ||
        asset_type == ASSET_VEHICLES ||
        asset_type == ASSET_INTELLECTUAL_PROPERTY
    );
    
    // Set timeout based on asset type
    let confirmation_timeout: i64 = get_timeout_for_asset_type(asset_type);
    
    // ... rest of function
}

// Helper function to get timeout based on asset type
function get_timeout_for_asset_type(asset_type: u8) -> i64 {
    if (asset_type == ASSET_PHYSICAL_GOODS) {
        return 14i64 * 24i64 * 3600i64;  // 14 days
    } else if (asset_type == ASSET_COLLECTIBLES) {
        return 21i64 * 24i64 * 3600i64;  // 21 days
    } else if (asset_type == ASSET_REAL_ESTATE) {
        return 90i64 * 24i64 * 3600i64;  // 90 days
    } else if (asset_type == ASSET_DIGITAL_ASSETS) {
        return 3i64 * 24i64 * 3600i64;   // 3 days
    } else if (asset_type == ASSET_SERVICES) {
        return 30i64 * 24i64 * 3600i64;  // 30 days
    } else if (asset_type == ASSET_TICKETS_EVENTS) {
        return 7i64 * 24i64 * 3600i64;   // 7 days
    } else if (asset_type == ASSET_VEHICLES) {
        return 30i64 * 24i64 * 3600i64;  // 30 days
    } else if (asset_type == ASSET_INTELLECTUAL_PROPERTY) {
        return 90i64 * 24i64 * 3600i64;  // 90 days
    } else {
        return 14i64 * 24i64 * 3600i64;  // Default 14 days
    }
}
```

---

### **C. Update claim_winning with Timeout**

```leo
async function finalize_claim_winning_aleo(
    auction_id: field,
    caller: address,
    transfer_future: Future
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    assert_eq(auction.seller, caller);
    assert_eq(auction.state, SETTLED);
    assert_eq(auction.currency_type, CURRENCY_ALEO);
    assert(!auction.payment_claimed);
    
    // Get current time
    let current_time: i64 = block.height as i64;
    let finalized_time: i64 = auction.challenge_end_time;
    let time_elapsed: i64 = current_time - finalized_time;
    
    // Can claim if:
    // 1. Winner confirmed receipt, OR
    // 2. Timeout passed (based on asset type)
    assert(
        auction.item_received || 
        time_elapsed > auction.confirmation_timeout
    );
    
    // Transfer to seller
    transfer_future.await();
    
    // Update auction
    // ... mark as claimed
}
```

---

## 🎨 UI Implementation

### **A. Update Create Auction Form**

**Add Asset Type Selector:**

```jsx
<div className="space-y-2">
  <label className="block text-sm font-mono text-white/60">
    Asset Category
  </label>
  <select
    value={assetType}
    onChange={(e) => setAssetType(e.target.value)}
    className="w-full px-4 py-3 bg-void-800 border border-white/10 rounded-xl text-white font-mono focus:border-gold-500 focus:outline-none transition-colors"
  >
    <option value="0">📦 Physical Goods (14 days)</option>
    <option value="1">🎨 Collectibles (21 days)</option>
    <option value="2">🏠 Real Estate (90 days)</option>
    <option value="3">💎 Digital Assets (3 days)</option>
    <option value="4">💼 Services (30 days)</option>
    <option value="5">🎫 Tickets & Events (7 days)</option>
    <option value="6">🚗 Vehicles (30 days)</option>
    <option value="7">📜 Intellectual Property (90 days)</option>
  </select>
  
  <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
    <div className="text-xs text-white/60">
      {getAssetTypeDescription(assetType)}
    </div>
  </div>
</div>
```

**Helper Function:**

```javascript
const getAssetTypeDescription = (type) => {
  const descriptions = {
    '0': 'Physical goods require shipping and delivery confirmation. Winner has 14 days to confirm receipt.',
    '1': 'Collectibles may require authentication. Winner has 21 days to confirm receipt and verify authenticity.',
    '2': 'Real estate requires legal documentation and title transfer. Winner has 90 days for legal process.',
    '3': 'Digital assets can be transferred instantly. Winner has 3 days to confirm receipt.',
    '4': 'Services are delivered over time. Winner has 30 days to confirm completion.',
    '5': 'Tickets are time-sensitive. Winner has 7 days to confirm receipt before event.',
    '6': 'Vehicles require inspection and registration. Winner has 30 days for inspection and title transfer.',
    '7': 'Intellectual property requires legal transfer and registration. Winner has 90 days for legal process.'
  };
  return descriptions[type] || 'Select an asset category';
};

const getAssetTypeName = (type) => {
  const names = {
    0: 'Physical Goods',
    1: 'Collectibles',
    2: 'Real Estate',
    3: 'Digital Assets',
    4: 'Services',
    5: 'Tickets & Events',
    6: 'Vehicles',
    7: 'Intellectual Property'
  };
  return names[type] || 'Unknown';
};

const getAssetTypeIcon = (type) => {
  const icons = {
    0: '📦',
    1: '🎨',
    2: '🏠',
    3: '💎',
    4: '💼',
    5: '🎫',
    6: '🚗',
    7: '📜'
  };
  return icons[type] || '📦';
};

const getAssetTypeTimeout = (type) => {
  const timeouts = {
    0: 14,  // days
    1: 21,
    2: 90,
    3: 3,
    4: 30,
    5: 7,
    6: 30,
    7: 90
  };
  return timeouts[type] || 14;
};
```

---

### **B. Display Asset Type in Auction Detail**

```jsx
{/* Asset Category Badge */}
<div className="flex items-center gap-2 mb-4">
  <span className="text-2xl">{getAssetTypeIcon(auction.assetType)}</span>
  <div>
    <div className="text-sm font-mono text-white/40 uppercase tracking-wider">
      Asset Category
    </div>
    <div className="text-lg font-display font-bold">
      {getAssetTypeName(auction.assetType)}
    </div>
  </div>
</div>

{/* Category-Specific Info */}
<div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
  <div className="flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-cyan-400 mt-0.5" />
    <div>
      <div className="font-mono text-sm text-cyan-400 mb-2">
        {getAssetTypeName(auction.assetType)} Policy
      </div>
      <div className="text-xs text-white/60 leading-relaxed">
        {getAssetTypeDescription(auction.assetType)}
      </div>
      <div className="text-xs text-gold-400 mt-2">
        Confirmation timeout: {getAssetTypeTimeout(auction.assetType)} days
      </div>
    </div>
  </div>
</div>
```

---

## 📋 Category-Specific Rules

### **Matrix: Asset Type vs Features**

| Asset Type | Shipping | Timeout | Insurance | Authentication | Legal Docs | Instant |
|------------|----------|---------|-----------|----------------|------------|---------|
| Physical Goods | ✅ | 14d | Optional | ❌ | ❌ | ❌ |
| Collectibles | ✅ | 21d | ✅ | ✅ | ❌ | ❌ |
| Real Estate | ❌ | 90d | N/A | ✅ | ✅ | ❌ |
| Digital Assets | ❌ | 3d | N/A | ✅ | ❌ | ✅ |
| Services | ❌ | 30d | N/A | ❌ | Optional | ❌ |
| Tickets/Events | Optional | 7d | Optional | ✅ | ❌ | ✅ |
| Vehicles | ✅ | 30d | ✅ | ✅ | ✅ | ❌ |
| IP | ❌ | 90d | N/A | ✅ | ✅ | ❌ |

---

## 🔄 Category-Specific Workflows

### **Physical Goods (Standard)**
```
Finalize
  ↓
Seller: Ship Item
  ↓
Upload Tracking
  ↓
Winner: Receive Item (7-14 days)
  ↓
Winner: Confirm Receipt (3 days inspection)
  ↓
Seller: Claim Payment
  ↓
OR after 14 days → Auto-enable claim
```

---

### **Collectibles (High-Value)**
```
Finalize
  ↓
Seller: Ship Item (insured)
  ↓
Upload Tracking + Insurance
  ↓
Winner: Receive Item (7-14 days)
  ↓
Winner: Authenticate Item (optional 3rd party)
  ↓
Winner: Confirm Receipt (7 days inspection)
  ↓
Seller: Claim Payment
  ↓
OR after 21 days → Auto-enable claim
```

---

### **Digital Assets (Instant)**
```
Finalize
  ↓
Seller: Transfer Digital Asset (instant)
  ↓
Winner: Verify On-Chain (instant)
  ↓
Auto-Confirm (24 hours) OR Manual Confirm
  ↓
Seller: Claim Payment
  ↓
OR after 3 days → Auto-enable claim
```

---

### **Real Estate (Complex)**
```
Finalize
  ↓
Seller: Initiate Legal Transfer
  ↓
Upload Legal Documents
  ↓
Winner: Review Documents (30 days)
  ↓
Legal Process: Title Transfer (30-60 days)
  ↓
Winner: Confirm Title Transfer
  ↓
Seller: Claim Payment
  ↓
OR after 90 days → Auto-enable claim
```

---

## 🎯 V2.18 Implementation Priority

### **Phase 1: Core Categories (MVP)**
Implement 3 kategori utama dulu:

1. **Physical Goods** (0) - Standard RWA
2. **Digital Assets** (3) - Instant settlement
3. **Collectibles** (1) - High-value items

**Reasoning:**
- Cover 80% use cases
- Different workflows (shipping vs instant)
- Test timeout mechanism

---

### **Phase 2: Additional Categories**
4. **Tickets/Events** (5) - Time-sensitive
5. **Services** (4) - Milestone-based
6. **Vehicles** (6) - Inspection required

---

### **Phase 3: Complex Categories (V3.0)**
7. **Real Estate** (2) - Legal complexity
8. **Intellectual Property** (7) - IP registration

---

## 📊 Timeout Configuration

### **Default Timeouts by Category:**

```javascript
const ASSET_TIMEOUTS = {
  PHYSICAL_GOODS: 14 * 24 * 3600,        // 14 days
  COLLECTIBLES: 21 * 24 * 3600,          // 21 days
  REAL_ESTATE: 90 * 24 * 3600,           // 90 days
  DIGITAL_ASSETS: 3 * 24 * 3600,         // 3 days
  SERVICES: 30 * 24 * 3600,              // 30 days
  TICKETS_EVENTS: 7 * 24 * 3600,         // 7 days
  VEHICLES: 30 * 24 * 3600,              // 30 days
  INTELLECTUAL_PROPERTY: 90 * 24 * 3600  // 90 days
};
```

**Rationale:**
- Digital assets: Fast (3 days) - instant verification
- Physical goods: Standard (14 days) - shipping + inspection
- Collectibles: Extended (21 days) - authentication time
- Real estate/IP: Long (90 days) - legal process
- Vehicles: Medium (30 days) - inspection + registration
- Services: Medium (30 days) - work completion
- Tickets: Short (7 days) - time-sensitive

---

## 🎨 UI Enhancements

### **Category-Specific Badges:**

```jsx
const AssetTypeBadge = ({ type }) => {
  const config = {
    0: { icon: '📦', label: 'Physical', color: 'blue' },
    1: { icon: '🎨', label: 'Collectible', color: 'purple' },
    2: { icon: '🏠', label: 'Real Estate', color: 'green' },
    3: { icon: '💎', label: 'Digital', color: 'cyan' },
    4: { icon: '💼', label: 'Service', color: 'orange' },
    5: { icon: '🎫', label: 'Ticket', color: 'pink' },
    6: { icon: '🚗', label: 'Vehicle', color: 'red' },
    7: { icon: '📜', label: 'IP', color: 'yellow' }
  };
  
  const { icon, label, color } = config[type] || config[0];
  
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 bg-${color}-500/20 border border-${color}-500/40 rounded-full text-xs font-mono text-${color}-400`}>
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  );
};
```

---

### **Category-Specific Instructions:**

```jsx
const getCategoryInstructions = (assetType, role) => {
  const instructions = {
    0: { // Physical Goods
      seller: [
        'Ship item within 3 days',
        'Upload tracking number',
        'Wait for winner confirmation',
        'Claim payment after confirmation'
      ],
      winner: [
        'Wait for item delivery (7-14 days)',
        'Inspect item upon receipt',
        'Confirm receipt within 3 days',
        'Payment released to seller'
      ]
    },
    1: { // Collectibles
      seller: [
        'Ship item with insurance',
        'Upload tracking + insurance proof',
        'Wait for authentication (if required)',
        'Claim payment after confirmation'
      ],
      winner: [
        'Wait for item delivery (7-14 days)',
        'Authenticate item (optional)',
        'Inspect condition carefully',
        'Confirm receipt within 7 days'
      ]
    },
    3: { // Digital Assets
      seller: [
        'Transfer digital asset immediately',
        'Provide access credentials',
        'Wait for winner confirmation',
        'Claim payment (usually within 24h)'
      ],
      winner: [
        'Verify asset received',
        'Check asset authenticity on-chain',
        'Confirm receipt within 24 hours',
        'Payment released to seller'
      ]
    }
    // ... other categories
  };
  
  return instructions[assetType]?.[role] || [];
};
```

---

## 🔐 Category-Specific Validations

### **Smart Contract Validations:**

```leo
// In confirm_receipt
async function finalize_confirm_receipt(
    auction_id: field,
    caller: address
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Standard validations
    assert_eq(auction.state, SETTLED);
    assert_eq(auction.winner, caller);
    assert(!auction.item_received);
    
    // Category-specific validations
    if (auction.asset_type == ASSET_DIGITAL_ASSETS) {
        // Digital assets: Check if asset transferred on-chain
        // (Future: verify NFT transfer, domain transfer, etc.)
    } else if (auction.asset_type == ASSET_REAL_ESTATE) {
        // Real estate: May require legal document hash
        // (Future: verify title transfer document)
    }
    
    // ... rest of function
}
```

---

## 📊 Benefits of Categorization

### **For Users:**
- ✅ Clear expectations per category
- ✅ Appropriate timeouts
- ✅ Category-specific instructions
- ✅ Better UX

### **For Platform:**
- ✅ Different handling per category
- ✅ Appropriate risk management
- ✅ Scalable for new categories
- ✅ Better analytics

### **For Smart Contract:**
- ✅ Flexible timeout per category
- ✅ Category-specific validations
- ✅ Future-proof for new features
- ✅ Clear audit trail

---

## 🚀 Implementation Roadmap

### **V2.18 (MVP):**
- [ ] Add asset_type field to AuctionInfo
- [ ] Add confirmation_timeout field
- [ ] Implement 3 core categories (Physical, Digital, Collectibles)
- [ ] Add asset type selector in create form
- [ ] Display asset type in auction detail
- [ ] Category-specific timeouts
- [ ] Category-specific instructions

### **V2.19 (Enhanced):**
- [ ] Add all 8 categories
- [ ] Category-specific validations
- [ ] Shipping tracking per category
- [ ] Insurance requirements for high-value

### **V3.0 (Full Features):**
- [ ] Category-specific dispute resolution
- [ ] Authentication integration for collectibles
- [ ] Legal document upload for real estate/IP
- [ ] Milestone payments for services
- [ ] Event date validation for tickets

---

## 💡 Advanced Features per Category

### **Collectibles:**
- Third-party authentication integration
- Condition grading system
- Provenance tracking
- Certificate of authenticity

### **Real Estate:**
- Legal document upload (encrypted)
- Title verification
- Lien check
- Property inspection report

### **Digital Assets:**
- On-chain verification
- Instant transfer
- Smart contract integration
- NFT metadata validation

### **Vehicles:**
- VIN verification
- Inspection report upload
- Title transfer tracking
- Registration assistance

### **Services:**
- Milestone-based payments
- Work progress tracking
- Deliverable verification
- Review system

---

## 📝 Data Structure

### **Asset Metadata (Off-Chain or On-Chain):**

```javascript
// Store in localStorage or IPFS
const assetMetadata = {
  auctionId: 123,
  assetType: 0,  // Physical Goods
  category: 'Electronics',
  subcategory: 'Smartphones',
  brand: 'Apple',
  model: 'iPhone 15 Pro',
  condition: 'New',
  serialNumber: 'ABC123XYZ',
  photos: ['ipfs://...', 'ipfs://...'],
  documents: ['ipfs://...'],  // Proof of ownership
  specifications: {
    color: 'Black',
    storage: '256GB',
    warranty: 'Yes'
  },
  shipping: {
    weight: '0.5kg',
    dimensions: '15x8x1cm',
    origin: 'Singapore',
    restrictions: 'None'
  }
};
```

---

## 🎯 Recommended Implementation Order

### **Step 1: Smart Contract (Week 1)**
1. Add asset_type field
2. Add confirmation_timeout field
3. Implement timeout logic in claim_winning
4. Test with 3 core categories

### **Step 2: UI (Week 1)**
1. Add asset type selector in create form
2. Add category display in auction detail
3. Add category-specific instructions
4. Add timeout countdown

### **Step 3: Testing (Week 1)**
1. Test each category workflow
2. Test timeout mechanism
3. Test category-specific validations
4. User acceptance testing

### **Step 4: Documentation (Week 1)**
1. Update user guide
2. Add category descriptions
3. Add workflow diagrams
4. Add FAQ per category

---

## 📊 Analytics & Insights

### **Track by Category:**
- Total auctions per category
- Average winning bid per category
- Settlement time per category
- Dispute rate per category
- Success rate per category

**Use for:**
- Optimize timeouts
- Identify risky categories
- Improve category-specific features
- Better risk management

---

## 🎯 Success Metrics

**V2.18 sukses jika:**
- ✅ Seller bisa pilih asset category saat create
- ✅ Timeout berbeda per category
- ✅ Instructions jelas per category
- ✅ Payment mechanism works untuk semua category
- ✅ User understand category implications

---

## 💬 Discussion Points

### **Questions:**
1. **Apakah 8 kategori cukup?** Atau perlu lebih spesifik?
2. **Apakah timeout yang disarankan reasonable?** Atau perlu adjust?
3. **Apakah perlu subcategories?** (e.g., Electronics → Smartphones, Laptops)
4. **Apakah seller bisa custom timeout?** Atau fixed per category?
5. **Apakah perlu category verification?** (e.g., real estate must upload title)

### **Recommendations:**
- Start dengan 3 core categories (Physical, Digital, Collectibles)
- Fixed timeout per category (no custom)
- Add subcategories di V3.0
- Category verification di V3.0

---

**Last Updated:** 24 Maret 2026  
**Status:** Design Complete - Ready for V2.18 Implementation
