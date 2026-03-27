# Requirements Document: Scalable Sealed-Bid Auction V2

## 1. Functional Requirements

### 1.1 Auction Creation

**REQ-1.1.1**: The system SHALL allow sellers to create auctions with the following parameters:
- Unique auction identifier (u64)
- Minimum bid amount (u64, in microcredits)
- Auction end time (i64, Unix timestamp)
- Challenge period duration (i64, in seconds)

**REQ-1.1.2**: The system SHALL validate that the auction end time is in the future at creation time.

**REQ-1.1.3**: The system SHALL validate that the challenge period is positive (recommended: 86400 seconds = 24 hours).

**REQ-1.1.4**: The system SHALL prevent creation of auctions with duplicate auction identifiers.

**REQ-1.1.5**: The system SHALL issue an AuctionRecord to the seller upon successful auction creation.

**REQ-1.1.6**: The system SHALL store auction metadata on-chain in the auctions mapping.

### 1.2 Bid Commitment (Sealed Phase)

**REQ-1.2.1**: The system SHALL allow bidders to commit bids during the commit phase (before end_time).

**REQ-1.2.2**: The system SHALL accept bid commitments as cryptographic hashes (field type).

**REQ-1.2.3**: The system SHALL store commitments on-chain with the following information:
- Bidder address
- Commitment hash
- Commitment timestamp
- Reveal status (initially false)

**REQ-1.2.4**: The system SHALL prevent bidders from committing multiple times for the same auction.

**REQ-1.2.5**: The system SHALL reject commitments submitted after the auction end_time.

**REQ-1.2.6**: The system SHALL NOT reveal bid amounts during the commit phase.

### 1.3 Auction Closing

**REQ-1.3.1**: The system SHALL allow the seller to close the auction.

**REQ-1.3.2**: The system SHALL transition the auction state from OPEN to CLOSED.

**REQ-1.3.3**: The system SHALL enforce that only the seller can close their auction.

**REQ-1.3.4**: The system SHALL prevent closing an already closed auction.


### 1.4 Bid Reveal

**REQ-1.4.1**: The system SHALL allow bidders to reveal their bids after the auction closes.

**REQ-1.4.2**: The system SHALL verify that revealed amounts match the stored commitment hash.

**REQ-1.4.3**: The system SHALL reject reveals that do not match the commitment.

**REQ-1.4.4**: The system SHALL reject reveals submitted before the auction end_time.

**REQ-1.4.5**: The system SHALL enforce that revealed amounts meet the minimum bid requirement.

**REQ-1.4.6**: The system SHALL prevent bidders from revealing multiple times.

**REQ-1.4.7**: The system SHALL update the highest bid tracker if the revealed amount exceeds the current highest.

**REQ-1.4.8**: The system SHALL mark commitments as revealed after successful reveal.

### 1.5 Winner Determination

**REQ-1.5.1**: The system SHALL allow the seller to determine the winner after the reveal period.

**REQ-1.5.2**: The system SHALL determine the winner in O(1) time complexity (single transaction).

**REQ-1.5.3**: The system SHALL select the bidder with the highest revealed bid as the winner.

**REQ-1.5.4**: The system SHALL reject winner determination if no bids have been revealed.

**REQ-1.5.5**: The system SHALL transition the auction state from CLOSED to CHALLENGE.

**REQ-1.5.6**: The system SHALL record the winner's address and winning amount on-chain.

**REQ-1.5.7**: The system SHALL start the challenge period timer upon winner determination.

### 1.6 Challenge Mechanism

**REQ-1.6.1**: The system SHALL allow bidders to challenge the declared winner during the challenge period.

**REQ-1.6.2**: The system SHALL verify that the challenger has a revealed bid.

**REQ-1.6.3**: The system SHALL verify that the challenger's bid is higher than the current winning amount.

**REQ-1.6.4**: The system SHALL update the winner if the challenge is valid.

**REQ-1.6.5**: The system SHALL reject challenges submitted after the challenge period expires.

