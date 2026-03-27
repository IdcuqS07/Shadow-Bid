# Tasks: USDX Auction Integration (Phase 2)

## Phase 1: Smart Contract Implementation

### 1. Setup and Structure
- [ ] 1.1 Create shadowbid_marketplace_v2_usdx.aleo file
- [ ] 1.2 Import test_usdcx_stablecoin.aleo
- [ ] 1.3 Define USDXAuctionInfo struct
- [ ] 1.4 Define USDXEscrow struct
- [ ] 1.5 Define USDXCommitment struct
- [ ] 1.6 Create usdx_auctions mapping
- [ ] 1.7 Create usdx_escrow mapping
- [ ] 1.8 Create usdx_commitments mapping
- [ ] 1.9 Create usdx_highest_bid and usdx_highest_bidder mappings

### 2. USDX Auction Creation
- [ ] 2.1 Implement create_auction transition
- [ ] 2.2 Add validation for min_bid_usdx > 0
- [ ] 2.3 Add validation for future end_time
- [ ] 2.4 Add validation for unique auction_id
- [ ] 2.5 Implement finalize_create_auction function
- [ ] 2.6 Return AuctionRecord to seller

### 3. USDX Commit with Escrow
- [ ] 3.1 Implement commit_bid transition accepting USDXRecord
- [ ] 3.2 Add USDX transfer call to test_usdcx_stablecoin.aleo
- [ ] 3.3 Transfer USDX from bidder to contract
- [ ] 3.4 Add timing validation (before end_time)
- [ ] 3.5 Add duplicate commit prevention
- [ ] 3.6 Implement finalize_commit_bid function
- [ ] 3.7 Store commitment in usdx_commitments
- [ ] 3.8 Store escrow in usdx_escrow mapping
- [ ] 3.9 Update total_escrowed in auction
- [ ] 3.10 Verify USDX transfer success

### 4. Close Auction
- [ ] 4.1 Implement close_auction transition
- [ ] 4.2 Add seller permission check
- [ ] 4.3 Add state validation (OPEN -> CLOSED)
- [ ] 4.4 Implement finalize_close_auction function

### 5. USDX Reveal
- [ ] 5.1 Implement reveal_bid transition
- [ ] 5.2 Add timing validation (after end_time)
- [ ] 5.3 Add commitment verification (hash matching)
- [ ] 5.4 Verify revealed amount matches escrowed amount
- [ ] 5.5 Add minimum bid validation
- [ ] 5.6 Implement finalize_reveal_bid function
- [ ] 5.7 Update usdx_highest_bid if needed
- [ ] 5.8 Mark commitment as revealed

### 6. Winner Determination
- [ ] 6.1 Implement determine_winner transition
- [ ] 6.2 Add validation for at least one reveal
- [ ] 6.3 Read usdx_highest_bid and usdx_highest_bidder (O(1))
- [ ] 6.4 Implement finalize_determine_winner function
- [ ] 6.5 Update auction state to CHALLENGE
- [ ] 6.6 Set winner and winning_amount_usdx
- [ ] 6.7 Calculate challenge_end_time

### 7. Winner Finalization with USDX Transfer
- [ ] 7.1 Implement finalize_winner transition
- [ ] 7.2 Add timing validation (after challenge_end_time)
- [ ] 7.3 Add state validation (CHALLENGE -> SETTLED)
- [ ] 7.4 Call test_usdcx_stablecoin.aleo/transfer_public
- [ ] 7.5 Transfer USDX from contract to winner
- [ ] 7.6 Implement finalize_finalize_winner function
- [ ] 7.7 Mark winner in escrow (is_winner = true)
- [ ] 7.8 Update auction state to SETTLED
- [ ] 7.9 Verify USDX transfer success

### 8. Loser Refund Mechanism
- [ ] 8.1 Implement claim_refund transition
- [ ] 8.2 Add validation: auction is settled
- [ ] 8.3 Add validation: caller is not winner
- [ ] 8.4 Add validation: refund not already claimed
- [ ] 8.5 Implement finalize_claim_refund function
- [ ] 8.6 Call test_usdcx_stablecoin.aleo/transfer_public
- [ ] 8.7 Transfer USDX from contract to loser
- [ ] 8.8 Mark escrow as refunded (is_refunded = true)
- [ ] 8.9 Verify USDX transfer success

### 9. Challenge Mechanism
- [ ] 9.1 Implement challenge_winner transition
- [ ] 9.2 Add timing validation (before challenge_end_time)
- [ ] 9.3 Add commitment verification for challenger
- [ ] 9.4 Add amount comparison (must be higher)
- [ ] 9.5 Implement finalize_challenge_winner function
- [ ] 9.6 Update winner and winning_amount_usdx

## Phase 2: Testing

### 10. Unit Tests
- [ ] 10.1 Test create_auction with USDX parameters
- [ ] 10.2 Test commit_bid with USDX escrow
- [ ] 10.3 Test escrow balance tracking
- [ ] 10.4 Test reveal_bid with USDX amounts
- [ ] 10.5 Test determine_winner with USDX bids
- [ ] 10.6 Test finalize_winner with USDX transfer
- [ ] 10.7 Test claim_refund success
- [ ] 10.8 Test claim_refund already claimed (should fail)
- [ ] 10.9 Test winner claiming refund (should fail)
- [ ] 10.10 Test refund before settled (should fail)

