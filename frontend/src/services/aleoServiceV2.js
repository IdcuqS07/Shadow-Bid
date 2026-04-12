import { recordWalletDebug } from '@/wallets/walletDebug';

// Aleo Service V2 - For shadowbid_marketplace_v2_24.aleo
// V2.24: Refund identity consistency for Aleo plus v2.23 lifecycle guards
// V2.19: Platform fee (2.5%), reserve price, settlement timing fix

// NOTE: write-path helpers below target the remediated contract ABI in `contracts/src/main.leo`.
// Point `VITE_PROGRAM_ID` at the redeployed program before using commit/refund transactions.
const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'shadowbid_marketplace_v2_24.aleo';
const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.explorer.provable.com/v1/testnet';
const BID_RECOVERY_SCHEMA = 'shadowbid.bid-recovery';
const BID_RECOVERY_SCHEMA_VERSION = 1;

// V2.19 NEW: Platform fee configuration
const PLATFORM_FEE_RATE = 250; // 2.5% (250 basis points / 10000)
export const PLATFORM_ADDRESS = 'aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8';
export const EMPTY_ALEO_ADDRESS = 'aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeProgramId(programId) {
  return typeof programId === 'string' && programId.trim()
    ? programId.trim()
    : PROGRAM_ID;
}

export function inferContractVersionFromProgramId(programId = PROGRAM_ID) {
  const normalizedProgramId = normalizeProgramId(programId);
  const versionMatch = normalizedProgramId.match(/shadowbid_marketplace_v(\d+)_(\d+)\.aleo/i);
  if (!versionMatch) {
    return 'current';
  }

  return `v${versionMatch[1]}.${versionMatch[2]}`;
}

function nonceStorageKey(auctionId, walletAddress) {
  return `nonce_${auctionId}_${walletAddress}`;
}

function commitmentStorageKey(auctionId, walletAddress) {
  return `commitment_${auctionId}_${walletAddress}`;
}

function extractStructSource(data) {
  if (typeof data === 'string') {
    return data;
  }

  if (!data || typeof data !== 'object') {
    return null;
  }

  const candidates = [
    data.plaintext,
    data.value,
    data.data,
    data.auction,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      return candidate;
    }
  }

  return null;
}

function extractStructValue(structSource, key) {
  if (typeof structSource !== 'string') {
    return null;
  }

  const match = structSource.match(new RegExp(`${key}:\\s*([^,\\n}]+)`));
  return match ? match[1].trim() : null;
}

export function normalizeAuctionInfoResponse(data) {
  if (!data) {
    return null;
  }

  if (
    typeof data === 'object' &&
    !Array.isArray(data) &&
    ['state', 'seller', 'min_bid_amount', 'currency_type', 'total_escrowed', 'asset_type'].some((key) => key in data)
  ) {
    return data;
  }

  const structSource = extractStructSource(data);
  if (!structSource) {
    return data;
  }

  const fields = [
    'seller',
    'min_bid_amount',
    'currency_type',
    'end_time',
    'reveal_period',
    'dispute_period',
    'challenge_period',
    'state',
    'winner',
    'winning_amount',
    'reveal_deadline',
    'dispute_deadline',
    'challenge_end_time',
    'total_escrowed',
    'asset_type',
    'item_received',
    'item_received_at',
    'payment_claimed',
    'payment_claimed_at',
    'confirmation_timeout',
    // V2.19 NEW fields
    'settled_at',
    'claimable_at',
    'platform_fee_amount',
    'seller_net_amount',
    'platform_fee_claimed',
    'platform_fee_claimed_at',
    'reserve_price',
    'reserve_met',
    'commitment_count',
    'revealed_count',
    'cancel_reason',
  ];

  const normalized = {};
  for (const field of fields) {
    const value = extractStructValue(structSource, field);
    if (value !== null) {
      normalized[field] = value;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : data;
}

async function loadFixtureValue(loaderName, ...args) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const fixtureModule = await import('@/lib/testData/shadowbidV221Fixtures');
    const loader = fixtureModule?.[loaderName];
    return typeof loader === 'function' ? loader(...args) : null;
  } catch {
    return null;
  }
}

async function fetchJsonWithFixtureFallback(path, loaderName, loaderArgs = [], normalizeValue = (value) => value) {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (res.ok) {
      return normalizeValue(await res.json());
    }
  } catch {
    // Fall back to local fixture data when explorer access is unavailable.
  }

  const fallbackValue = await loadFixtureValue(loaderName, ...loaderArgs);
  return normalizeValue(fallbackValue);
}

// V2.19 NEW: Helper functions for platform fee and reserve price
export function calculatePlatformFee(winningAmount) {
  const amount = BigInt(winningAmount);
  const fee = (amount * BigInt(PLATFORM_FEE_RATE)) / 10000n;
  return fee.toString();
}

export function calculateSellerNetAmount(winningAmount) {
  const amount = BigInt(winningAmount);
  const fee = (amount * BigInt(PLATFORM_FEE_RATE)) / 10000n;
  const netAmount = amount - fee;
  return netAmount.toString();
}

export function isReserveMet(winningAmount, reservePrice) {
  return BigInt(winningAmount) >= BigInt(reservePrice);
}

export function getCurrentTimestamp() {
  return Math.floor(Date.now() / 1000);
}

export function calculateClaimableAt(settledAt, confirmationTimeout) {
  return parseInt(settledAt) + parseInt(confirmationTimeout);
}

const UINT64_MAX = (1n << 64n) - 1n;
const UINT128_MAX = (1n << 128n) - 1n;

function formatUnsignedTransactionInput(value, type) {
  let normalizedValue;

  if (typeof value === 'bigint') {
    normalizedValue = value;
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      throw new Error(`Invalid ${type} value: ${value}`);
    }

    normalizedValue = BigInt(value);
  } else if (typeof value === 'string') {
    const trimmedValue = value.trim();
    const match = trimmedValue.match(/^(\d+)(?:u(?:64|128))?(?:\.(?:public|private))?$/);

    if (!match) {
      throw new Error(`Invalid ${type} value: ${value}`);
    }

    normalizedValue = BigInt(match[1]);
  } else {
    throw new Error(`Missing ${type} value`);
  }

  const maxValue = type === 'u64' ? UINT64_MAX : UINT128_MAX;
  if (normalizedValue > maxValue) {
    throw new Error(`${type} value exceeds ${type} max`);
  }

  return `${normalizedValue}${type}`;
}

