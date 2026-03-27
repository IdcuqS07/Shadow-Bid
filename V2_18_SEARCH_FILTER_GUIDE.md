# V2.18 Search & Category Filter - Guide

## 🔍 Overview

V2.18 menambahkan sistem pencarian dan filter kategori aset yang powerful untuk memudahkan user menemukan auction yang mereka cari.

---

## ✨ Features

### **1. Search Bar**
- **Location:** Top of auction list page
- **Function:** Search auction by title
- **Real-time:** Filter updates as you type
- **Case-insensitive:** "test" matches "Test Auction"

### **2. Status Filter**
- **Options:** All, Active, Ending Soon
- **Function:** Filter by auction status
- **Visual:** Gold highlight for selected

### **3. Category Filter (NEW V2.18)**
- **Options:** All + 8 asset categories
- **Function:** Filter by asset type
- **Visual:** Gold highlight for selected
- **Icons:** Each category has unique icon
- **Badge:** V2.18 badge indicator

### **4. Combined Filters**
- Search + Status + Category work together
- Example: "test" + "Active" + "Physical Goods"
- Real-time filtering

---

## 🎨 UI Layout

### **Filter Bar:**
```
┌─────────────────────────────────────────────────────────────┐
│ [🔍 Search auctions...]  [All][Active][Ending Soon] [Create]│
├─────────────────────────────────────────────────────────────┤
│ Filter: [All][📦 Physical][🎨 Collectibles][🏠 Real Estate] │
│         [💎 Digital][💼 Services][🎫 Tickets][🚗 Vehicles]   │
│         [📜 IP]                                    [V2.18]   │
└─────────────────────────────────────────────────────────────┘
```

### **Auction Card with Category:**
```
┌─────────────────────────────────────┐
│ [Active] 📦                         │
│                                      │
│ Rare Collectible Item               │
│ #123456789                          │
│                                      │
│ Current Bid: 50.00 ALEO             │
│ Ends In: 12h 30m                    │
│ Bids: 5                             │
└─────────────────────────────────────┘
```

### **Featured Auction with Category:**
```
┌───────────────────────────────────────────────────────┐
│ [Active] Sealed-Bid [📦 Physical Goods]              │
│                                                        │
│ Premium Vintage Watch Collection                      │
│ Auction #123456789                                    │
│                                                        │
│ Min Bid: 100.00 ALEO | Ends In: 23h 45m | Bids: 12  │
└───────────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Details

### **Category Filter State:**
```javascript
const [categoryFilter, setCategoryFilter] = useState('all');
```

### **Filter Logic:**
```javascript
const filteredAuctions = auctions.filter(auction => {
  // Status filter
  if (filter !== 'all' && auction.status !== filter) return false;
  
  // Category filter (NEW)
  if (categoryFilter !== 'all' && auction.assetType !== parseInt(categoryFilter)) return false;
  
  // Search query
  if (searchQuery && !auction.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
  
  return true;
});
```

### **Category Buttons:**
```javascript
{[
  { value: '0', label: 'Physical', icon: '📦' },
  { value: '1', label: 'Collectibles', icon: '🎨' },
  { value: '2', label: 'Real Estate', icon: '🏠' },
  { value: '3', label: 'Digital', icon: '💎' },
  { value: '4', label: 'Services', icon: '💼' },
  { value: '5', label: 'Tickets', icon: '🎫' },
  { value: '6', label: 'Vehicles', icon: '🚗' },
  { value: '7', label: 'IP', icon: '📜' },
].map((cat) => (
  <button onClick={() => setCategoryFilter(cat.value)}>
    {cat.icon} {cat.label}
  </button>
))}
```

---

## 🎯 Use Cases

### **Use Case 1: Find Physical Goods**
```
1. Click "📦 Physical" filter
2. See only Physical Goods auctions
3. Search "watch" to narrow down
4. Click auction to view details
```

### **Use Case 2: Find Active Digital Assets**
```
1. Click "Active" status filter
2. Click "💎 Digital" category filter
3. See only active digital asset auctions
4. Quick access to NFTs, tokens, etc.
```

### **Use Case 3: Find Ending Soon Collectibles**
```
1. Click "Ending Soon" status filter
2. Click "🎨 Collectibles" category filter
3. See urgent collectible auctions
4. Place last-minute bids
```

### **Use Case 4: Search Specific Item**
```
1. Type "vintage" in search bar
2. Real-time filter shows matching auctions
3. Combine with category if needed
4. Quick item discovery
```

---

## 📊 Filter Combinations

### **Valid Combinations:**

| Search | Status | Category | Result |
|--------|--------|----------|--------|
| "" | All | All | All auctions |
| "test" | All | All | Auctions with "test" in title |
| "" | Active | All | All active auctions |
| "" | All | Physical | All Physical Goods |
| "watch" | Active | Collectibles | Active collectible watches |
| "car" | Ending Soon | Vehicles | Urgent vehicle auctions |

---

## 🎨 Visual Indicators

### **Category Badges:**
- **Featured Auction:** Full badge with icon + name
- **Regular Cards:** Icon only (space-saving)
- **Wide Card:** Full badge with icon + name
- **Color:** Cyan background with cyan border

### **Filter Buttons:**
- **Selected:** Gold background, dark text
- **Unselected:** Dark background, light text
- **Hover:** Lighter text color
- **V2.18 Badge:** Green with checkmark

---

## 🧪 Testing

### **Test Category Filter:**
```
1. Create auctions with different categories:
   - Physical Goods
   - Digital Assets
   - Collectibles
2. Go to auction list
3. Click each category filter
4. Verify only matching auctions show
5. Click "All" → All auctions show
```

### **Test Combined Filters:**
```
1. Select "Active" status
2. Select "Physical" category
3. Type "test" in search
4. Verify only active physical goods with "test" show
5. Clear filters one by one
6. Verify results update correctly
```

### **Test Category Badges:**
```
1. Create auctions with different categories
2. Go to auction list
3. Verify featured auction shows full badge
4. Verify regular cards show icon
5. Verify wide card shows full badge
6. Click auction → Verify category in detail page
```

---

## 🚀 Future Enhancements

### **V2.19 or V3.0:**
- [ ] Price range filter (min-max)
- [ ] Currency filter (Aleo, USDCx, USAD)
- [ ] Sort options (price, time, bids)
- [ ] Advanced search (description, seller)
- [ ] Saved filters (user preferences)
- [ ] Filter presets (e.g., "Hot Deals")
- [ ] Multi-category selection
- [ ] Tag system for items

---

## 📱 Responsive Design

### **Desktop:**
- Full filter bar with all categories
- 2-row layout (search + categories)
- All filters visible

### **Mobile (Future):**
- Collapsible filter menu
- Dropdown for categories
- Compact layout

---

## 🎯 Success Metrics

**Filter system sukses jika:**
- ✅ Category filter works correctly
- ✅ Search works in real-time
- ✅ Status filter works
- ✅ Combined filters work together
- ✅ Category badges visible on cards
- ✅ No performance issues
- ✅ Intuitive UX

---

## 📝 Notes

### **Performance:**
- Filtering done client-side (fast)
- No API calls for filtering
- Real-time updates

### **Data Source:**
- Auctions from localStorage
- On-chain data fetched on load
- Category from auction metadata

### **UX Considerations:**
- Clear visual feedback
- Instant filtering
- Easy to reset (click "All")
- Category icons for quick recognition

---

**Last Updated:** 24 Maret 2026  
**Version:** V2.18  
**Status:** ✅ Implemented