**REQ-1.6.6**: The system SHALL optionally extend the challenge period when a valid challenge is accepted.

**REQ-1.6.7**: The system SHALL verify the challenger's commitment matches their revealed amount.

### 1.7 Winner Finalization

**REQ-1.7.1**: The system SHALL allow the seller to finalize the winner after the challenge period expires.

**REQ-1.7.2**: The system SHALL reject finalization before the challenge period expires.

**REQ-1.7.3**: The system SHALL transition the auction state from CHALLENGE to SETTLED.

**REQ-1.7.4**: The system SHALL create a WinnerRecord and transfer it to the winning bidder.

**REQ-1.7.5**: The system SHALL record the finalization timestamp.

**REQ-1.7.6**: The system SHALL prevent further modifications to the auction after finalization.


## 2. Non-Functional Requirements

### 2.1 Performance

**REQ-2.1.1**: The system SHALL support at least 1000 bidders per auction.

**REQ-2.1.2**: The winner determination operation SHALL complete in a single transaction regardless of bid count.

**REQ-2.1.3**: The winner determination operation SHALL have O(1) time complexity.

**REQ-2.1.4**: The system SHALL complete winner determination in approximately 15 seconds (one block time).

**REQ-2.1.5**: The total cost for resolving an auction with 1000 bids SHALL NOT exceed 1 Aleo credit for the winner determination transaction.

### 2.2 Scalability

**REQ-2.2.1**: The system SHALL scale to support 10,000+ bidders without degradation in winner determination performance.

**REQ-2.2.2**: The system SHALL use on-chain mappings for efficient bid storage and retrieval.

**REQ-2.2.3**: The system SHALL track the highest bid incrementally during reveals to avoid iteration during winner determination.

**REQ-2.2.4**: The storage cost per bidder SHALL NOT exceed 0.001 Aleo credits.

### 2.3 Security

**REQ-2.3.1**: The system SHALL maintain bid privacy during the commit phase using cryptographic commitments.

**REQ-2.3.2**: The system SHALL use collision-resistant hash functions (Poseidon) for commitments.

**REQ-2.3.3**: The system SHALL prevent bidders from changing their bid after committing (commitment binding).

**REQ-2.3.4**: The system SHALL resist front-running attacks through the sealed-bid design.

**REQ-2.3.5**: The system SHALL ensure censorship resistance through permissionless on-chain transactions.

**REQ-2.3.6**: The system SHALL validate all state transitions with cryptographic proofs.

**REQ-2.3.7**: The system SHALL provide at least 128-bit security for commitment schemes.

### 2.4 Usability

**REQ-2.4.1**: The system SHALL use Unix timestamps (i64) for all time-based logic.

**REQ-2.4.2**: The system SHALL display timestamps in human-readable format (e.g., "Jan 1, 2025 12:00 PM UTC").

**REQ-2.4.3**: The system SHALL express challenge periods in hours or days (e.g., 24 hours = 86400 seconds).

**REQ-2.4.4**: The system SHALL provide clear error messages for all failure scenarios.

**REQ-2.4.5**: The frontend SHALL convert timestamps to the user's local timezone for display.

### 2.5 Reliability

**REQ-2.5.1**: The system SHALL ensure atomic state transitions (all-or-nothing).

**REQ-2.5.2**: The system SHALL maintain consistency across all on-chain mappings.

**REQ-2.5.3**: The system SHALL handle network failures gracefully with appropriate error messages.

**REQ-2.5.4**: The system SHALL prevent partial auction states (e.g., winner set but state not updated).

### 2.6 Maintainability

**REQ-2.6.1**: The smart contract code SHALL be well-documented with inline comments.

**REQ-2.6.2**: The system SHALL follow Leo language best practices and conventions.

**REQ-2.6.3**: The system SHALL provide comprehensive test coverage (95%+ line coverage).

**REQ-2.6.4**: The system SHALL include property-based tests for critical correctness properties.


## 3. Technical Requirements

### 3.1 Smart Contract Platform

