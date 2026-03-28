// Auction State Validator
// Validates auction state before allowing user actions

const AUCTION_STATES = {
  OPEN: 0,
  CLOSED: 1,
  CHALLENGE: 2,
  SETTLED: 3,
  CANCELLED: 4,
  DISPUTED: 5,
};

const STATE_NAMES = {
  0: 'OPEN',
  1: 'CLOSED',
  2: 'CHALLENGE',
  3: 'SETTLED',
  4: 'CANCELLED',
  5: 'DISPUTED',
};

const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'shadowbid_marketplace_v2_21.aleo';
const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.explorer.provable.com/v1/testnet';

/**
 * Fetch auction info from on-chain
 */
export async function fetchAuctionInfo(auctionId) {
  try {
    const response = await fetch(
      `${API_BASE}/program/${PROGRAM_ID}/mapping/auctions/${auctionId}field`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return { error: 'Auction not found', notFound: true };
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse auction info from response
    // Response format: "{ seller: address, min_bid_usdx: u128, ... }"
    const auctionInfo = parseAuctionInfo(data);
    
    return { auction: auctionInfo, error: null };
  } catch (error) {
    console.error('[AuctionValidator] Fetch error:', error);
    return { error: error.message, auction: null };
  }
}

/**
 * Parse auction info from API response
 */
function parseAuctionInfo(data) {
  // API returns string like: "{ seller: aleo1..., state: 0u8, ... }"
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  
  // Extract state (most important for validation)
  const stateMatch = str.match(/state:\s*(\d+)u8/);
  const state = stateMatch ? parseInt(stateMatch[1]) : null;
  
  // Extract other fields
  const sellerMatch = str.match(/seller:\s*(aleo1[a-z0-9]+)/);
  const seller = sellerMatch ? sellerMatch[1] : null;
  
  // V2.14: Try new field names first, fallback to old names
  const minBidMatch = str.match(/min_bid_amount:\s*(\d+)u128/) || str.match(/min_bid_usdx:\s*(\d+)u128/);
  const minBidUsdx = minBidMatch ? parseInt(minBidMatch[1]) : null;
  
  // V2.14: Extract currency_type (0=USDC, 1=Aleo)
  const currencyTypeMatch = str.match(/currency_type:\s*(\d+)u8/);
  const currency_type = currencyTypeMatch ? parseInt(currencyTypeMatch[1]) : 0; // Default to USDC for old auctions
  
  const winnerMatch = str.match(/winner:\s*(aleo1[a-z0-9]+)/);
  const winner = winnerMatch ? winnerMatch[1] : null;
  
  const winningAmountMatch = str.match(/winning_amount:\s*(\d+)u128/) || str.match(/winning_amount_usdx:\s*(\d+)u128/);
  const winningAmount = winningAmountMatch ? parseInt(winningAmountMatch[1]) : null;
  
  const totalEscrowedMatch = str.match(/total_escrowed:\s*(\d+)u128/) || str.match(/total_escrowed_usdx:\s*(\d+)u128/);
  const totalEscrowed = totalEscrowedMatch ? parseInt(totalEscrowedMatch[1]) : null;
  
  return {
    state,
    stateName: STATE_NAMES[state] || 'UNKNOWN',
    seller,
    minBidUsdx,
    currency_type,  // NEW: 0=USDC, 1=Aleo
    winner,
    winningAmount,
    totalEscrowed,
    raw: str
  };
}

/**
 * Validate if action is allowed based on current auction state
 */
export function validateAction(action, currentState) {
  const validations = {
    'commit_bid': {
      requiredState: AUCTION_STATES.OPEN,
      message: 'Auction must be OPEN to commit bids'
    },
    'close_auction': {
      requiredState: AUCTION_STATES.OPEN,
      message: 'Auction must be OPEN to close'
    },
    'reveal_bid': {
      requiredState: AUCTION_STATES.CLOSED,
      message: 'Auction must be CLOSED to reveal bids. Seller needs to close the auction first.'
    },
    'settle_after_reveal_timeout': {
      requiredState: AUCTION_STATES.CLOSED,
      message: 'Auction must be CLOSED before the seller can settle it after the reveal deadline.'
    },
    'determine_winner': {
      requiredState: AUCTION_STATES.CLOSED,
      message: 'Auction must be CLOSED before the seller can settle it after the reveal deadline.'
    },
    'finalize_winner': {
      requiredState: AUCTION_STATES.CHALLENGE,
      message: 'Auction must be in CHALLENGE state to finalize winner'
    },
    'claim_refund': {
      requiredState: AUCTION_STATES.SETTLED,
      message: 'Auction must be SETTLED to claim refunds'
    }
  };
  
  const validation = validations[action];
  if (!validation) {
    return { valid: true };
  }
  
  const isValid = currentState === validation.requiredState;
  
  return {
    valid: isValid,
    message: isValid ? null : validation.message,
    currentState: STATE_NAMES[currentState],
    requiredState: STATE_NAMES[validation.requiredState]
  };
}

/**
 * Get user-friendly state description
 */
export function getStateDescription(state) {
  const descriptions = {
    [AUCTION_STATES.OPEN]: {
      name: 'OPEN',
      description: 'Auction is accepting bids',
      color: 'green',
      icon: '🟢',
      allowedActions: ['Commit Bid', 'Close Auction (Seller)']
    },
    [AUCTION_STATES.CLOSED]: {
      name: 'CLOSED',
      description: 'Bidding closed, reveal window active or waiting for timeout settlement',
      color: 'blue',
      icon: '🔵',
      allowedActions: ['Reveal Bid', 'Settle After Reveal Timeout (Seller)']
    },
    [AUCTION_STATES.CHALLENGE]: {
      name: 'CHALLENGE',
      description: 'Winner selected, dispute window active',
      color: 'yellow',
      icon: '🟡',
      allowedActions: ['Finalize Winner (Seller)']
    },
    [AUCTION_STATES.SETTLED]: {
      name: 'SETTLED',
      description: 'Auction completed, ready for settlement',
      color: 'purple',
      icon: '🟣',
      allowedActions: ['Claim Refund (Losers)', 'Manual Settlement (Owner)']
    },
    [AUCTION_STATES.CANCELLED]: {
      name: 'CANCELLED',
      description: 'Auction cancelled or no valid reveal met the reserve',
      color: 'red',
      icon: '🔴',
      allowedActions: []
    },
    [AUCTION_STATES.DISPUTED]: {
      name: 'DISPUTED',
      description: 'An on-chain dispute is open and must be resolved before settlement continues',
      color: 'red',
      icon: '🟥',
      allowedActions: ['Resolve Dispute']
    }
  };
  
  return descriptions[state] || {
    name: 'UNKNOWN',
    description: 'Unknown state',
    color: 'gray',
    icon: '⚪',
    allowedActions: []
  };
}

/**
 * Get next required action based on current state
 */
export function getNextAction(state, userRole) {
  const nextActions = {
    [AUCTION_STATES.OPEN]: {
      seller: 'Close the auction when bidding period ends',
      bidder: 'Commit your bid (two-step process)'
    },
    [AUCTION_STATES.CLOSED]: {
      seller: 'Wait for the reveal deadline, then settle after reveal timeout',
      bidder: 'Reveal your bid with the saved nonce before the reveal deadline'
    },
    [AUCTION_STATES.CHALLENGE]: {
      seller: 'Finalize the winner after the dispute deadline',
      bidder: 'Wait for seller to finalize or open a dispute if needed'
    },
    [AUCTION_STATES.SETTLED]: {
      seller: 'Manually settle payments via Shield Wallet',
      bidder: 'Wait for refund if you lost'
    },
    [AUCTION_STATES.CANCELLED]: {
      seller: 'Auction cancelled',
      bidder: 'Auction cancelled'
    },
    [AUCTION_STATES.DISPUTED]: {
      seller: 'Resolve the dispute before continuing settlement',
      bidder: 'Wait for dispute resolution'
    }
  };
  
  const actions = nextActions[state];
  return actions ? actions[userRole] || actions.bidder : 'Unknown state';
}

export { AUCTION_STATES, STATE_NAMES };
