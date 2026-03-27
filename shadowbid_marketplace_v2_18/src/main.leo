// ShadowBid Marketplace V2.18 — Private Transactions Support
// Foundation: Aleo blockchain with ZK proofs
// Currency: Aleo Credits (native) OR USDCx stablecoin (ARC-21 token)
// Architecture: Commit-reveal pattern with O(1) winner determination
// NEW in V2.18: Hybrid privacy model (Private → Public → Private)

import credits.aleo;
import test_usdcx_stablecoin.aleo;
import test_usad_stablecoin.aleo;

program shadowbid_marketplace_v2_18.aleo {

    // -------------------------
    // Constants
    // -------------------------
    
    // Auction states
    const OPEN: u8 = 0u8;
    const CLOSED: u8 = 1u8;
    const CHALLENGE: u8 = 2u8;
    const SETTLED: u8 = 3u8;
    const CANCELLED: u8 = 4u8;

    // Currency types
    const CURRENCY_USDX: u8 = 0u8;
    const CURRENCY_ALEO: u8 = 1u8;
    const CURRENCY_USAD: u8 = 2u8;

    // Asset categories (for RWA settlement timeouts)
    const ASSET_PHYSICAL_GOODS: u8 = 0u8;           // 14 days timeout
    const ASSET_COLLECTIBLES: u8 = 1u8;             // 21 days timeout
    const ASSET_REAL_ESTATE: u8 = 2u8;              // 90 days timeout
    const ASSET_DIGITAL_ASSETS: u8 = 3u8;           // 3 days timeout
    const ASSET_SERVICES: u8 = 4u8;                 // 30 days timeout
    const ASSET_TICKETS_EVENTS: u8 = 5u8;           // 7 days timeout
    const ASSET_VEHICLES: u8 = 6u8;                 // 30 days timeout
    const ASSET_INTELLECTUAL_PROPERTY: u8 = 7u8;    // 90 days timeout

    // -------------------------
    // Records
    // -------------------------

    // Auction receipt — owner is the SELLER
    record AuctionRecord {
        owner: address,           // Seller
        auction_id: field,        // Auction ID as field
        min_bid_amount: u128,     // Minimum bid (generic for both currencies)
        currency_type: u8,        // 0=USDCx, 1=Aleo
        end_time: i64,           // Unix timestamp
        challenge_period: i64    // Duration in seconds
    }

    // Winner certificate — transferred to winner after finalization
    record WinnerRecord {
        owner: address,              // Winner (bidder)
        auction_id: field,           // Auction ID as field
        winning_amount: u128,        // Winning bid amount
        currency_type: u8,           // Currency used
        finalized_at: i64            // Timestamp when finalized
    }

    // -------------------------
    // Structs
    // -------------------------

    // Auction metadata stored on-chain
    struct AuctionInfo {
        seller: address,
        min_bid_amount: u128,        // Generic (works for both currencies)
        currency_type: u8,            // 0=USDCx, 1=Aleo
        end_time: i64,
        challenge_period: i64,
        state: u8,                    // 0=OPEN, 1=CLOSED, 2=CHALLENGE, 3=SETTLED, 4=CANCELLED
        winner: address,
        winning_amount: u128,         // Generic (works for both currencies)
        challenge_end_time: i64,
        total_escrowed: u128,         // Generic (works for both currencies)
        asset_type: u8,               // Asset category (0-7)
        item_received: bool,          // Winner confirmed receipt
        item_received_at: i64,        // Timestamp
        payment_claimed: bool,        // Seller claimed payment
        payment_claimed_at: i64,      // Timestamp
        confirmation_timeout: i64     // Timeout based on asset type
    }

    // Bid commitment for commit-reveal pattern
    struct BidCommitment {
        bidder: address,
        commitment: field,           // hash(amount || nonce || bidder)
        is_revealed: bool,
        revealed_amount: u128,       // Generic (works for both currencies)
        timestamp: i64
    }

    // Generic escrow tracking (works for both Aleo and USDCx)
    struct Escrow {
        bidder: address,
        amount: u128,                // Generic (u64 Aleo fits in u128)
        is_refunded: bool,
        is_winner: bool
    }

    // -------------------------
    // Mappings (On-Chain Storage)
    // -------------------------

    // Auction metadata: auction_id => AuctionInfo
    mapping auctions: field => AuctionInfo;

    // Bid commitments: bid_key => BidCommitment
    mapping commitments: field => BidCommitment;

    // Generic escrow: bid_key => Escrow
    mapping escrow: field => Escrow;

    // Highest bid tracker
    mapping highest_bid: field => u128;
    mapping highest_bidder: field => address;

    // -------------------------
    // 1. Create Auction
    // -------------------------

    async transition create_auction(
        public auction_id: field,
        public min_bid_amount: u128,
        public currency_type: u8,     // 0=USDCx, 1=Aleo
        public asset_type: u8,        // NEW: Asset category (0-7)
        public end_time: i64,
        public challenge_period: i64
    ) -> (AuctionRecord, Future) {
        
        // Validate currency type
        assert(currency_type == CURRENCY_USDX || currency_type == CURRENCY_ALEO || currency_type == CURRENCY_USAD);
        
        // Validate asset type
        assert(asset_type <= 7u8);
        
        // Create auction receipt for seller
        let receipt: AuctionRecord = AuctionRecord {
            owner: self.signer,
            auction_id,
            min_bid_amount,
            currency_type,
            end_time,
            challenge_period
        };

        return (receipt, finalize_create_auction(
            auction_id,
            self.signer,
            min_bid_amount,
            currency_type,
            asset_type,
            end_time,
            challenge_period
        ));
    }

    async function finalize_create_auction(
        auction_id: field,
        seller: address,
        min_bid_amount: u128,
        currency_type: u8,
        asset_type: u8,
        end_time: i64,
        challenge_period: i64
    ) {
        assert(!Mapping::contains(auctions, auction_id));
        assert(min_bid_amount > 0u128);
        assert(challenge_period > 0i64);
        
        // Calculate confirmation timeout based on asset type using ternary operators
        let timeout: i64 = asset_type == ASSET_PHYSICAL_GOODS ? 1209600i64 :
                          asset_type == ASSET_COLLECTIBLES ? 1814400i64 :
                          asset_type == ASSET_REAL_ESTATE ? 7776000i64 :
                          asset_type == ASSET_DIGITAL_ASSETS ? 259200i64 :
                          asset_type == ASSET_SERVICES ? 2592000i64 :
                          asset_type == ASSET_TICKETS_EVENTS ? 604800i64 :
                          asset_type == ASSET_VEHICLES ? 2592000i64 :
                          7776000i64;  // ASSET_INTELLECTUAL_PROPERTY default
        
        Mapping::set(auctions, auction_id, AuctionInfo {
            seller,
            min_bid_amount,
            currency_type,
            end_time,
            challenge_period,
            state: OPEN,
            winner: aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc,
            winning_amount: 0u128,
            challenge_end_time: 0i64,
            total_escrowed: 0u128,
            asset_type,
            item_received: false,
            item_received_at: 0i64,
            payment_claimed: false,
            payment_claimed_at: 0i64,
            confirmation_timeout: timeout
        });
    }

    // -------------------------
    // 1b. Cancel Auction
    // -------------------------
    
    async transition cancel_auction(
        public auction_id: field
    ) -> Future {
        return finalize_cancel_auction(auction_id, self.signer);
    }

    async function finalize_cancel_auction(
        auction_id: field,
        caller: address
    ) {
        let auction: AuctionInfo = Mapping::get(auctions, auction_id);
        
        assert_eq(auction.seller, caller);
        assert_eq(auction.state, OPEN);
        assert_eq(auction.total_escrowed, 0u128);
        
        let cancelled_auction: AuctionInfo = AuctionInfo {
            seller: auction.seller,
            min_bid_amount: auction.min_bid_amount,
            currency_type: auction.currency_type,
            end_time: auction.end_time,
            challenge_period: auction.challenge_period,
            state: CANCELLED,
            winner: auction.winner,
            winning_amount: auction.winning_amount,
            challenge_end_time: auction.challenge_end_time,
            total_escrowed: auction.total_escrowed,
            asset_type: auction.asset_type,
            item_received: auction.item_received,
            item_received_at: auction.item_received_at,
            payment_claimed: auction.payment_claimed,
            payment_claimed_at: auction.payment_claimed_at,
            confirmation_timeout: auction.confirmation_timeout
        };
        
        Mapping::set(auctions, auction_id, cancelled_auction);
    }

    // -------------------------
    // 2a. Commit Bid - USDCx (Existing)
    // -------------------------

    async transition commit_bid(
        public auction_id: field,
        public commitment: field,
        public amount_usdx: u128
    ) -> Future {
        let transfer_future: Future = test_usdcx_stablecoin.aleo/transfer_public_as_signer(
            shadowbid_marketplace_v2_18.aleo,
            amount_usdx
        );
        
        return finalize_commit_bid(auction_id, commitment, self.signer, amount_usdx, transfer_future);
    }

    async function finalize_commit_bid(
        auction_id: field,
        commitment: field,
        bidder: address,
        amount_usdx: u128,
        transfer_future: Future
    ) {
        transfer_future.await();
        
        let auction: AuctionInfo = Mapping::get(auctions, auction_id);
        
        // Verify auction uses USDCx currency
        assert_eq(auction.currency_type, CURRENCY_USDX);
        assert_eq(auction.state, OPEN);
        
        let bid_key: field = auction_id + BHP256::hash_to_field(bidder);
        
        Mapping::set(commitments, bid_key, BidCommitment {
            bidder,
            commitment,
            is_revealed: false,
            revealed_amount: 0u128,
            timestamp: 0i64
        });
        
        Mapping::set(escrow, bid_key, Escrow {
            bidder,
            amount: amount_usdx,
            is_refunded: false,
            is_winner: false
        });
        
        let updated_auction: AuctionInfo = AuctionInfo {
            seller: auction.seller,
            min_bid_amount: auction.min_bid_amount,
            currency_type: auction.currency_type,
            end_time: auction.end_time,
            challenge_period: auction.challenge_period,
            state: auction.state,
            winner: auction.winner,
            winning_amount: auction.winning_amount,
            challenge_end_time: auction.challenge_end_time,
            total_escrowed: auction.total_escrowed + amount_usdx,
            asset_type: auction.asset_type,
            item_received: auction.item_received,
            item_received_at: auction.item_received_at,
            payment_claimed: auction.payment_claimed,
            payment_claimed_at: auction.payment_claimed_at,
            confirmation_timeout: auction.confirmation_timeout
        };
        Mapping::set(auctions, auction_id, updated_auction);
    }

    // -------------------------
    // 2a2. Commit Bid - USAD (Public)
    // -------------------------

    async transition commit_bid_usad(
        public auction_id: field,
        public commitment: field,
        public amount_usad: u128
    ) -> Future {
        let transfer_future: Future = test_usad_stablecoin.aleo/transfer_public_as_signer(
            shadowbid_marketplace_v2_18.aleo,
            amount_usad
        );
        
        return finalize_commit_bid_usad(auction_id, commitment, self.signer, amount_usad, transfer_future);
    }

    async function finalize_commit_bid_usad(
        auction_id: field,
        commitment: field,
        bidder: address,
        amount_usad: u128,
        transfer_future: Future
    ) {
        transfer_future.await();
        
        let auction: AuctionInfo = Mapping::get(auctions, auction_id);
        
        // Verify auction uses USAD currency
        assert_eq(auction.currency_type, CURRENCY_USAD);
        assert_eq(auction.state, OPEN);
        
        let bid_key: field = auction_id + BHP256::hash_to_field(bidder);
        
        Mapping::set(commitments, bid_key, BidCommitment {
            bidder,
            commitment,
            is_revealed: false,
            revealed_amount: 0u128,
            timestamp: 0i64
        });
        
        Mapping::set(escrow, bid_key, Escrow {
            bidder,
            amount: amount_usad,
            is_refunded: false,
            is_winner: false
        });
        
        let updated_auction: AuctionInfo = AuctionInfo {
            seller: auction.seller,
            min_bid_amount: auction.min_bid_amount,
            currency_type: auction.currency_type,
            end_time: auction.end_time,
            challenge_period: auction.challenge_period,
            state: auction.state,
            winner: auction.winner,
            winning_amount: auction.winning_amount,
            challenge_end_time: auction.challenge_end_time,
            total_escrowed: auction.total_escrowed + amount_usad,
            asset_type: auction.asset_type,
            item_received: auction.item_received,
            item_received_at: auction.item_received_at,
            payment_claimed: auction.payment_claimed,
            payment_claimed_at: auction.payment_claimed_at,
            confirmation_timeout: auction.confirmation_timeout
        };
        Mapping::set(auctions, auction_id, updated_auction);
    }

    // -------------------------
    // 2b. Commit Bid - Aleo Credits (NEW)
    // -------------------------
    // 2b. Commit Bid - Aleo Credits (TWO-STEP: Manual Transfer)
    // -------------------------
    // NOTE: User must transfer credits MANUALLY before calling this
    // Step 1: User calls credits.aleo/transfer_public(contract, amount)
    // Step 2: User calls this function to record commitment

    async transition commit_bid_aleo(
        public auction_id: field,
        public commitment: field,
        public amount_credits: u64
    ) -> Future {
        // NO TRANSFER HERE - user already transferred in Step 1
        // Just record the commitment and escrow
        
        return finalize_commit_bid_aleo(
            auction_id,
            commitment,
            self.signer,
            amount_credits
        );
    }

    async function finalize_commit_bid_aleo(
        auction_id: field,
        commitment: field,
        bidder: address,
        amount_credits: u64
    ) {
        let auction: AuctionInfo = Mapping::get(auctions, auction_id);
        
        // Verify auction uses Aleo currency
        assert_eq(auction.currency_type, CURRENCY_ALEO);
        assert_eq(auction.state, OPEN);
        
        // Convert u64 to u128 for storage
        let amount_u128: u128 = amount_credits as u128;
        
        let bid_key: field = auction_id + BHP256::hash_to_field(bidder);
        
        Mapping::set(commitments, bid_key, BidCommitment {
            bidder,
            commitment,
            is_revealed: false,
            revealed_amount: 0u128,
            timestamp: 0i64
        });
        
        Mapping::set(escrow, bid_key, Escrow {
            bidder,
            amount: amount_u128,
            is_refunded: false,
            is_winner: false
        });
        
        let updated_auction: AuctionInfo = AuctionInfo {
            seller: auction.seller,
            min_bid_amount: auction.min_bid_amount,
            currency_type: auction.currency_type,
            end_time: auction.end_time,
            challenge_period: auction.challenge_period,
            state: auction.state,
            winner: auction.winner,
            winning_amount: auction.winning_amount,
            challenge_end_time: auction.challenge_end_time,
            total_escrowed: auction.total_escrowed + amount_u128,
            asset_type: auction.asset_type,
            item_received: auction.item_received,
            item_received_at: auction.item_received_at,
            payment_claimed: auction.payment_claimed,
            payment_claimed_at: auction.payment_claimed_at,
            confirmation_timeout: auction.confirmation_timeout
        };
        Mapping::set(auctions, auction_id, updated_auction);
    }

    // -------------------------
    // 3. Close Auction (Currency-Agnostic)
    // -------------------------

    async transition close_auction(
        public auction_id: field
    ) -> Future {
        return finalize_close_auction(auction_id, self.signer);
    }

    async function finalize_close_auction(
        auction_id: field,
        caller: address
    ) {
        let auction: AuctionInfo = Mapping::get(auctions, auction_id);
        
        assert_eq(auction.seller, caller);
        assert_eq(auction.state, OPEN);
        
        let updated_auction: AuctionInfo = AuctionInfo {
            seller: auction.seller,
            min_bid_amount: auction.min_bid_amount,
            currency_type: auction.currency_type,
            end_time: auction.end_time,
            challenge_period: auction.challenge_period,
            state: CLOSED,
            winner: auction.winner,
            winning_amount: auction.winning_amount,
            challenge_end_time: auction.challenge_end_time,
            total_escrowed: auction.total_escrowed,
            asset_type: auction.asset_type,
            item_received: auction.item_received,
            item_received_at: auction.item_received_at,
            payment_claimed: auction.payment_claimed,
            payment_claimed_at: auction.payment_claimed_at,
            confirmation_timeout: auction.confirmation_timeout
        };
        Mapping::set(auctions, auction_id, updated_auction);
    }

    // -------------------------
    // 4. Reveal Bid (Currency-Agnostic)
    // -------------------------

    async transition reveal_bid(
        public auction_id: field,
        amount: u128,
        nonce: field
    ) -> Future {
        let computed_commitment: field = nonce + amount as field;
        
        return finalize_reveal_bid(
            auction_id,
            computed_commitment,
            self.signer,
            amount
        );
    }

    async function finalize_reveal_bid(
        auction_id: field,
        computed_commitment: field,
        bidder: address,
        amount: u128
    ) {
        let auction: AuctionInfo = Mapping::get(auctions, auction_id);
        assert_eq(auction.state, CLOSED);
        
        let bid_key: field = auction_id + BHP256::hash_to_field(bidder);
        let commitment: BidCommitment = Mapping::get(commitments, bid_key);
        
        assert_eq(commitment.commitment, computed_commitment);
        assert(!commitment.is_revealed);
        assert(amount >= auction.min_bid_amount);
        
        let escrow_data: Escrow = Mapping::get(escrow, bid_key);
        assert_eq(amount, escrow_data.amount);
        
        let updated_commitment: BidCommitment = BidCommitment {
            bidder: commitment.bidder,
            commitment: commitment.commitment,
            is_revealed: true,
            revealed_amount: amount,
            timestamp: commitment.timestamp
        };
        Mapping::set(commitments, bid_key, updated_commitment);
        
        let current_highest: u128 = Mapping::get_or_use(highest_bid, auction_id, 0u128);
        
        if (amount > current_highest) {
            Mapping::set(highest_bid, auction_id, amount);
            Mapping::set(highest_bidder, auction_id, commitment.bidder);
        }
    }

    // -------------------------
    // 5. Determine Winner (Currency-Agnostic)
    // -------------------------

    async transition determine_winner(
        public auction_id: field
    ) -> Future {
        return finalize_determine_winner(auction_id, self.signer);
    }

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
        
        let updated_auction: AuctionInfo = AuctionInfo {
            seller: auction.seller,
            min_bid_amount: auction.min_bid_amount,
            currency_type: auction.currency_type,
            end_time: auction.end_time,
            challenge_period: auction.challenge_period,
            state: CHALLENGE,
            winner,
            winning_amount,
            challenge_end_time: auction.challenge_end_time,
            total_escrowed: auction.total_escrowed,
            asset_type: auction.asset_type,
            item_received: auction.item_received,
            item_received_at: auction.item_received_at,
            payment_claimed: auction.payment_claimed,
            payment_claimed_at: auction.payment_claimed_at,
            confirmation_timeout: auction.confirmation_timeout
        };
        
        Mapping::set(auctions, auction_id, updated_auction);
    }

    // -------------------------
    // 6. Finalize Winner (Currency-Agnostic)
    // -------------------------

    async transition finalize_winner(
        public auction_id: field
    ) -> (WinnerRecord, Future) {
        
        let placeholder_record: WinnerRecord = WinnerRecord {
            owner: self.signer,
            auction_id,
            winning_amount: 0u128,
            currency_type: 0u8,
            finalized_at: 0i64
        };
        
        return (placeholder_record, finalize_finalize_winner(auction_id, self.signer));
    }

    async function finalize_finalize_winner(
        auction_id: field,
        caller: address
    ) {
        let auction: AuctionInfo = Mapping::get(auctions, auction_id);
        
        assert_eq(auction.seller, caller);
        assert_eq(auction.state, CHALLENGE);
        
        let winner_key: field = auction_id + BHP256::hash_to_field(auction.winner);
        
        if (Mapping::contains(escrow, winner_key)) {
            let winner_escrow: Escrow = Mapping::get(escrow, winner_key);
            let updated_escrow: Escrow = Escrow {
                bidder: winner_escrow.bidder,
                amount: winner_escrow.amount,
                is_refunded: winner_escrow.is_refunded,
                is_winner: true
            };
            Mapping::set(escrow, winner_key, updated_escrow);
        }
        
        let updated_auction: AuctionInfo = AuctionInfo {
            seller: auction.seller,
            min_bid_amount: auction.min_bid_amount,
            currency_type: auction.currency_type,
            end_time: auction.end_time,
            challenge_period: auction.challenge_period,
            state: SETTLED,
            winner: auction.winner,
            winning_amount: auction.winning_amount,
            challenge_end_time: auction.challenge_end_time,
            total_escrowed: auction.total_escrowed,
            asset_type: auction.asset_type,
            item_received: auction.item_received,
            item_received_at: auction.item_received_at,
            payment_claimed: auction.payment_claimed,
            payment_claimed_at: auction.payment_claimed_at,
            confirmation_timeout: auction.confirmation_timeout
        };
        Mapping::set(auctions, auction_id, updated_auction);
    }

    // -------------------------
    // 7a. Claim Refund - USDCx (Existing)
    // -------------------------

    async transition claim_refund(
        public auction_id: field,
        public refund_amount: u128
    ) -> Future {
        let transfer_future: Future = test_usdcx_stablecoin.aleo/transfer_public(
            self.signer,
            refund_amount
        );
        
        return finalize_claim_refund(auction_id, self.signer, refund_amount, transfer_future);
    }

    async function finalize_claim_refund(
        auction_id: field,
        bidder: address,
        refund_amount: u128,
        transfer_future: Future
    ) {
        let auction: AuctionInfo = Mapping::get(auctions, auction_id);
        
        // Verify auction uses USDCx currency
        assert_eq(auction.currency_type, CURRENCY_USDX);
        assert_eq(auction.state, SETTLED);
        
        let bid_key: field = auction_id + BHP256::hash_to_field(bidder);
        
        assert(Mapping::contains(escrow, bid_key));
        let escrow_data: Escrow = Mapping::get(escrow, bid_key);
        
        assert(!escrow_data.is_winner);
        assert(!escrow_data.is_refunded);
        assert_eq(refund_amount, escrow_data.amount);
        
        transfer_future.await();
        
        let updated_escrow: Escrow = Escrow {
            bidder: escrow_data.bidder,
            amount: escrow_data.amount,
            is_refunded: true,
            is_winner: escrow_data.is_winner
        };
        Mapping::set(escrow, bid_key, updated_escrow);
    }

    // -------------------------
    // 7a2. Claim Refund - USAD (Public)
    // -------------------------

    async transition claim_refund_usad(
        public auction_id: field,
        public refund_amount: u128
    ) -> Future {
        let transfer_future: Future = test_usad_stablecoin.aleo/transfer_public(
            self.signer,
            refund_amount
        );
        
        return finalize_claim_refund_usad(auction_id, self.signer, refund_amount, transfer_future);
    }

    async function finalize_claim_refund_usad(
        auction_id: field,
        bidder: address,
        refund_amount: u128,
        transfer_future: Future
    ) {
        let auction: AuctionInfo = Mapping::get(auctions, auction_id);
        
        // Verify auction uses USAD currency
        assert_eq(auction.currency_type, CURRENCY_USAD);
        assert_eq(auction.state, SETTLED);
        
        let bid_key: field = auction_id + BHP256::hash_to_field(bidder);
        
        assert(Mapping::contains(escrow, bid_key));
        let escrow_data: Escrow = Mapping::get(escrow, bid_key);
        
        assert(!escrow_data.is_winner);
        assert(!escrow_data.is_refunded);
        assert_eq(refund_amount, escrow_data.amount);
        
        transfer_future.await();
        
        let updated_escrow: Escrow = Escrow {
            bidder: escrow_data.bidder,
            amount: escrow_data.amount,
            is_refunded: true,
            is_winner: escrow_data.is_winner
        };
        Mapping::set(escrow, bid_key, updated_escrow);
    }

    // -------------------------
    // 7b. Claim Refund - Aleo Credits (NEW)
    // -------------------------

    async transition claim_refund_aleo(
        public auction_id: field,
        public refund_amount: u64
    ) -> Future {
        // Transfer Aleo credits FROM contract TO bidder (caller)
        // self.caller = bidder address
        let transfer_future: Future = credits.aleo/transfer_public(
            self.caller,
            refund_amount
        );
        
        return finalize_claim_refund_aleo(
            auction_id,
            self.caller,
            refund_amount,
            transfer_future
        );
    }

    async function finalize_claim_refund_aleo(
        auction_id: field,
        bidder: address,
        refund_amount: u64,
        transfer_future: Future
    ) {
        let auction: AuctionInfo = Mapping::get(auctions, auction_id);
        
        // Verify auction uses Aleo currency
        assert_eq(auction.currency_type, CURRENCY_ALEO);
        assert_eq(auction.state, SETTLED);
        
        let bid_key: field = auction_id + BHP256::hash_to_field(bidder);
        
        assert(Mapping::contains(escrow, bid_key));
        let escrow_data: Escrow = Mapping::get(escrow, bid_key);
        
        assert(!escrow_data.is_winner);
        assert(!escrow_data.is_refunded);
        assert_eq(refund_amount as u128, escrow_data.amount);
        
        // Wait for transfer to complete
        transfer_future.await();
        
        let updated_escrow: Escrow = Escrow {
            bidder: escrow_data.bidder,
            amount: escrow_data.amount,
            is_refunded: true,
            is_winner: escrow_data.is_winner
        };
        Mapping::set(escrow, bid_key, updated_escrow);
    }

    // -------------------------
    // 8. PRIVATE TRANSACTIONS (V2.18 NEW)
    // -------------------------
    
    // 8a. Commit Bid Aleo - Private Input (Private → Public)
    // User provides private credits record, contract receives public mapping
    async transition commit_bid_aleo_private(
        public auction_id: field,
        public commitment: field,
        private_credits: credits.aleo/credits,  // Private input record
        public amount_credits: u64
    ) -> (credits.aleo/credits, Future) {
        
        // Transfer private → public (returns change record)
        let (change_record, transfer_future): (credits.aleo/credits, Future) = 
            credits.aleo/transfer_private_to_public(
                private_credits,
                shadowbid_marketplace_v2_18.aleo,
                amount_credits
            );
        
        return (change_record, finalize_commit_aleo_priv(
            auction_id,
            commitment,
            self.signer,
            amount_credits,
            transfer_future
        ));
    }
    
    async function finalize_commit_aleo_priv(
        auction_id: field,
        commitment: field,
        bidder: address,
        amount_credits: u64,
        transfer_future: Future
    ) {
        transfer_future.await();
        
        let auction: AuctionInfo = Mapping::get(auctions, auction_id);
        
        // Verify auction uses Aleo currency
        assert_eq(auction.currency_type, CURRENCY_ALEO);
        assert_eq(auction.state, OPEN);
        
        // Convert u64 to u128 for storage
        let amount_u128: u128 = amount_credits as u128;
        
        let bid_key: field = auction_id + BHP256::hash_to_field(bidder);
        
        Mapping::set(commitments, bid_key, BidCommitment {
            bidder,
            commitment,
            is_revealed: false,
            revealed_amount: 0u128,
            timestamp: 0i64
        });
        
        Mapping::set(escrow, bid_key, Escrow {
            bidder,
            amount: amount_u128,
            is_refunded: false,
            is_winner: false
        });
        
        let updated_auction: AuctionInfo = AuctionInfo {
            seller: auction.seller,
            min_bid_amount: auction.min_bid_amount,
            currency_type: auction.currency_type,
            end_time: auction.end_time,
            challenge_period: auction.challenge_period,
            state: auction.state,
            winner: auction.winner,
            winning_amount: auction.winning_amount,
            challenge_end_time: auction.challenge_end_time,
            total_escrowed: auction.total_escrowed + amount_u128,
            asset_type: auction.asset_type,
            item_received: auction.item_received,
            item_received_at: auction.item_received_at,
            payment_claimed: auction.payment_claimed,
            payment_claimed_at: auction.payment_claimed_at,
            confirmation_timeout: auction.confirmation_timeout
        };
        Mapping::set(auctions, auction_id, updated_auction);
    }
    
    // 8b. Commit Bid USDCx - Private Input (Private → Public)
    // NOTE: USDCx private requires ComplianceRecord - complex implementation
    // Skipped in V2.18, will be added in V3.0
    
    // 8c. Claim Refund Aleo - Private Output (Public → Private)
    // Contract sends from public mapping, user receives private record
    async transition claim_refund_aleo_private(
        public auction_id: field,
        public refund_amount: u64
    ) -> (credits.aleo/credits, Future) {
        
        // Transfer public → private (returns private record to caller)
        let (refund_record, transfer_future): (credits.aleo/credits, Future) = 
            credits.aleo/transfer_public_to_private(
                self.caller,
                refund_amount
            );
        
        return (refund_record, finalize_claim_refund_aleo(
            auction_id,
            self.caller,
            refund_amount,
            transfer_future
        ));
    }
    
    // Note: finalize_claim_refund_aleo already exists from V2.17
    // It handles the escrow validation and marking as refunded
    
    // 8d. Claim Refund USDCx/USAD - Private Output
    // NOTE: USDCx/USAD private requires ComplianceRecord - complex implementation
    // Skipped in V2.18, will be added in V3.0

    // -------------------------
    // 9. RWA SETTLEMENT MECHANISM (V2.18 NEW)
    // -------------------------
    
    // 9a. Confirm Receipt - Winner confirms item received
    async transition confirm_receipt(
        public auction_id: field,
        public received_at: i64
    ) -> Future {
        return finalize_confirm_receipt(auction_id, self.signer, received_at);
    }

    async function finalize_confirm_receipt(
        auction_id: field,
        caller: address,
        received_at: i64
    ) {
        let auction: AuctionInfo = Mapping::get(auctions, auction_id);
        
        // Only winner can confirm
        assert_eq(auction.winner, caller);
        
        // Auction must be SETTLED
        assert_eq(auction.state, SETTLED);
        
        // Cannot confirm twice
        assert(!auction.item_received);
        
        let updated_auction: AuctionInfo = AuctionInfo {
            seller: auction.seller,
            min_bid_amount: auction.min_bid_amount,
            currency_type: auction.currency_type,
            end_time: auction.end_time,
            challenge_period: auction.challenge_period,
            state: auction.state,
            winner: auction.winner,
            winning_amount: auction.winning_amount,
            challenge_end_time: auction.challenge_end_time,
            total_escrowed: auction.total_escrowed,
            asset_type: auction.asset_type,
            item_received: true,
            item_received_at: received_at,
            payment_claimed: auction.payment_claimed,
            payment_claimed_at: auction.payment_claimed_at,
            confirmation_timeout: auction.confirmation_timeout
        };
        
        Mapping::set(auctions, auction_id, updated_auction);
    }
    
    // 9b. Claim Winning - Aleo Credits
    async transition claim_winning_aleo(
        public auction_id: field,
        public winning_amount_u64: u64,
        public seller_address: address,
        public claim_at: i64
    ) -> Future {
        let transfer_future: Future = credits.aleo/transfer_public(
            seller_address,
            winning_amount_u64
        );
        
        return finalize_claim_winning_aleo(
            auction_id,
            self.signer,
            claim_at,
            transfer_future
        );
    }
    
    async function finalize_claim_winning_aleo(
        auction_id: field,
        caller: address,
        claim_at: i64,
        transfer_future: Future
    ) {
        let auction: AuctionInfo = Mapping::get(auctions, auction_id);
        
        // Only seller can claim
        assert_eq(auction.seller, caller);
        
        // Verify currency type
        assert_eq(auction.currency_type, CURRENCY_ALEO);
        
        // Auction must be SETTLED
        assert_eq(auction.state, SETTLED);
        
        // Cannot claim twice
        assert(!auction.payment_claimed);
        
        // Winner must have confirmed receipt OR timeout passed
        let timeout_passed: bool = claim_at >= (auction.item_received_at + auction.confirmation_timeout);
        assert(auction.item_received || timeout_passed);
        
        // Execute transfer
        transfer_future.await();
        
        let updated_auction: AuctionInfo = AuctionInfo {
            seller: auction.seller,
            min_bid_amount: auction.min_bid_amount,
            currency_type: auction.currency_type,
            end_time: auction.end_time,
            challenge_period: auction.challenge_period,
            state: auction.state,
            winner: auction.winner,
            winning_amount: auction.winning_amount,
            challenge_end_time: auction.challenge_end_time,
            total_escrowed: auction.total_escrowed,
            asset_type: auction.asset_type,
            item_received: auction.item_received,
            item_received_at: auction.item_received_at,
            payment_claimed: true,
            payment_claimed_at: claim_at,
            confirmation_timeout: auction.confirmation_timeout
        };
        
        Mapping::set(auctions, auction_id, updated_auction);
    }
    
    // 9c. Claim Winning - USDCx
    async transition claim_winning_usdcx(
        public auction_id: field,
        public winning_amount: u128,
        public seller_address: address,
        public claim_at: i64
    ) -> Future {
        let transfer_future: Future = test_usdcx_stablecoin.aleo/transfer_public(
            seller_address,
            winning_amount
        );
        
        return finalize_claim_winning_usdcx(
            auction_id,
            self.signer,
            claim_at,
            transfer_future
        );
    }
    
    async function finalize_claim_winning_usdcx(
        auction_id: field,
        caller: address,
        claim_at: i64,
        transfer_future: Future
    ) {
        let auction: AuctionInfo = Mapping::get(auctions, auction_id);
        
        // Only seller can claim
        assert_eq(auction.seller, caller);
        
        // Verify currency type
        assert_eq(auction.currency_type, CURRENCY_USDX);
        
        // Auction must be SETTLED
        assert_eq(auction.state, SETTLED);
        
        // Cannot claim twice
        assert(!auction.payment_claimed);
        
        // Winner must have confirmed receipt OR timeout passed
        let timeout_passed: bool = claim_at >= (auction.item_received_at + auction.confirmation_timeout);
        assert(auction.item_received || timeout_passed);
        
        // Execute transfer
        transfer_future.await();
        
        let updated_auction: AuctionInfo = AuctionInfo {
            seller: auction.seller,
            min_bid_amount: auction.min_bid_amount,
            currency_type: auction.currency_type,
            end_time: auction.end_time,
            challenge_period: auction.challenge_period,
            state: auction.state,
            winner: auction.winner,
            winning_amount: auction.winning_amount,
            challenge_end_time: auction.challenge_end_time,
            total_escrowed: auction.total_escrowed,
            asset_type: auction.asset_type,
            item_received: auction.item_received,
            item_received_at: auction.item_received_at,
            payment_claimed: true,
            payment_claimed_at: claim_at,
            confirmation_timeout: auction.confirmation_timeout
        };
        
        Mapping::set(auctions, auction_id, updated_auction);
    }
    
    // 9c2. Claim Winning - USAD
    async transition claim_winning_usad(
        public auction_id: field,
        public winning_amount: u128,
        public seller_address: address,
        public claim_at: i64
    ) -> Future {
        let transfer_future: Future = test_usad_stablecoin.aleo/transfer_public(
            seller_address,
            winning_amount
        );
        
        return finalize_claim_winning_usad(
            auction_id,
            self.signer,
            claim_at,
            transfer_future
        );
    }
    
    async function finalize_claim_winning_usad(
        auction_id: field,
        caller: address,
        claim_at: i64,
        transfer_future: Future
    ) {
        let auction: AuctionInfo = Mapping::get(auctions, auction_id);
        
        // Only seller can claim
        assert_eq(auction.seller, caller);
        
        // Verify currency type
        assert_eq(auction.currency_type, CURRENCY_USAD);
        
        // Auction must be SETTLED
        assert_eq(auction.state, SETTLED);
        
        // Cannot claim twice
        assert(!auction.payment_claimed);
        
        // Winner must have confirmed receipt OR timeout passed
        let timeout_passed: bool = claim_at >= (auction.item_received_at + auction.confirmation_timeout);
        assert(auction.item_received || timeout_passed);
        
        // Execute transfer
        transfer_future.await();
        
        let updated_auction: AuctionInfo = AuctionInfo {
            seller: auction.seller,
            min_bid_amount: auction.min_bid_amount,
            currency_type: auction.currency_type,
            end_time: auction.end_time,
            challenge_period: auction.challenge_period,
            state: auction.state,
            winner: auction.winner,
            winning_amount: auction.winning_amount,
            challenge_end_time: auction.challenge_end_time,
            total_escrowed: auction.total_escrowed,
            asset_type: auction.asset_type,
            item_received: auction.item_received,
            item_received_at: auction.item_received_at,
            payment_claimed: true,
            payment_claimed_at: claim_at,
            confirmation_timeout: auction.confirmation_timeout
        };
        
        Mapping::set(auctions, auction_id, updated_auction);
    }

    // -------------------------
    // Constructor
    // -------------------------

    @noupgrade
    async constructor() {}
}
