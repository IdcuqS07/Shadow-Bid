# Asset Category Workflows - Visual Guide

## 🎯 Overview
Setiap kategori aset memiliki workflow dan mekanisme payment yang berbeda sesuai dengan karakteristik aset.

---

## 📦 Category 0: Physical Goods (Standard)

### **Examples:** Electronics, Furniture, Equipment, Clothing

### **Workflow:**
```
CREATE AUCTION
  ↓
  [Seller selects: 📦 Physical Goods]
  [Timeout: 14 days]
  ↓
BIDDING PHASE
  ↓
FINALIZE WINNER
  ↓
┌─────────────────────────────────────────┐
│ DELIVERY PHASE (Physical Goods)         │
├─────────────────────────────────────────┤
│ Day 0:  Seller ships item               │
│ Day 1:  Upload tracking number          │
│ Day 7:  Item delivered                  │
│ Day 8:  Winner inspects (3 days)        │
│ Day 10: Winner confirms receipt ✅      │
│ Day 10: Seller claims payment 💰        │
│                                          │
│ OR                                       │
│                                          │
│ Day 14: Timeout → Auto-enable claim ⏰  │
│ Day 14: Seller claims payment 💰        │
└─────────────────────────────────────────┘
  ↓
LOSERS CLAIM REFUND
  ↓
✅ COMPLETE
```

**Key Points:**
- Shipping required
- 3 days inspection period
- 14 days total timeout
- Standard risk level

---

## 🎨 Category 1: Collectibles (High-Value)

### **Examples:** Art, Rare Cards, Antiques, Luxury Items

### **Workflow:**
```
CREATE AUCTION
  ↓
  [Seller selects: 🎨 Collectibles]
  [Timeout: 21 days]
  [Insurance: Required]
  ↓
BIDDING PHASE
  ↓
FINALIZE WINNER
  ↓
┌─────────────────────────────────────────┐
│ DELIVERY PHASE (Collectibles)           │
├─────────────────────────────────────────┤
│ Day 0:  Seller ships (insured) 📦       │
│ Day 1:  Upload tracking + insurance     │
│ Day 7:  Item delivered                  │
│ Day 8:  Winner authenticates (optional) │
│ Day 10: Authentication complete ✅      │
│ Day 11: Winner inspects (7 days)        │
│ Day 17: Winner confirms receipt ✅      │
│ Day 17: Seller claims payment 💰        │
│                                          │
│ OR                                       │
│                                          │
│ Day 21: Timeout → Auto-enable claim ⏰  │
│ Day 21: Seller claims payment 💰        │
└─────────────────────────────────────────┘
  ↓
LOSERS CLAIM REFUND
  ↓
✅ COMPLETE
```

**Key Points:**
- Insured shipping required
- Authentication period (optional)
- 7 days inspection period
- 21 days total timeout
- High risk level

---

## 💎 Category 3: Digital Assets (Instant)

### **Examples:** NFTs, Domain Names, Digital Art, Software Licenses

### **Workflow:**
```
CREATE AUCTION
  ↓
  [Seller selects: 💎 Digital Assets]
  [Timeout: 3 days]
  [Instant transfer possible]
  ↓
BIDDING PHASE
  ↓
FINALIZE WINNER
  ↓
┌─────────────────────────────────────────┐
│ DELIVERY PHASE (Digital Assets)         │
├─────────────────────────────────────────┤
│ Hour 0:  Seller transfers asset ⚡      │
│ Hour 1:  Winner verifies on-chain ✅    │
│ Hour 2:  Winner confirms receipt ✅     │
│ Hour 2:  Seller claims payment 💰       │
│                                          │
│ OR                                       │
│                                          │
│ Day 3:  Timeout → Auto-enable claim ⏰  │
│ Day 3:  Seller claims payment 💰        │
└─────────────────────────────────────────┘
  ↓
LOSERS CLAIM REFUND
  ↓
✅ COMPLETE
```

**Key Points:**
- No shipping (instant transfer)
- On-chain verification
- 24 hours inspection
- 3 days total timeout
- Low risk level

---

## 🏠 Category 2: Real Estate (Complex)

### **Examples:** Land, Houses, Apartments, Commercial Property

