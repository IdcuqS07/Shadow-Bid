# Requirements Document: USDX Auction Integration (Phase 2)

## 1. Functional Requirements

### 1.1 USDX Auction Creation

**REQ-1.1.1**: The system SHALL allow sellers to create USDX-denominated auctions.

**REQ-1.1.2**: The system SHALL accept minimum bid amounts in USDX microcredits.

**REQ-1.1.3**: The system SHALL store USDX auction metadata separately from ALEO auctions.

**REQ-1.1.4**: The system SHALL validate that USDX amounts are positive and non-zero.

### 1.2 USDX Bid Commitment with Escrow

**REQ-1.2.1**: The system SHALL accept USDX tokens when bidders commit bids.

**REQ-1.2.2**: The system SHALL transfer USDX from bidder to contract escrow during commit.

**REQ-1.2.3**: The system SHALL store escrow amount per bidder per auction.

**REQ-1.2.4**: The system SHALL verify USDX transfer success before storing commitment.

**REQ-1.2.5**: The system SHALL reject commits if USDX transfer fails.

**REQ-1.2.6**: The system SHALL track total USDX escrowed per auction.

### 1.3 USDX Bid Reveal

**REQ-1.3.1**: The system SHALL verify revealed USDX amounts match commitments.

**REQ-1.3.2**: The system SHALL verify revealed amounts match escrowed amounts.

**REQ-1.3.3**: The system SHALL update highest USDX bid tracker during reveals.

### 1.4 USDX Winner Determination

**REQ-1.4.1**: The system SHALL determine winner based on highest USDX bid.

**REQ-1.4.2**: The system SHALL maintain O(1) complexity for USDX winner determination.

**REQ-1.4.3**: The system SHALL record winning USDX amount on-chain.

### 1.5 USDX Winner Payment

**REQ-1.5.1**: The system SHALL transfer USDX from contract to winner upon finalization.

**REQ-1.5.2**: The system SHALL mark winner's escrow as paid.

**REQ-1.5.3**: The system SHALL prevent winner from claiming refund.

**REQ-1.5.4**: The system SHALL verify USDX transfer success before marking auction as settled.

### 1.6 USDX Loser Refunds

**REQ-1.6.1**: The system SHALL allow losers to claim USDX refunds after auction settles.

**REQ-1.6.2**: The system SHALL transfer USDX from contract to loser upon refund claim.

**REQ-1.6.3**: The system SHALL mark escrow as refunded after successful claim.

**REQ-1.6.4**: The system SHALL prevent double refunds.

**REQ-1.6.5**: The system SHALL prevent winner from claiming refund.

**REQ-1.6.6**: The system SHALL allow refunds only after auction is settled.

## 2. Non-Functional Requirements

### 2.1 Security

**REQ-2.1.1**: The system SHALL hold USDX tokens securely in contract escrow.

**REQ-2.1.2**: The system SHALL prevent unauthorized withdrawal of escrowed USDX.

**REQ-2.1.3**: The system SHALL track exact escrow amounts per bidder.

**REQ-2.1.4**: The system SHALL verify all USDX transfers before state changes.

**REQ-2.1.5**: The system SHALL handle USDX transfer failures gracefully.

### 2.2 Gas Efficiency

**REQ-2.2.1**: The system SHALL use manual refund claims to minimize gas costs.

**REQ-2.2.2**: The system SHALL NOT auto-refund all losers (too expensive).

**REQ-2.2.3**: The system SHALL batch-friendly for parallel commits and reveals.

### 2.3 Compatibility

**REQ-2.3.1**: The system SHALL integrate with test_usdcx_stablecoin.aleo on testnet.

**REQ-2.3.2**: The system SHALL use standard token transfer interface.

**REQ-2.3.3**: The system SHALL be compatible with V2 ALEO auction architecture.

## 3. Technical Requirements

### 3.1 Smart Contract