### 11. Integration Tests
- [ ] 11.1 Test full USDX auction lifecycle
- [ ] 11.2 Test with 100 USDX bidders
- [ ] 11.3 Test with real test_usdcx_stablecoin.aleo on testnet
- [ ] 11.4 Verify all escrow amounts correct
- [ ] 11.5 Verify winner receives correct USDX
- [ ] 11.6 Verify all losers can claim refunds
- [ ] 11.7 Test USDX transfer failures
- [ ] 11.8 Test challenge scenario with USDX

### 12. Performance Tests
- [ ] 12.1 Measure commit_bid gas cost with USDX transfer
- [ ] 12.2 Measure finalize_winner gas cost with USDX transfer
- [ ] 12.3 Measure claim_refund gas cost
- [ ] 12.4 Verify O(1) winner determination with USDX
- [ ] 12.5 Test with 1000 USDX bidders

## Phase 3: Frontend Implementation

### 13. Currency Selection UI
- [ ] 13.1 Add currency selector to auction creation form
- [ ] 13.2 Add "ALEO" and "USDX" options
- [ ] 13.3 Route to appropriate contract based on selection
- [ ] 13.4 Display currency symbol in UI

### 14. USDX Auction Creation UI
- [ ] 14.1 Update auction creation form for USDX
- [ ] 14.2 Add min_bid_usdx input
- [ ] 14.3 Display USDX balance
- [ ] 14.4 Submit to shadowbid_marketplace_v2_usdx.aleo
- [ ] 14.5 Display transaction status

### 15. USDX Bid Commitment UI
- [ ] 15.1 Update bid commitment form for USDX
- [ ] 15.2 Add USDX amount input
- [ ] 15.3 Display USDX balance
- [ ] 15.4 Show escrow warning message
- [ ] 15.5 Generate commitment hash
- [ ] 15.6 Submit commit_bid with USDXRecord
- [ ] 15.7 Display escrow status

### 16. USDX Reveal UI
- [ ] 16.1 Update reveal interface for USDX
- [ ] 16.2 Retrieve stored nonce
- [ ] 16.3 Submit reveal_bid transaction
- [ ] 16.4 Display reveal status

### 17. USDX Winner Display
- [ ] 17.1 Display winning USDX amount
- [ ] 17.2 Show USDX transfer status
- [ ] 17.3 Display winner address

### 18. Refund Claim UI
- [ ] 18.1 Create "Claim Refund" button for losers
- [ ] 18.2 Check if user is loser
- [ ] 18.3 Check if refund already claimed
- [ ] 18.4 Display refund amount in USDX
- [ ] 18.5 Submit claim_refund transaction
- [ ] 18.6 Display refund status
- [ ] 18.7 Update UI after successful refund

### 19. USDX Auction Status Display
- [ ] 19.1 Display auction currency (USDX)
- [ ] 19.2 Display amounts in USDX format
- [ ] 19.3 Display escrow balance per auction
- [ ] 19.4 Display refund claim status
- [ ] 19.5 Show "Refund Available" badge for losers

### 20. Wallet Integration
- [ ] 20.1 Fetch USDX balance from wallet
- [ ] 20.2 Fetch USDX records for bidding
- [ ] 20.3 Handle USDX transfer approvals
- [ ] 20.4 Display USDX transaction history

## Phase 4: Documentation

### 21. User Documentation
- [ ] 21.1 Write USDX auction user guide
- [ ] 21.2 Document escrow mechanism
- [ ] 21.3 Document refund claim process
- [ ] 21.4 Create USDX bidding tutorial
- [ ] 21.5 Document currency selection

### 22. Developer Documentation
- [ ] 22.1 Document USDX contract architecture
- [ ] 22.2 Document escrow data structures
- [ ] 22.3 Document test_usdcx_stablecoin.aleo integration
- [ ] 22.4 Document refund mechanism
- [ ] 22.5 Create API documentation for USDX transitions

### 23. Deployment Documentation
- [ ] 23.1 Create deployment script for USDX contract
- [ ] 23.2 Document testnet deployment steps
- [ ] 23.3 Document USDX contract verification
- [ ] 23.4 Create rollback plan

## Phase 5: Deployment and Monitoring

### 24. Deployment
- [ ] 24.1 Deploy shadowbid_marketplace_v2_usdx.aleo to testnet
- [ ] 24.2 Verify deployment
- [ ] 24.3 Test deployed contract with real USDX
- [ ] 24.4 Update frontend with deployed program ID
- [ ] 24.5 Announce USDX support

### 25. Monitoring
- [ ] 25.1 Monitor USDX escrow balances
- [ ] 25.2 Monitor refund claim rate
- [ ] 25.3 Monitor USDX transfer success rate
- [ ] 25.4 Set up alerts for escrow anomalies
- [ ] 25.5 Track USDX auction creation rate

### 26. Security Audit
- [ ] 26.1 Internal code review for escrow logic
- [ ] 26.2 Verify escrow accounting
- [ ] 26.3 Test refund edge cases
- [ ] 26.4 External security audit (recommended)
- [ ] 26.5 Address audit findings
