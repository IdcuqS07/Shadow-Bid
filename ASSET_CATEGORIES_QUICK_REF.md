# Asset Categories - Quick Reference

## 📦 8 Kategori Aset RWA

### **0. 📦 Physical Goods**
- Barang fisik umum (electronics, furniture, equipment)
- Shipping: ✅ Required
- Timeout: 14 days
- Risk: Medium

### **1. 🎨 Collectibles**
- Barang koleksi berharga (art, rare cards, antiques)
- Shipping: ✅ Required (insured)
- Timeout: 21 days
- Risk: High (authenticity)

### **2. 🏠 Real Estate**
- Properti (land, houses, commercial)
- Shipping: ❌ No (location-based)
- Timeout: 90 days
- Risk: High (legal)

### **3. 💎 Digital Assets**
- Aset digital (NFTs, domains, licenses)
- Shipping: ❌ No (instant transfer)
- Timeout: 3 days
- Risk: Low

### **4. 💼 Services**
- Jasa profesional (consulting, design, dev)
- Shipping: ❌ No (service delivery)
- Timeout: 30 days
- Risk: Medium (quality)

### **5. 🎫 Tickets & Events**
- Tiket event (concert, sports, conference)
- Shipping: Optional (digital/physical)
- Timeout: 7 days
- Risk: Medium (fake tickets)

### **6. 🚗 Vehicles**
- Kendaraan (cars, motorcycles, boats)
- Shipping: ✅ Required (or pickup)
- Timeout: 30 days
- Risk: High (inspection)

### **7. 📜 Intellectual Property**
- Hak kekayaan intelektual (patents, trademarks)
- Shipping: ❌ No (legal transfer)
- Timeout: 90 days
- Risk: High (legal)

---

## ⏱️ Timeout Matrix

| Category | Timeout | Reason |
|----------|---------|--------|
| Physical Goods | 14 days | Shipping + inspection |
| Collectibles | 21 days | Authentication time |
| Real Estate | 90 days | Legal process |
| Digital Assets | 3 days | Instant verification |
| Services | 30 days | Work completion |
| Tickets/Events | 7 days | Time-sensitive |
| Vehicles | 30 days | Inspection + registration |
| IP | 90 days | Legal registration |

---

## 🔄 Workflow Differences

### **Shipping Required:**
- Physical Goods ✅
- Collectibles ✅
- Vehicles ✅
- Others ❌

### **Legal Docs Required:**
- Real Estate ✅
- IP ✅
- Vehicles ✅ (title)
- Others ❌

### **Authentication Needed:**
- Collectibles ✅ (optional)
- Digital Assets ✅ (on-chain)
- Tickets ✅ (verification)
- Others ❌

### **Instant Settlement Possible:**
- Digital Assets ✅
- Tickets ✅ (digital)
- Others ❌

---

## 🎯 V2.18 Priority

**Implement First:**
1. 📦 Physical Goods (standard)
2. 💎 Digital Assets (instant)
3. 🎨 Collectibles (high-value)

**Implement Later:**
4. 🎫 Tickets & Events
5. 💼 Services
6. 🚗 Vehicles

**V3.0:**
7. 🏠 Real Estate
8. 📜 Intellectual Property

---

## 💡 Smart Contract Constants

```leo
const ASSET_PHYSICAL_GOODS: u8 = 0u8;
const ASSET_COLLECTIBLES: u8 = 1u8;
const ASSET_REAL_ESTATE: u8 = 2u8;
const ASSET_DIGITAL_ASSETS: u8 = 3u8;
const ASSET_SERVICES: u8 = 4u8;
const ASSET_TICKETS_EVENTS: u8 = 5u8;
const ASSET_VEHICLES: u8 = 6u8;
const ASSET_INTELLECTUAL_PROPERTY: u8 = 7u8;
```

---

**Last Updated:** 24 Maret 2026