### **Workflow:**
```
CREATE AUCTION
  ↓
  [Seller selects: 🏠 Real Estate]
  [Timeout: 90 days]
  [Legal docs required]
  ↓
BIDDING PHASE
  ↓
FINALIZE WINNER
  ↓
┌─────────────────────────────────────────┐
│ DELIVERY PHASE (Real Estate)            │
├─────────────────────────────────────────┤
│ Day 0:  Seller initiates legal transfer │
│ Day 7:  Upload title documents 📄       │
│ Day 14: Winner reviews documents        │
│ Day 30: Legal process (notary, etc.)    │
│ Day 60: Title transfer complete 📜      │
│ Day 65: Winner confirms transfer ✅     │
│ Day 65: Seller claims payment 💰        │
│                                          │
│ OR                                       │
│                                          │
│ Day 90: Timeout → Auto-enable claim ⏰  │
│ Day 90: Seller claims payment 💰        │
└─────────────────────────────────────────┘
  ↓
LOSERS CLAIM REFUND
  ↓
✅ COMPLETE
```

**Key Points:**
- No shipping (location-based)
- Legal documentation required
- Title transfer process
- 90 days total timeout
- High risk level

---

## 🚗 Category 6: Vehicles

### **Examples:** Cars, Motorcycles, Boats, Aircraft

### **Workflow:**
```
CREATE AUCTION
  ↓
  [Seller selects: 🚗 Vehicles]
  [Timeout: 30 days]
  [Inspection required]
  ↓
BIDDING PHASE
  ↓
FINALIZE WINNER
  ↓
┌─────────────────────────────────────────┐
│ DELIVERY PHASE (Vehicles)               │
├─────────────────────────────────────────┤
│ Day 0:  Schedule inspection 📋          │
│ Day 3:  Winner inspects vehicle         │
│ Day 5:  Inspection report uploaded      │
│ Day 7:  Seller ships or winner pickup   │
│ Day 10: Vehicle delivered               │
│ Day 12: Title transfer initiated        │
│ Day 15: Registration complete           │
│ Day 17: Winner confirms receipt ✅      │
│ Day 17: Seller claims payment 💰        │
│                                          │
│ OR                                       │
│                                          │
│ Day 30: Timeout → Auto-enable claim ⏰  │
│ Day 30: Seller claims payment 💰        │
└─────────────────────────────────────────┘
  ↓
LOSERS CLAIM REFUND
  ↓
✅ COMPLETE
```

**Key Points:**
- Inspection required
- Title transfer process
- Registration needed
- 30 days total timeout
- High risk level

---

## 💼 Category 4: Services

### **Examples:** Consulting, Design, Development, Professional Services

### **Workflow:**
```
CREATE AUCTION
  ↓
  [Seller selects: 💼 Services]
  [Timeout: 30 days]
  [Milestone-based]
  ↓
BIDDING PHASE
  ↓
FINALIZE WINNER
  ↓
┌─────────────────────────────────────────┐
│ DELIVERY PHASE (Services)               │
├─────────────────────────────────────────┤
│ Day 0:  Service starts                  │
│ Day 7:  Milestone 1 complete            │
│ Day 14: Milestone 2 complete            │
│ Day 21: Final deliverable               │
│ Day 23: Winner reviews work             │
│ Day 25: Winner confirms completion ✅   │
│ Day 25: Seller claims payment 💰        │
│                                          │
│ OR                                       │
│                                          │
│ Day 30: Timeout → Auto-enable claim ⏰  │
│ Day 30: Seller claims payment 💰        │
└─────────────────────────────────────────┘
  ↓
LOSERS CLAIM REFUND
  ↓
✅ COMPLETE
```

**Key Points:**
- No shipping (service delivery)
- Milestone tracking
- Work review period
- 30 days total timeout
- Medium risk level

---

## 🎫 Category 5: Tickets & Events

### **Examples:** Concert Tickets, Sports Events, Conference Passes

### **Workflow:**
```
CREATE AUCTION
  ↓
  [Seller selects: 🎫 Tickets & Events]
  [Timeout: 7 days OR event date]
  [Time-sensitive]
  ↓
BIDDING PHASE
  ↓
FINALIZE WINNER
  ↓
┌─────────────────────────────────────────┐
│ DELIVERY PHASE (Tickets)                │
├─────────────────────────────────────────┤
│ Hour 0:  Seller transfers ticket ⚡     │
│ Hour 2:  Winner verifies ticket         │
│ Hour 4:  Winner confirms receipt ✅     │
│ Hour 4:  Seller claims payment 💰       │
│                                          │
│ OR                                       │
│                                          │
│ Day 7:  Timeout → Auto-enable claim ⏰  │
│         (or event date, whichever first)│
│ Day 7:  Seller claims payment 💰        │
└─────────────────────────────────────────┘
  ↓
LOSERS CLAIM REFUND
  ↓
✅ COMPLETE
```

**Key Points:**
- Digital or physical delivery
- Time-sensitive (event date)
- Quick verification
- 7 days timeout (or event date)
- Medium risk level

