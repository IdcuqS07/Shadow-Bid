# V2.19 UI Integration Guide

## Status: Service Layer Updated ✅

Contract V2.19 deployed dan service layer sudah diupdate.

---

## ✅ Completed

### 1. aleoServiceV2.js Updates
- ✅ Updated PROGRAM_ID to `shadowbid_marketplace_v2_19.aleo`
- ✅ Added PLATFORM_FEE_RATE constant (250 = 2.5%)
- ✅ Added PLATFORM_ADDRESS constant
- ✅ Added 8 new fields to normalizeAuctionInfoResponse
- ✅ Added helper functions:
  - `calculatePlatformFee(winningAmount)`
  - `calculateSellerNetAmount(winningAmount)`
  - `isReserveMet(winningAmount, reservePrice)`
  - `getCurrentTimestamp()`
  - `calculateClaimableAt(settledAt, confirmationTimeout)`
  - `isPlatformOwner(walletAddress)`
  - `getPlatformFeeInfo()`

### 2. Updated Existing Functions
- ✅ `createAuction` - Added reserve_price parameter
- ✅ `finalizeWinner` - Added finalized_at parameter
- ✅ `claimWinningAleo` - Uses seller_net_amount
- ✅ `claimWinningUSDCx` - Uses seller_net_amount
- ✅ `claimWinningUSAD` - Uses seller_net_amount

### 3. New Functions Added
- ✅ `claimPlatformFeeAleo(executeTransaction, auctionId, feeAmount)`
- ✅ `claimPlatformFeeUsdcx(executeTransaction, auctionId, feeAmount)`
- ✅ `claimPlatformFeeUsad(executeTransaction, auctionId, feeAmount)`
- ✅ `cancelAuctionReserveNotMet(executeTransaction, auctionId)`

### 4. PremiumCreateAuction.jsx
- ✅ Reserve price already in formData
- ✅ Updated createAuction call to pass reservePriceMicro

---

## ⏳ Remaining UI Updates

### 1. PremiumAuctionDetail.jsx

#### Add Imports
```javascript
import {
  // ... existing imports
  calculatePlatformFee,
  calculateSellerNetAmount,
  isPlatformOwner,
  claimPlatformFeeAleo,
  claimPlatformFeeUsdcx,
  claimPlatformFeeUsad,
  cancelAuctionReserveNotMet,
  getCurrentTimestamp,
} from '@/services/aleoServiceV2';
```

#### Calculate Fee Breakdown
```javascript
// In loadAuctionData or wherever auction data is processed
if (auction.winningBid) {
  const winningAmountMicro = Math.floor(auction.winningBid * 1_000_000);
  const platformFeeMicro = calculatePlatformFee(winningAmountMicro);
  const sellerNetMicro = calculateSellerNetAmount(winningAmountMicro);
  
  auction.platformFee = parseInt(platformFeeMicro) / 1_000_000;
  auction.sellerNetAmount = parseInt(sellerNetMicro) / 1_000_000;
  auction.platformFeePercent = 2.5;
}
```

#### Display Fee Breakdown
```jsx
{/* Show fee breakdown for settled auctions */}
{auction.state === 'SETTLED' && auction.winningBid && (
  <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
    <div className="text-sm text-white/60 mb-2">Payment Breakdown</div>
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-white/80">Winning Bid:</span>
        <span className="text-white font-medium">
          {auction.winningBid} {auction.token}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-white/80">Platform Fee (2.5%):</span>
        <span className="text-gold-400 font-medium">
          {auction.platformFee} {auction.token}
        </span>
      </div>
      <div className="h-px bg-white/10 my-2" />
      <div className="flex justify-between">
        <span className="text-white font-medium">Seller Receives:</span>
        <span className="text-cyan-400 font-bold text-lg">
          {auction.sellerNetAmount} {auction.token}
        </span>
      </div>
    </div>
  </div>
)}
```