**REQ-3.1.1**: The system SHALL be implemented in Leo programming language version 1.11.0 or higher.

**REQ-3.1.2**: The system SHALL be deployed on the Aleo blockchain testnet.

**REQ-3.1.3**: The system SHALL use async transitions for state-modifying operations.

**REQ-3.1.4**: The system SHALL use finalize functions for on-chain state updates.

### 3.2 Data Storage

**REQ-3.2.1**: The system SHALL use mappings for on-chain storage of:
- Auction metadata (auctions mapping)
- Bid commitments (commitments mapping)
- Highest bid tracker (highest_bid and highest_bidder mappings)

**REQ-3.2.2**: The system SHALL use records for:
- Auction receipts (AuctionRecord)
- Winner certificates (WinnerRecord)

**REQ-3.2.3**: The system SHALL NOT use dynamic arrays (Leo limitation).

### 3.3 Cryptography

**REQ-3.3.1**: The system SHALL use the Poseidon hash function for bid commitments.

**REQ-3.3.2**: The commitment scheme SHALL be: `hash(amount || nonce || bidder_address)`.

**REQ-3.3.3**: The nonce SHALL be a cryptographically secure random field element.

**REQ-3.3.4**: The system SHALL ensure commitment binding through hash collision resistance.

**REQ-3.3.5**: The system SHALL ensure commitment hiding through hash preimage resistance.

### 3.4 Timing

**REQ-3.4.1**: The system SHALL use `block.timestamp` (i64) for all timing checks.

**REQ-3.4.2**: The system SHALL NOT use block height for timing.

**REQ-3.4.3**: The system SHALL support timestamps from Unix epoch (1970) to year 2262.

**REQ-3.4.4**: The system SHALL use second precision for timestamps (not milliseconds).

**REQ-3.4.5**: The system SHALL account for blockchain timestamp drift (±15 minutes).

### 3.5 State Machine

**REQ-3.5.1**: The system SHALL implement the following auction states:
- OPEN (0): Accepting commitments
- CLOSED (1): Accepting reveals
- CHALLENGE (2): Challenge period active
- SETTLED (3): Auction finalized

**REQ-3.5.2**: The system SHALL enforce state transitions in order: OPEN → CLOSED → CHALLENGE → SETTLED.

**REQ-3.5.3**: The system SHALL prevent invalid state transitions.

**REQ-3.5.4**: The system SHALL store the current state on-chain in the AuctionInfo struct.

### 3.6 Gas Optimization

**REQ-3.6.1**: The system SHALL minimize finalize function complexity to reduce gas costs.

**REQ-3.6.2**: The system SHALL use efficient data structures (mappings over records for lookups).

**REQ-3.6.3**: The system SHALL avoid unnecessary on-chain storage.

**REQ-3.6.4**: The system SHALL batch-friendly design (parallel commits and reveals).


## 4. Interface Requirements

### 4.1 Smart Contract Transitions

**REQ-4.1.1**: The system SHALL provide a `create_auction` transition with parameters:
- auction_id (u64)
- min_bid (u64)
- end_time (i64)
- challenge_period (i64)

**REQ-4.1.2**: The system SHALL provide a `commit_bid` transition with parameters:
- auction_id (u64)
- commitment (field)

**REQ-4.1.3**: The system SHALL provide a `close_auction` transition with parameter:
- auction_id (u64)

**REQ-4.1.4**: The system SHALL provide a `reveal_bid` transition with parameters:
- auction_id (u64)
- amount (u64, private)
- nonce (field, private)

**REQ-4.1.5**: The system SHALL provide a `determine_winner` transition with parameter:
- auction_id (u64)

**REQ-4.1.6**: The system SHALL provide a `challenge_winner` transition with parameters:
- auction_id (u64)
- my_bid_amount (u64, private)
- my_nonce (field, private)

**REQ-4.1.7**: The system SHALL provide a `finalize_winner` transition with parameter:
- auction_id (u64)

### 4.2 Frontend Interface

