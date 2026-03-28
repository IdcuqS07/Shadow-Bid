/**
 * Utility functions for auction state management
 */

/**
 * Map on-chain state number to UI status string
 * State constants from smart contract:
 * OPEN: 0u8
 * REVEAL: 1u8
 * CHALLENGE: 2u8
 * SETTLED: 3u8
 * CANCELLED: 4u8
 */
export function mapStateToStatus(state) {
  const stateNum = typeof state === 'string' ? parseInt(state.replace('u8', '')) : state;
  
  switch (stateNum) {
    case 0:
      return 'active'; // OPEN
    case 1:
      return 'reveal_open'; // REVEAL
    case 2:
      return 'pending_settlement'; // CHALLENGE
    case 3:
      return 'settled'; // SETTLED
    case 4:
      return 'cancelled'; // CANCELLED
    default:
      return 'active';
  }
}

/**
 * Parse Leo format auction data and extract state
 */
export function parseAuctionState(rawData) {
  if (!rawData) return null;
  
  try {
    // Extract state field from Leo format
    const stateMatch = rawData.match(/state:\s*(\d+)u8/);
    if (stateMatch) {
      return parseInt(stateMatch[1]);
    }
    return null;
  } catch (error) {
    console.error('[parseAuctionState] Error:', error);
    return null;
  }
}