#### Add Platform Fee Claim Button (Admin Only)
```jsx
{/* Platform owner can claim fee after seller claims */}
{isPlatformOwner(address) && 
 auction.state === 'SETTLED' && 
 auction.payment_claimed && 
 !auction.platform_fee_claimed && (
  <PremiumButton
    onClick={handleClaimPlatformFee}
    loading={isClaimingFee}
    className="w-full"
  >
    <DollarSign className="w-4 h-4 mr-2" />
    Claim Platform Fee ({auction.platformFee} {auction.token})
  </PremiumButton>
)}
```

#### Add Cancel Button (Reserve Not Met)
```jsx
{/* Seller can cancel if reserve not met */}
{isSeller && 
 auction.state === 'CHALLENGE' && 
 !auction.reserve_met && (
  <PremiumButton
    onClick={handleCancelReserveNotMet}
    variant="danger"
    className="w-full"
  >
    <X className="w-4 h-4 mr-2" />
    Cancel Auction (Reserve Not Met)
  </PremiumButton>
)}
```

#### Add Handler Functions
```javascript
const handleClaimPlatformFee = async () => {
  try {
    setIsClaimingFee(true);
    
    const feeAmountMicro = Math.floor(auction.platformFee * 1_000_000);
    
    let result;
    if (auction.currencyType === 1) {
      // Aleo
      result = await claimPlatformFeeAleo(
        executeTransaction,
        auction.id,
        feeAmountMicro
      );
    } else if (auction.currencyType === 0) {
      // USDCx
      result = await claimPlatformFeeUsdcx(
        executeTransaction,
        auction.id,
        feeAmountMicro
      );
    } else {
      // USAD
      result = await claimPlatformFeeUsad(
        executeTransaction,
        auction.id,
        feeAmountMicro
      );
    }
    
    console.log('✅ Platform fee claimed:', result);
    alert('Platform fee claimed successfully!');
    
    // Reload auction data
    await loadAuctionData();
  } catch (error) {
    console.error('❌ Error claiming platform fee:', error);
    alert('Failed to claim platform fee: ' + error.message);
  } finally {
    setIsClaimingFee(false);
  }
};

const handleCancelReserveNotMet = async () => {
  if (!confirm('Cancel this auction because reserve price was not met?')) {
    return;
  }
  
  try {
    setIsCancelling(true);
    
    const result = await cancelAuctionReserveNotMet(
      executeTransaction,
      auction.id
    );
    
    console.log('✅ Auction cancelled:', result);
    alert('Auction cancelled. Bidders can now claim refunds.');
    
    // Reload auction data
    await loadAuctionData();
  } catch (error) {
    console.error('❌ Error cancelling auction:', error);
    alert('Failed to cancel auction: ' + error.message);
  } finally {
    setIsCancelling(false);
  }
};
```

#### Update Claim Winning Handler
```javascript
const handleClaimWinning = async () => {
  try {
    setIsClaimingWinning(true);
    
    // V2.19: Use seller_net_amount instead of winning_amount
    const sellerNetMicro = Math.floor(auction.sellerNetAmount * 1_000_000);
    const timestamp = getCurrentTimestamp();
    
    let result;
    if (auction.currencyType === 1) {
      // Aleo
      result = await claimWinningAleo(
        executeTransaction,
        auction.id,
        sellerNetMicro,  // V2.19: seller_net_amount
        address,
        timestamp
      );
    } else if (auction.currencyType === 0) {
      // USDCx
      result = await claimWinningUSDCx(
        executeTransaction,
        auction.id,
        sellerNetMicro,  // V2.19: seller_net_amount
        address,
        timestamp
      );
    } else {
      // USAD
      result = await claimWinningUSAD(
        executeTransaction,
        auction.id,
        sellerNetMicro,  // V2.19: seller_net_amount
        address,
        timestamp
      );
    }
    
    console.log('✅ Winning amount claimed:', result);
    alert(`Successfully claimed ${auction.sellerNetAmount} ${auction.token}!`);
    
    // Reload auction data
    await loadAuctionData();
  } catch (error) {
    console.error('❌ Error claiming winning:', error);
    alert('Failed to claim winning: ' + error.message);
  } finally {
    setIsClaimingWinning(false);
  }
};
```