**REQ-4.2.1**: The frontend SHALL provide a form to create auctions with:
- Auction ID input
- Minimum bid input (in Aleo credits)
- End time picker (date and time)
- Challenge period selector (hours/days)

**REQ-4.2.2**: The frontend SHALL provide a form to commit bids with:
- Auction ID selector
- Bid amount input (in Aleo credits)
- Automatic nonce generation
- Commitment hash display

**REQ-4.2.3**: The frontend SHALL provide a reveal interface with:
- Auction ID selector
- Automatic retrieval of stored nonce
- One-click reveal button

**REQ-4.2.4**: The frontend SHALL provide a winner determination interface with:
- Auction ID selector
- Current highest bid display
- One-click determine winner button

**REQ-4.2.5**: The frontend SHALL provide a challenge interface with:
- Auction ID selector
- Current winner display
- Challenge submission button (if user has higher bid)

**REQ-4.2.6**: The frontend SHALL display auction status including:
- Current state (OPEN/CLOSED/CHALLENGE/SETTLED)
- Time remaining until end_time
- Time remaining in challenge period
- Number of commitments
- Number of reveals

### 4.3 Data Display

**REQ-4.3.1**: The frontend SHALL display timestamps in user's local timezone.

**REQ-4.3.2**: The frontend SHALL display amounts in Aleo credits (not microcredits).

**REQ-4.3.3**: The frontend SHALL display auction state as human-readable text.

**REQ-4.3.4**: The frontend SHALL display countdown timers for active phases.

**REQ-4.3.5**: The frontend SHALL display transaction status and confirmation.


## 5. Data Requirements

### 5.1 Auction Data

**REQ-5.1.1**: Each auction SHALL store:
- Unique identifier (u64)
- Seller address
- Minimum bid amount (u64)
- End time (i64, Unix timestamp)
- Challenge period duration (i64, seconds)
- Current state (u8: 0-3)
- Winner address (set during CHALLENGE state)
- Winning amount (u64, set during CHALLENGE state)
- Challenge end time (i64, set during CHALLENGE state)

**REQ-5.1.2**: Auction data SHALL be immutable after creation except for state transitions.

**REQ-5.1.3**: Auction data SHALL be publicly readable on-chain.

### 5.2 Commitment Data

**REQ-5.2.1**: Each commitment SHALL store:
- Bidder address
- Commitment hash (field)
- Reveal status (bool)
- Revealed amount (u64, only after reveal)
- Commitment timestamp (i64)

**REQ-5.2.2**: Commitments SHALL be indexed by hash(auction_id || bidder_address).

**REQ-5.2.3**: Commitment hashes SHALL be publicly readable.

**REQ-5.2.4**: Revealed amounts SHALL be publicly readable after reveal.

### 5.3 Highest Bid Tracking

**REQ-5.3.1**: The system SHALL maintain:
- highest_bid mapping: auction_id → amount
- highest_bidder mapping: auction_id → address

**REQ-5.3.2**: These mappings SHALL be updated during each reveal if the new bid is higher.

**REQ-5.3.3**: These mappings SHALL be publicly readable.

### 5.4 Record Data

**REQ-5.4.1**: AuctionRecord SHALL contain:
- Owner (seller address)
- Auction ID
- Minimum bid
- End time
- Challenge period

**REQ-5.4.2**: WinnerRecord SHALL contain:
- Owner (winner address)
- Auction ID
- Winning amount
- Finalization timestamp

**REQ-5.4.3**: Records SHALL be private to their owners.

## 6. Validation Requirements

### 6.1 Input Validation

**REQ-6.1.1**: The system SHALL validate that auction_id is unique before creation.

**REQ-6.1.2**: The system SHALL validate that min_bid is greater than 0.

**REQ-6.1.3**: The system SHALL validate that end_time is in the future.

**REQ-6.1.4**: The system SHALL validate that challenge_period is positive.

**REQ-6.1.5**: The system SHALL validate that commitment is a valid field element.

**REQ-6.1.6**: The system SHALL validate that revealed amount matches commitment.

