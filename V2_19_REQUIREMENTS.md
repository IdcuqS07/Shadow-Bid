# ShadowBid V2.19 - Settlement Timing + Platform Fee + Reserve Price

## Tujuan V2.19

V2.19 adalah upgrade dari V2.18 dengan 3 fokus utama:

1. **Settlement Timing Fix** - Memperbaiki timeout baseline untuk seller claim
2. **Platform Fee** - Monetization mechanism untuk business model
3. **Reserve Price** - Seller protection untuk minimum acceptable price

V2.19 tetap mempertahankan sealed-bid auction core, dengan penambahan business logic yang essential.

---

## Feature 1: Settlement Timing Fix

### Masalah di V2.18

- `item_received_at = 0` saat winner belum confirm
- Baseline timeout tidak merepresentasikan awal settlement
- UI tidak punya deadline yang reliable untuk countdown

### Solusi V2.19

**Tambah 2 field baru:**

```leo
settled_at: i64        // Timestamp saat finalize_winner
claimable_at: i64      // settled_at + confirmation_timeout
```

**Update `finalize_winner`:**
- Set `settled_at` saat finalize
- Calculate `claimable_at = settled_at + confirmation_timeout`
- Jadi ada anchor waktu yang jelas

**Update `claim_winning_*`:**
```leo
assert(auction.item_received || claim_at >= auction.claimable_at);
```

Seller bisa claim jika:
- Winner sudah confirm receipt, ATAU
- Deadline `claimable_at` sudah lewat

---

## Feature 2: Platform Fee

### Business Model

Platform mengambil persentase dari winning bid sebagai revenue.

**Fee Rate:** 2.5% (250 basis points)
- Configurable via constant
- Applied to all auctions
- Transparent on-chain

### Implementation

**1. Platform Configuration**

```leo
// Platform fee rate (basis points)
const PLATFORM_FEE_RATE: u16 = 250u16;  // 2.5%

// Platform owner address
const PLATFORM_ADDRESS: address = aleo1your_platform_address_here;
```

**2. Fee Calculation (saat finalize_winner)**

```leo
let winning_amount_u128: u128 = auction.winning_amount;
let fee_amount: u128 = (winning_amount_u128 * (PLATFORM_FEE_RATE as u128)) / 10000u128;
let seller_amount: u128 = winning_amount_u128 - fee_amount;
```

**3. Seller Claim (net amount only)**

Seller hanya terima net amount (setelah dipotong fee):

```leo
async transition claim_winning_aleo(
    public auction_id: field,
    public claim_at: i64
) -> Future {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Transfer NET AMOUNT to seller
    let seller_amount_u64: u64 = auction.seller_net_amount as u64;
    let transfer_future: Future = credits.aleo/transfer_public(
        auction.seller,
        seller_amount_u64
    );
    
    return finalize_claim_winning_aleo(auction_id, self.signer, claim_at, transfer_future);
}
```

**4. Platform Fee Claim (NEW function)**

```leo
async transition claim_platform_fee(
    public auction_id: field
) -> Future {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Transfer fee to platform address
    let fee_amount_u64: u64 = auction.platform_fee_amount as u64;
    let transfer_future: Future = credits.aleo/transfer_public(
        PLATFORM_ADDRESS,
        fee_amount_u64
    );
    
    return finalize_claim_platform_fee(auction_id, self.signer, transfer_future);
}

async function finalize_claim_platform_fee(
    auction_id: field,
    caller: address,
    transfer_future: Future
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Only platform owner can claim
    assert_eq(caller, PLATFORM_ADDRESS);
    
    // Auction must be SETTLED
    assert_eq(auction.state, SETTLED);
    
    // Seller must have claimed first
    assert(auction.payment_claimed);
    
    // Fee not claimed yet
    assert(!auction.platform_fee_claimed);
    
    // Execute transfer
    transfer_future.await();
    
    // Mark as claimed
    let updated_auction: AuctionInfo = AuctionInfo {
        // ... all fields
        platform_fee_claimed: true,
        platform_fee_claimed_at: /* timestamp */
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}
```

### Fee Flow

```
1. Bidder commits: 100 ALEO → Contract Escrow

2. Seller finalizes:
   - Calculate fee: 100 * 2.5% = 2.5 ALEO
   - Calculate net: 100 - 2.5 = 97.5 ALEO
   - Store both amounts

3. Seller claims:
   - Transfer 97.5 ALEO → Seller
   - 2.5 ALEO remains in contract

4. Platform claims:
   - Transfer 2.5 ALEO → Platform Address
   - Contract balance = 0
```

### Access Control

