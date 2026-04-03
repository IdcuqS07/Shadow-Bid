const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'shadowbid_marketplace_v2_22.aleo';
const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.explorer.provable.com/v1/testnet';
const AUCTIONEER = import.meta.env.VITE_AUCTIONEER_ADDRESS || 'aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8';

async function requestTx(executeTransaction, programFunction, inputs, fee = 1_000_000, privateFee = false) {
  if (!executeTransaction) throw new Error('Wallet not available');
  
  const txPayload = {
    program: PROGRAM_ID,
    function: programFunction,
    inputs,
    fee,
    privateFee,
  };
  
  console.log('[aleoService] ========== TRANSACTION REQUEST ==========');
  console.log('[aleoService] Function:', programFunction);
  console.log('[aleoService] Program:', PROGRAM_ID);
  console.log('[aleoService] Inputs array:', inputs);
  console.log('[aleoService] Inputs JSON:', JSON.stringify(inputs, null, 2));
  console.log('[aleoService] Fee:', fee);
  console.log('[aleoService] PrivateFee:', privateFee);
  console.log('[aleoService] Full payload:', JSON.stringify(txPayload, null, 2));
  console.log('[aleoService] =======================================');
  
  try {
    const result = await executeTransaction(txPayload);
    console.log('[aleoService] ✅ Transaction SUCCESS:', result);
    return result;
  } catch (error) {
    console.error('[aleoService] ❌ Transaction FAILED');
    console.error('[aleoService] Error:', error);
    console.error('[aleoService] Error message:', error.message);
    console.error('[aleoService] Error stack:', error.stack);
    console.error('[aleoService] Failed payload:', JSON.stringify(txPayload, null, 2));
    throw error;
  }
}

// 1. Create Auction
export async function createAuction(executeTransaction, auctionId, minBidCredits, endBlock) {
  const minBidMicro = Math.round(minBidCredits * 1_000_000);
  
  console.log('[aleoService] ========== CREATE AUCTION ==========');
  console.log('[aleoService] createAuction params:', {
    auctionId,
    minBidCredits,
    minBidMicro,
    endBlock
  });
  
  const inputs = [
    `${auctionId}u64`,
    `${minBidMicro}u64`,
    `${endBlock}u32`,
  ];
  
  console.log('[aleoService] createAuction inputs:', inputs);
  console.log('[aleoService] =====================================');
  
  return requestTx(executeTransaction, 'create_auction', inputs);
}

// 2. Place Bid (Sealed)
export async function placeBid(executeTransaction, auctionId, amountCredits, bidderAddress) {
  const amountMicro = Math.round(amountCredits * 1_000_000);
  
  console.log('[aleoService] ========== PLACE BID ==========');
  console.log('[aleoService] placeBid params:', {
    auctionId,
    amountCredits,
    amountMicro,
    bidderAddress,
    auctioneer: AUCTIONEER
  });
  
  // Contract signature:
  // place_bid(public auction_id: u64, public auctioneer: address, bidder: address, amount: u64)
  // All params passed as strings - wallet handles public/private internally
  const inputs = [
    `${auctionId}u64`,
    AUCTIONEER,
    bidderAddress,
    `${amountMicro}u64`
  ];
  
  console.log('[aleoService] placeBid inputs:', inputs);
  console.log('[aleoService] Input[0] (auction_id):', inputs[0], typeof inputs[0]);
  console.log('[aleoService] Input[1] (auctioneer):', inputs[1], typeof inputs[1]);
  console.log('[aleoService] Input[2] (bidder):', inputs[2], typeof inputs[2]);
  console.log('[aleoService] Input[3] (amount):', inputs[3], typeof inputs[3]);
  console.log('[aleoService] =====================================');
  
  return requestTx(executeTransaction, 'place_bid', inputs);
}

// 3. Close Auction (auctioneer only)
export async function closeAuction(executeTransaction, auctionId) {
  console.log('[aleoService] closeAuction params:', { auctionId });
  
  return requestTx(executeTransaction, 'close_auction', [
    `${auctionId}u64`
  ]);
}

// 4. Resolve — compare two bids, return higher one
export async function resolveBids(executeTransaction, firstBidRecord, secondBidRecord) {
  console.log('[aleoService] resolveBids params:', {
    firstBidRecord: firstBidRecord.substring(0, 50) + '...',
    secondBidRecord: secondBidRecord.substring(0, 50) + '...'
  });
  
  return requestTx(executeTransaction, 'resolve', [
    firstBidRecord, 
    secondBidRecord
  ]);
}

// 5. Finish — declare winner on-chain
export async function finishAuction(executeTransaction, auctionId, winningBidRecord) {
  console.log('[aleoService] finishAuction params:', {
    auctionId,
    winningBidRecord: winningBidRecord.substring(0, 50) + '...'
  });
  
  return requestTx(executeTransaction, 'finish', [
    `${auctionId}u64`,
    winningBidRecord,
  ]);
}

// Query auction info from on-chain mapping
export async function getAuctionInfo(auctionId) {
  try {
    const res = await fetch(`${API_BASE}/program/${PROGRAM_ID}/mapping/auctions/${auctionId}field`);
    if (!res.ok) {
      console.log('[aleoService] getAuctionInfo failed:', res.status, res.statusText);
      return null;
    }
    return res.json();
  } catch (error) {
    console.error('[aleoService] getAuctionInfo error:', error);
    return null;
  }
}

// Check if program is deployed
export async function checkProgramDeployed() {
  try {
    const res = await fetch(`${API_BASE}/program/${PROGRAM_ID}`);
    console.log('[aleoService] Program check:', res.status, res.statusText);
    if (!res.ok) {
      console.error('[aleoService] Program NOT deployed:', PROGRAM_ID);
      return false;
    }
    const data = await res.json();
    console.log('[aleoService] Program IS deployed:', data);
    return true;
  } catch (error) {
    console.error('[aleoService] checkProgramDeployed error:', error);
    return false;
  }
}

// Query winner from on-chain mapping
export async function getAuctionWinner(auctionId) {
  const res = await fetch(`${API_BASE}/program/${PROGRAM_ID}/mapping/highest_bidder/${auctionId}field`);
  if (!res.ok) return null;
  return res.json();
}

// Query highest bid from the v2.21 tracker mapping.
export async function getHighestBid(auctionId) {
  const res = await fetch(`${API_BASE}/program/${PROGRAM_ID}/mapping/highest_bid/${auctionId}field`);
  if (!res.ok) return null;
  return res.json();
}