function formatFieldInput(value) {
  if (typeof value === 'string') {
    return value.endsWith('field') ? value : `${value}field`;
  }

  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) {
    return `${value}field`;
  }

  throw new Error(`Invalid field value: ${value}`);
}

function formatTransactionInputPreview(value) {
  if (value && typeof value === 'object') {
    return 'Object';
  }

  return String(value);
}

function buildTransactionPreviewMessage(txPayload, options = {}) {
  const heading = typeof options.debugHeading === 'string' && options.debugHeading.trim()
    ? options.debugHeading.trim()
    : 'Submitting transaction.';
  const inputLabels = Array.isArray(options.inputLabels) ? options.inputLabels : [];
  const lines = [
    heading,
    `- Program: ${txPayload.program}`,
    `- Function: ${txPayload.function}`,
    '- Inputs:',
  ];

  txPayload.inputs.forEach((input, index) => {
    const label = inputLabels[index] || `input_${index + 1}`;
    lines.push(`${index + 1}. ${label}: ${formatTransactionInputPreview(input)}`);
  });

  return lines.join('\n');
}

export function buildPrivateBidAleoSubmissionPreview({
  programId = PROGRAM_ID,
  auctionId,
  nonce,
  privateRecord,
  amountCredits,
}) {
  return buildTransactionPreviewMessage({
    program: normalizeProgramId(programId),
    function: 'commit_bid_aleo_private',
    inputs: [
      formatFieldInput(auctionId),
      formatFieldInput(nonce),
      privateRecord,
      formatUnsignedTransactionInput(amountCredits, 'u64'),
    ],
  }, {
    debugHeading: 'Submitting private bid transaction.',
    inputLabels: [
      'auction_id',
      'nonce',
      'private_credits',
      'amount_credits',
    ],
  });
}

export async function hashStringToField(value) {
  const normalizedValue = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.subtle) {
    const encoded = new TextEncoder().encode(normalizedValue);
    const digest = await cryptoApi.subtle.digest('SHA-256', encoded);
    const bytes = new Uint8Array(digest).slice(0, 31);

    let result = 0n;
    for (const byte of bytes) {
      result = (result << 8n) | BigInt(byte);
    }

    return `${result === 0n ? 1n : result}field`;
  }

  let fallback = 0n;
  for (let index = 0; index < normalizedValue.length; index += 1) {
    fallback = (fallback * 131n + BigInt(normalizedValue.charCodeAt(index))) & ((1n << 248n) - 1n);
  }

  return `${fallback === 0n ? 1n : fallback}field`;
}

export async function hashJsonToField(value) {
  return hashStringToField(JSON.stringify(value ?? null));
}

// Helper: Request transaction
async function requestTx(
  executeTransaction,
  programFunction,
  inputs,
  fee = 1_000_000,
  privateFee = false,
  options = {}
) {
  if (!executeTransaction) throw new Error('Wallet not available');
  
  const txPayload = {
    program: normalizeProgramId(options.programId),
    function: programFunction,
    inputs,
    fee,
    privateFee,
  };

  if (options.debugHeading || Array.isArray(options.inputLabels)) {
    const previewMessage = buildTransactionPreviewMessage(txPayload, options);
    console.info(`[aleoServiceV2] ${previewMessage}`);
    recordWalletDebug('transaction-request', {
      program: txPayload.program,
      function: txPayload.function,
      fee: txPayload.fee,
      privateFee: txPayload.privateFee,
      inputLabels: Array.isArray(options.inputLabels) ? options.inputLabels : [],
      inputPreview: txPayload.inputs.map((input) => formatTransactionInputPreview(input)),
      previewMessage,
    });
  }
  
  try {
    return await executeTransaction(txPayload);
  } catch (error) {
    console.error('[aleoServiceV2] ❌ Transaction FAILED');
    console.error('[aleoServiceV2] Error:', error);
    throw error;
  }
}

// Helper: Generate random nonce for commitment
export function generateNonce() {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues) {
    // 31 random bytes stay comfortably within the Aleo field range.
    const bytes = new Uint8Array(31);
    cryptoApi.getRandomValues(bytes);

    let randomBigInt = 0n;
    for (const byte of bytes) {
      randomBigInt = (randomBigInt << 8n) | BigInt(byte);
    }

    return `${randomBigInt === 0n ? 1n : randomBigInt}field`;
  }

  const timestampPart = BigInt(Date.now()) << 32n;
  const randomPart = BigInt(Math.floor(Math.random() * 0x1_0000_0000));
  return `${timestampPart | randomPart}field`;
}

// The remediated contract source now derives commitments on-chain.
// Keep this export only to fail loudly if an older UI path still tries to precompute one.
export function generateCommitment() {
  throw new Error('generateCommitment is deprecated. Persist the nonce and let the contract derive the commitment.');
}

// 1. Create Auction (V2.21 - Split reveal/dispute periods)
// Params: auction_id, min_bid_amount, reserve_price, currency_type (0=USDCx, 1=Aleo, 2=USAD), asset_type (0-7), end_time, reveal_period, dispute_period
export async function createAuction(
  executeTransaction,
  auctionId,
  minBidAmount,
  reservePrice,
  currencyType,
  assetType,
  endTime,
  revealPeriod = 86400,
  disputePeriod = revealPeriod,
  options = {}
) {
  const inputs = [
    `${auctionId}field`,
    `${minBidAmount}u128`,
    `${reservePrice}u128`,
    `${currencyType}u8`,
    `${assetType}u8`,
    `${endTime}i64`,
    `${revealPeriod}i64`,
    `${disputePeriod}i64`
  ];
  
  return requestTx(executeTransaction, 'create_auction', inputs, 1_000_000, false, options);
}

// 1b. Cancel Auction (V2.10)
// Seller can cancel auction if no bids have been placed yet
export async function cancelAuction(executeTransaction, auctionId, options = {}) {
  return requestTx(executeTransaction, 'cancel_auction', [
    `${auctionId}field`     // V2.10: Changed to field
  ], 1_000_000, false, options);
}