- **Seller**: Can only claim `seller_net_amount`
- **Platform**: Can only claim after seller claimed
- **No one**: Can modify fee amounts (calculated on-chain)

---

## Feature 3: Reserve Price

### Purpose

Minimum price threshold untuk auction success. Berbeda dengan `min_bid_amount`:

- **min_bid_amount**: Floor untuk bid (siapa saja bisa bid)
- **reserve_price**: Threshold untuk auction valid (harus tercapai)

### Use Case

Seller ingin:
- Buka auction untuk semua orang (min_bid = 1 ALEO)
- Tapi hanya jual jika ada yang bid ≥ 100 ALEO (reserve = 100 ALEO)

Jika winning bid < reserve → auction cancelled, semua refund.

### Implementation

**1. Add to AuctionInfo**

```leo
reserve_price: u128,      // Minimum untuk auction success
reserve_met: bool,        // Apakah reserve tercapai
```

**2. Set saat create_auction**

```leo
async transition create_auction(
    public auction_id: field,
    public min_bid_amount: u128,
    public reserve_price: u128,     // NEW
    public currency_type: u8,
    public asset_type: u8,
    public end_time: i64,
    public challenge_period: i64
) -> (AuctionRecord, Future) {
    
    // Validate: reserve >= min_bid
    assert(reserve_price >= min_bid_amount);
    
    // ... rest of function
}
```

**3. Check saat determine_winner**

```leo
async function finalize_determine_winner(
    auction_id: field,
    caller: address
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    assert_eq(auction.seller, caller);
    assert_eq(auction.state, CLOSED);
    
    let winning_amount: u128 = Mapping::get(highest_bid, auction_id);
    let winner: address = Mapping::get(highest_bidder, auction_id);
    
    assert(winning_amount > 0u128);
    
    // NEW: Check reserve price
    let reserve_met: bool = winning_amount >= auction.reserve_price;
    
    let updated_auction: AuctionInfo = AuctionInfo {
        // ... all fields
        winner,
        winning_amount,
        reserve_met,  // NEW
        state: CHALLENGE
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}
```

**4. Validate saat finalize_winner**

```leo
async function finalize_finalize_winner(
    auction_id: field,
    caller: address,
    finalized_at: i64
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    assert_eq(auction.seller, caller);
    assert_eq(auction.state, CHALLENGE);
    
    // NEW: Reserve must be met to finalize
    assert(auction.reserve_met);
    
    // ... rest of finalization
}
```

**5. Cancel if reserve not met (NEW function)**

```leo
async transition cancel_auction_reserve_not_met(
    public auction_id: field
) -> Future {
    return finalize_cancel_reserve_not_met(auction_id, self.signer);
}

async function finalize_cancel_reserve_not_met(
    auction_id: field,
    caller: address
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Only seller can cancel
    assert_eq(auction.seller, caller);
    
    // Must be in CHALLENGE state
    assert_eq(auction.state, CHALLENGE);
    
    // Reserve must NOT be met
    assert(!auction.reserve_met);
    
    // Cancel auction
    let updated_auction: AuctionInfo = AuctionInfo {
        // ... all fields
        state: CANCELLED
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}
```

**6. Refund for cancelled auctions**

Bidders dapat refund jika auction cancelled karena reserve not met:

```leo
async function finalize_claim_refund(
    auction_id: field,
    bidder: address,
    refund_amount: u128,
    transfer_future: Future
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Allow refund if SETTLED or CANCELLED
    assert(auction.state == SETTLED || auction.state == CANCELLED);
    
    // ... rest of refund logic
}
```

### Reserve Price Flow

```
Scenario A: Reserve Met
1. Winning bid: 150 ALEO (reserve: 100 ALEO)
2. reserve_met = true
3. Seller can finalize → Normal settlement flow

Scenario B: Reserve Not Met
1. Winning bid: 80 ALEO (reserve: 100 ALEO)
2. reserve_met = false
3. Seller cannot finalize
4. Seller cancels auction
5. All bidders get refund
```

---

## Updated AuctionInfo Struct

```leo
struct AuctionInfo {
    seller: address,
    min_bid_amount: u128,
    currency_type: u8,
    end_time: i64,
    challenge_period: i64,
    state: u8,
    winner: address,
    winning_amount: u128,
    challenge_end_time: i64,
    total_escrowed: u128,
    asset_type: u8,
    
    // V2.18 fields
    item_received: bool,
    item_received_at: i64,
    payment_claimed: bool,
    payment_claimed_at: i64,
    confirmation_timeout: i64,
    
    // V2.19 NEW: Settlement timing
    settled_at: i64,
    claimable_at: i64,
    
    // V2.19 NEW: Platform fee
    platform_fee_amount: u128,
    seller_net_amount: u128,
    platform_fee_claimed: bool,
    platform_fee_claimed_at: i64,
    
    // V2.19 NEW: Reserve price
    reserve_price: u128,
    reserve_met: bool
}
```