**REQ-6.1.7**: The system SHALL validate that revealed amount meets minimum bid.

### 6.2 State Validation

**REQ-6.2.1**: The system SHALL validate auction state before each operation.

**REQ-6.2.2**: The system SHALL validate timing constraints before each operation.

**REQ-6.2.3**: The system SHALL validate caller permissions before privileged operations.

**REQ-6.2.4**: The system SHALL validate that auctions exist before operations.

### 6.3 Cryptographic Validation

**REQ-6.3.1**: The system SHALL validate commitment hashes during reveal.

**REQ-6.3.2**: The system SHALL validate that hash(amount || nonce || bidder) equals stored commitment.

**REQ-6.3.3**: The system SHALL validate challenge commitments before updating winner.


## 7. Error Handling Requirements

**REQ-7.1**: The system SHALL provide specific error codes for each failure scenario:
- AUCTION_ALREADY_EXISTS
- AUCTION_CLOSED
- INVALID_REVEAL
- AUCTION_STILL_OPEN
- NO_BIDS_REVEALED
- CHALLENGE_PERIOD_ACTIVE
- CHALLENGE_NOT_HIGHER
- CHALLENGE_PERIOD_EXPIRED
- ALREADY_COMMITTED
- BELOW_MINIMUM_BID

**REQ-7.2**: The system SHALL fail transactions atomically (no partial state changes).

**REQ-7.3**: The system SHALL provide descriptive error messages for debugging.

**REQ-7.4**: The frontend SHALL display user-friendly error messages.

**REQ-7.5**: The system SHALL log errors for monitoring and debugging.

## 8. Testing Requirements

### 8.1 Unit Testing

**REQ-8.1.1**: The system SHALL have unit tests for all transitions.

**REQ-8.1.2**: The system SHALL achieve 95%+ line coverage.

**REQ-8.1.3**: The system SHALL achieve 100% branch coverage for critical paths.

**REQ-8.1.4**: The system SHALL test all error scenarios.

**REQ-8.1.5**: The system SHALL test boundary conditions (e.g., exactly at end_time).

### 8.2 Property-Based Testing

**REQ-8.2.1**: The system SHALL test the following properties:
- Winner correctness (highest bid wins)
- Commitment binding (cannot change bid)
- Commitment hiding (amounts private during commit phase)
- Timing enforcement (state transitions at correct times)
- Scalability (O(1) winner determination)
- Challenge correctness (valid challenges update winner)
- No double bidding (one commit per bidder)
- Minimum bid enforcement (all reveals meet minimum)

**REQ-8.2.2**: The system SHALL use property-based testing library (fast-check or equivalent).

**REQ-8.2.3**: The system SHALL generate random test inputs for property verification.

### 8.3 Integration Testing

**REQ-8.3.1**: The system SHALL test full auction lifecycle on testnet.

**REQ-8.3.2**: The system SHALL test with 1000 simulated bidders.

**REQ-8.3.3**: The system SHALL test challenge scenarios.

**REQ-8.3.4**: The system SHALL test edge cases (single bidder, no reveals, etc.).

**REQ-8.3.5**: The system SHALL test timestamp edge cases.

### 8.4 Performance Testing

**REQ-8.4.1**: The system SHALL measure winner determination transaction time.

**REQ-8.4.2**: The system SHALL verify O(1) complexity with varying bid counts.

**REQ-8.4.3**: The system SHALL measure gas costs for all operations.

**REQ-8.4.4**: The system SHALL verify scalability targets (1000, 10000, 100000 bidders).

## 9. Documentation Requirements

**REQ-9.1**: The system SHALL provide comprehensive inline code documentation.

**REQ-9.2**: The system SHALL provide user documentation explaining:
- How to create auctions
- How to commit bids
- How to reveal bids
- How to challenge winners
- Timestamp format and timezone handling

**REQ-9.3**: The system SHALL provide developer documentation explaining:
- Smart contract architecture
- State machine transitions
- Commitment scheme
- Gas optimization strategies

**REQ-9.4**: The system SHALL provide API documentation for all transitions.

