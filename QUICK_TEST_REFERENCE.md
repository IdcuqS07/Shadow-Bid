# ⚡ Quick Test Reference

## 🧪 Testing Mode - 1 Minute Complete Flow

### Setup (One Time)
```
1. Buka http://localhost:3004/premium-create
2. Toggle ON "Testing Mode" di Privacy Settings
3. Create auction
   → Challenge period: 60 seconds (bukan 24 jam)
```

### Complete Flow (1-2 Minutes)
```
T+0s:   Create Auction (testing mode ON)
        ↓
T+10s:  Place Bid (Wallet B: 5 ALEO)
        ↓
T+20s:  Place Bid (Wallet C: 7 ALEO)
        ↓
T+30s:  Enable UI Testing Mode (klik toggle di debug panel)
        ↓
T+30s:  Close Auction (Wallet A - seller)
        ↓
T+35s:  Reveal Bid (Wallet B)
        ↓
T+40s:  Reveal Bid (Wallet C)
        ↓
T+45s:  Determine Winner (Wallet A - seller)
        ↓
T+60s:  Wait 60 seconds (grab coffee ☕)
        ↓
T+105s: Finalize Winner (Wallet A - seller) ✅
        ↓
T+110s: Claim Refund (Wallet B - loser) ✅
        ↓
DONE! 🎉
```

## 🎛️ Toggle Locations

### 1. Create Auction - Smart Contract Testing
```
Location: /premium-create
Section: Privacy Settings (bottom)
Toggle: "Testing Mode" 🧪

Effect:
- Challenge period: 60 seconds
- Can finalize after 1 minute
```

### 2. Auction Detail - UI Testing
```
Location: /premium-auction/{id}
Section: Debug Panel (top of Auction Actions)
Toggle: "Testing Mode OFF" → Click → "🧪 TESTING MODE ON"

Effect:
- All buttons visible
- No status validation
- Can click any action
```

## ⚡ Ultra Quick Commands

### Create Testing Auction
```javascript
// In browser console
localStorage.setItem('quickTest', 'true');
// Then create auction with testing mode ON
```

### Skip to Any Step
```javascript
// Enable UI testing mode
// All buttons appear
// Click any step directly
```

### Check Challenge Period
```javascript
// In browser console after create
const auctions = JSON.parse(localStorage.getItem('myAuctions'));
console.log('Last auction:', auctions[auctions.length - 1]);
// Check if created with testing mode
```

## 🎯 What Each Mode Does

### Testing Mode OFF (Production)
```
Create Auction:
- Challenge period: 86400 seconds (24 hours)

Auction Detail:
- Buttons show based on status
- Must wait for auction to close
- Must wait 24h after determine winner
```

### UI Testing Mode ON
```
Auction Detail:
- ✅ All buttons visible
- ✅ Can click any action
- ❌ Smart contract may reject
```

### SC Testing Mode ON (at creation)
```
Create Auction:
- ✅ Challenge period: 60 seconds
- ✅ Can finalize after 1 minute
- ✅ Smart contract accepts
```

### Both Testing Modes ON (Best for Testing)
```
- ✅ All buttons visible (UI)
- ✅ Can finalize after 60s (SC)
- ✅ Complete flow in 1-2 minutes
- ✅ No waiting!
```

## 🔍 Visual Indicators

### Testing Mode OFF
```
Debug Panel:
┌─────────────────────────────────────────┐
│ Debug Info:              [Testing Mode OFF] │
│ ...                                     │
└─────────────────────────────────────────┘

Workflow:
⏳ Wait 24h challenge period
```

### Testing Mode ON
```
Debug Panel:
┌─────────────────────────────────────────┐
│ Debug Info:         [🧪 TESTING MODE ON] │
│ ...                                     │
│ ⚡ Testing Mode: All timing validations │
│    bypassed                             │
└─────────────────────────────────────────┘

Workflow:
⚡ Skip 24h wait
```

## ⚠️ Warnings

### UI Testing Mode Warning
```
🧪 TESTING MODE ACTIVE

You are bypassing the 24h challenge period.
This may FAIL on-chain if the smart contract enforces timing.

Continue anyway?
```

### If Finalize Fails
```
❌ Challenge Period Not Complete

The 24-hour challenge period has not ended yet.
You must wait before finalizing the winner.

Testing Mode can bypass UI validation but NOT smart contract validation.
```

## 💡 Pro Tips

1. **Always use SC Testing Mode** untuk testing lengkap
   - Set saat create auction
   - Challenge period 60 detik
   - Workflow selesai dalam 2 menit

2. **UI Testing Mode** untuk demo/presentation
   - Toggle kapan saja
   - Tunjukkan semua tombol
   - Jelaskan workflow tanpa tunggu

3. **Production**: Matikan semua testing mode
   - Realistic timing
   - Full 24h challenge period
   - User experience sebenarnya

## 🎉 Result

Dengan Testing Mode, Anda bisa:
- ✅ Test complete flow dalam 1-2 menit
- ✅ Tidak perlu tunggu 24 jam
- ✅ Semua fitur bisa di-test cepat
- ✅ Toggle ON/OFF kapan saja

**No more waiting!** 🚀