---

## UI Requirements for V2.19

### 1. Create Auction Page

**NEW: Reserve Price Input**

```jsx
<div className="form-group">
  <label>Minimum Bid Amount</label>
  <input 
    type="number" 
    value={minBid}
    onChange={(e) => setMinBid(e.target.value)}
    placeholder="1.0"
  />
  <span className="hint">Minimum amount for any bid</span>
</div>

<div className="form-group">
  <label>Reserve Price (Optional)</label>
  <input 
    type="number" 
    value={reservePrice}
    onChange={(e) => setReservePrice(e.target.value)}
    placeholder="100.0"
  />
  <span className="hint">
    Minimum price to accept. If not met, auction will be cancelled.
    Must be ≥ minimum bid amount.
  </span>
</div>

<div className="fee-info">
  <div className="fee-breakdown">
    <div>If winning bid is {reservePrice || minBid} ALEO:</div>
    <div>Platform Fee (2.5%): {calculateFee(reservePrice || minBid)} ALEO</div>
    <div>You Receive: {calculateNet(reservePrice || minBid)} ALEO</div>
  </div>
</div>
```

### 2. Auction Detail Page - Seller View

**Settlement Status Card**

```jsx
{auction.state === 'SETTLED' && auction.seller === address && (
  <GlassCard>
    <h3>Settlement Status</h3>
    
    {/* Timeline */}
    <div className="timeline">
      <div className="step completed">
        <div>✓ Auction Finalized</div>
        <div>{formatDate(auction.settledAt)}</div>
      </div>
      
      <div className={auction.itemReceived ? 'step completed' : 'step pending'}>
        <div>{auction.itemReceived ? '✓' : '○'} Winner Confirmation</div>
        {auction.itemReceived && <div>{formatDate(auction.itemReceivedAt)}</div>}
      </div>
      
      <div className={auction.paymentClaimed ? 'step completed' : 'step pending'}>
        <div>{auction.paymentClaimed ? '✓' : '○'} Payment Claimed</div>
        {auction.paymentClaimed && <div>{formatDate(auction.paymentClaimedAt)}</div>}
      </div>
    </div>
    
    {/* Payment Info */}
    <div className="payment-breakdown">
      <div className="row">
        <span>Winning Bid:</span>
        <span>{auction.winningAmount} {auction.token}</span>
      </div>
      <div className="row fee">
        <span>Platform Fee (2.5%):</span>
        <span>-{auction.platformFeeAmount} {auction.token}</span>
      </div>
      <div className="row total">
        <span>You Receive:</span>
        <span>{auction.sellerNetAmount} {auction.token}</span>
      </div>
    </div>
    
    {/* Claim Button */}
    {!auction.paymentClaimed && (
      <div>
        {auction.itemReceived ? (
          <PremiumButton onClick={handleClaimPayment}>
            Claim Payment ({auction.sellerNetAmount} {auction.token})
          </PremiumButton>
        ) : (
          <div>
            <div className="countdown">
              Auto-claimable in: {formatCountdown(auction.claimableAt)}
            </div>
            <PremiumButton 
              onClick={handleClaimPayment}
              disabled={Date.now() < auction.claimableAt * 1000}
            >
              Claim Payment (Available {formatDate(auction.claimableAt)})
            </PremiumButton>
          </div>
        )}
      </div>
    )}
  </GlassCard>
)}
```

**Reserve Not Met Warning**

```jsx
{auction.state === 'CHALLENGE' && !auction.reserveMet && (
  <GlassCard className="warning">
    <h3>⚠️ Reserve Price Not Met</h3>
    <p>
      Winning bid ({auction.winningAmount} {auction.token}) is below 
      your reserve price ({auction.reservePrice} {auction.token}).
    </p>
    <p>
      You can cancel this auction and all bidders will receive refunds.
    </p>
    <PremiumButton 
      variant="danger"
      onClick={handleCancelReserveNotMet}
    >
      Cancel Auction (Reserve Not Met)
    </PremiumButton>
  </GlassCard>
)}
```

### 3. Platform Admin Dashboard (NEW)