#### Update Finalize Winner Handler
```javascript
const handleFinalizeWinner = async () => {
  try {
    setIsFinalizingWinner(true);
    
    const timestamp = getCurrentTimestamp();
    
    const result = await finalizeWinner(
      executeTransaction,
      auction.id,
      timestamp  // V2.19: Pass current timestamp
    );
    
    console.log('✅ Winner finalized:', result);
    alert('Winner finalized successfully!');
    
    // Reload auction data
    await loadAuctionData();
  } catch (error) {
    console.error('❌ Error finalizing winner:', error);
    alert('Failed to finalize winner: ' + error.message);
  } finally {
    setIsFinalizingWinner(false);
  }
};
```

### 2. PremiumAuctionList.jsx

#### Display Reserve Price
```jsx
{/* Show reserve price if set */}
{auction.reservePrice && auction.reservePrice !== auction.minBid && (
  <div className="text-xs text-white/60">
    Reserve: {auction.reservePrice} {auction.token}
  </div>
)}
```

### 3. Admin Dashboard (Optional)

Create new component for platform fee management:

```jsx
// components/admin/PlatformFeeManager.jsx
export default function PlatformFeeManager() {
  const [settledAuctions, setSettledAuctions] = useState([]);
  const [totalFeesCollected, setTotalFeesCollected] = useState(0);
  const [totalFeesPending, setTotalFeesPending] = useState(0);
  
  // Load settled auctions with unclaimed fees
  // Display list of auctions with claim buttons
  // Show statistics
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Total Fees Collected" value={totalFeesCollected} />
        <StatCard title="Pending Fees" value={totalFeesPending} />
        <StatCard title="Fee Rate" value="2.5%" />
      </div>
      
      <div className="space-y-4">
        {settledAuctions.map(auction => (
          <AuctionFeeCard 
            key={auction.id}
            auction={auction}
            onClaim={handleClaimFee}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## Testing Checklist

### Create Auction
- [ ] Create auction with reserve price = minBid
- [ ] Create auction with reserve price > minBid
- [ ] Verify reserve price stored on-chain

### Bidding & Settlement
- [ ] Bid below reserve → verify reserve_met = false
- [ ] Bid above reserve → verify reserve_met = true
- [ ] Finalize winner → verify fee calculated correctly
- [ ] Verify settled_at and claimable_at set correctly

### Claiming
- [ ] Seller claims net amount (97.5%)
- [ ] Verify seller receives correct amount
- [ ] Platform claims fee (2.5%)
- [ ] Verify platform receives correct amount

### Reserve Not Met
- [ ] Seller cancels auction
- [ ] Bidders claim refunds
- [ ] Verify all refunds processed

### UI Display
- [ ] Fee breakdown shows correctly
- [ ] Platform fee claim button shows for admin only
- [ ] Cancel button shows when reserve not met
- [ ] All amounts display correctly

---

## Deployment Steps

1. ✅ Contract deployed to testnet
2. ✅ Service layer updated
3. ⏳ Update PremiumAuctionDetail.jsx
4. ⏳ Test all flows
5. ⏳ Deploy UI to production

---

## Quick Reference

### Fee Calculation
```javascript
const platformFee = (winningAmount * 250) / 10000;  // 2.5%
const sellerNet = winningAmount - platformFee;       // 97.5%
```

### Platform Address
```
aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8
```

### Contract Program ID
```
shadowbid_marketplace_v2_19.aleo
```

---

Contract deployed, service layer ready, UI updates documented.
