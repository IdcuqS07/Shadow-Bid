# Asset Category Decision Tree

## 🎯 Quick Guide: Pilih Kategori yang Tepat

### **START HERE:**

```
Apa yang dijual?
  │
  ├─ Barang Fisik? ────────────────────┐
  │                                     │
  ├─ Barang Digital? ──────────────────┤
  │                                     │
  ├─ Jasa/Layanan? ────────────────────┤
  │                                     │
  └─ Hak/Dokumen Legal? ───────────────┘
```

---

## 🌳 Decision Tree

### **1. Apakah Barang Fisik?**

**YES →** Lanjut ke pertanyaan berikutnya

**NO →** Skip ke pertanyaan 5

---

### **2. Apakah Barang Koleksi/Berharga?**

**YES →** Apakah nilai > $10,000 atau perlu authentication?
- **YES →** 🎨 **COLLECTIBLES** (21 days)
- **NO →** Lanjut ke pertanyaan 3

**NO →** Lanjut ke pertanyaan 3

---

### **3. Apakah Kendaraan?**

**YES →** 🚗 **VEHICLES** (30 days)

**NO →** Lanjut ke pertanyaan 4

---

### **4. Barang Fisik Standard**

→ 📦 **PHYSICAL GOODS** (14 days)

---

### **5. Apakah Barang Digital?**

**YES →** Apakah NFT, domain, atau digital art?
- **YES →** 💎 **DIGITAL ASSETS** (3 days)
- **NO →** Lanjut ke pertanyaan 6

**NO →** Lanjut ke pertanyaan 6

---

### **6. Apakah Tiket Event?**

**YES →** 🎫 **TICKETS & EVENTS** (7 days)

**NO →** Lanjut ke pertanyaan 7

---

### **7. Apakah Jasa/Layanan?**

**YES →** 💼 **SERVICES** (30 days)

**NO →** Lanjut ke pertanyaan 8

---

### **8. Apakah Properti?**

**YES →** 🏠 **REAL ESTATE** (90 days)

**NO →** Lanjut ke pertanyaan 9

---

### **9. Apakah Hak Kekayaan Intelektual?**

**YES →** 📜 **INTELLECTUAL PROPERTY** (90 days)

**NO →** Default ke 📦 **PHYSICAL GOODS** (14 days)

---

## 🎯 Quick Selection Guide

### **Pilih berdasarkan karakteristik:**

| Karakteristik | Kategori |
|---------------|----------|
| Bisa dikirim via kurir | 📦 Physical Goods |
| Nilai tinggi + perlu authentication | 🎨 Collectibles |
| Properti/tanah | 🏠 Real Estate |
| NFT/domain/digital | 💎 Digital Assets |
| Jasa profesional | 💼 Services |
| Tiket event | 🎫 Tickets & Events |
| Mobil/motor/kapal | 🚗 Vehicles |
| Patent/trademark | 📜 IP |

---

### **Pilih berdasarkan timeout yang dibutuhkan:**

| Timeout Needed | Kategori |
|----------------|----------|
| 3 days (fast) | 💎 Digital Assets |
| 7 days (quick) | 🎫 Tickets & Events |
| 14 days (standard) | 📦 Physical Goods |
| 21 days (extended) | 🎨 Collectibles |
| 30 days (medium) | 💼 Services, 🚗 Vehicles |
| 90 days (long) | 🏠 Real Estate, 📜 IP |

---

### **Pilih berdasarkan shipping:**

| Shipping | Kategori |
|----------|----------|
| Required | 📦 Physical Goods, 🎨 Collectibles, 🚗 Vehicles |
| Optional | 🎫 Tickets & Events |
| Not Needed | 💎 Digital Assets, 💼 Services, 🏠 Real Estate, 📜 IP |

---

## 💡 Examples

### **Example 1: Jual iPhone**
```
Barang fisik? YES
Koleksi berharga? NO (< $10k)
Kendaraan? NO
→ 📦 PHYSICAL GOODS (14 days)
```

### **Example 2: Jual Rare Pokemon Card**
```
Barang fisik? YES
Koleksi berharga? YES (rare + authentication)
→ 🎨 COLLECTIBLES (21 days)
```

### **Example 3: Jual NFT Art**
```
Barang fisik? NO
Barang digital? YES (NFT)
→ 💎 DIGITAL ASSETS (3 days)
```

### **Example 4: Jual Rumah**
```
Barang fisik? NO (properti)
Properti? YES
→ 🏠 REAL ESTATE (90 days)
```

### **Example 5: Jual Jasa Design**
```
Barang fisik? NO
Barang digital? NO
Jasa? YES
→ 💼 SERVICES (30 days)
```

### **Example 6: Jual Concert Ticket**
```
Barang fisik? NO (digital ticket)
Barang digital? YES
Tiket event? YES
→ 🎫 TICKETS & EVENTS (7 days)
```

### **Example 7: Jual Mobil**
```
Barang fisik? YES
Kendaraan? YES
→ 🚗 VEHICLES (30 days)
```

### **Example 8: Jual Patent**
```
Barang fisik? NO
Hak IP? YES
→ 📜 INTELLECTUAL PROPERTY (90 days)
```

---

## 🚨 Common Mistakes

### **❌ Wrong Category Selection:**

**Mistake 1:** Pilih Physical Goods untuk NFT
- **Problem:** Timeout terlalu lama (14 days vs 3 days)
- **Fix:** Pilih Digital Assets

**Mistake 2:** Pilih Physical Goods untuk rare art
- **Problem:** No authentication period
- **Fix:** Pilih Collectibles

**Mistake 3:** Pilih Digital Assets untuk physical collectible
- **Problem:** No shipping mechanism
- **Fix:** Pilih Collectibles

**Mistake 4:** Pilih Services untuk product
- **Problem:** Wrong workflow
- **Fix:** Pilih Physical Goods

---

## ✅ Validation Rules

### **Smart Contract Validation:**
```leo
// Validate asset type is valid
assert(asset_type >= 0u8 && asset_type <= 7u8);

// Validate timeout is reasonable
assert(confirmation_timeout > 0i64);
assert(confirmation_timeout <= 90i64 * 24i64 * 3600i64);  // Max 90 days
```

### **UI Validation:**
```javascript
// Warn if unusual combination
if (assetType === DIGITAL_ASSETS && shippingRequired) {
  alert('⚠️ Digital assets usually don\'t require shipping');
}

if (assetType === PHYSICAL_GOODS && instantDelivery) {
  alert('⚠️ Physical goods cannot be delivered instantly');
}
```

---

## 🎯 Best Practices

### **For Sellers:**
1. ✅ Choose category that matches your item
2. ✅ Read category description carefully
3. ✅ Understand timeout implications
4. ✅ Prepare required documents per category
5. ✅ Plan delivery method before listing

### **For Winners:**
1. ✅ Check asset category before bidding
2. ✅ Understand confirmation timeline
3. ✅ Prepare for inspection period
4. ✅ Confirm receipt promptly
5. ✅ Use dispute if item not as described

---

## 📊 Category Statistics (Future)

**Track per category:**
- Total auctions
- Average winning bid
- Average settlement time
- Dispute rate
- Success rate
- User satisfaction

**Use for:**
- Optimize timeouts
- Identify problematic categories
- Improve category-specific features
- Better risk assessment

---

**Last Updated:** 24 Maret 2026  
**Purpose:** Help users select correct asset category