**REQ-3.1.1**: The system SHALL be implemented as shadowbid_marketplace_v2_usdx.aleo.

**REQ-3.1.2**: The system SHALL import test_usdcx_stablecoin.aleo.

**REQ-3.1.3**: The system SHALL use async transitions for USDX transfers.

**REQ-3.1.4**: The system SHALL use finalize functions for escrow tracking.

### 3.2 Data Storage

**REQ-3.2.1**: The system SHALL use mappings for:
- USDX auction metadata
- USDX commitments
- USDX escrow tracking
- USDX highest bid tracker

**REQ-3.2.2**: The system SHALL store escrow amounts as u64 (USDX microcredits).

### 3.3 External Integration

**REQ-3.3.1**: The system SHALL call test_usdcx_stablecoin.aleo/transfer_public for transfers.

**REQ-3.3.2**: The system SHALL await transfer futures before proceeding.

**REQ-3.3.3**: The system SHALL handle transfer errors with assertions.

## 4. Interface Requirements

### 4.1 Smart Contract Transitions

**REQ-4.1.1**: The system SHALL provide create_auction transition accepting min_bid_usdx.

**REQ-4.1.2**: The system SHALL provide commit_bid transition accepting USDXRecord.

**REQ-4.1.3**: The system SHALL provide claim_refund transition for losers.

**REQ-4.1.4**: The system SHALL provide finalize_winner transition with USDX transfer.

### 4.2 Frontend Interface

**REQ-4.2.1**: The frontend SHALL allow users to select USDX as auction currency.

**REQ-4.2.2**: The frontend SHALL display USDX amounts in human-readable format.

**REQ-4.2.3**: The frontend SHALL show escrow status per bidder.

**REQ-4.2.4**: The frontend SHALL provide "Claim Refund" button for losers.

**REQ-4.2.5**: The frontend SHALL route USDX auctions to shadowbid_marketplace_v2_usdx.aleo.

## 5. Validation Requirements

**REQ-5.1**: The system SHALL validate USDX amounts are positive.

**REQ-5.2**: The system SHALL validate escrow exists before refund.

**REQ-5.3**: The system SHALL validate bidder is not winner before refund.

**REQ-5.4**: The system SHALL validate refund not already claimed.

**REQ-5.5**: The system SHALL validate auction is settled before refunds.

## 6. Error Handling Requirements

**REQ-6.1**: The system SHALL provide error codes:
- USDX_TRANSFER_FAILED
- ESCROW_NOT_FOUND
- ALREADY_REFUNDED
- WINNER_CANNOT_REFUND
- AUCTION_NOT_SETTLED

**REQ-6.2**: The system SHALL fail atomically on USDX transfer errors.

**REQ-6.3**: The system SHALL provide descriptive error messages.

## 7. Testing Requirements

**REQ-7.1**: The system SHALL have unit tests for all USDX transitions.

**REQ-7.2**: The system SHALL test escrow tracking accuracy.

**REQ-7.3**: The system SHALL test refund claim scenarios.

**REQ-7.4**: The system SHALL test with real test_usdcx_stablecoin.aleo on testnet.

**REQ-7.5**: The system SHALL test with 100+ USDX bidders.

## 8. Documentation Requirements

**REQ-8.1**: The system SHALL document USDX escrow mechanism.

**REQ-8.2**: The system SHALL document refund claim process.

**REQ-8.3**: The system SHALL document test_usdcx_stablecoin.aleo integration.

**REQ-8.4**: The system SHALL provide user guide for USDX auctions.

## 9. Acceptance Criteria

**AC-1**: Bidder can commit bid with USDX and see escrow balance.

**AC-2**: Winner receives USDX upon finalization.

**AC-3**: Losers can claim USDX refunds after settlement.

**AC-4**: Double refund attempts fail.

**AC-5**: Winner cannot claim refund.

**AC-6**: USDX auction supports 1000+ bidders with O(1) winner determination.
