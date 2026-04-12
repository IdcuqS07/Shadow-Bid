// ShadowBid Marketplace V2.24 — Refund identity consistency plus v2.23 lifecycle guards
// Foundation: Aleo blockchain with ZK proofs
// Currency: Aleo Credits (native) OR USDCx/USAD stablecoin (ARC-21 token)
// Architecture: Commit-reveal pattern with O(1) winner determination
// NEW in V2.21: reveal/dispute deadline split, timeout settlement, v2.20-compatible dispute flow

import credits.aleo;
import test_usdcx_stablecoin.aleo;
import test_usad_stablecoin.aleo;



// -------------------------
// Constants
// -------------------------

// Auction states
const OPEN: u8 = 0u8;
const CLOSED: u8 = 1u8;
const CHALLENGE: u8 = 2u8;
const SETTLED: u8 = 3u8;
const CANCELLED: u8 = 4u8;
const DISPUTED: u8 = 5u8;

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

// Platform fee configuration
const PLATFORM_FEE_RATE: u16 = 250u16;  // 2.5% (250 basis points / 10000)

// Platform owner address
const PLATFORM_ADDRESS: address = aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8;
const EMPTY_ADDRESS: address = aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc;

// Verification states
const VERIFICATION_PENDING: u8 = 0u8;
const VERIFICATION_SUBMITTED: u8 = 1u8;
const VERIFICATION_VERIFIED: u8 = 2u8;

// Cancellation reasons
const CANCEL_REASON_NONE: u8 = 0u8;
const CANCEL_REASON_PREBID_CANCEL: u8 = 1u8;
const CANCEL_REASON_NO_BID: u8 = 2u8;
const CANCEL_REASON_NO_REVEAL: u8 = 3u8;
const CANCEL_REASON_RESERVE_NOT_MET: u8 = 4u8;
const CANCEL_REASON_DISPUTE_REFUND: u8 = 5u8;

// -------------------------

// Structs
// -------------------------

// Auction metadata stored on-chain
struct AuctionInfo {
    seller: address,
    min_bid_amount: u128,        // Generic (works for both currencies)
    currency_type: u8,            // 0=USDCx, 1=Aleo
    end_time: i64,
    reveal_period: i64,
    dispute_period: i64,
    state: u8,                    // 0=OPEN, 1=CLOSED, 2=CHALLENGE, 3=SETTLED, 4=CANCELLED
    winner: address,
    winning_amount: u128,         // Generic (works for both currencies)
    reveal_deadline: i64,
    dispute_deadline: i64,
    total_escrowed: u128,         // Generic (works for both currencies)
    asset_type: u8,               // Asset category (0-7)
    item_received: bool,          // Winner confirmed receipt
    item_received_at: i64,        // Timestamp
    payment_claimed: bool,        // Seller claimed payment
    payment_claimed_at: i64,      // Timestamp
    confirmation_timeout: i64,    // Timeout based on asset type
    
    // Settlement timing
    settled_at: i64,              // When finalize_winner was called
    claimable_at: i64,            // settled_at + confirmation_timeout
    
    // Platform fee tracking
    platform_fee_amount: u128,    // Calculated fee (2.5% of winning_amount)
    seller_net_amount: u128,      // Net amount for seller (winning_amount - fee)
    platform_fee_claimed: bool,   // Has platform claimed the fee?
    platform_fee_claimed_at: i64, // When platform claimed
    
    // Reserve price controls
    reserve_price: u128,          // Minimum acceptable price
    reserve_met: bool,            // Is winning_amount >= reserve_price?
    commitment_count: u32,        // Number of committed bids
    revealed_count: u32,          // Number of revealed bids
    cancel_reason: u8             // Why a cancelled auction ended
}

// Bid commitment for commit-reveal pattern
struct BidCommitment {
    bidder: address,
    commitment: field,           // BHP256(auction_id || bidder || amount || nonce)
    is_revealed: bool,
    revealed_amount: u128,       // Generic (works for both currencies)
    revealed_at: i64
}

struct BidCommitmentPreimage {
    auction_id: field,
    bidder: address,
    amount: u128,
    nonce: field
}

// Generic escrow tracking (works for both Aleo and USDCx)
struct Escrow {
    bidder: address,
    is_refunded: bool,
    is_winner: bool
}

struct SellerProfile {
    verification_status: u8,
    verification_tier: u8,
    profile_root: field,
    attestation_expiry: i64,
    updated_at: i64
}

// -------------------------

final fn finalize_create_auction(
    auction_id: field,
    seller: address,
    min_bid_amount: u128,
    reserve_price: u128,
    currency_type: u8,
    asset_type: u8,
    end_time: i64,
    reveal_period: i64,
    dispute_period: i64
) {
    assert(!Mapping::contains(auctions, auction_id));
    assert(min_bid_amount > 0u128);
    assert(reveal_period > 0i64);
    assert(dispute_period > 0i64);
    
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
        reveal_period,
        dispute_period,
        state: OPEN,
        winner: EMPTY_ADDRESS,
        winning_amount: 0u128,
        reveal_deadline: 0i64,
        dispute_deadline: 0i64,
        total_escrowed: 0u128,
        asset_type,
        item_received: false,
        item_received_at: 0i64,
        payment_claimed: false,
        payment_claimed_at: 0i64,
        confirmation_timeout: timeout,
        
        // Initialize settlement and fee fields
        settled_at: 0i64,
        claimable_at: 0i64,
        platform_fee_amount: 0u128,
        seller_net_amount: 0u128,
        platform_fee_claimed: false,
        platform_fee_claimed_at: 0i64,
        reserve_price,
        reserve_met: false,
        commitment_count: 0u32,
        revealed_count: 0u32,
        cancel_reason: CANCEL_REASON_NONE
    });
}

final fn finalize_cancel_auction(
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
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: CANCELLED,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: auction.dispute_deadline,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met,
        commitment_count: auction.commitment_count,
        revealed_count: auction.revealed_count,
        cancel_reason: CANCEL_REASON_PREBID_CANCEL
    };
    
    Mapping::set(auctions, auction_id, cancelled_auction);
}

