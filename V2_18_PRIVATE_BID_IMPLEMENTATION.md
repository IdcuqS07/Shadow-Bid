# V2.18 Private Bid Implementation

## Overview

V2.18 introduces **fully private transactions** for ALEO bids, allowing users to hide both:
- Bid amount (already hidden via commitment)
- Transfer amount (now also hidden via private → public transfer)

## Contract Functions

### 1. commit_bid_aleo_private
```leo
async transition commit_bid_aleo_private(
    public auction_id: field,
    public commitment: field,
    private_credits: credits.aleo/credits,  // Private input
    public amount_credits: u64
) -> (credits.aleo/credits, Future)
```

**Flow:**
1. User provides private credits record
2. Contract transfers private → public (to escrow)
3. Returns change record to user (private)
4. Commitment stored on-chain (public mapping)

### 2. claim_refund_aleo_private
```leo
async transition claim_refund_aleo_private(
    public auction_id: field,
    public refund_amount: u64
) -> (credits.aleo/credits, Future)
```

**Flow:**
1. Contract transfers public → private (from escrow)
2. Returns private credits record to user
3. Marks refund as claimed

## UI Implementation

### Privacy Toggle (ALEO only)

```jsx
{auction.currency === 'ALEO' && (
  <div className="mb-4 p-4 bg-void-800 rounded-xl border border-white/10">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-gold-500" />
        <span className="text-sm font-mono text-white">Privacy Mode</span>
      </div>
      <button
        onClick={() => setUsePrivateBid(!usePrivateBid)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          usePrivateBid ? 'bg-gold-500' : 'bg-white/20'
        }`}
      >
        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
          usePrivateBid ? 'translate-x-6' : ''
        }`} />
      </button>
    </div>
    <div className="text-xs text-white/60">
      {usePrivateBid 
        ? '🔒 Private: Transfer amount hidden on-chain'
        : '👁️ Public: Transfer amount visible on-chain'
      }
    </div>
  </div>
)}
```

### Private Bid Flow

```javascript
const handlePrivateBid = async () => {
  // 1. Request private records from wallet
  const records = await wallet.requestRecords({
    program: 'credits.aleo',
  });
  
  // 2. Filter for sufficient balance
  const validRecords = records.filter(r => 
    parseInt(r.data.microcredits) >= bidAmountMicro
  );
  
  if (validRecords.length === 0) {
    alert('No private credits available. Please use public bid.');
    return;
  }
  
  // 3. Select record (use first available)
  const selectedRecord = validRecords[0];
  
  // 4. Call private bid function
  const result = await commitBidAleoPrivate(
    executeTransaction,
    auctionId,
    commitment,
    selectedRecord,
    bidAmountMicro
  );
  
  // 5. Save commitment data
  saveCommitment(auctionId, commitment, bidAmount, address, 'aleo');
  saveNonce(auctionId, nonce, address);
};
```

## Service Functions

### aleoServiceV2.js

```javascript
// Already implemented in aleoServiceV2.js
export async function commitBidAleoPrivate(
  executeTransaction, 
  auctionId, 
  commitment, 
  privateRecord, 
  amountCredits
) {
  const inputs = [
    `${auctionId}field`,
    `${commitment}field`,
    privateRecord,  // Private credits record
    `${amountCredits}u64`
  ];
  
  return requestTx(
    executeTransaction,
    'commit_bid_aleo_private',
    inputs
  );
}
```

## User Experience

### Public Bid (Default)
- ✅ Faster (no record selection)
- ✅ Cheaper fee
- ❌ Transfer amount visible on explorer
- ✅ Bid amount still hidden (commitment)

### Private Bid (V2.18 New)
- ✅ Fully private (transfer + bid amount)
- ✅ Maximum privacy
- ❌ Requires private credits
- ❌ Higher fee (private transaction)
- ❌ Slower (record management)

## Privacy Comparison

| Aspect | Public Bid | Private Bid |
|--------|-----------|-------------|
| Bid Amount | Hidden (commitment) | Hidden (commitment) |
| Transfer Amount | Visible | Hidden |
| Wallet Balance | Visible | Hidden |
| Transaction Fee | ~0.001 ALEO | ~0.002 ALEO |
| Speed | Fast | Slower |
| Requirements | Public credits | Private credits |

## Implementation Checklist

- [ ] Add privacy toggle UI (ALEO only)
- [ ] Add `usePrivateBid` state
- [ ] Implement `requestRecords()` from wallet
- [ ] Add record selection logic
- [ ] Call `commitBidAleoPrivate` when private mode
- [ ] Add loading state for record fetching
- [ ] Add error handling (no private credits)
- [ ] Add fee warning (higher for private)
- [ ] Test with private credits
- [ ] Test fallback to public if no private credits

## Testing Scenarios

### Scenario 1: User has private credits
1. Toggle privacy mode ON
2. Enter bid amount
3. Click "Commit Bid"
4. Wallet shows private record selection
5. Approve transaction
6. Bid committed privately

### Scenario 2: User has no private credits
1. Toggle privacy mode ON
2. Enter bid amount
3. Click "Commit Bid"
4. Show error: "No private credits available"
5. Suggest: "Use public bid or transfer to private first"

### Scenario 3: User switches currency
1. Select ALEO → Privacy toggle visible
2. Select USDCx → Privacy toggle hidden (not supported yet)
3. Select USAD → Privacy toggle hidden (not supported yet)

## Future Enhancements (V3.0)

- Private USDCx bid (requires ComplianceRecord)
- Private USAD bid
- Automatic record splitting (if insufficient balance)
- Record management UI
- Privacy analytics dashboard

---

**Status:** Ready for Implementation  
**Priority:** High (V2.18 core feature)  
**Estimated Time:** 30-45 minutes