// 2. Commit Bid (V2.21)
// Params: auction_id, nonce (private), amount_usdx
// NOTE: This will transfer USDX from bidder to contract
export async function commitBid(executeTransaction, auctionId, nonce, amountUsdx, options = {}) {
  const inputs = [
    `${auctionId}field`,
    formatFieldInput(nonce),
    `${amountUsdx}u128`
  ];
  
  return requestTx(executeTransaction, 'commit_bid', inputs, 1_000_000, false, options);
}

// 3. Close Auction (V2.21 keeper-friendly)
export async function closeAuction(executeTransaction, auctionId, closedAt = null, options = {}) {
  const timestamp = closedAt || getCurrentTimestamp();
  return requestTx(executeTransaction, 'close_auction', [
    `${auctionId}field`,
    `${timestamp}i64`
  ], 1_000_000, false, options);
}

// 4. Reveal Bid (V2.21 reveal timestamp)
// Params: auction_id, amount_usdx (private), nonce (private), revealed_at
export async function revealBid(executeTransaction, auctionId, amountUsdx, nonce, revealedAt = null, options = {}) {
  const timestamp = revealedAt || getCurrentTimestamp();
  const normalizedNonce = typeof nonce === 'string' && nonce.endsWith('field')
    ? nonce
    : `${nonce}field`;

  const inputs = [
    `${auctionId}field`,
    `${amountUsdx}u128`,
    normalizedNonce,
    `${timestamp}i64`
  ];
  
  return requestTx(executeTransaction, 'reveal_bid', inputs, 1_000_000, false, options);
}

// 5. Settle After Reveal Timeout (V2.21 keeper-friendly)
export async function settleAfterRevealTimeout(executeTransaction, auctionId, settledAt = null, options = {}) {
  const timestamp = settledAt || getCurrentTimestamp();
  return requestTx(executeTransaction, 'settle_after_reveal_timeout', [
    `${auctionId}field`,
    `${timestamp}i64`
  ], 1_000_000, false, options);
}

// Backward-compatible alias for older UI flows.
export async function determineWinner(executeTransaction, auctionId, determinedAt = null, options = {}) {
  return settleAfterRevealTimeout(executeTransaction, auctionId, determinedAt, options);
}

// 6. Finalize Winner (V2.21 - After dispute deadline)
export async function finalizeWinner(executeTransaction, auctionId, finalizedAt = null, options = {}) {
  const timestamp = finalizedAt || getCurrentTimestamp();
  return requestTx(executeTransaction, 'finalize_winner', [
    `${auctionId}field`,
    `${timestamp}i64`
  ], 1_000_000, false, options);
}

// 6b. Pay Seller (V2.10)
// Transfer USDX from contract to seller
// Call this AFTER finalize_winner
export async function paySeller(executeTransaction, auctionId, sellerAddress, winningAmount, options = {}) {
  const inputs = [
    `${auctionId}field`,    // V2.10: Changed to field
    sellerAddress,
    `${winningAmount}u128`
  ];
  
  return requestTx(executeTransaction, 'pay_seller', inputs, 1_000_000, false, options);
}

// 7. Claim Refund (V2.21)
// User must provide the original nonce so the contract can recompute the commitment.
export async function claimRefund(executeTransaction, auctionId, nonce, refundAmount, options = {}) {
  return requestTx(executeTransaction, 'claim_refund', [
    `${auctionId}field`,
    formatFieldInput(nonce),
    `${refundAmount}u128`
  ], 1_000_000, false, options);
}

// 7b. Process Refund (V2.5 NEW)
// Transfer USDX from contract to loser
// Call this AFTER claim_refund
export async function processRefund(executeTransaction, bidderAddress, refundAmount, options = {}) {
  const inputs = [
    bidderAddress,
    `${refundAmount}u128`
  ];
  
  return requestTx(executeTransaction, 'process_refund', inputs, 1_000_000, false, options);
}

// Query Functions

// Get auction info from on-chain mapping
export async function getAuctionInfo(auctionId, programId = null) {
  try {
    return await fetchJsonWithFixtureFallback(
      `/program/${normalizeProgramId(programId)}/mapping/auctions/${auctionId}field`,
      'getMockFixtureAuctionInfo',
      [auctionId],
      normalizeAuctionInfoResponse
    );
  } catch (error) {
    console.error('[aleoServiceV2] getAuctionInfo error:', error);
    return null;
  }
}

// Get commitment info
export async function getCommitment(auctionId) {
  try {
    const res = await fetch(`${API_BASE}/program/${PROGRAM_ID}/mapping/commitments/${auctionId}field`);
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error('[aleoServiceV2] getCommitment error:', error);
    return null;
  }
}

// Get escrow info
export async function getEscrow(auctionId) {
  try {
    const res = await fetch(`${API_BASE}/program/${PROGRAM_ID}/mapping/escrow/${auctionId}field`);
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error('[aleoServiceV2] getEscrow error:', error);
    return null;
  }
}

// Get highest bid
export async function getHighestBid(auctionId, programId = null) {
  try {
    return await fetchJsonWithFixtureFallback(
      `/program/${normalizeProgramId(programId)}/mapping/highest_bid/${auctionId}field`,
      'getMockFixtureHighestBid',
      [auctionId]
    );
  } catch (error) {
    console.error('[aleoServiceV2] getHighestBid error:', error);
    return null;
  }
}

// Get highest bidder
export async function getHighestBidder(auctionId, programId = null) {
  try {
    return await fetchJsonWithFixtureFallback(
      `/program/${normalizeProgramId(programId)}/mapping/highest_bidder/${auctionId}field`,
      'getMockFixtureHighestBidder',
      [auctionId]
    );
  } catch (error) {
    console.error('[aleoServiceV2] getHighestBidder error:', error);
    return null;
  }
}

// Check if program is deployed
export async function checkProgramDeployed() {
  try {
    const res = await fetch(`${API_BASE}/program/${PROGRAM_ID}`);
    if (!res.ok) {
      console.error('[aleoServiceV2] Program NOT deployed:', PROGRAM_ID);
      return false;
    }
    await res.json();
    return true;
  } catch (error) {
    console.error('[aleoServiceV2] checkProgramDeployed error:', error);
    return false;
  }
}

// Local Storage Helpers for Nonces (Multi-Bidder Support)

export function saveNonce(auctionId, nonce, walletAddress) {
  localStorage.setItem(nonceStorageKey(auctionId, walletAddress), nonce);
}

export function getNonce(auctionId, walletAddress) {
  return localStorage.getItem(nonceStorageKey(auctionId, walletAddress));
}

