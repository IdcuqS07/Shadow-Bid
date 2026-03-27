# 🧪 Testing Mode - Skip Timing Validations

## Overview

Testing Mode memungkinkan Anda untuk **skip semua timing validations** di UI dan menggunakan **challenge period 60 detik** (bukan 24 jam) untuk testing cepat.

## 🎯 2 Level Testing Mode

### Level 1: UI Testing Mode (Auction Detail)
**Lokasi**: Auction Detail Page → Debug Panel

**Fungsi**: Bypass UI timing validations
- Semua tombol seller/bidder muncul tanpa cek status
- Tidak perlu tunggu auction close untuk reveal
- Tidak perlu tunggu finalize untuk refund

**Catatan**: Smart contract masih enforce timing!

### Level 2: Smart Contract Testing Mode (Create Auction)
**Lokasi**: Create Auction Page → Privacy Settings

**Fungsi**: Set challenge period 60 detik
- Challenge period: 60 seconds (bukan 24 jam)
- Bisa finalize winner setelah 1 menit
- Smart contract akan accept karena timing sudah lewat

## 📋 Cara Menggunakan

### Opsi A: Full Testing Mode (Recommended)

**Step 1: Create Auction dengan Testing Mode**
```
1. Buka /premium-create
2. Isi form auction
3. Scroll ke "Privacy Settings"
4. Toggle ON "Testing Mode" 🧪
   → Challenge period: 60 seconds
5. Submit auction
```

**Step 2: Enable UI Testing Mode**
```
1. Buka auction detail
2. Lihat Debug Panel
3. Klik "Testing Mode OFF"
   → Berubah jadi "🧪 TESTING MODE ON"
4. Semua tombol sekarang visible
```

**Step 3: Test Complete Flow (Fast!)**
```
T+0:    Create auction (testing mode ON)
T+0:    Place bids (2-3 bidders)
T+0:    Close auction (no wait!)
T+0:    Reveal bids (no wait!)
T+0:    Determine winner (no wait!)
T+1min: Finalize winner (wait 60 seconds only!)
T+1min: Claim refunds (no wait!)
```

### Opsi B: UI Testing Mode Only

**Jika auction sudah dibuat tanpa testing mode**:
```
1. Buka auction detail
2. Enable UI Testing Mode
3. Semua tombol visible
4. TAPI finalize akan GAGAL jika belum 24h
```

## 🎨 UI Changes in Testing Mode

### Debug Panel
```
┌─────────────────────────────────────────┐
│ Debug Info:              [🧪 TESTING MODE ON] │
│ Your Address: aleo1lne9r7laz8r9p...     │
│ Seller: aleo1lne9r7laz8r9p...           │
│ Status: active                          │
│ Is Seller: YES                          │
│ ⚡ Testing Mode: All timing validations │
│    bypassed                             │
└─────────────────────────────────────────┘
```

### Seller Workflow Guide
```
🧪 Testing Mode: All buttons visible, no timing validation

Seller Workflow:
🚫 Cancel auction (if no bids) OR wait for time to end
1️⃣ Close auction
⏳ Wait for bidders to reveal
2️⃣ Determine winner (O(1))
⚡ Skip 24h wait  ← Changed!
3️⃣ Finalize winner
```

### Bidder Workflow Guide
```
🧪 Testing Mode: All buttons visible, no timing validation

Bidder Workflow:
🚫 Cancel bid (optional) OR wait for auction to close
🔓 Reveal your bid
⚡ Skip wait  ← Changed!
💰 Claim refund (if you lost)
```

## ⚠️ Important Notes

### UI Testing Mode
- ✅ Bypasses UI validations
- ✅ Shows all buttons
- ❌ Does NOT bypass smart contract
- ❌ Finalize will fail if challenge period not complete

### Smart Contract Testing Mode
- ✅ Sets challenge period to 60 seconds
- ✅ Smart contract accepts after 60 seconds
- ✅ Complete workflow works
- ⚠️ Must be set at auction creation