final fn finalize_commit_bid(
    auction_id: field,
    commitment: field,
    bidder: address,
    amount_usdx: u128,
    transfer_future: Final
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Verify auction uses USDCx currency
    assert_eq(auction.currency_type, CURRENCY_USDX);
    assert_eq(auction.state, OPEN);
    assert(bidder != auction.seller);
    assert(amount_usdx >= auction.min_bid_amount);
    
    let bid_key: field = auction_id + BHP256::hash_to_field(bidder);
    assert(!Mapping::contains(commitments, bid_key));
    assert(!Mapping::contains(escrow, bid_key));

    transfer_future.run();
    
    Mapping::set(commitments, bid_key, BidCommitment {
        bidder,
        commitment,
        is_revealed: false,
        revealed_amount: 0u128,
        revealed_at: 0i64
    });
    
    Mapping::set(escrow, bid_key, Escrow {
        bidder,
        is_refunded: false,
        is_winner: false
    });
    
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: auction.state,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: auction.dispute_deadline,
        total_escrowed: auction.total_escrowed + amount_usdx,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met,
        commitment_count: auction.commitment_count + 1u32,
        revealed_count: auction.revealed_count,
        cancel_reason: CANCEL_REASON_NONE
    };
    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_commit_bid_usad(
    auction_id: field,
    commitment: field,
    bidder: address,
    amount_usad: u128,
    transfer_future: Final
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Verify auction uses USAD currency
    assert_eq(auction.currency_type, CURRENCY_USAD);
    assert_eq(auction.state, OPEN);
    assert(bidder != auction.seller);
    assert(amount_usad >= auction.min_bid_amount);
    
    let bid_key: field = auction_id + BHP256::hash_to_field(bidder);
    assert(!Mapping::contains(commitments, bid_key));
    assert(!Mapping::contains(escrow, bid_key));

    transfer_future.run();
    
    Mapping::set(commitments, bid_key, BidCommitment {
        bidder,
        commitment,
        is_revealed: false,
        revealed_amount: 0u128,
        revealed_at: 0i64
    });
    
    Mapping::set(escrow, bid_key, Escrow {
        bidder,
        is_refunded: false,
        is_winner: false
    });
    
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: auction.state,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: auction.dispute_deadline,
        total_escrowed: auction.total_escrowed + amount_usad,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met,
        commitment_count: auction.commitment_count + 1u32,
        revealed_count: auction.revealed_count,
        cancel_reason: CANCEL_REASON_NONE
    };
    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_commit_bid_aleo(
    auction_id: field,
    commitment: field,
    bidder: address,
    amount_credits: u64
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Verify auction uses Aleo currency
    assert_eq(auction.currency_type, CURRENCY_ALEO);
    assert_eq(auction.state, OPEN);
    assert(bidder != auction.seller);
    
    // Convert u64 to u128 for storage
    let amount_u128: u128 = amount_credits as u128;
    
    let bid_key: field = auction_id + BHP256::hash_to_field(bidder);
    assert(amount_u128 >= auction.min_bid_amount);
    assert(!Mapping::contains(commitments, bid_key));
    assert(!Mapping::contains(escrow, bid_key));
    
    Mapping::set(commitments, bid_key, BidCommitment {
        bidder,
        commitment,
        is_revealed: false,
        revealed_amount: 0u128,
        revealed_at: 0i64
    });
    
    Mapping::set(escrow, bid_key, Escrow {
        bidder,
        is_refunded: false,
        is_winner: false
    });
    
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: auction.state,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: auction.dispute_deadline,
        total_escrowed: auction.total_escrowed + amount_u128,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met,
        commitment_count: auction.commitment_count + 1u32,
        revealed_count: auction.revealed_count,
        cancel_reason: CANCEL_REASON_NONE
    };
    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_close_auction(
    auction_id: field,
    caller: address,
    closed_at: i64
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    assert_eq(auction.state, OPEN);
    assert(closed_at >= auction.end_time);
    let is_no_bid: bool = auction.total_escrowed == 0u128;
    
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: is_no_bid ? CANCELLED : CLOSED,
        winner: is_no_bid ? EMPTY_ADDRESS : auction.winner,
        winning_amount: is_no_bid ? 0u128 : auction.winning_amount,
        reveal_deadline: is_no_bid ? 0i64 : closed_at + auction.reveal_period,
        dispute_deadline: 0i64,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: is_no_bid ? 0i64 : auction.settled_at,
        claimable_at: is_no_bid ? 0i64 : auction.claimable_at,
        platform_fee_amount: is_no_bid ? 0u128 : auction.platform_fee_amount,
        seller_net_amount: is_no_bid ? 0u128 : auction.seller_net_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: is_no_bid ? false : auction.reserve_met,
        commitment_count: auction.commitment_count,
        revealed_count: auction.revealed_count,
        cancel_reason: is_no_bid ? CANCEL_REASON_NO_BID : CANCEL_REASON_NONE
    };
    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_reveal_bid(
    auction_id: field,
    computed_commitment: field,
    bidder: address,
    amount: u128,
    revealed_at: i64
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    assert_eq(auction.state, CLOSED);
    assert(auction.reveal_deadline > 0i64);
    assert(revealed_at <= auction.reveal_deadline);
    
    let bid_key: field = auction_id + BHP256::hash_to_field(bidder);
    let commitment: BidCommitment = Mapping::get(commitments, bid_key);
    
    assert_eq(commitment.commitment, computed_commitment);
    assert(!commitment.is_revealed);
    assert(amount >= auction.min_bid_amount);
    
    let escrow_data: Escrow = Mapping::get(escrow, bid_key);
    assert(!escrow_data.is_refunded);
    
    let updated_commitment: BidCommitment = BidCommitment {
        bidder: commitment.bidder,
        commitment: commitment.commitment,
        is_revealed: true,
        revealed_amount: amount,
        revealed_at
    };
    Mapping::set(commitments, bid_key, updated_commitment);
    
    let current_highest: u128 = Mapping::get_or_use(highest_bid, auction_id, 0u128);
    
    if (amount > current_highest) {
        Mapping::set(highest_bid, auction_id, amount);
        Mapping::set(highest_bidder, auction_id, commitment.bidder);
    }

    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: auction.state,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: auction.dispute_deadline,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met,
        commitment_count: auction.commitment_count,
        revealed_count: auction.revealed_count + 1u32,
        cancel_reason: auction.cancel_reason
    };
    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_reveal_timeout(
    auction_id: field,
    settled_at: i64
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    assert_eq(auction.state, CLOSED);
    assert(auction.reveal_deadline > 0i64);
    assert(settled_at >= auction.reveal_deadline);
    
    let winning_amount: u128 = Mapping::get_or_use(highest_bid, auction_id, 0u128);
    let winner: address = Mapping::get_or_use(highest_bidder, auction_id, EMPTY_ADDRESS);
    let has_revealed_bids: bool = auction.revealed_count > 0u32;
    let reserve_met: bool = winning_amount > 0u128 && winning_amount >= auction.reserve_price;
    let next_state: u8 = reserve_met ? CHALLENGE : CANCELLED;
    let stored_winner: address = has_revealed_bids && winning_amount > 0u128 ? winner : EMPTY_ADDRESS;
    let stored_amount: u128 = has_revealed_bids && winning_amount > 0u128 ? winning_amount : 0u128;
    let dispute_deadline: i64 = reserve_met ? settled_at + auction.dispute_period : 0i64;
    let cancel_reason: u8 = reserve_met
        ? CANCEL_REASON_NONE
        : has_revealed_bids
            ? CANCEL_REASON_RESERVE_NOT_MET
            : CANCEL_REASON_NO_REVEAL;
    
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: next_state,
        winner: stored_winner,
        winning_amount: stored_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met,
        commitment_count: auction.commitment_count,
        revealed_count: auction.revealed_count,
        cancel_reason
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_finalize_winner(
    auction_id: field,
    caller: address,
    finalized_at: i64
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    assert_eq(auction.state, CHALLENGE);
    assert(auction.dispute_deadline > 0i64);
    assert(finalized_at >= auction.dispute_deadline);
    assert_eq(Mapping::get_or_use(auction_dispute_root, auction_id, 0field), 0field);
    
    // Reserve must be met before finalization
    assert(auction.reserve_met);
    
    // Calculate platform fee and seller net amount
    let winning_amount_u128: u128 = auction.winning_amount;
    let fee_amount: u128 = (winning_amount_u128 * (PLATFORM_FEE_RATE as u128)) / 10000u128;
    let seller_amount: u128 = winning_amount_u128 - fee_amount;
    
    // Derive the claimable timestamp
    let claimable_at: i64 = finalized_at + auction.confirmation_timeout;
    
    let winner_key: field = auction_id + BHP256::hash_to_field(auction.winner);
    
    if (Mapping::contains(escrow, winner_key)) {
        let winner_escrow: Escrow = Mapping::get(escrow, winner_key);
        let updated_escrow: Escrow = Escrow {
            bidder: winner_escrow.bidder,
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
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: SETTLED,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: auction.dispute_deadline,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        
        // Persist settlement timing
        settled_at: finalized_at,
        claimable_at,
        
        // Persist fee amounts
        platform_fee_amount: fee_amount,
        seller_net_amount: seller_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met,
        commitment_count: auction.commitment_count,
        revealed_count: auction.revealed_count,
        cancel_reason: CANCEL_REASON_NONE
    };
    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_claim_refund(
    auction_id: field,
    bidder: address,
    computed_commitment: field,
    refund_amount: u128,
    transfer_future: Final
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Verify auction uses USDCx currency
    assert_eq(auction.currency_type, CURRENCY_USDX);
    // Allow refunds for settled or cancelled auctions
    assert(auction.state == SETTLED || auction.state == CANCELLED);
    
    let bid_key: field = auction_id + BHP256::hash_to_field(bidder);
    
    assert(Mapping::contains(escrow, bid_key));
    let escrow_data: Escrow = Mapping::get(escrow, bid_key);
    let commitment: BidCommitment = Mapping::get(commitments, bid_key);
    
    assert(!escrow_data.is_winner);
    assert(!escrow_data.is_refunded);
    assert_eq(commitment.commitment, computed_commitment);
    
    transfer_future.run();
    
    let updated_escrow: Escrow = Escrow {
        bidder: escrow_data.bidder,
        is_refunded: true,
        is_winner: escrow_data.is_winner
    };
    Mapping::set(escrow, bid_key, updated_escrow);
}

final fn finalize_claim_refund_usad(
    auction_id: field,
    bidder: address,
    computed_commitment: field,
    refund_amount: u128,
    transfer_future: Final
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Verify auction uses USAD currency
    assert_eq(auction.currency_type, CURRENCY_USAD);
    // Allow refunds for settled or cancelled auctions
    assert(auction.state == SETTLED || auction.state == CANCELLED);
    
    let bid_key: field = auction_id + BHP256::hash_to_field(bidder);
    
    assert(Mapping::contains(escrow, bid_key));
    let escrow_data: Escrow = Mapping::get(escrow, bid_key);
    let commitment: BidCommitment = Mapping::get(commitments, bid_key);
    
    assert(!escrow_data.is_winner);
    assert(!escrow_data.is_refunded);
    assert_eq(commitment.commitment, computed_commitment);
    
    transfer_future.run();
    
    let updated_escrow: Escrow = Escrow {
        bidder: escrow_data.bidder,
        is_refunded: true,
        is_winner: escrow_data.is_winner
    };
    Mapping::set(escrow, bid_key, updated_escrow);
}

final fn finalize_claim_refund_aleo(
    auction_id: field,
    bidder: address,
    computed_commitment: field,
    refund_amount: u64,
    transfer_future: Final
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Verify auction uses Aleo currency
    assert_eq(auction.currency_type, CURRENCY_ALEO);
    // Allow refunds for settled or cancelled auctions
    assert(auction.state == SETTLED || auction.state == CANCELLED);
    
    let bid_key: field = auction_id + BHP256::hash_to_field(bidder);
    
    assert(Mapping::contains(escrow, bid_key));
    let escrow_data: Escrow = Mapping::get(escrow, bid_key);
    let commitment: BidCommitment = Mapping::get(commitments, bid_key);
    
    assert(!escrow_data.is_winner);
    assert(!escrow_data.is_refunded);
    assert_eq(commitment.commitment, computed_commitment);
    
    // Wait for transfer to complete
    transfer_future.run();
    
    let updated_escrow: Escrow = Escrow {
        bidder: escrow_data.bidder,
        is_refunded: true,
        is_winner: escrow_data.is_winner
    };
    Mapping::set(escrow, bid_key, updated_escrow);
}

final fn finalize_commit_aleo_priv(
    auction_id: field,
    commitment: field,
    bidder: address,
    amount_credits: u64,
    transfer_future: Final
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Verify auction uses Aleo currency
    assert_eq(auction.currency_type, CURRENCY_ALEO);
    assert_eq(auction.state, OPEN);
    assert(bidder != auction.seller);
    
    // Convert u64 to u128 for storage
    let amount_u128: u128 = amount_credits as u128;
    
    let bid_key: field = auction_id + BHP256::hash_to_field(bidder);
    assert(amount_u128 >= auction.min_bid_amount);
    assert(!Mapping::contains(commitments, bid_key));
    assert(!Mapping::contains(escrow, bid_key));

    transfer_future.run();
    
    Mapping::set(commitments, bid_key, BidCommitment {
        bidder,
        commitment,
        is_revealed: false,
        revealed_amount: 0u128,
        revealed_at: 0i64
    });
    
    Mapping::set(escrow, bid_key, Escrow {
        bidder,
        is_refunded: false,
        is_winner: false
    });
    
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: auction.state,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: auction.dispute_deadline,
        total_escrowed: auction.total_escrowed + amount_u128,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met,
        commitment_count: auction.commitment_count + 1u32,
        revealed_count: auction.revealed_count,
        cancel_reason: CANCEL_REASON_NONE
    };
    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_confirm_receipt(
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
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: auction.state,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: auction.dispute_deadline,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: true,
        item_received_at: received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met,
        commitment_count: auction.commitment_count,
        revealed_count: auction.revealed_count,
        cancel_reason: CANCEL_REASON_NONE
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_claim_winning_aleo(
    auction_id: field,
    caller: address,
    seller_net_amount_u64: u64,
    seller_address: address,
    claim_at: i64,
    transfer_future: Final
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Only seller can claim
    assert_eq(auction.seller, caller);
    
    // Verify currency type
    assert_eq(auction.currency_type, CURRENCY_ALEO);
    assert_eq(seller_address, auction.seller);
    assert_eq(seller_net_amount_u64 as u128, auction.seller_net_amount);
    
    // Auction must be SETTLED
    assert_eq(auction.state, SETTLED);
    
    // Cannot claim twice
    assert(!auction.payment_claimed);
    
    // Use claimable_at instead of item_received_at + timeout
    let timeout_passed: bool = claim_at >= auction.claimable_at;
    assert(auction.item_received || timeout_passed);
    
    // Execute transfer
    transfer_future.run();
    
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: auction.state,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: auction.dispute_deadline,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: true,
        payment_claimed_at: claim_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met,
        commitment_count: auction.commitment_count,
        revealed_count: auction.revealed_count,
        cancel_reason: auction.cancel_reason
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_claim_winning_usdcx(
    auction_id: field,
    caller: address,
    seller_net_amount: u128,
    seller_address: address,
    claim_at: i64,
    transfer_future: Final
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Only seller can claim
    assert_eq(auction.seller, caller);
    
    // Verify currency type
    assert_eq(auction.currency_type, CURRENCY_USDX);
    assert_eq(seller_address, auction.seller);
    assert_eq(seller_net_amount, auction.seller_net_amount);
    
    // Auction must be SETTLED
    assert_eq(auction.state, SETTLED);
    
    // Cannot claim twice
    assert(!auction.payment_claimed);
    
    // Use claimable_at instead of item_received_at + timeout
    let timeout_passed: bool = claim_at >= auction.claimable_at;
    assert(auction.item_received || timeout_passed);
    
    // Execute transfer
    transfer_future.run();
    
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: auction.state,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: auction.dispute_deadline,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: true,
        payment_claimed_at: claim_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met,
        commitment_count: auction.commitment_count,
        revealed_count: auction.revealed_count,
        cancel_reason: auction.cancel_reason
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_claim_winning_usad(
    auction_id: field,
    caller: address,
    seller_net_amount: u128,
    seller_address: address,
    claim_at: i64,
    transfer_future: Final
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Only seller can claim
    assert_eq(auction.seller, caller);
    
    // Verify currency type
    assert_eq(auction.currency_type, CURRENCY_USAD);
    assert_eq(seller_address, auction.seller);
    assert_eq(seller_net_amount, auction.seller_net_amount);
    
    // Auction must be SETTLED
    assert_eq(auction.state, SETTLED);
    
    // Cannot claim twice
    assert(!auction.payment_claimed);
    
    // Use claimable_at instead of item_received_at + timeout
    let timeout_passed: bool = claim_at >= auction.claimable_at;
    assert(auction.item_received || timeout_passed);
    
    // Execute transfer
    transfer_future.run();
    
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: auction.state,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: auction.dispute_deadline,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: true,
        payment_claimed_at: claim_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met,
        commitment_count: auction.commitment_count,
        revealed_count: auction.revealed_count,
        cancel_reason: auction.cancel_reason
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_claim_fee_aleo(
    auction_id: field,
    caller: address,
    fee_amount_u64: u64,
    claimed_at: i64,
    transfer_future: Final
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Only platform owner can claim
    assert_eq(caller, PLATFORM_ADDRESS);
    
    // Verify currency type
    assert_eq(auction.currency_type, CURRENCY_ALEO);
    
    // Auction must be SETTLED
    assert_eq(auction.state, SETTLED);
    
    // Seller must have claimed first
    assert(auction.payment_claimed);
    
    // Fee not claimed yet
    assert(!auction.platform_fee_claimed);
    assert_eq(fee_amount_u64 as u128, auction.platform_fee_amount);
    
    // Execute transfer
    transfer_future.run();
    
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: auction.state,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: auction.dispute_deadline,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: true,
        platform_fee_claimed_at: claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met,
        commitment_count: auction.commitment_count,
        revealed_count: auction.revealed_count,
        cancel_reason: auction.cancel_reason
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_claim_fee_usdcx(
    auction_id: field,
    caller: address,
    fee_amount: u128,
    claimed_at: i64,
    transfer_future: Final
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Only platform owner can claim
    assert_eq(caller, PLATFORM_ADDRESS);
    
    // Verify currency type
    assert_eq(auction.currency_type, CURRENCY_USDX);
    
    // Auction must be SETTLED
    assert_eq(auction.state, SETTLED);
    
    // Seller must have claimed first
    assert(auction.payment_claimed);
    
    // Fee not claimed yet
    assert(!auction.platform_fee_claimed);
    assert_eq(fee_amount, auction.platform_fee_amount);
    
    // Execute transfer
    transfer_future.run();
    
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: auction.state,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: auction.dispute_deadline,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: true,
        platform_fee_claimed_at: claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met,
        commitment_count: auction.commitment_count,
        revealed_count: auction.revealed_count,
        cancel_reason: auction.cancel_reason
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_claim_fee_usad(
    auction_id: field,
    caller: address,
    fee_amount: u128,
    claimed_at: i64,
    transfer_future: Final
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    
    // Only platform owner can claim
    assert_eq(caller, PLATFORM_ADDRESS);
    
    // Verify currency type
    assert_eq(auction.currency_type, CURRENCY_USAD);
    
    // Auction must be SETTLED
    assert_eq(auction.state, SETTLED);
    
    // Seller must have claimed first
    assert(auction.payment_claimed);
    
    // Fee not claimed yet
    assert(!auction.platform_fee_claimed);
    assert_eq(fee_amount, auction.platform_fee_amount);
    
    // Execute transfer
    transfer_future.run();
    
    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: auction.state,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: auction.dispute_deadline,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: true,
        platform_fee_claimed_at: claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met,
        commitment_count: auction.commitment_count,
        revealed_count: auction.revealed_count,
        cancel_reason: auction.cancel_reason
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_cancel_reserve_not_met(
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
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: CANCELLED,
        winner: EMPTY_ADDRESS,
        winning_amount: 0u128,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: 0i64,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: false,
        commitment_count: auction.commitment_count,
        revealed_count: auction.revealed_count,
        cancel_reason: CANCEL_REASON_RESERVE_NOT_MET
    };
    
    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_upsert_seller_profile(
    seller: address,
    verification_status: u8,
    verification_tier: u8,
    profile_root: field,
    attestation_expiry: i64,
    updated_at: i64
) {
    assert(verification_status <= VERIFICATION_VERIFIED);
    assert(verification_tier <= 2u8);

    Mapping::set(seller_profiles, seller, SellerProfile {
        verification_status,
        verification_tier,
        profile_root,
        attestation_expiry,
        updated_at
    });
}

final fn finalize_set_auction_proof_root(
    auction_id: field,
    caller: address,
    proof_root: field,
    disclosure_root: field
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);

    assert_eq(auction.seller, caller);
    assert(auction.state == OPEN || auction.state == CLOSED || auction.state == CHALLENGE);

    Mapping::set(auction_proof_root, auction_id, proof_root);
    Mapping::set(auction_disclosure_root, auction_id, disclosure_root);
}

final fn finalize_open_dispute(
    auction_id: field,
    caller: address,
    dispute_root: field,
    opened_at: i64
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);
    let existing_dispute_root: field = Mapping::get_or_use(auction_dispute_root, auction_id, 0field);

    assert(existing_dispute_root == 0field);
    assert(auction.state == CHALLENGE || auction.state == SETTLED);
    assert_eq(auction.platform_fee_claimed, false);
    assert_eq(auction.payment_claimed, false);
    assert(caller == auction.seller || caller == auction.winner);

    Mapping::set(auction_dispute_root, auction_id, dispute_root);

    let disputed_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: DISPUTED,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: auction.dispute_deadline,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: auction.claimable_at,
        platform_fee_amount: auction.platform_fee_amount,
        seller_net_amount: auction.seller_net_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met,
        commitment_count: auction.commitment_count,
        revealed_count: auction.revealed_count,
        cancel_reason: auction.cancel_reason
    };

    Mapping::set(auctions, auction_id, disputed_auction);
}

final fn finalize_dispute_release(
    auction_id: field,
    caller: address,
    resolved_at: i64
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);

    assert_eq(caller, PLATFORM_ADDRESS);
    assert_eq(auction.state, DISPUTED);
    assert(Mapping::get_or_use(auction_dispute_root, auction_id, 0field) != 0field);

    Mapping::set(auction_dispute_root, auction_id, 0field);

    let fee_amount: u128 = auction.platform_fee_amount > 0u128
        ? auction.platform_fee_amount
        : (auction.winning_amount * (PLATFORM_FEE_RATE as u128)) / 10000u128;
    let seller_amount: u128 = auction.seller_net_amount > 0u128
        ? auction.seller_net_amount
        : auction.winning_amount - fee_amount;
    let settled_at: i64 = auction.settled_at > 0i64 ? auction.settled_at : resolved_at;
    let claimable_at: i64 = auction.claimable_at > 0i64
        ? auction.claimable_at
        : resolved_at + auction.confirmation_timeout;
    let winner_key: field = auction_id + BHP256::hash_to_field(auction.winner);

    if (auction.winner != EMPTY_ADDRESS && Mapping::contains(escrow, winner_key)) {
        let winner_escrow: Escrow = Mapping::get(escrow, winner_key);
        let updated_winner_escrow: Escrow = Escrow {
            bidder: winner_escrow.bidder,
            is_refunded: winner_escrow.is_refunded,
            is_winner: true
        };
        Mapping::set(escrow, winner_key, updated_winner_escrow);
    }

    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: SETTLED,
        winner: auction.winner,
        winning_amount: auction.winning_amount,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: auction.dispute_deadline,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: auction.payment_claimed,
        payment_claimed_at: auction.payment_claimed_at,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at,
        claimable_at,
        platform_fee_amount: fee_amount,
        seller_net_amount: seller_amount,
        platform_fee_claimed: auction.platform_fee_claimed,
        platform_fee_claimed_at: auction.platform_fee_claimed_at,
        reserve_price: auction.reserve_price,
        reserve_met: auction.reserve_met,
        commitment_count: auction.commitment_count,
        revealed_count: auction.revealed_count,
        cancel_reason: auction.cancel_reason
    };

    Mapping::set(auctions, auction_id, updated_auction);
}

final fn finalize_dispute_refund(
    auction_id: field,
    caller: address,
    resolved_at: i64
) {
    let auction: AuctionInfo = Mapping::get(auctions, auction_id);

    assert_eq(caller, PLATFORM_ADDRESS);
    assert_eq(auction.state, DISPUTED);
    assert(Mapping::get_or_use(auction_dispute_root, auction_id, 0field) != 0field);

    let winner_key: field = auction_id + BHP256::hash_to_field(auction.winner);
    if (Mapping::contains(escrow, winner_key)) {
        let winner_escrow: Escrow = Mapping::get(escrow, winner_key);
        let updated_winner_escrow: Escrow = Escrow {
            bidder: winner_escrow.bidder,
            is_refunded: winner_escrow.is_refunded,
            is_winner: false
        };
        Mapping::set(escrow, winner_key, updated_winner_escrow);
    }

    Mapping::set(auction_dispute_root, auction_id, 0field);

    let updated_auction: AuctionInfo = AuctionInfo {
        seller: auction.seller,
        min_bid_amount: auction.min_bid_amount,
        currency_type: auction.currency_type,
        end_time: auction.end_time,
        reveal_period: auction.reveal_period,
        dispute_period: auction.dispute_period,
        state: CANCELLED,
        winner: EMPTY_ADDRESS,
        winning_amount: 0u128,
        reveal_deadline: auction.reveal_deadline,
        dispute_deadline: 0i64,
        total_escrowed: auction.total_escrowed,
        asset_type: auction.asset_type,
        item_received: auction.item_received,
        item_received_at: auction.item_received_at,
        payment_claimed: false,
        payment_claimed_at: 0i64,
        confirmation_timeout: auction.confirmation_timeout,
        settled_at: auction.settled_at,
        claimable_at: 0i64,
        platform_fee_amount: 0u128,
        seller_net_amount: 0u128,
        platform_fee_claimed: false,
        platform_fee_claimed_at: 0i64,
        reserve_price: auction.reserve_price,
        reserve_met: false,
        commitment_count: auction.commitment_count,
        revealed_count: auction.revealed_count,
        cancel_reason: CANCEL_REASON_DISPUTE_REFUND
    };

    Mapping::set(auctions, auction_id, updated_auction);
}

program shadowbid_marketplace_v2_24.aleo {

    // Records
    // -------------------------

    // Auction receipt — owner is the SELLER
    record AuctionRecord {
        owner: address,           // Seller
        auction_id: field,        // Auction ID as field
        min_bid_amount: u128,     // Minimum bid (generic for both currencies)
        currency_type: u8,        // 0=USDCx, 1=Aleo
        end_time: i64,           // Unix timestamp
        reveal_period: i64,      // Duration in seconds
        dispute_period: i64      // Duration in seconds
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
    mapping seller_profiles: address => SellerProfile;
    mapping auction_proof_root: field => field;
    mapping auction_disclosure_root: field => field;
    mapping auction_dispute_root: field => field;

    // -------------------------
    // 1. Create Auction
    // -------------------------


    fn create_auction(
        public auction_id: field,
        public min_bid_amount: u128,
        public reserve_price: u128,
        public currency_type: u8,
        public asset_type: u8,
        public end_time: i64,
        public reveal_period: i64,
        public dispute_period: i64
    ) -> (AuctionRecord, Final) {

        let signer = self.signer;

        
        // Validate currency type
        assert(currency_type == CURRENCY_USDX || currency_type == CURRENCY_ALEO || currency_type == CURRENCY_USAD);
        
        // Validate asset type
        assert(asset_type <= 7u8);
        
        // Enforce reserve price floor
        assert(reserve_price >= min_bid_amount);
        
        // Create auction receipt for seller
        let receipt: AuctionRecord = AuctionRecord {
            owner: signer,
            auction_id,
            min_bid_amount,
            currency_type,
            end_time,
            reveal_period,
            dispute_period
        };

        return (receipt, final {
            finalize_create_auction(
            auction_id,
            signer,
            min_bid_amount,
            reserve_price,
            currency_type,
            asset_type,
            end_time,
            reveal_period,
            dispute_period
            );
        });
    }

    fn cancel_auction(
        public auction_id: field
    ) -> Final {

        let signer = self.signer;

        return final {
            finalize_cancel_auction(auction_id, signer);
        };
    }

    fn commit_bid(
        public auction_id: field,
        nonce: field,
        public amount_usdx: u128
    ) -> Final {

        let signer = self.signer;
        let commitment: field = BHP256::hash_to_field(BidCommitmentPreimage {
            auction_id,
            bidder: signer,
            amount: amount_usdx,
            nonce
        });

        let transfer_future: Final = test_usdcx_stablecoin.aleo::transfer_public_as_signer(
            shadowbid_marketplace_v2_24.aleo,
            amount_usdx
        );
        
        return final {
            finalize_commit_bid(auction_id, commitment, signer, amount_usdx, transfer_future);
        };
    }

    fn commit_bid_usad(
        public auction_id: field,
        nonce: field,
        public amount_usad: u128
    ) -> Final {

        let signer = self.signer;
        let commitment: field = BHP256::hash_to_field(BidCommitmentPreimage {
            auction_id,
            bidder: signer,
            amount: amount_usad,
            nonce
        });

        let transfer_future: Final = test_usad_stablecoin.aleo::transfer_public_as_signer(
            shadowbid_marketplace_v2_24.aleo,
            amount_usad
        );
        
        return final {
            finalize_commit_bid_usad(auction_id, commitment, signer, amount_usad, transfer_future);
        };
    }

    fn commit_bid_aleo(
        public auction_id: field,
        nonce: field,
        public amount_credits: u64
    ) -> Final {

        let signer = self.signer;
        let amount_u128: u128 = amount_credits as u128;
        let commitment: field = BHP256::hash_to_field(BidCommitmentPreimage {
            auction_id,
            bidder: signer,
            amount: amount_u128,
            nonce
        });

        // NO TRANSFER HERE - user already transferred in Step 1
        // Just record the commitment and escrow
        
        return final {
            finalize_commit_bid_aleo(
            auction_id,
            commitment,
            signer,
            amount_credits
            );
        };
    }

    fn close_auction(
        public auction_id: field,
        public closed_at: i64
    ) -> Final {

        let signer = self.signer;

        return final {
            finalize_close_auction(auction_id, signer, closed_at);
        };
    }

    fn reveal_bid(
        public auction_id: field,
        amount: u128,
        nonce: field,
        public revealed_at: i64
    ) -> Final {

        let signer = self.signer;

        let computed_commitment: field = BHP256::hash_to_field(BidCommitmentPreimage {
            auction_id,
            bidder: signer,
            amount,
            nonce
        });
        
        return final {
            finalize_reveal_bid(
            auction_id,
            computed_commitment,
            signer,
            amount,
            revealed_at
            );
        };
    }

    fn settle_after_reveal_timeout(
        public auction_id: field,
        public settled_at: i64
    ) -> Final {
        return final {
            finalize_reveal_timeout(auction_id, settled_at);
        };
    }

    fn determine_winner(
        public auction_id: field,
        public determined_at: i64
    ) -> Final {
        return final {
            finalize_reveal_timeout(auction_id, determined_at);
        };
    }

    fn finalize_winner(
        public auction_id: field,
        public finalized_at: i64
    ) -> (WinnerRecord, Final) {

        let signer = self.signer;

        
        let placeholder_record: WinnerRecord = WinnerRecord {
            owner: signer,
            auction_id,
            winning_amount: 0u128,
            currency_type: 0u8,
            finalized_at: 0i64
        };
        
        return (placeholder_record, final {
            finalize_finalize_winner(auction_id, signer, finalized_at);
        });
    }

    fn claim_refund(
        public auction_id: field,
        nonce: field,
        public refund_amount: u128
    ) -> Final {

        let signer = self.signer;
        let computed_commitment: field = BHP256::hash_to_field(BidCommitmentPreimage {
            auction_id,
            bidder: signer,
            amount: refund_amount,
            nonce
        });

        let transfer_future: Final = test_usdcx_stablecoin.aleo::transfer_public(
            signer,
            refund_amount
        );
        
        return final {
            finalize_claim_refund(auction_id, signer, computed_commitment, refund_amount, transfer_future);
        };
    }

    fn claim_refund_usad(
        public auction_id: field,
        nonce: field,
        public refund_amount: u128
    ) -> Final {

        let signer = self.signer;
        let computed_commitment: field = BHP256::hash_to_field(BidCommitmentPreimage {
            auction_id,
            bidder: signer,
            amount: refund_amount,
            nonce
        });

        let transfer_future: Final = test_usad_stablecoin.aleo::transfer_public(
            signer,
            refund_amount
        );
        
        return final {
            finalize_claim_refund_usad(auction_id, signer, computed_commitment, refund_amount, transfer_future);
        };
    }

    fn claim_refund_aleo(
        public auction_id: field,
        nonce: field,
        public refund_amount: u64
    ) -> Final {

        // Match the bidder identity used during commit/reveal.
        let signer = self.signer;
        let refund_amount_u128: u128 = refund_amount as u128;
        let computed_commitment: field = BHP256::hash_to_field(BidCommitmentPreimage {
            auction_id,
            bidder: signer,
            amount: refund_amount_u128,
            nonce
        });

        // Transfer Aleo credits FROM contract TO bidder.
        let transfer_future: Final = credits.aleo::transfer_public(
            signer,
            refund_amount
        );
        
        return final {
            finalize_claim_refund_aleo(
            auction_id,
            signer,
            computed_commitment,
            refund_amount,
            transfer_future
            );
        };
    }

    fn commit_bid_aleo_private(
        public auction_id: field,
        nonce: field,
        private_credits: credits.aleo::credits,  // Private input record
        public amount_credits: u64
    ) -> (credits.aleo::credits, Final) {

        let signer = self.signer;
        let amount_u128: u128 = amount_credits as u128;
        let commitment: field = BHP256::hash_to_field(BidCommitmentPreimage {
            auction_id,
            bidder: signer,
            amount: amount_u128,
            nonce
        });

        
        // Transfer private → public (returns change record)
        let (change_record, transfer_future): (credits.aleo::credits, Final) = 
            credits.aleo::transfer_private_to_public(
                private_credits,
                shadowbid_marketplace_v2_24.aleo,
                amount_credits
            );
        
        return (change_record, final {
            finalize_commit_aleo_priv(
            auction_id,
            commitment,
            signer,
            amount_credits,
            transfer_future
            );
        });
    }

    fn claim_refund_aleo_private(
        public auction_id: field,
        nonce: field,
        public refund_amount: u64
    ) -> (credits.aleo::credits, Final) {

        // Match the bidder identity used during commit/reveal.
        let signer = self.signer;
        let refund_amount_u128: u128 = refund_amount as u128;
        let computed_commitment: field = BHP256::hash_to_field(BidCommitmentPreimage {
            auction_id,
            bidder: signer,
            amount: refund_amount_u128,
            nonce
        });

        // Transfer public → private (returns private record to bidder).
        let (refund_record, transfer_future): (credits.aleo::credits, Final) = 
            credits.aleo::transfer_public_to_private(
                signer,
                refund_amount
            );
        
        return (refund_record, final {
            finalize_claim_refund_aleo(
            auction_id,
            signer,
            computed_commitment,
            refund_amount,
            transfer_future
            );
        });
    }

    fn confirm_receipt(
        public auction_id: field,
        public received_at: i64
    ) -> Final {

        let signer = self.signer;

        return final {
            finalize_confirm_receipt(auction_id, signer, received_at);
        };
    }

    fn claim_winning_aleo(
        public auction_id: field,
        public seller_net_amount_u64: u64,
        public seller_address: address,
        public claim_at: i64
    ) -> Final {

        let signer = self.signer;

        let transfer_future: Final = credits.aleo::transfer_public(
            seller_address,
            seller_net_amount_u64
        );
        
        return final {
            finalize_claim_winning_aleo(
            auction_id,
            signer,
            seller_net_amount_u64,
            seller_address,
            claim_at,
            transfer_future
            );
        };
    }

    fn claim_winning_usdcx(
        public auction_id: field,
        public seller_net_amount: u128,
        public seller_address: address,
        public claim_at: i64
    ) -> Final {

        let signer = self.signer;

        let transfer_future: Final = test_usdcx_stablecoin.aleo::transfer_public(
            seller_address,
            seller_net_amount
        );
        
        return final {
            finalize_claim_winning_usdcx(
            auction_id,
            signer,
            seller_net_amount,
            seller_address,
            claim_at,
            transfer_future
            );
        };
    }

    fn claim_winning_usad(
        public auction_id: field,
        public seller_net_amount: u128,
        public seller_address: address,
        public claim_at: i64
    ) -> Final {

        let signer = self.signer;

        let transfer_future: Final = test_usad_stablecoin.aleo::transfer_public(
            seller_address,
            seller_net_amount
        );
        
        return final {
            finalize_claim_winning_usad(
            auction_id,
            signer,
            seller_net_amount,
            seller_address,
            claim_at,
            transfer_future
            );
        };
    }

    fn claim_platform_fee_aleo(
        public auction_id: field,
        public fee_amount_u64: u64,
        public claimed_at: i64
    ) -> Final {

        let signer = self.signer;

        let transfer_future: Final = credits.aleo::transfer_public(
            PLATFORM_ADDRESS,
            fee_amount_u64
        );
        
        return final {
            finalize_claim_fee_aleo(auction_id, signer, fee_amount_u64, claimed_at, transfer_future);
        };
    }

    fn claim_platform_fee_usdcx(
        public auction_id: field,
        public fee_amount: u128,
        public claimed_at: i64
    ) -> Final {

        let signer = self.signer;

        let transfer_future: Final = test_usdcx_stablecoin.aleo::transfer_public(
            PLATFORM_ADDRESS,
            fee_amount
        );
        
        return final {
            finalize_claim_fee_usdcx(auction_id, signer, fee_amount, claimed_at, transfer_future);
        };
    }

    fn claim_platform_fee_usad(
        public auction_id: field,
        public fee_amount: u128,
        public claimed_at: i64
    ) -> Final {

        let signer = self.signer;

        let transfer_future: Final = test_usad_stablecoin.aleo::transfer_public(
            PLATFORM_ADDRESS,
            fee_amount
        );
        
        return final {
            finalize_claim_fee_usad(auction_id, signer, fee_amount, claimed_at, transfer_future);
        };
    }

    fn cancel_auction_reserve_not_met(
        public auction_id: field
    ) -> Final {

        let signer = self.signer;

        return final {
            finalize_cancel_reserve_not_met(auction_id, signer);
        };
    }

    fn upsert_seller_profile(
        public verification_status: u8,
        public verification_tier: u8,
        public profile_root: field,
        public attestation_expiry: i64,
        public updated_at: i64
    ) -> Final {

        let signer = self.signer;

        return final {
            finalize_upsert_seller_profile(
            signer,
            verification_status,
            verification_tier,
            profile_root,
            attestation_expiry,
            updated_at
            );
        };
    }

    fn set_auction_proof_root(
        public auction_id: field,
        public proof_root: field,
        public disclosure_root: field
    ) -> Final {

        let signer = self.signer;

        return final {
            finalize_set_auction_proof_root(auction_id, signer, proof_root, disclosure_root);
        };
    }

    fn open_dispute(
        public auction_id: field,
        public dispute_root: field,
        public opened_at: i64
    ) -> Final {

        let signer = self.signer;

        return final {
            finalize_open_dispute(auction_id, signer, dispute_root, opened_at);
        };
    }

    fn resolve_dispute_release_seller(
        public auction_id: field,
        public resolved_at: i64
    ) -> Final {

        let signer = self.signer;

        return final {
            finalize_dispute_release(auction_id, signer, resolved_at);
        };
    }

    fn resolve_dispute_refund_winner(
        public auction_id: field,
        public resolved_at: i64
    ) -> Final {

        let signer = self.signer;

        return final {
            finalize_dispute_refund(auction_id, signer, resolved_at);
        };
    }

    @admin(address = "aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8")
    constructor() {}
}