```jsx
function PlatformAdminDashboard() {
  return (
    <div className="admin-dashboard">
      <h1>Platform Revenue Dashboard</h1>
      
      {/* Stats Overview */}
      <div className="stats-grid">
        <StatCard 
          title="Total Revenue"
          value={`${totalRevenue} ALEO`}
          icon="💰"
        />
        <StatCard 
          title="Pending Fees"
          value={`${pendingFees} ALEO`}
          icon="⏳"
        />
        <StatCard 
          title="Auctions Settled"
          value={settledCount}
          icon="✓"
        />
        <StatCard 
          title="Average Fee"
          value={`${averageFee} ALEO`}
          icon="📊"
        />
      </div>
      
      {/* Pending Fees Table */}
      <GlassCard>
        <h2>Pending Fee Claims</h2>
        <table>
          <thead>
            <tr>
              <th>Auction ID</th>
              <th>Settled At</th>
              <th>Winning Amount</th>
              <th>Fee Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pendingFeeAuctions.map(auction => (
              <tr key={auction.id}>
                <td>#{auction.id}</td>
                <td>{formatDate(auction.settledAt)}</td>
                <td>{auction.winningAmount} {auction.token}</td>
                <td>{auction.platformFeeAmount} {auction.token}</td>
                <td>
                  <PremiumButton 
                    size="sm"
                    onClick={() => handleClaimFee(auction.id)}
                  >
                    Claim Fee
                  </PremiumButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
      
      {/* Revenue Chart */}
      <GlassCard>
        <h2>Revenue Over Time</h2>
        <RevenueChart data={revenueData} />
      </GlassCard>
      
      {/* Recent Claims */}
      <GlassCard>
        <h2>Recent Fee Claims</h2>
        {recentClaims.map(claim => (
          <div key={claim.id} className="claim-item">
            <div>Auction #{claim.auctionId}</div>
            <div>{claim.amount} {claim.token}</div>
            <div>{formatDate(claim.timestamp)}</div>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}
```

---

## Optional Improvements for V2.19

Jika bandwidth cukup, dua tambahan ini akan membantu UI:

### 1. Add `bid_count`

Manfaat:
- seller bisa lihat apakah auction punya peserta
- UI bisa menghapus beberapa tebakan dari metadata lokal

### 2. Add `revealed_count`

Manfaat:
- seller tahu kapan determine winner sudah masuk akal
- bidder tahu progress reveal lebih jelas

Keduanya bukan blocker utama, tetapi membantu sinkronisasi UI dengan chain.

---

## Out of Scope for V2.19

Tetap ditunda:
- anti-snipe
- platform fee
- dispute system
- reserve price terpisah dari `min_bid_amount`
- on-chain shipping tracking
- on-chain file/photo storage
- auction formats lain selain sealed-bid

---

## Testing Matrix

### Settlement correctness

- [ ] Winner confirm receipt setelah auction settled
- [ ] Seller claim setelah winner confirm
- [ ] Seller claim tanpa confirm hanya bisa setelah `claimable_at`
- [ ] Seller tidak bisa claim dua kali
- [ ] Winner tidak bisa confirm dua kali

### Asset categories

- [ ] Digital Assets (3 days)
- [ ] Physical Goods (14 days)
- [ ] Collectibles (21 days)
- [ ] Vehicles / Services (30 days)
- [ ] Real Estate / IP (90 days)

### Currencies

- [ ] ALEO public
- [ ] ALEO private bid path
- [ ] USDCx
- [ ] USAD

---

## Acceptance Criteria

V2.19 dianggap berhasil bila:
- seller claim deadline punya baseline on-chain yang jelas
- UI bisa menampilkan countdown settlement tanpa workaround lokal
- claim button benar-benar sinkron dengan aturan contract
- `item_received_at` dan `payment_claimed_at` tetap tercatat dengan benar
- tidak ada ambiguity antara “waiting for confirmation” dan “ready to claim”

---

**Last Updated:** 26 Maret 2026  
**Status:** Draft requirements for next contract iteration


## Service Functions (aleoServiceV2.js)

### NEW Functions for V2.19