export function clearNonce(auctionId, walletAddress) {
  localStorage.removeItem(nonceStorageKey(auctionId, walletAddress));
}

export function saveCommitment(auctionId, commitment, amount, walletAddress, currency = 'usdc', metadata = {}) {
  const data = { 
    commitment, 
    amount,  // Generic field name
    amountUsdx: amount,  // Keep for backward compatibility
    currency,  // NEW: store currency type
    timestamp: Date.now(),
    ...metadata,
    transactionId: metadata.transactionId || null,
    status: metadata.status || (metadata.transactionId ? 'pending-confirmation' : 'local-only'),
  };
  localStorage.setItem(commitmentStorageKey(auctionId, walletAddress), JSON.stringify(data));
}

export function getCommitmentData(auctionId, walletAddress) {
  const data = localStorage.getItem(commitmentStorageKey(auctionId, walletAddress));
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch (error) {
    console.warn('[aleoServiceV2] Dropping malformed commitment data from localStorage', {
      auctionId,
      walletAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    localStorage.removeItem(commitmentStorageKey(auctionId, walletAddress));
    return null;
  }
}

export function updateCommitmentData(auctionId, walletAddress, updates = {}) {
  const existing = getCommitmentData(auctionId, walletAddress);
  if (!existing) {
    return null;
  }

  const nextData = {
    ...existing,
    ...updates,
    lastUpdatedAt: Date.now(),
  };

  localStorage.setItem(
    commitmentStorageKey(auctionId, walletAddress),
    JSON.stringify(nextData)
  );

  return nextData;
}

export function clearCommitment(auctionId, walletAddress) {
  localStorage.removeItem(commitmentStorageKey(auctionId, walletAddress));
}

export function buildBidRecoveryBundle(auctionId, walletAddress, options = {}) {
  const normalizedWalletAddress = typeof walletAddress === 'string' ? walletAddress.trim() : '';
  if (!auctionId || !normalizedWalletAddress) {
    return null;
  }

  const nonce = options.nonce || getNonce(auctionId, normalizedWalletAddress);
  const commitmentData = options.commitmentData || getCommitmentData(auctionId, normalizedWalletAddress);
  const amount = Number(options.amount ?? commitmentData?.amount ?? commitmentData?.amountUsdx ?? 0);

  if (!nonce || !commitmentData || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const resolvedProgramId = normalizeProgramId(
    options.programId
      || commitmentData?.programId
  );

  return {
    schema: BID_RECOVERY_SCHEMA,
    schemaVersion: BID_RECOVERY_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    auctionId: Number(auctionId),
    walletAddress: normalizedWalletAddress,
    programId: resolvedProgramId,
    contractVersion: inferContractVersionFromProgramId(resolvedProgramId),
    nonce,
    amount,
    currency: commitmentData?.currency || options.currency || 'usdcx',
    privacy: commitmentData?.privacy || options.privacy || 'public',
    commitment: commitmentData?.commitment || null,
    transactionId: commitmentData?.transactionId || null,
    walletTransactionId: commitmentData?.walletTransactionId || null,
    explorerTransactionId: commitmentData?.explorerTransactionId || null,
    status: commitmentData?.status || null,
    revealStatus: commitmentData?.revealStatus || null,
    commitmentMode: commitmentData?.commitmentMode || 'contract-derived',
    timestamp: commitmentData?.timestamp || Date.now(),
  };
}

export function serializeBidRecoveryBundle(bundle) {
  return JSON.stringify(bundle, null, 2);
}

export function restoreBidRecoveryBundle(bundleOrText, options = {}) {
  const bundle = typeof bundleOrText === 'string'
    ? JSON.parse(bundleOrText)
    : bundleOrText;

  if (!bundle || typeof bundle !== 'object') {
    throw new Error('Recovery bundle is empty or malformed.');
  }

  if (bundle.schema !== BID_RECOVERY_SCHEMA || bundle.schemaVersion !== BID_RECOVERY_SCHEMA_VERSION) {
    throw new Error('Unsupported recovery bundle format.');
  }

  const auctionId = Number(bundle.auctionId);
  const walletAddress = typeof bundle.walletAddress === 'string' ? bundle.walletAddress.trim() : '';
  const expectedWalletAddress = typeof options.walletAddress === 'string' ? options.walletAddress.trim() : '';
  const expectedAuctionId = options.auctionId != null ? Number(options.auctionId) : null;
  const amount = Number(bundle.amount);

  if (!Number.isFinite(auctionId) || auctionId <= 0) {
    throw new Error('Recovery bundle is missing a valid auction ID.');
  }

  if (!walletAddress) {
    throw new Error('Recovery bundle is missing the bidder wallet address.');
  }

  if (!bundle.nonce || typeof bundle.nonce !== 'string') {
    throw new Error('Recovery bundle is missing the nonce required for reveal and refund.');
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Recovery bundle is missing the committed bid amount.');
  }

  if (expectedWalletAddress && walletAddress.toLowerCase() !== expectedWalletAddress.toLowerCase()) {
    throw new Error(`Recovery bundle belongs to ${walletAddress}, not the currently connected wallet.`);
  }

  if (expectedAuctionId !== null && auctionId !== expectedAuctionId) {
    throw new Error(`Recovery bundle targets auction #${auctionId}, not auction #${expectedAuctionId}.`);
  }

  saveNonce(auctionId, bundle.nonce, walletAddress);
  saveCommitment(auctionId, bundle.commitment || null, amount, walletAddress, bundle.currency || 'usdcx', {
    privacy: bundle.privacy || 'public',
    transactionId: bundle.transactionId || null,
    walletTransactionId: bundle.walletTransactionId || null,
    explorerTransactionId: bundle.explorerTransactionId || null,
    status: bundle.status || 'confirmed',
    revealStatus: bundle.revealStatus || null,
    commitmentMode: bundle.commitmentMode || 'contract-derived',
    programId: normalizeProgramId(bundle.programId),
    restoredAt: Date.now(),
    restoredFromRecoveryBundle: true,
    timestamp: bundle.timestamp || Date.now(),
  });

  return {
    ...bundle,
    auctionId,
    walletAddress,
    amount,
    programId: normalizeProgramId(bundle.programId),
  };
}

async function fetchApiPayload(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (response.status === 404) {
    return { ok: false, status: 404, payload: null };
  }

  if (!response.ok) {
    throw new Error(`Explorer API request failed (${response.status})`);
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  return { ok: true, status: response.status, payload };
}

function parseConfirmedResponse(payload) {
  if (typeof payload === 'boolean') {
    return payload;
  }

  if (typeof payload === 'string') {
    return payload.trim().toLowerCase() === 'true';
  }

  if (payload && typeof payload === 'object') {
    const booleanKeys = ['confirmed', 'isConfirmed', 'result', 'success'];
    for (const key of booleanKeys) {
      if (typeof payload[key] === 'boolean') {
        return payload[key];
      }
    }

    return true;
  }

  return false;
}

export async function getTransactionById(transactionId) {
  const response = await fetchApiPayload(`/transaction/${transactionId}`);
  return response.ok ? response.payload : null;
}

export async function getTransactionConfirmation(transactionId) {
  const response = await fetchApiPayload(`/transaction/confirmed/${transactionId}`);

  if (!response.ok) {
    return {
      found: false,
      confirmed: false,
      transaction: null,
      transactionType: null,
    };
  }

  const confirmed = parseConfirmedResponse(response.payload);
  let transaction = response.payload && typeof response.payload === 'object'
    ? response.payload
    : null;
  let transactionType = null;

  if (confirmed) {
    if (!transaction) {
      transaction = await getTransactionById(transactionId);
    }
    transactionType =
      transaction?.type ||
      transaction?.transaction?.type ||
      transaction?.execution?.type ||
      null;
  }

  return {
    found: true,
    confirmed,
    transaction,
    transactionType,
  };
}

export async function waitForTransactionConfirmation(transactionId, options = {}) {
  const attempts = options.attempts ?? 12;
  const intervalMs = options.intervalMs ?? 2500;
  let lastError = null;
  let lastResult = {
    found: false,
    confirmed: false,
    transaction: null,
    transactionType: null,
  };

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      lastResult = await getTransactionConfirmation(transactionId);

      if (lastResult.confirmed) {
        const rejectedByExecution = lastResult.transactionType === 'fee';
        return {
          status: rejectedByExecution ? 'rejected' : 'confirmed',
          error: rejectedByExecution
            ? 'Execution was rejected on-chain before the contract state changed.'
            : null,
          ...lastResult,
        };
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts - 1) {
      await sleep(intervalMs);
    }
  }

  return {
    status: lastError ? 'unknown' : 'pending',
    error: lastError,
    ...lastResult,
  };
}

// Export program ID for reference
export { PROGRAM_ID, API_BASE };

// -------------------------
// V2.14: Aleo Credits Functions
// -------------------------

// 2b. Commit Bid with Aleo Credits
export async function commitBidAleo(executeTransaction, auctionId, nonce, amountCredits, options = {}) {
  const inputs = [
    `${auctionId}field`,
    formatFieldInput(nonce),
    `${amountCredits}u64`
  ];
  
  return requestTx(executeTransaction, 'commit_bid_aleo', inputs, 1_000_000, false, options);
}

// 7b. Claim Refund with Aleo Credits
export async function claimRefundAleo(executeTransaction, auctionId, nonce, refundAmount, options = {}) {
  return requestTx(executeTransaction, 'claim_refund_aleo', [
    `${auctionId}field`,
    formatFieldInput(nonce),
    `${refundAmount}u64`
  ], 1_000_000, false, options);
}

// Helper: Detect currency from auction info
export function getAuctionCurrency(auctionInfo) {
  if (!auctionInfo) return 'usdcx';
  
  if (typeof auctionInfo === 'string') {
    const match = auctionInfo.match(/currency_type:\s*(\d+)u8/);
    if (!match) {
      return 'usdcx';
    }

    if (match[1] === '1') {
      return 'aleo';
    }

    if (match[1] === '2') {
      return 'usad';
    }

    return 'usdcx';
  }

  const parsedType = typeof auctionInfo.currency_type === 'string'
    ? parseInt(auctionInfo.currency_type, 10)
    : auctionInfo.currency_type;

  if (parsedType === 1) {
    return 'aleo';
  }

  if (parsedType === 2) {
    return 'usad';
  }

  return 'usdcx';
}

// Helper: Get currency label
export function getCurrencyLabel(currency) {
  if (currency === 'aleo') {
    return 'Aleo';
  }

  if (currency === 'usad') {
    return 'USAD';
  }

  return 'USDCx';
}

// Helper: Get currency icon
export function getCurrencyIcon(currency) {
  return currency === 'aleo' ? 'A' : '$';
}

// Helper: Convert to microcredits/micro-units
export function toMicroUnits(amount) {
  return Math.floor(parseFloat(amount) * 1_000_000);
}

// Helper: Convert from microcredits/micro-units
export function fromMicroUnits(amount) {
  return parseFloat(amount) / 1_000_000;
}



// ========================================
// V2.18 NEW FUNCTIONS - RWA Payment Mechanism
// ========================================
// Note: These are simplified versions for backward compatibility
// Use the V2_18 suffixed versions below for full V2.18 functionality

// ========================================
// V2.18 HELPER FUNCTIONS - Asset Categories
// ========================================

// Asset type constants
export const ASSET_TYPES = {
  PHYSICAL_GOODS: 0,
  COLLECTIBLES: 1,
  REAL_ESTATE: 2,
  DIGITAL_ASSETS: 3,
  SERVICES: 4,
  TICKETS_EVENTS: 5,
  VEHICLES: 6,
  INTELLECTUAL_PROPERTY: 7
};

// Get asset type name
export function getAssetTypeName(type) {
  const names = {
    0: 'Physical Goods',
    1: 'Collectibles',
    2: 'Real Estate',
    3: 'Digital Assets',
    4: 'Services',
    5: 'Tickets & Events',
    6: 'Vehicles',
    7: 'Intellectual Property'
  };
  return names[type] || 'Unknown';
}

// Get asset type icon
export function getAssetTypeIcon(type) {
  const icons = {
    0: '📦',
    1: '🎨',
    2: '🏠',
    3: '💎',
    4: '💼',
    5: '🎫',
    6: '🚗',
    7: '📜'
  };
  return icons[type] || '📦';
}

// Get asset type timeout (in days)
export function getAssetTypeTimeout(type) {
  const timeouts = {
    0: 14,  // Physical Goods
    1: 21,  // Collectibles
    2: 90,  // Real Estate
    3: 3,   // Digital Assets
    4: 30,  // Services
    5: 7,   // Tickets & Events
    6: 30,  // Vehicles
    7: 90   // Intellectual Property
  };
  return timeouts[type] || 14;
}

// Get asset type description
export function getAssetTypeDescription(type) {
  const descriptions = {
    0: 'Physical goods require shipping and delivery confirmation. Winner has 14 days to confirm receipt.',
    1: 'Collectibles may require authentication. Winner has 21 days to confirm receipt and verify authenticity.',
    2: 'Real estate requires legal documentation and title transfer. Winner has 90 days for legal process.',
    3: 'Digital assets can be transferred instantly. Winner has 3 days to confirm receipt.',
    4: 'Services are delivered over time. Winner has 30 days to confirm completion.',
    5: 'Tickets are time-sensitive. Winner has 7 days to confirm receipt before event.',
    6: 'Vehicles require inspection and registration. Winner has 30 days for inspection and title transfer.',
    7: 'Intellectual property requires legal transfer and registration. Winner has 90 days for legal process.'
  };
  return descriptions[type] || 'Select an asset category';
}

// Get category-specific instructions
export function getCategoryInstructions(assetType, role) {
  const instructions = {
    0: { // Physical Goods
      seller: [
        'Ship item within 3 days after finalization',
        'Use trackable shipping method',
        'Wait for winner to confirm receipt',
        'Claim payment after confirmation (or 14 days timeout)'
      ],
      winner: [
        'Wait for item delivery (typically 7-14 days)',
        'Inspect item carefully upon receipt',
        'Confirm receipt within 3 days of delivery',
        'Seller can claim payment after your confirmation'
      ]
    },
    1: { // Collectibles
      seller: [
        'Ship item with insurance',
        'Use secure, trackable shipping',
        'Wait for authentication (if required)',
        'Claim payment after confirmation (or 21 days timeout)'
      ],
      winner: [
        'Wait for insured delivery',
        'Authenticate item if needed (optional)',
        'Inspect condition carefully (7 days)',
        'Confirm receipt after verification'
      ]
    },
    3: { // Digital Assets
      seller: [
        'Transfer digital asset immediately',
        'Provide access credentials securely',
        'Wait for winner verification',
        'Claim payment after confirmation (or 3 days timeout)'
      ],
      winner: [
        'Verify asset received on-chain',
        'Check asset authenticity',
        'Confirm receipt within 24 hours',
        'Fast settlement for digital assets'
      ]
    },
    2: { // Real Estate
      seller: [
        'Initiate legal transfer process',
        'Provide title documentation',
        'Work with legal counsel',
        'Claim payment after title transfer (or 90 days timeout)'
      ],
      winner: [
        'Review legal documents (30 days)',
        'Complete title transfer process',
        'Confirm transfer after registration',
        'Long settlement for legal process'
      ]
    },
    4: { // Services
      seller: [
        'Deliver service as agreed',
        'Complete milestones on time',
        'Provide deliverables',
        'Claim payment after completion (or 30 days timeout)'
      ],
      winner: [
        'Review work progress',
        'Verify deliverables',
        'Confirm completion after review',
        'Service-based settlement'
      ]
    },
    5: { // Tickets & Events
      seller: [
        'Transfer ticket immediately',
        'Provide event details',
        'Ensure ticket validity',
        'Claim payment after confirmation (or 7 days timeout)'
      ],
      winner: [
        'Verify ticket authenticity',
        'Check event details',
        'Confirm receipt quickly (time-sensitive)',
        'Fast settlement before event'
      ]
    },
    6: { // Vehicles
      seller: [
        'Arrange inspection',
        'Prepare title transfer',
        'Coordinate delivery or pickup',
        'Claim payment after transfer (or 30 days timeout)'
      ],
      winner: [
        'Inspect vehicle thoroughly',
        'Complete title transfer',
        'Register vehicle',
        'Confirm after registration complete'
      ]
    },
    7: { // IP
      seller: [
        'Initiate IP transfer process',
        'Provide legal documentation',
        'Complete IP office registration',
        'Claim payment after transfer (or 90 days timeout)'
      ],
      winner: [
        'Review IP documentation',
        'Verify IP validity',
        'Complete registration process',
        'Confirm after IP office approval'
      ]
    }
  };
  
  return instructions[assetType]?.[role] || [];
}

// Check if seller can claim winning bid
export function canSellerClaimWinning(auction, currentTimestamp) {
  if (!auction || auction.status !== 'finalized') return false;
  if (auction.paymentClaimed) return false;
  
  // Can claim if winner confirmed OR timeout passed
  if (auction.itemReceived) return true;
  
  // Check timeout based on asset type
  const timeoutDays = getAssetTypeTimeout(auction.assetType || 0);
  const timeoutSeconds = timeoutDays * 24 * 3600;
  const finalizedAt = auction.finalizedAt || auction.endTimestamp;
  const timeElapsed = currentTimestamp - finalizedAt;
  
  return timeElapsed > timeoutSeconds;
}

// ========================================
// V2.18 SPECIFIC FUNCTIONS
// ========================================

function findFirstNestedString(value, depth = 0) {
  if (value == null || depth > 6) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findFirstNestedString(item, depth + 1);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  if (typeof value === 'object') {
    for (const nestedValue of Object.values(value)) {
      const nested = findFirstNestedString(nestedValue, depth + 1);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function findNestedStringByKey(value, keys, depth = 0) {
  if (value == null || depth > 6 || typeof value !== 'object') {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findNestedStringByKey(item, keys, depth + 1);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (keys.includes(key)) {
      const direct = findFirstNestedString(nestedValue, depth + 1);
      if (direct) {
        return direct;
      }
    }

    const nested = findNestedStringByKey(nestedValue, keys, depth + 1);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function findNestedMicrocredits(value, depth = 0) {
  if (value == null || depth > 6) {
    return null;
  }

  if (typeof value === 'string') {
    const recordMatch = value.match(/microcredits:\s*(\d+)u64/);
    if (recordMatch) {
      return parseInt(recordMatch[1], 10);
    }

    const exactValueMatch = value.match(/^(\d+)u64(?:\.private|\.public)?$/);
    if (exactValueMatch) {
      return parseInt(exactValueMatch[1], 10);
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findNestedMicrocredits(item, depth + 1);
      if (nested !== null) {
        return nested;
      }
    }

    return null;
  }

  if (typeof value === 'object') {
    if ('microcredits' in value) {
      const direct = findNestedMicrocredits(value.microcredits, depth + 1);
      if (direct !== null) {
        return direct;
      }
    }

    if ('value' in value) {
      const directValue = findNestedMicrocredits(value.value, depth + 1);
      if (directValue !== null) {
        return directValue;
      }
    }
  }

  return null;
}

function ensureVisibilitySuffix(value, suffix) {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.endsWith('.private') || value.endsWith('.public')) {
    return value;
  }

  return `${value}${suffix}`;
}

function compactRecordString(value) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(/\s+/g, ' ').trim();
}

function normalizePrivateRecordInput(privateRecord) {
  if (typeof privateRecord === 'string') {
    return compactRecordString(privateRecord);
  }

  if (privateRecord && typeof privateRecord === 'object') {
    if (typeof privateRecord.plaintext === 'string') {
      return compactRecordString(privateRecord.plaintext);
    }

    if (typeof privateRecord.record === 'string') {
      return compactRecordString(privateRecord.record);
    }

    const owner = findNestedStringByKey(privateRecord, ['owner']);
    const nonce = findNestedStringByKey(privateRecord, ['_nonce', 'nonce']);
    const microcredits = findNestedMicrocredits(privateRecord);

    if (owner && nonce && microcredits !== null) {
      return compactRecordString(`{
        owner: ${ensureVisibilitySuffix(owner, '.private')},
        microcredits: ${microcredits}u64.private,
        _nonce: ${ensureVisibilitySuffix(nonce, '.public')}
      }`);
    }
  }

  return privateRecord;
}

// Commit bid with private ALEO funding.
// Contract signature:
// async transition commit_bid_aleo_private(
//     public auction_id: field,
//     nonce: field,
//     private_credits: credits.aleo/credits,
//     public amount_credits: u64
// )
export async function commitBidAleoPrivate(executeTransaction, auctionId, nonce, privateRecord, amountCredits, options = {}) {
  const normalizedRecord = normalizePrivateRecordInput(privateRecord);

  if (typeof normalizedRecord !== 'string') {
    throw new Error('Private credits record is missing plaintext data');
  }
  
  // Contract expects:
  // 1. auction_id: field
  // 2. nonce: field
  // 3. private_credits: credits.aleo/credits (record)
  // 4. amount_credits: u64
  
  const inputs = [
    `${auctionId}field`,
    formatFieldInput(nonce),
    normalizedRecord,
    `${amountCredits}u64`
  ];
  
  return requestTx(
    executeTransaction,
    'commit_bid_aleo_private',
    inputs,
    2_000_000, // Higher fee for private transactions
    false,
    {
      ...options,
      debugHeading: 'Submitting private bid transaction.',
      inputLabels: [
        'auction_id',
        'nonce',
        'private_credits',
        'amount_credits',
      ],
    }
  );
}

// Claim refund with private ALEO output.
export async function claimRefundAleoPrivate(executeTransaction, auctionId, nonce, refundAmount, options = {}) {
  const inputs = [
    `${auctionId}field`,
    formatFieldInput(nonce),
    `${refundAmount}u64`
  ];
  
  return requestTx(
    executeTransaction,
    'claim_refund_aleo_private',
    inputs,
    1_000_000,
    false,
    options
  );
}

// Commit bid with USAD.
export async function commitBidUSAD(executeTransaction, auctionId, nonce, amountUsad, options = {}) {
  const inputs = [
    `${auctionId}field`,
    formatFieldInput(nonce),
    `${amountUsad}u128`
  ];
  
  return requestTx(
    executeTransaction,
    'commit_bid_usad',
    inputs,
    1_000_000,
    false,
    options
  );
}

// Claim refund USAD.
export async function claimRefundUSAD(executeTransaction, auctionId, nonce, refundAmount, options = {}) {
  const inputs = [
    `${auctionId}field`,
    formatFieldInput(nonce),
    `${refundAmount}u128`
  ];
  
  return requestTx(
    executeTransaction,
    'claim_refund_usad',
    inputs,
    1_000_000,
    false,
    options
  );
}

// Confirm receipt - Winner confirms item received (V2.18 only)
export async function confirmReceiptV2_18(executeTransaction, auctionId, options = {}) {
  const receivedAt = Math.floor(Date.now() / 1000);
  const inputs = [
    `${auctionId}field`,
    `${receivedAt}i64`
  ];
  
  return requestTx(
    executeTransaction,
    'confirm_receipt',
    inputs,
    1_000_000,
    false,
    options
  );
}

// Claim winning bid - ALEO (V2.19 - Uses seller_net_amount)
export async function claimWinningAleo(executeTransaction, auctionId, sellerNetAmount, sellerAddress, claimAt = null, options = {}) {
  const timestamp = claimAt || getCurrentTimestamp();
  const inputs = [
    `${auctionId}field`,
    formatUnsignedTransactionInput(sellerNetAmount, 'u64'),  // V2.19: seller_net_amount
    sellerAddress,
    `${timestamp}i64`
  ];
  
  return requestTx(
    executeTransaction,
    'claim_winning_aleo',
    inputs,
    1_000_000,
    false,
    options
  );
}

// Claim winning bid - USDCx (V2.19 - Uses seller_net_amount)
export async function claimWinningUSDCx(executeTransaction, auctionId, sellerNetAmount, sellerAddress, claimAt = null, options = {}) {
  const timestamp = claimAt || getCurrentTimestamp();
  const inputs = [
    `${auctionId}field`,
    formatUnsignedTransactionInput(sellerNetAmount, 'u128'),  // V2.19: seller_net_amount
    sellerAddress,
    `${timestamp}i64`
  ];
  
  return requestTx(
    executeTransaction,
    'claim_winning_usdcx',
    inputs,
    1_000_000,
    false,
    options
  );
}

// Claim winning bid - USAD (V2.19 - Uses seller_net_amount)
export async function claimWinningUSAD(executeTransaction, auctionId, sellerNetAmount, sellerAddress, claimAt = null, options = {}) {
  const timestamp = claimAt || getCurrentTimestamp();
  const inputs = [
    `${auctionId}field`,
    formatUnsignedTransactionInput(sellerNetAmount, 'u128'),  // V2.19: seller_net_amount
    sellerAddress,
    `${timestamp}i64`
  ];
  
  return requestTx(
    executeTransaction,
    'claim_winning_usad',
    inputs,
    1_000_000,
    false,
    options
  );
}

// Helper: Get currency name
export function getCurrencyName(currencyType) {
  const currencies = {
    0: 'USDCx',
    1: 'ALEO',
    2: 'USAD'
  };
  return currencies[currencyType] || 'Unknown';
}

// ========================================
// V2.19 NEW FUNCTIONS
// ========================================

// Claim Platform Fee - ALEO
export async function claimPlatformFeeAleo(executeTransaction, auctionId, feeAmount, claimedAt = null, options = {}) {
  const timestamp = claimedAt || getCurrentTimestamp();
  const inputs = [
    `${auctionId}field`,
    formatUnsignedTransactionInput(feeAmount, 'u64'),
    `${timestamp}i64`
  ];
  
  return requestTx(
    executeTransaction,
    'claim_platform_fee_aleo',
    inputs,
    1_000_000,
    false,
    options
  );
}

// Claim Platform Fee - USDCx
export async function claimPlatformFeeUsdcx(executeTransaction, auctionId, feeAmount, claimedAt = null, options = {}) {
  const timestamp = claimedAt || getCurrentTimestamp();
  const inputs = [
    `${auctionId}field`,
    formatUnsignedTransactionInput(feeAmount, 'u128'),
    `${timestamp}i64`
  ];
  
  return requestTx(
    executeTransaction,
    'claim_platform_fee_usdcx',
    inputs,
    1_000_000,
    false,
    options
  );
}

// Claim Platform Fee - USAD
export async function claimPlatformFeeUsad(executeTransaction, auctionId, feeAmount, claimedAt = null, options = {}) {
  const timestamp = claimedAt || getCurrentTimestamp();
  const inputs = [
    `${auctionId}field`,
    formatUnsignedTransactionInput(feeAmount, 'u128'),
    `${timestamp}i64`
  ];
  
  return requestTx(
    executeTransaction,
    'claim_platform_fee_usad',
    inputs,
    1_000_000,
    false,
    options
  );
}

// Cancel Auction - Reserve Not Met
export async function cancelAuctionReserveNotMet(executeTransaction, auctionId, settledAt = null, options = {}) {
  return settleAfterRevealTimeout(executeTransaction, auctionId, settledAt, options);
}

// ========================================
// V2.21 NEW FUNCTIONS
// ========================================

export async function upsertSellerProfileOnChain(
  executeTransaction,
  verificationStatus,
  verificationTier,
  profileRoot,
  attestationExpiry,
  updatedAt = null,
  options = {}
) {
  const timestamp = updatedAt || getCurrentTimestamp();
  return requestTx(executeTransaction, 'upsert_seller_profile', [
    `${verificationStatus}u8`,
    `${verificationTier}u8`,
    formatFieldInput(profileRoot),
    `${attestationExpiry}i64`,
    `${timestamp}i64`,
  ], 1_000_000, false, options);
}

export async function setAuctionProofRootOnChain(executeTransaction, auctionId, proofRoot, disclosureRoot, options = {}) {
  return requestTx(executeTransaction, 'set_auction_proof_root', [
    `${auctionId}field`,
    formatFieldInput(proofRoot),
    formatFieldInput(disclosureRoot),
  ], 1_000_000, false, options);
}

export async function openDisputeOnChain(executeTransaction, auctionId, disputeRoot, openedAt = null, options = {}) {
  const timestamp = openedAt || getCurrentTimestamp();
  return requestTx(executeTransaction, 'open_dispute', [
    `${auctionId}field`,
    formatFieldInput(disputeRoot),
    `${timestamp}i64`,
  ], 1_000_000, false, options);
}

export async function resolveDisputeReleaseSellerOnChain(executeTransaction, auctionId, resolvedAt = null, options = {}) {
  const timestamp = resolvedAt || getCurrentTimestamp();
  return requestTx(executeTransaction, 'resolve_dispute_release_seller', [
    `${auctionId}field`,
    `${timestamp}i64`,
  ], 1_000_000, false, options);
}

export async function resolveDisputeRefundWinnerOnChain(executeTransaction, auctionId, resolvedAt = null, options = {}) {
  const timestamp = resolvedAt || getCurrentTimestamp();
  return requestTx(executeTransaction, 'resolve_dispute_refund_winner', [
    `${auctionId}field`,
    `${timestamp}i64`,
  ], 1_000_000, false, options);
}

export async function getSellerProfileOnChain(address) {
  try {
    return await fetchJsonWithFixtureFallback(
      `/program/${PROGRAM_ID}/mapping/seller_profiles/${address}`,
      'getMockFixtureSellerProfile',
      [address]
    );
  } catch (error) {
    console.error('[aleoServiceV2] getSellerProfileOnChain error:', error);
    return null;
  }
}

export async function getAuctionProofRootOnChain(auctionId) {
  try {
    return await fetchJsonWithFixtureFallback(
      `/program/${PROGRAM_ID}/mapping/auction_proof_root/${auctionId}field`,
      'getMockFixtureProofRoot',
      [auctionId]
    );
  } catch (error) {
    console.error('[aleoServiceV2] getAuctionProofRootOnChain error:', error);
    return null;
  }
}

export async function getAuctionDisputeRootOnChain(auctionId) {
  try {
    return await fetchJsonWithFixtureFallback(
      `/program/${PROGRAM_ID}/mapping/auction_dispute_root/${auctionId}field`,
      'getMockFixtureDisputeRoot',
      [auctionId]
    );
  } catch (error) {
    console.error('[aleoServiceV2] getAuctionDisputeRootOnChain error:', error);
    return null;
  }
}

// Helper: Check if caller is platform owner
export function isPlatformOwner(walletAddress) {
  return typeof walletAddress === 'string' && walletAddress.toLowerCase() === PLATFORM_ADDRESS.toLowerCase();
}

// Helper: Get platform fee info
export function getPlatformFeeInfo() {
  return {
    rate: PLATFORM_FEE_RATE,
    ratePercent: PLATFORM_FEE_RATE / 100,
    platformAddress: PLATFORM_ADDRESS
  };
}

// Backward compatibility alias
export const confirmReceipt = confirmReceiptV2_18;
