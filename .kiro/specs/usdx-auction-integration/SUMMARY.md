# USDX Auction Integration - Summary

## Overview

Phase 2 extension untuk Scalable Sealed-Bid Auction V2 yang menambahkan support untuk USDX stablecoin bidding.

## Key Decisions

### Architecture: Separate Contract ✅
- **Contract**: `shadowbid_marketplace_v2_usdx.aleo`
- **Reason**: Isolate token complexity, easier maintenance, independent deployment
- **Trade-off**: Code duplication vs simplicity (chose simplicity)

### Token Escrow: Contract Holds USDX ✅
- **Mechanism**: Contract holds USDX during auction lifecycle
- **Commit**: Bidder transfers USDX to contract
- **Winner**: Contract transfers USDX to winner
- **Losers**: Manual claim refund

### Refund Strategy: Manual Claim ✅
- **Reason**: Gas efficiency (auto-refund 1000 losers = expensive)
- **Process**: Losers call `claim_refund()` after auction settled
- **Safety**: Prevent double refunds, winner cannot refund

## Technical Highlights

### 1. USDX Escrow Tracking
```leo
mapping usdx_escrow: field => USDXEscrow;

struct USDXEscrow {
    bidder: address,
    amount_usdx: u64,
    is_refunded: bool,
    is_winner: bool
}
```

### 2. Commit with Escrow
```leo
async transition commit_bid(
    auction_id: u64,
    commitment: field,
    usdx_record: USDXRecord  // Bidder's USDX
) -> Future {
    // Transfer USDX to contract
    test_usdcx_stablecoin.aleo/transfer_public(
        self.caller,
        self.address,  // Contract
        amount
    );
    
    // Store commitment + escrow
}
```

### 3. Winner Payment
```leo
async transition finalize_winner(auction_id: u64) -> Future {
    // Transfer USDX to winner
    test_usdcx_stablecoin.aleo/transfer_public(
        self.address,      // Contract
        auction.winner,
        auction.winning_amount_usdx
    );
}
```

### 4. Loser Refund
```leo
async transition claim_refund(auction_id: u64) -> Future {
    // Verify not winner, not refunded
    // Transfer USDX back to loser
    test_usdcx_stablecoin.aleo/transfer_public(
        self.address,
        bidder,
        escrow.amount_usdx
    );
}
```

## Comparison: ALEO vs USDX Auctions

| Aspect | V2 ALEO | V2 USDX |
|--------|---------|---------|
| **Contract** | shadowbid_marketplace_v2_aleo.aleo | shadowbid_marketplace_v2_usdx.aleo |
| **Currency** | Native ALEO | USDX Stablecoin |
| **Escrow** | No escrow needed | Contract holds USDX |
| **Winner Payment** | WinnerRecord (proof) | USDX transfer |
| **Loser Refund** | N/A (no escrow) | Manual claim_refund |
| **External Calls** | None | test_usdcx_stablecoin.aleo |
| **Gas Cost** | Lower | Higher (external calls) |
| **Complexity** | Simple | Moderate (escrow logic) |

## User Flow

### Creating USDX Auction
1. Seller selects "USDX" currency in UI
2. Sets min_bid_usdx (e.g., 1000 USDX)
3. Frontend routes to shadowbid_marketplace_v2_usdx.aleo
4. Auction created with USDX denomination

### Bidding with USDX
1. Bidder enters bid amount in USDX
2. Frontend generates commitment hash
3. Bidder approves USDX transfer
4. commit_bid transfers USDX to contract escrow
5. Commitment stored on-chain

### Winning
1. Auction closes, reveals happen
2. Seller calls determine_winner (O(1))
3. Winner determined
4. After challenge period, seller calls finalize_winner
5. Contract transfers USDX to winner automatically

### Losing (Refund)
1. Auction settled
2. Loser sees "Claim Refund" button in UI
3. Loser clicks button
4. claim_refund transfers USDX back to loser
5. Escrow marked as refunded

## Security Considerations

### Escrow Security
- ✅ Contract holds exact amounts per bidder
- ✅ Only winner or losers can withdraw their amounts
- ✅ No admin withdrawal function
- ⚠️ Requires thorough audit

### Refund Safety
- ✅ Prevent double refunds (is_refunded flag)
- ✅ Winner cannot refund (is_winner check)
- ✅ Only after settled (state check)
- ⚠️ Grace period for stuck auctions

### Token Contract Trust
- ⚠️ Depends on test_usdcx_stablecoin.aleo security
- ✅ Use only verified token contracts
- ✅ Handle transfer failures gracefully

## Implementation Phases

### Phase 1: Smart Contract (4-6 weeks)
- Data structures and mappings
- USDX auction creation
- Commit with escrow
- Reveal and winner determination
- Winner payment and loser refunds
- Testing (unit, integration, performance)

### Phase 2: Frontend (2-3 weeks)
- Currency selection UI
- USDX auction creation form
- USDX bid commitment with escrow warning
- Refund claim interface
- USDX balance and status display

### Phase 3: Deployment (1 week)
- Deploy to testnet
- Integration testing with real USDX
- Documentation
- User education

### Phase 4: Monitoring (Ongoing)
- Escrow balance monitoring
- Refund claim rate tracking
- Security monitoring

## Success Metrics

- ✅ USDX auction creation works
- ✅ Escrow tracking accurate (100%)
- ✅ Winner receives USDX automatically
- ✅ Losers can claim refunds successfully
- ✅ No double refunds
- ✅ O(1) winner determination maintained
- ✅ Support 1000+ USDX bidders

## Next Steps

1. **Review this spec** - Confirm architecture decisions
2. **Start Phase 1** - Implement smart contract
3. **Deploy V2 ALEO first** - Get core working before USDX
4. **Then add USDX** - Extend with token support

## Questions?

- Escrow mechanism clear?
- Refund process acceptable?
- Security concerns addressed?
- Ready to start implementation?