```javascript
// Create auction with reserve price
export async function createAuctionV2_19(
  executeTransaction, 
  auctionId, 
  minBidAmount, 
  reservePrice,
  currencyType, 
  assetType, 
  endTime, 
  challengePeriod = 86400
) {
  const inputs = [
    `${auctionId}field`,
    `${minBidAmount}u128`,
    `${reservePrice}u128`,      // NEW
    `${currencyType}u8`,
    `${assetType}u8`,
    `${endTime}i64`,
    `${challengePeriod}i64`
  ];
  
  return requestTx(executeTransaction, 'create_auction', inputs);
}

// Finalize winner with timestamp
export async function finalizeWinnerV2_19(executeTransaction, auctionId) {
  const finalizedAt = Math.floor(Date.now() / 1000);
  const inputs = [
    `${auctionId}field`,
    `${finalizedAt}i64`         // NEW: Pass timestamp
  ];
  
  return requestTx(executeTransaction, 'finalize_winner', inputs);
}

// Claim platform fee
export async function claimPlatformFee(executeTransaction, auctionId) {
  const inputs = [
    `${auctionId}field`
  ];
  
  return requestTx(executeTransaction, 'claim_platform_fee', inputs);
}

// Cancel auction (reserve not met)
export async function cancelAuctionReserveNotMet(executeTransaction, auctionId) {
  const inputs = [
    `${auctionId}field`
  ];
  
  return requestTx(executeTransaction, 'cancel_auction_reserve_not_met', inputs);
}

// Helper: Calculate platform fee
export function calculatePlatformFee(winningAmount, feeRate = 250) {
  return Math.floor((winningAmount * feeRate) / 10000);
}

// Helper: Calculate seller net amount
export function calculateSellerNet(winningAmount, feeRate = 250) {
  const fee = calculatePlatformFee(winningAmount, feeRate);
  return winningAmount - fee;
}

// Helper: Check if reserve met
export function isReserveMet(winningAmount, reservePrice) {
  return winningAmount >= reservePrice;
}
```

---

## Testing Matrix

### Settlement Timing
- [ ] `settled_at` set correctly saat finalize_winner
- [ ] `claimable_at` calculated correctly (settled_at + confirmation_timeout)
- [ ] Seller can claim after winner confirms
- [ ] Seller can claim after timeout (without confirmation)
- [ ] Seller cannot claim before timeout (without confirmation)
- [ ] UI countdown shows correct time remaining

### Platform Fee
- [ ] Fee calculated correctly (2.5% of winning amount)
- [ ] Seller receives net amount only
- [ ] Platform can claim fee after seller claims
- [ ] Platform cannot claim before seller claims
- [ ] Platform cannot claim twice
- [ ] Only platform address can claim fee
- [ ] Fee works for all currencies (ALEO, USDCx, USAD)

### Reserve Price
- [ ] Reserve price must be >= min_bid_amount
- [ ] `reserve_met` set correctly saat determine_winner
- [ ] Seller can finalize if reserve met
- [ ] Seller cannot finalize if reserve not met
- [ ] Seller can cancel if reserve not met
- [ ] Bidders can refund if auction cancelled
- [ ] UI shows reserve status correctly

### Integration
- [ ] All 3 features work together
- [ ] Fee calculated on reserve-met auctions
- [ ] Settlement timing works with fee split
- [ ] Cancelled auctions don't generate fees

---

## Out of Scope for V2.19

Tetap ditunda ke versi berikutnya:
- ❌ Anti-snipe mechanism
- ❌ Dispute system
- ❌ Multiple auction formats
- ❌ On-chain shipping tracking
- ❌ Configurable fee rates per auction
- ❌ Fee sharing/referral system

---

## Acceptance Criteria

V2.19 dianggap berhasil bila:

1. **Settlement Timing**
   - Seller claim deadline punya baseline on-chain yang jelas
   - UI countdown akurat dan reliable
   - No ambiguity antara "waiting" dan "ready to claim"

2. **Platform Fee**
   - Platform dapat revenue 2.5% dari setiap auction
   - Seller terima net amount yang benar
   - Admin dashboard berfungsi untuk claim fees
   - Transparent dan auditable on-chain

3. **Reserve Price**
   - Seller dapat set minimum acceptable price
   - Auction cancelled jika reserve not met
   - Bidders dapat refund dengan aman
   - UI menjelaskan reserve vs min_bid dengan jelas

4. **Backward Compatibility**
   - Semua fitur V2.18 tetap berfungsi
   - Sealed-bid flow tidak berubah
   - Asset categories tetap supported
   - Multi-currency tetap berfungsi

---

## Migration Path from V2.18

### Contract Migration

1. Deploy V2.19 contract dengan address baru
2. Update `VITE_PROGRAM_ID` di environment
3. UI detect contract version dan route accordingly
4. V2.18 auctions tetap bisa diselesaikan di V2.18 contract
5. New auctions menggunakan V2.19 contract

### Data Migration

Tidak perlu migration karena:
- V2.18 dan V2.19 bisa coexist
- Auction data independent per contract
- No shared state between versions

### UI Migration

1. Add reserve price input di create auction
2. Add platform fee display di auction detail
3. Add admin dashboard untuk fee management
4. Update settlement status cards dengan new fields
5. Add countdown untuk claimable_at

---

**Last Updated:** 26 Maret 2026  
**Status:** ✅ Ready for implementation
**Target:** V2.19 production deployment
