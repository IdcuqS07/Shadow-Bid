# RWA Photo Upload - V2.18

## 📸 Overview

V2.18 menambahkan fitur upload foto untuk RWA verification. Foto wajib untuk semua kategori kecuali Digital Assets.

---

## ✅ Rules

### **Photo Required:**
- ✅ Physical Goods (0)
- ✅ Collectibles (1)
- ✅ Real Estate (2)
- ❌ Digital Assets (3) - **TIDAK PERLU FOTO**
- ✅ Services (4)
- ✅ Tickets & Events (5)
- ✅ Vehicles (6)
- ✅ Intellectual Property (7)

### **Specifications:**
- **Max Photos:** 5 per auction
- **Max Size:** 5MB per photo
- **Formats:** JPG, PNG, WebP
- **Storage:** Base64 in localStorage (temporary)
- **Future:** IPFS/Arweave for production

---

## 🎯 Why Photos Required?

### **For Bidders:**
- Verify item condition
- Check authenticity
- Assess quality
- Build confidence

### **For Sellers:**
- Prove item exists
- Show condition clearly
- Increase bidder trust
- Reduce disputes

### **For Platform:**
- RWA verification
- Fraud prevention
- Dispute resolution evidence
- Quality control

---

## 💎 Digital Assets Exception

**Why no photos for Digital Assets?**
- Digital assets verified on-chain
- Token records provide proof
- NFT metadata includes images
- No physical verification needed

**Examples:**
- NFTs (already have images)
- Tokens (verified by contract)
- Domain names (DNS records)
- Digital licenses (on-chain proof)

---

## 🎨 UI Implementation

### **Create Auction Form:**

```jsx
// Photo upload section (conditional)
{formData.assetType !== '3' && (
  <div>
    <label>Item Photos *</label>
    <input type="file" accept="image/*" multiple />
    {/* Photo preview grid */}
    {/* Max 5 photos, 5MB each */}
  </div>
)}

// Digital assets notice
{formData.assetType === '3' && (
  <div className="info-notice">
    Digital Assets: Photos not required
  </div>
)}
```

### **Auction Detail Page:**

```jsx
// Photo gallery (if photos exist)
{auction.itemPhotos && auction.itemPhotos.length > 0 && (
  <GlassCard>
    <h2>Item Photos</h2>
    <div className="photo-grid">
      {auction.itemPhotos.map(photo => (
        <img src={photo.data} alt="Item" />
      ))}
    </div>
  </GlassCard>
)}
```

---

## 🔐 Validation

### **Client-Side:**
```javascript
// Check if photos required
const assetType = parseInt(formData.assetType);
if (assetType !== 3 && itemPhotos.length === 0) {
  alert('Photo required for RWA verification');
  return;
}
```

### **File Size Check:**
```javascript
if (file.size > 5 * 1024 * 1024) {
  alert('File too large. Max 5MB per photo');
  return;
}
```

### **Photo Count Check:**
```javascript
if (itemPhotos.length + files.length > 5) {
  alert('Maximum 5 photos allowed');
  return;
}
```

---

## 📦 Data Structure

### **Photo Object:**
```javascript
{
  name: 'item-photo-1.jpg',
  data: 'data:image/jpeg;base64,...',
  size: 1234567,
  type: 'image/jpeg'
}
```

### **Auction Metadata:**
```javascript
{
  id: 123456789,
  title: 'Rare Collectible',
  assetType: 1,
  itemPhotos: [
    { name: '...', data: '...', size: ..., type: '...' },
    { name: '...', data: '...', size: ..., type: '...' }
  ],
  // ... other fields
}
```

---

## 🚀 Future Enhancements

### **V2.19 or V3.0:**
- [ ] Upload to IPFS/Arweave
- [ ] Store hash on-chain
- [ ] Image compression
- [ ] Thumbnail generation
- [ ] Watermark for protection
- [ ] Photo verification (AI)
- [ ] Multiple angles required
- [ ] Video support

---

## 🧪 Testing

### **Test Cases:**

**1. Physical Goods (Photo Required):**
```
1. Select "Physical Goods"
2. Try submit without photo → ❌ Error
3. Upload 1 photo → ✅ Success
4. Upload 6 photos → ❌ Error (max 5)
5. Upload 6MB photo → ❌ Error (max 5MB)
```

**2. Digital Assets (No Photo):**
```
1. Select "Digital Assets"
2. No photo upload section shown
3. Submit without photo → ✅ Success
4. Info notice: "Photos not required"
```

**3. Photo Gallery Display:**
```
1. Create auction with 3 photos
2. Open auction detail
3. Verify photo gallery shows 3 photos
4. Click photo → Opens full size
5. Verify RWA verification notice
```

---

## 📊 Storage Considerations

### **Current (V2.18):**
- **Storage:** localStorage (base64)
- **Limit:** ~5-10MB total per auction
- **Persistence:** Browser only
- **Sharing:** Not shared across devices

### **Production (Future):**
- **Storage:** IPFS/Arweave
- **Limit:** Unlimited (decentralized)
- **Persistence:** Permanent
- **Sharing:** Global via hash

---

## ⚠️ Important Notes

1. **Photos are NOT stored on-chain** - Only metadata in localStorage
2. **Base64 increases size** - 5MB photo → ~7MB base64
3. **Browser storage limit** - ~10MB total for localStorage
4. **Production needs IPFS** - For permanent, decentralized storage
5. **Digital Assets exception** - No photos needed (on-chain verification)

---

**Last Updated:** 24 Maret 2026  
**Status:** ✅ Implemented  
**Version:** V2.18
