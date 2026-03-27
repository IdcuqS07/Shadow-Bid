# Force V2.18 Migration - Complete Guide

## Problem
Wallet masih mencoba connect ke v2.17 meskipun code sudah diupdate ke v2.18.

## Root Cause
1. **Wallet Extension Cache** - Shield Wallet menyimpan "allowed programs" saat pertama connect
2. **Browser Cache** - JavaScript bundle lama masih di-cache
3. **localStorage** - Wallet connection info tersimpan

## Complete Solution (Step by Step)

### Step 1: Clear Browser Cache
```bash
# Hard refresh (ini TIDAK cukup)
Ctrl + Shift + R

# Yang benar: Clear ALL cache
1. Buka DevTools (F12)
2. Klik kanan pada Refresh button
3. Pilih "Empty Cache and Hard Reload"
```

### Step 2: Clear localStorage & sessionStorage
```javascript
// Di browser console (F12)
localStorage.clear();
sessionStorage.clear();
console.log('✅ Storage cleared');
```

### Step 3: Disconnect dari Wallet Extension
```bash
1. Klik Shield Wallet icon di browser toolbar
2. Go to Settings → Connected Sites
3. Find "localhost:3005"
4. Click "Disconnect" atau "Remove"
5. Close wallet popup
```

### Step 4: Close ALL Tabs
```bash
# Close semua tab localhost:3005
# Jangan cuma refresh, tapi CLOSE tab
```

### Step 5: Restart Browser (PENTING!)
```bash
# Tutup browser COMPLETELY
# Bukan cuma close tab, tapi quit browser
# Kemudian buka lagi
```

### Step 6: Fresh Start
```bash
1. Buka browser baru
2. Go to http://localhost:3005/
3. Klik "Connect Wallet"
4. Approve connection (akan request v2.18)
5. Try create auction
```

## Verification

### Check 1: Console Logs
```javascript
// Setelah page load, check console
// Should see:
[aleoServiceV2] CURRENT: shadowbid_marketplace_v2_18.aleo
[PremiumCreateAuction] Current Program ID: shadowbid_marketplace_v2_18.aleo
```

### Check 2: Environment Variable
```javascript
// Di console
console.log(import.meta.env.VITE_PROGRAM_ID);
// Should show: shadowbid_marketplace_v2_18.aleo
```

### Check 3: Wallet Connection
```bash
# Saat connect wallet, popup akan show:
"This app wants to connect to:
- shadowbid_marketplace_v2_18.aleo
- test_usdcx_stablecoin.aleo
- credits.aleo"

# Jika masih show v2.17, berarti cache belum clear
```

## Alternative: Nuclear Option

Jika masih tidak berhasil, gunakan "nuclear option":

```bash
# 1. Stop dev server
Ctrl+C

# 2. Clear Vite cache
rm -rf shadowbid-marketplace/node_modules/.vite

# 3. Clear browser data
- Open browser settings
- Clear browsing data
- Select "Cached images and files"
- Select "Cookies and site data"
- Time range: "All time"
- Clear data

# 4. Uninstall & reinstall wallet extension
- Remove Shield Wallet extension
- Restart browser
- Reinstall Shield Wallet
- Import account

# 5. Start fresh
npm run dev
# Open browser
# Connect wallet
# Try create auction
```

## Debug Commands

```javascript
// Check current program ID
import { getCurrentProgramId } from './services/aleoServiceV2';
console.log('Program ID:', getCurrentProgramId());

// Check if v2.18 loaded
console.log('VITE_PROGRAM_ID:', import.meta.env.VITE_PROGRAM_ID);

// Check wallet connection
console.log('Wallet:', wallet);
console.log('Connected:', connected);

// Force set version
import { setContractVersion } from './services/aleoServiceV2';
setContractVersion('v2.18');
```

## Expected Behavior

### ✅ Correct (V2.18)
```
[aleoServiceV2] CURRENT: shadowbid_marketplace_v2_18.aleo
[aleoServiceV2] Program: shadowbid_marketplace_v2_18.aleo
Transaction submitted to v2.18
```

### ❌ Wrong (V2.17)
```
Error: shadowbid_marketplace_v2_17.aleo is not in the allowed programs
```

## Why This Happens

1. **First Connection** - Saat pertama connect, wallet menyimpan:
   - Program list: [v2.17, usdcx, credits]
   - Connection permission
   
2. **Code Update** - Kita update code ke v2.18:
   - Program list: [v2.18, usdcx, credits]
   
3. **Conflict** - Wallet masih punya permission lama (v2.17)
   - Code minta v2.18
   - Wallet cuma allow v2.17
   - Error!

4. **Solution** - Clear wallet permission:
   - Disconnect dari wallet
   - Clear cache
   - Reconnect (request v2.18)

## Prevention

Untuk mencegah masalah ini di masa depan:

1. **Always disconnect** sebelum update program list
2. **Use version switcher** jika perlu support multiple versions
3. **Clear cache** setelah major updates
4. **Document** program IDs yang digunakan

## Files Updated

- ✅ `App.jsx` - programs: ["v2_18", ...]
- ✅ `aleoServiceV2.js` - CURRENT_VERSION = 'v2.18'
- ✅ `.env` - VITE_PROGRAM_ID=v2_18
- ✅ `PremiumCreateAuction.jsx` - setContractVersion('v2.18')
- ✅ `PremiumAuctionDetail.jsx` - contractVersion = 'v2.18'

## Support

Jika masih ada masalah setelah semua langkah:
1. Screenshot console error
2. Screenshot wallet popup saat connect
3. Check localStorage: `localStorage.getItem('walletName')`
4. Check if dev server running on correct port

---

**Created:** 25 March 2026  
**Status:** Complete Migration Guide