---

## 📜 Category 7: Intellectual Property

### **Examples:** Patents, Trademarks, Copyrights, Royalty Rights

### **Workflow:**
```
CREATE AUCTION
  ↓
  [Seller selects: 📜 Intellectual Property]
  [Timeout: 90 days]
  [Legal process required]
  ↓
BIDDING PHASE
  ↓
FINALIZE WINNER
  ↓
┌─────────────────────────────────────────┐
│ DELIVERY PHASE (IP)                     │
├─────────────────────────────────────────┤
│ Day 0:  Seller initiates IP transfer    │
│ Day 7:  Upload legal documents 📄       │
│ Day 14: Winner reviews documents        │
│ Day 30: Legal process (lawyers, etc.)   │
│ Day 60: IP office registration          │
│ Day 75: Registration complete 📜        │
│ Day 80: Winner confirms transfer ✅     │
│ Day 80: Seller claims payment 💰        │
│                                          │
│ OR                                       │
│                                          │
│ Day 90: Timeout → Auto-enable claim ⏰  │
│ Day 90: Seller claims payment 💰        │
└─────────────────────────────────────────┘
  ↓
LOSERS CLAIM REFUND
  ↓
✅ COMPLETE
```

**Key Points:**
- No shipping (legal transfer)
- Legal documentation required
- IP office registration
- 90 days total timeout
- High risk level

---

## 📊 Comparison Matrix

### **Delivery Speed:**
```
Fastest ←──────────────────────────────────→ Slowest

Digital Assets (instant)
  ↓
Tickets (hours-days)
  ↓
Physical Goods (7-14 days)
  ↓
Collectibles (7-21 days)
  ↓
Services (varies)
  ↓
Vehicles (14-30 days)
  ↓
Real Estate (30-90 days)
  ↓
IP (30-90 days)
```

---

### **Risk Level:**
```
Lowest ←──────────────────────────────────→ Highest

Digital Assets (low)
  ↓
Physical Goods (medium)
  ↓
Services (medium)
  ↓
Tickets (medium)
  ↓
Collectibles (high)
  ↓
Vehicles (high)
  ↓
Real Estate (high)
  ↓
IP (high)
```

---

### **Complexity:**
```
Simplest ←────────────────────────────────→ Most Complex

Digital Assets (instant transfer)
  ↓
Tickets (quick verification)
  ↓
Physical Goods (shipping + confirm)
  ↓
Services (milestone tracking)
  ↓
Collectibles (authentication)
  ↓
Vehicles (inspection + title)
  ↓
Real Estate (legal process)
  ↓
IP (legal + registration)
```

---

## 🎯 Category Selection Guide

### **For Sellers:**

**Choose Physical Goods if:**
- Item is tangible and can be shipped
- Standard shipping methods work
- No special authentication needed
- Value < $10,000

**Choose Collectibles if:**
- Item is rare or valuable
- Authentication may be needed
- Insurance required for shipping
- Value > $10,000

**Choose Digital Assets if:**
- Item is fully digital
- Can be transferred on-chain
- Instant verification possible
- No physical component

**Choose Real Estate if:**
- Item is property or land
- Legal transfer required
- Title documentation needed
- Long settlement period acceptable

**Choose Services if:**
- Selling professional services
- Milestone-based delivery
- Work can be reviewed
- Time-based completion

**Choose Tickets if:**
- Event-based item
- Time-sensitive delivery
- Quick verification needed
- Event date is fixed

**Choose Vehicles if:**
- Selling car, motorcycle, boat, etc.
- Inspection required
- Title transfer needed
- Registration process involved

**Choose IP if:**
- Selling patents, trademarks, copyrights
- Legal transfer required
- IP office registration needed
- Long legal process expected

---

## 🔄 State Transitions per Category

### **All Categories Follow Base Flow:**
```
OPEN → CLOSED → CHALLENGE → SETTLED
```

### **But Settlement Completion Varies:**

**Fast Settlement (3-7 days):**
- Digital Assets
- Tickets & Events

**Standard Settlement (14-21 days):**
- Physical Goods
- Collectibles

**Extended Settlement (30 days):**
- Services
- Vehicles

**Long Settlement (90 days):**
- Real Estate
- Intellectual Property

---

## 💰 Payment Release Conditions

### **All Categories:**
```
Seller can claim payment IF:
  (Winner confirmed receipt) 
  OR 
  (Timeout passed based on category)
```