### Warning Dialog
Saat finalize dengan UI testing mode (tanpa smart contract testing mode):
```
🧪 TESTING MODE ACTIVE

You are bypassing the 24h challenge period.
This may FAIL on-chain if the smart contract enforces timing.

Continue anyway?
```

Jika gagal:
```
❌ Challenge Period Not Complete

The 24-hour challenge period has not ended yet.
You must wait before finalizing the winner.

Testing Mode can bypass UI validation but NOT smart contract validation.
```

## 🚀 Quick Test Scenarios

### Scenario 1: Ultra Fast Test (1 minute total)
```
1. Create auction (testing mode ON)
   - Challenge period: 60 seconds
   
2. Place bids immediately
   - Bidder A: 5 ALEO
   - Bidder B: 7 ALEO
   
3. Enable UI testing mode
   
4. Close auction immediately
   
5. Reveal bids immediately
   
6. Determine winner immediately
   
7. Wait 60 seconds
   
8. Finalize winner ✅ SUCCESS
   
9. Claim refunds immediately
```

### Scenario 2: UI Testing Only (Will Fail)
```
1. Create auction (testing mode OFF)
   - Challenge period: 24 hours
   
2. Place bids
   
3. Enable UI testing mode
   
4. Close, reveal, determine immediately
   
5. Try finalize immediately
   → ❌ FAILS: Challenge period not complete
   
6. Must wait 24 hours
```

### Scenario 3: Production Simulation
```
1. Create auction (testing mode OFF)
   - Challenge period: 24 hours
   
2. Place bids
   
3. Wait for end time
   
4. Close auction
   
5. Reveal bids
   
6. Determine winner
   
7. Wait 24 hours
   
8. Finalize winner
   
9. Claim refunds
```

## 🔧 Technical Details

### Challenge Period Values
```javascript
// Create Auction
const challengePeriod = formData.testingMode ? 60 : 86400;

// 60 seconds = 1 minute (testing)
// 86400 seconds = 24 hours (production)
```

### UI Validation Bypass
```javascript
// Without testing mode
{auction.status === 'winner-determined' && (
  <button>Finalize Winner</button>
)}

// With testing mode
{(testingMode || auction.status === 'winner-determined') && (
  <button>Finalize Winner</button>
)}
```

### Smart Contract Validation (Cannot Bypass)
```leo
finalize finalize_winner(auction_id: field) {
    let auction: AuctionInfo = auctions.get(auction_id);
    
    // This CANNOT be bypassed from UI
    assert(block.height >= auction.challenge_end_time);
    
    // Will fail if challenge period not complete
}
```

## 📊 Comparison

| Feature | Normal Mode | UI Testing | SC Testing | Both |
|---------|-------------|------------|------------|------|
| UI buttons visible | Status-based | ✅ All | Status-based | ✅ All |
| Close auction | Any time | Any time | Any time | Any time |
| Reveal bid | After close | ✅ Any time | After close | ✅ Any time |
| Determine winner | After reveal | ✅ Any time | After reveal | ✅ Any time |
| Finalize winner | After 24h | ❌ Fails | After 60s | ✅ After 60s |
| Claim refund | After finalize | ❌ Fails | After finalize | ✅ Works |

## ✅ Best Practices

### For Development/Testing
1. ✅ Use both testing modes
2. ✅ Create auction with testing mode ON
3. ✅ Enable UI testing mode
4. ✅ Test complete flow in 1-2 minutes

### For Staging/Demo
1. ✅ Use smart contract testing mode only
2. ✅ Keep UI validations (testing mode OFF)
3. ✅ Shows realistic flow but faster (60s vs 24h)

### For Production
1. ✅ Disable both testing modes
2. ✅ Full 24-hour challenge period
3. ✅ All UI validations active
4. ✅ Realistic timing

## 🎉 Summary

**Testing Mode = Fast Testing**
- UI Testing Mode: Skip UI validations
- SC Testing Mode: 60-second challenge period
- Combined: Complete flow in 1 minute!

**Production Mode = Real Experience**
- All validations active
- 24-hour challenge period
- Realistic user experience

Toggle testing mode sesuai kebutuhan Anda!