**REQ-9.5**: The system SHALL provide migration guide from V1 to V2.

## 10. Deployment Requirements

**REQ-10.1**: The system SHALL be deployed on Aleo testnet before mainnet.

**REQ-10.2**: The system SHALL undergo security audit before mainnet deployment.

**REQ-10.3**: The system SHALL have deployment scripts for reproducible deployments.

**REQ-10.4**: The system SHALL have rollback plan in case of critical issues.

**REQ-10.5**: The system SHALL maintain separate V1 and V2 contracts (no backward compatibility).

## 11. Monitoring Requirements

**REQ-11.1**: The system SHOULD provide monitoring for:
- Auction creation rate
- Bid commitment rate
- Reveal rate
- Challenge frequency
- Winner determination success rate

**REQ-11.2**: The system SHOULD alert on anomalies:
- Unusually high challenge rate
- Failed winner determinations
- Timestamp manipulation attempts

**REQ-11.3**: The system SHOULD track performance metrics:
- Transaction times
- Gas costs
- Scalability metrics

## 12. Acceptance Criteria

**AC-1**: An auction with 1000 bidders can be resolved in 1 transaction (determine_winner).

**AC-2**: Winner determination completes in approximately 15 seconds regardless of bid count.

**AC-3**: Timestamps are displayed in human-readable format (e.g., "Jan 1, 2025 12:00 PM").

**AC-4**: Challenge periods are specified in hours/days (e.g., 24 hours).

**AC-5**: Bid amounts remain private during commit phase.

**AC-6**: Winner is always the highest revealed bidder (verified by challenge mechanism).

**AC-7**: All state transitions enforce timing constraints using block.timestamp.

**AC-8**: System supports at least 1000 bidders with O(1) winner determination.

**AC-9**: Total cost for 1000-bidder auction resolution is approximately 1 Aleo credit (winner determination only).

**AC-10**: Challenge mechanism successfully detects and corrects incorrect winner declarations.

## 13. Constraints

**CONSTRAINT-1**: Leo language does not support dynamic arrays; must use alternative data structures.

**CONSTRAINT-2**: Leo language does not support floating-point numbers; must use integer microcredits.

**CONSTRAINT-3**: Blockchain timestamp can drift ±15 minutes; must use sufficiently long challenge periods.

**CONSTRAINT-4**: Finalize functions have limited operations; must keep logic simple.

**CONSTRAINT-5**: No backward compatibility with V1; separate contract deployment required.

## 14. Assumptions

**ASSUMPTION-1**: Bidders will store their nonces securely off-chain for reveal phase.

**ASSUMPTION-2**: Bidders will monitor challenge period to detect incorrect winner declarations.

**ASSUMPTION-3**: Blockchain consensus ensures timestamp validity within acceptable drift.

**ASSUMPTION-4**: Cryptographic hash function (Poseidon) provides 128-bit security.

**ASSUMPTION-5**: Aleo testnet is available and stable for testing.

**ASSUMPTION-6**: Users have access to Aleo-compatible wallets.

## 15. Dependencies

**DEP-1**: Leo language v1.11.0 or higher

**DEP-2**: Aleo SDK (latest version)

**DEP-3**: Aleo testnet access

**DEP-4**: Aleo wallet SDK for frontend

**DEP-5**: Date/time library (date-fns or dayjs) for timestamp conversion

**DEP-6**: React v18.0+ for frontend

**DEP-7**: Property-based testing library (fast-check or equivalent)

## 16. Success Metrics

**METRIC-1**: Winner determination transaction count: 1 (regardless of bid count)

**METRIC-2**: Winner determination time: ~15 seconds

**METRIC-3**: Maximum supported bidders: 10,000+

**METRIC-4**: Test coverage: 95%+ line coverage

**METRIC-5**: Challenge success rate: 100% for valid challenges

**METRIC-6**: User satisfaction: Positive feedback on timestamp usability

**METRIC-7**: Gas cost reduction: 99%+ compared to V1 (for 1000 bidders)