### **Category-Specific Timeouts:**
```javascript
const canSellerClaim = (auction, currentTime) => {
  const timeElapsed = currentTime - auction.finalizedAt;
  const timeout = ASSET_TIMEOUTS[auction.assetType];
  
  return auction.itemReceived || timeElapsed > timeout;
};
```

---

## 🛡️ Category-Specific Protections

### **Physical Goods:**
- ✅ Tracking number required
- ✅ Delivery confirmation
- ✅ 3 days inspection
- ⚠️ Damage during shipping

### **Collectibles:**
- ✅ Insurance required
- ✅ Authentication option
- ✅ 7 days inspection
- ⚠️ Authenticity disputes

### **Digital Assets:**
- ✅ On-chain verification
- ✅ Instant transfer
- ✅ 24 hours review
- ⚠️ Low risk

### **Real Estate:**
- ✅ Legal documentation
- ✅ Title verification
- ✅ 30 days review
- ⚠️ Legal disputes

### **Services:**
- ✅ Milestone tracking
- ✅ Work review
- ✅ Quality check
- ⚠️ Quality disputes

### **Tickets:**
- ✅ Quick verification
- ✅ Event date check
- ✅ Fast settlement
- ⚠️ Fake tickets

### **Vehicles:**
- ✅ Inspection required
- ✅ Title transfer
- ✅ Registration check
- ⚠️ Mechanical issues

### **IP:**
- ✅ Legal documentation
- ✅ IP registration
- ✅ Validity check
- ⚠️ Legal disputes

---

## 🎨 UI Components per Category

### **Category Badge:**
```jsx
<div className="flex items-center gap-2">
  <span className="text-2xl">{getAssetIcon(assetType)}</span>
  <div>
    <div className="text-xs text-white/40">Asset Category</div>
    <div className="text-lg font-bold">{getAssetName(assetType)}</div>
  </div>
</div>
```

### **Category Timeline:**
```jsx
<div className="p-4 bg-void-800 rounded-xl">
  <div className="text-sm font-mono text-white/60 mb-3">
    Expected Timeline
  </div>
  <div className="space-y-2">
    {getCategoryTimeline(assetType).map((step, i) => (
      <div key={i} className="flex items-center gap-2 text-xs">
        <div className="w-1.5 h-1.5 bg-gold-500 rounded-full" />
        <span className="text-white/60">{step}</span>
      </div>
    ))}
  </div>
</div>
```

### **Category Instructions:**
```jsx
<div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
  <div className="font-mono text-sm text-cyan-400 mb-2">
    {role === 'seller' ? 'Seller' : 'Winner'} Instructions
  </div>
  <div className="space-y-1">
    {getCategoryInstructions(assetType, role).map((instruction, i) => (
      <div key={i} className="text-xs text-white/60">
        {i + 1}. {instruction}
      </div>
    ))}
  </div>
</div>
```

---

## 📋 Implementation Checklist

### **Phase 1: Core Categories (V2.18)**
- [ ] Physical Goods (0)
- [ ] Digital Assets (3)
- [ ] Collectibles (1)

### **Phase 2: Additional (V2.19)**
- [ ] Tickets & Events (5)
- [ ] Services (4)
- [ ] Vehicles (6)

### **Phase 3: Complex (V3.0)**
- [ ] Real Estate (2)
- [ ] Intellectual Property (7)

---

## 🎯 Benefits

### **For Users:**
- ✅ Clear expectations per category
- ✅ Appropriate timeouts
- ✅ Category-specific guidance
- ✅ Better risk understanding

### **For Platform:**
- ✅ Flexible handling per category
- ✅ Appropriate risk management
- ✅ Better analytics
- ✅ Scalable system

### **For Development:**
- ✅ Modular implementation
- ✅ Easy to add new categories
- ✅ Category-specific features
- ✅ Clear separation of concerns

---

## 💡 Future Enhancements

### **V3.0 Features per Category:**

**Physical Goods:**
- Shipping insurance integration
- Carrier API integration
- Real-time tracking

**Collectibles:**
- Third-party authentication
- Grading system integration
- Provenance tracking

**Digital Assets:**
- NFT marketplace integration
- Domain registrar API
- License management

**Real Estate:**
- Title company integration
- Legal document verification
- Property inspection reports

**Services:**
- Milestone payment system
- Work progress tracking
- Review & rating system

**Tickets:**
- Event API integration
- QR code verification
- Seat selection

**Vehicles:**
- VIN verification API
- DMV integration
- Inspection report upload

**IP:**
- Patent office API
- IP lawyer network
- Validity verification

---

**Last Updated:** 24 Maret 2026  
**Status:** Design Complete - Ready for V2.18 Implementation
