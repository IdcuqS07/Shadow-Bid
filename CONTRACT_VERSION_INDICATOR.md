# Contract Version Indicator - V2.18

## Issue

User tidak tahu contract version mana yang sedang aktif (V2.17 atau V2.18) saat menggunakan aplikasi. Console log menunjukkan V2.17 sebagai default, tapi seharusnya sudah switch ke V2.18.

## Root Cause

1. **Initial Load:** File `aleoServiceV2.js` di-load dengan default V2.17
2. **Version Switch:** `setContractVersion('v2.18')` dipanggil di `useEffect`
3. **Timing Issue:** Console log awal muncul sebelum useEffect dijalankan
4. **No Visual Feedback:** User tidak tahu version mana yang aktif

## Solution

### 1. Improved Logging

**Before:**
```javascript
console.log('[aleoServiceV2] Switched to', version, ':', PROGRAM_ID);
```

**After:**
```javascript
console.log('[aleoServiceV2] ========== VERSION SWITCHED ==========');
console.log('[aleoServiceV2] New Version:', version);
console.log('[aleoServiceV2] Program ID:', PROGRAM_ID);
console.log('[aleoServiceV2] =====================================');
```

### 2. Added Helper Functions

```javascript
export function getCurrentVersion() {
  return CURRENT_VERSION;
}

export function getCurrentProgramId() {
  return PROGRAM_ID;
}
```

### 3. Visual Version Badge

Added version indicator badge di UI:

**PremiumCreateAuction.jsx:**
```jsx
<div className="flex items-center gap-4 mb-4">
  <h1 className="text-5xl font-display font-bold">Create Auction</h1>
  {/* Version Badge */}
  <div className="px-3 py-1 bg-gold-500/10 border border-gold-500/30 rounded-lg">
    <span className="text-xs font-mono text-gold-400">
      {contractVersion === 'v2.18' ? 'V2.18 • 3 Currencies • RWA' : 'V2.17'}
    </span>
  </div>
</div>
```

**Visual:**
```
┌─────────────────────────────────────────────┐
│  Create Auction  [V2.18 • 3 Currencies • RWA]│
│  Launch a private sealed-bid auction...     │
└─────────────────────────────────────────────┘
```

### 4. State Management

Added local state untuk track version:

```javascript
const [contractVersion, setContractVersionState] = useState('v2.17');

useEffect(() => {
  setContractVersion('v2.18');
  setContractVersionState(getCurrentVersion());
  console.log('[Component] Enabled V2.18 contract');
  console.log('[Component] Current Program ID:', getCurrentProgramId());
}, []);
```

## Console Output

### Initial Load (Expected):
```
[aleoServiceV2] ========== CONFIGURATION ==========
[aleoServiceV2] V2.17: shadowbid_marketplace_v2_17.aleo
[aleoServiceV2] V2.18: shadowbid_marketplace_v2_18.aleo
[aleoServiceV2] CURRENT: shadowbid_marketplace_v2_17.aleo
[aleoServiceV2] API_BASE: https://api.explorer.provable.com/v1/testnet
[aleoServiceV2] =====================================
```

### After Component Mount:
```
[aleoServiceV2] ========== VERSION SWITCHED ==========
[aleoServiceV2] New Version: v2.18
[aleoServiceV2] Program ID: shadowbid_marketplace_v2_18.aleo
[aleoServiceV2] =====================================
[PremiumCreateAuction] Enabled V2.18 contract
[PremiumCreateAuction] Current Program ID: shadowbid_marketplace_v2_18.aleo
```

## Version Badge Styling

### Colors:
- **Background:** `bg-gold-500/10` (10% opacity gold)
- **Border:** `border-gold-500/30` (30% opacity gold)
- **Text:** `text-gold-400` (gold 400 shade)

### Typography:
- **Font:** `font-mono` (JetBrains Mono)
- **Size:** `text-xs` (12px)
- **Padding:** `px-3 py-1` (12px horizontal, 4px vertical)

### Layout:
- **Display:** Inline with title
- **Alignment:** Centered vertically with h1
- **Gap:** 16px from title

## Version Information Display

### V2.18 Badge:
```
┌──────────────────────────────┐
│ V2.18 • 3 Currencies • RWA   │
└──────────────────────────────┘
```

### V2.17 Badge:
```
┌──────────┐
│  V2.17   │
└──────────┘
```

## Implementation Details

### Files Modified:

1. **aleoServiceV2.js**
   - Improved `setContractVersion` logging
   - Added `getCurrentVersion()` helper
   - Added `getCurrentProgramId()` helper

2. **PremiumCreateAuction.jsx**
   - Added `contractVersion` state
   - Added version badge in header
   - Improved logging with program ID

3. **PremiumAuctionDetail.jsx**
   - Added `contractVersion` state
   - Improved logging with program ID
   - Ready for version badge (can be added later)

## Benefits

### For Developers:
- ✅ Clear console logs showing version switches
- ✅ Easy to debug version-related issues
- ✅ Helper functions for version checking

### For Users:
- ✅ Visual confirmation of active version
- ✅ Know which features are available
- ✅ Understand contract capabilities

### For Testing:
- ✅ Easy to verify correct version is active
- ✅ Clear distinction between V2.17 and V2.18
- ✅ Can screenshot version badge for bug reports

## Usage in Other Components

To add version badge to any component:

```jsx
import { getCurrentVersion, getCurrentProgramId } from '@/services/aleoServiceV2';

const [contractVersion, setContractVersionState] = useState('v2.17');

useEffect(() => {
  setContractVersionState(getCurrentVersion());
}, []);

// In render:
<div className="px-3 py-1 bg-gold-500/10 border border-gold-500/30 rounded-lg">
  <span className="text-xs font-mono text-gold-400">
    {contractVersion === 'v2.18' ? 'V2.18 • 3 Currencies • RWA' : 'V2.17'}
  </span>
</div>
```

## Testing Checklist

- [x] Console shows initial V2.17 config
- [x] Console shows version switch to V2.18
- [x] Version badge displays "V2.18 • 3 Currencies • RWA"
- [x] Badge styling matches design system
- [x] Badge responsive on mobile
- [x] No console errors
- [x] Helper functions work correctly

## Future Enhancements

1. **Version Selector:** Allow user to switch between V2.17 and V2.18
2. **Feature List:** Show available features per version
3. **Migration Guide:** Link to upgrade guide from V2.17 to V2.18
4. **Version History:** Show changelog in UI
5. **Auto-detect:** Detect which version auction was created with

---

**Implemented:** 25 March 2026  
**Status:** ✅ Complete  
**Impact:** Better visibility of active contract version
