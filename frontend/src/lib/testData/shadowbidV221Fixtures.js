import {
  createOffer,
  createDispute,
  getDisputes,
  getOffers,
  getOpsApiDebugInfo,
  resetOpsTestData,
  runExecutorScan,
  saveSavedSearches,
  saveWatchlist,
  syncAuctionRole,
  syncAuctionSnapshot,
  updateDispute,
  upsertAuctionProofBundle,
  upsertSellerVerification,
} from '@/services/localOpsService';
import {
  PLATFORM_ADDRESS,
  clearCommitment,
  clearNonce,
  saveCommitment,
  saveNonce,
} from '@/services/aleoServiceV2';

export const SHADOWBID_FIXTURE_VERSION = 'shadowbid-v221-local-fixtures-1';
export const SHADOWBID_FIXTURE_STORAGE_KEY = '__shadowbid_v221_fixture_bundle';

const EMPTY_ALEO_ADDRESS = 'aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc';
const DEFAULT_PRIMARY_WALLET = 'aleo1fixtureprimarywallet0000000000000000000000000000000000000005';
const DEFAULT_ALT_SELLER = 'aleo1fixtureselleralpha000000000000000000000000000000000000006';
const DEFAULT_ALT_BIDDER = 'aleo1fixturebidderbeta000000000000000000000000000000000000007';
const DEFAULT_ALT_WINNER = 'aleo1fixturewinnergamma00000000000000000000000000000000000008';
const DEFAULT_ALT_COLLECTOR = 'aleo1fixturecollector0000000000000000000000000000000000000009';

const FIXTURE_IDS = {
  OPEN_CATALOG: 910021001,
  OPEN_OVERDUE: 910021002,
  CLOSED_REVEAL: 910021003,
  CLOSED_SETTLE: 910021004,
  CHALLENGE_READY: 910021005,
  SETTLED_SELLER: 910021006,
  SETTLED_WINNER: 910021007,
  SETTLED_FEE: 910021008,
  CANCELLED_REFUND: 910021009,
  DISPUTED_CASE: 910021010,
};

function toMicro(amount) {
  return Math.round(amount * 1_000_000);
}

function buildFakeTxId(suffix) {
  return `at1shadowbidfixture${String(suffix).padStart(10, '0')}`;
}

function createSvgDataUri(label, colorA, colorB) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colorA}" />
          <stop offset="100%" stop-color="${colorB}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="900" fill="url(#g)" rx="48" />
      <circle cx="960" cy="180" r="120" fill="rgba(255,255,255,0.18)" />
      <circle cx="240" cy="720" r="170" fill="rgba(255,255,255,0.12)" />
      <text x="96" y="420" fill="white" font-family="Space Grotesk, Arial, sans-serif" font-size="76" font-weight="700">
        ${label}
      </text>
      <text x="96" y="500" fill="rgba(255,255,255,0.76)" font-family="JetBrains Mono, monospace" font-size="28">
        ShadowBid V2.21 test fixture
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createPhoto(name, label, colorA, colorB) {
  return {
    name,
    type: 'image/svg+xml',
    size: 24_576,
    data: createSvgDataUri(label, colorA, colorB),
  };
}

function createProofFile(name, type = 'application/pdf') {
  return {
    name,
    type,
    size: 98_304,
  };
}

function buildMockOnChain({
  seller,
  minBid,
  reservePrice,
  currencyType,
  assetType,
  endTimestamp,
  revealPeriod,
  disputePeriod,
  state,
  winner = null,
  winningAmount = 0,
  revealDeadline = 0,
  disputeDeadline = 0,
  totalEscrowed = 0,
  itemReceived = false,
  itemReceivedAt = 0,
  paymentClaimed = false,
  paymentClaimedAt = 0,
  confirmationTimeout = 0,
  settledAt = 0,
  claimableAt = 0,
  platformFeeAmount = 0,
  sellerNetAmount = 0,
  platformFeeClaimed = false,
  platformFeeClaimedAt = 0,
  reserveMet = null,
}) {
  return {
    seller,
    min_bid_amount: `${toMicro(minBid)}u128`,
    currency_type: `${currencyType}u8`,
    end_time: `${endTimestamp}i64`,
    reveal_period: `${revealPeriod}i64`,
    dispute_period: `${disputePeriod}i64`,
    state: `${state}u8`,
    winner: winner || EMPTY_ALEO_ADDRESS,
    winning_amount: `${winningAmount}u128`,
    reveal_deadline: `${revealDeadline}i64`,
    dispute_deadline: `${disputeDeadline}i64`,
    total_escrowed: `${totalEscrowed}u128`,
    asset_type: `${assetType}u8`,
    item_received: itemReceived ? 'true' : 'false',
    item_received_at: `${itemReceivedAt}i64`,
    payment_claimed: paymentClaimed ? 'true' : 'false',
    payment_claimed_at: `${paymentClaimedAt}i64`,
    confirmation_timeout: `${confirmationTimeout}i64`,
    settled_at: `${settledAt}i64`,
    claimable_at: `${claimableAt}i64`,
    platform_fee_amount: `${platformFeeAmount}u128`,
    seller_net_amount: `${sellerNetAmount}u128`,
    platform_fee_claimed: platformFeeClaimed ? 'true' : 'false',
    platform_fee_claimed_at: `${platformFeeClaimedAt}i64`,
    reserve_price: `${toMicro(reservePrice)}u128`,
    reserve_met: reserveMet === null ? 'false' : reserveMet ? 'true' : 'false',
  };
}

function buildVerification({
  sellerDisplayName,
  status,
  tier,
  issuingAuthority,
  certificateId,
  provenanceNote,
  authenticityGuarantee,
}) {
  return {
    sellerDisplayName,
    status,
    tier,
    issuingAuthority,
    certificateId,
    provenanceNote,
    authenticityGuarantee,
    submittedAt: new Date().toISOString(),
  };
}

function buildProofBundle({
  seller,
  summary,
  provenanceNote,
  authenticityGuarantee,
  certificateId,
  proofFiles,
  itemPhotos,
  token,
  assetType,
}) {
  return {
    seller,
    summary,
    provenanceNote,
    authenticityGuarantee,
    certificateId,
    proofFiles,
    itemPhotos,
    token,
    assetType,
  };
}

function buildLegacyAuction({
  id,
  title,
  category,
  description,
  minBid,
  seller,
  createdAt,
  durationSeconds,
  image,
  status,
  bids,
}) {
  return {
    id: String(id),
    title,
    category,
    description,
    minBid: `${minBid} ALEO`,
    endBlock: String(Math.floor(createdAt / 1000) + durationSeconds),
    closingDate: new Date(createdAt + (durationSeconds * 1000)).toISOString(),
    seller,
    txId: buildFakeTxId(id),
    status,
    bids,
    createdAt,
    location: 'Local Test Fixture',
    image,
    highestBid: 'Sealed',
  };
}

function buildFixtureBundle(primaryWallet) {
  const nowMs = Date.now();
  const now = Math.floor(nowMs / 1000);
  const primary = primaryWallet || DEFAULT_PRIMARY_WALLET;
  const otherSeller = DEFAULT_ALT_SELLER;
  const otherBidder = DEFAULT_ALT_BIDDER;
  const otherWinner = DEFAULT_ALT_WINNER;
  const collector = DEFAULT_ALT_COLLECTOR;
  const revealPeriod = 2 * 3600;
  const disputePeriod = 6 * 3600;
  const physicalTimeout = 14 * 24 * 3600;
  const digitalTimeout = 3 * 24 * 3600;

  const goldPhoto = createPhoto('certificate-front.svg', 'Rare Watch', '#0F172A', '#D4AF37');
  const bluePhoto = createPhoto('warehouse-lot.svg', 'Warehouse Lot', '#082F49', '#0EA5E9');
  const redPhoto = createPhoto('vehicle-side.svg', 'Collector Car', '#450A0A', '#F97316');
  const greenPhoto = createPhoto('nft-preview.svg', 'Genesis Pass', '#052E16', '#22C55E');

  const verifiedSeller = buildVerification({
    sellerDisplayName: 'Fixture Atelier',
    status: 'verified',
    tier: 'premium',
    issuingAuthority: 'Jakarta Assay & Vault',
    certificateId: 'FIX-V221-0001',
    provenanceNote: 'Stored under insured custody with serial and appraisal documents attached.',
    authenticityGuarantee: 'Seller guarantees buyback if the appraisal packet and serial proof mismatch.',
  });

  const submittedSeller = buildVerification({
    sellerDisplayName: 'Fixture Logistics Desk',
    status: 'submitted',
    tier: 'standard',
    issuingAuthority: 'Demo Freight Registry',
    certificateId: 'FIX-V221-0002',
    provenanceNote: 'Chain-of-custody still pending manual review.',
    authenticityGuarantee: 'Warehouse release requires courier and inspection evidence.',
  });

  const openCatalogProof = buildProofBundle({
    seller: primary,
    summary: 'High-signal proof bundle for a premium physical collectible listing.',
    provenanceNote: verifiedSeller.provenanceNote,
    authenticityGuarantee: verifiedSeller.authenticityGuarantee,
    certificateId: verifiedSeller.certificateId,
    proofFiles: [
      createProofFile('watch-appraisal.pdf'),
      createProofFile('serial-certificate.pdf'),
      createProofFile('insurance-letter.pdf'),
    ],
    itemPhotos: [goldPhoto],
    token: 'ALEO',
    assetType: 1,
  });

  const overdueProof = buildProofBundle({
    seller: primary,
    summary: 'Open auction already overdue so seller can test close + executor flow.',
    provenanceNote: 'Fixtures intentionally set end time in the past.',
    authenticityGuarantee: 'Testing close_auction readiness.',
    certificateId: 'FIX-V221-OVERDUE',
    proofFiles: [createProofFile('overdue-checklist.pdf')],
    itemPhotos: [bluePhoto],
    token: 'USDCx',
    assetType: 0,
  });

  const auctions = [
    {
      id: FIXTURE_IDS.OPEN_CATALOG,
      title: 'Fixture: Verified Watch Lot',
      description: 'Open premium listing with proof bundle, verification metadata, and future closing time.',
      currency: 'ALEO',
      currencyType: 1,
      assetType: 1,
      minBid: 12,
      reservePrice: 18,
      status: 'open',
      seller: primary,
      winner: null,
      createdAt: nowMs - (2 * 3600 * 1000),
      durationSeconds: 12 * 3600,
      endTimestamp: now + (10 * 3600),
      revealDeadline: 0,
      disputeDeadline: 0,
      winningAmount: 0,
      totalEscrowed: 0,
      reserveMet: null,
      itemReceived: false,
      paymentClaimed: false,
      settledAt: 0,
      claimableAt: 0,
      confirmationTimeout: physicalTimeout,
      platformFeeAmount: 0,
      sellerNetAmount: 0,
      platformFeeClaimed: false,
      sellerVerification: verifiedSeller,
      assetProof: openCatalogProof,
      itemPhotos: [goldPhoto],
      proofFiles: openCatalogProof.proofFiles,
      bidRecords: [],
      localBids: [],
      offers: [],
      disputes: [],
    },
    {
      id: FIXTURE_IDS.OPEN_OVERDUE,
      title: 'Fixture: Overdue Seller Close',
      description: 'Open auction whose end time already passed, useful for testing close action and executor queue.',
      currency: 'USDCx',
      currencyType: 0,
      assetType: 0,
      minBid: 8,
      reservePrice: 9.5,
      status: 'open',
      seller: primary,
      winner: null,
      createdAt: nowMs - (7 * 3600 * 1000),
      durationSeconds: 3600,
      endTimestamp: now - 1800,
      revealDeadline: 0,
      disputeDeadline: 0,
      winningAmount: 0,
      totalEscrowed: toMicro(19.5),
      reserveMet: null,
      itemReceived: false,
      paymentClaimed: false,
      settledAt: 0,
      claimableAt: 0,
      confirmationTimeout: physicalTimeout,
      platformFeeAmount: 0,
      sellerNetAmount: 0,
      platformFeeClaimed: false,
      sellerVerification: submittedSeller,
      assetProof: overdueProof,
      itemPhotos: [bluePhoto],
      proofFiles: overdueProof.proofFiles,
      bidRecords: [
        { bidder: otherBidder, amount: 9.5, revealed: false, txId: buildFakeTxId(201), timestamp: nowMs - 5_400_000 },
        { bidder: collector, amount: 10, revealed: false, txId: buildFakeTxId(202), timestamp: nowMs - 5_100_000 },
      ],
      localBids: [],
      offers: [],
      disputes: [],
    },
    {
      id: FIXTURE_IDS.CLOSED_REVEAL,
      title: 'Fixture: Reveal Window Active',
      description: 'Closed auction where the connected wallet is a bidder with a stored commitment ready to reveal.',
      currency: 'ALEO',
      currencyType: 1,
      assetType: 3,
      minBid: 5,
      reservePrice: 7,
      status: 'closed',
      seller: otherSeller,
      winner: null,
      createdAt: nowMs - (8 * 3600 * 1000),
      durationSeconds: 4 * 3600,
      endTimestamp: now - 3600,
      revealDeadline: now + 2700,
      disputeDeadline: 0,
      winningAmount: 0,
      totalEscrowed: toMicro(14.25),
      reserveMet: null,
      itemReceived: false,
      paymentClaimed: false,
      settledAt: 0,
      claimableAt: 0,
      confirmationTimeout: digitalTimeout,
      platformFeeAmount: 0,
      sellerNetAmount: 0,
      platformFeeClaimed: false,
      sellerVerification: verifiedSeller,
      assetProof: buildProofBundle({
        seller: otherSeller,
        summary: 'Digital asset listing with active reveal window and bidder-side local commitment.',
        provenanceNote: 'Mint hash and issuance memo attached.',
        authenticityGuarantee: 'Seller agrees to refund if asset metadata hash mismatches.',
        certificateId: 'NFT-FIX-21003',
        proofFiles: [createProofFile('mint-hash.txt', 'text/plain')],
        itemPhotos: [greenPhoto],
        token: 'ALEO',
        assetType: 3,
      }),
      itemPhotos: [greenPhoto],
      proofFiles: [createProofFile('mint-hash.txt', 'text/plain')],
      bidRecords: [
        { bidder: primary, amount: 7.25, revealed: false, txId: buildFakeTxId(301), timestamp: nowMs - 7_200_000 },
        { bidder: otherBidder, amount: 6.5, revealed: true, txId: buildFakeTxId(302), timestamp: nowMs - 6_900_000 },
      ],
      localBids: [
        { wallet: primary, amount: 7.25, txId: buildFakeTxId(301), revealed: false, privacy: 'private', currency: 'aleo' },
      ],
      commitments: [
        { wallet: primary, amountMicro: toMicro(7.25), nonce: 'fixture-nonce-reveal', commitment: '123456789field', privacy: 'private', currency: 'aleo', transactionId: buildFakeTxId(301) },
      ],
      offers: [
        { wallet: primary, amount: 7.5, currency: 'ALEO', note: '[Fixture] Fast settlement if metadata decrypts cleanly.', disclosureMode: 'selective', proofOfFundsStatus: 'zk-proof-ready', status: 'pending' },
      ],
      disputes: [],
    },
    {
      id: FIXTURE_IDS.CLOSED_SETTLE,
      title: 'Fixture: Reveal Timeout Settlement',
      description: 'Closed auction with reveal deadline in the past so the seller can test settle_after_reveal_timeout.',
      currency: 'USAD',
      currencyType: 2,
      assetType: 6,
      minBid: 20,
      reservePrice: 26,
      status: 'closed',
      seller: primary,
      winner: null,
      createdAt: nowMs - (18 * 3600 * 1000),
      durationSeconds: 6 * 3600,
      endTimestamp: now - (8 * 3600),
      revealDeadline: now - 1200,
      disputeDeadline: 0,
      winningAmount: 0,
      totalEscrowed: toMicro(54),
      reserveMet: null,
      itemReceived: false,
      paymentClaimed: false,
      settledAt: 0,
      claimableAt: 0,
      confirmationTimeout: 30 * 24 * 3600,
      platformFeeAmount: 0,
      sellerNetAmount: 0,
      platformFeeClaimed: false,
      sellerVerification: submittedSeller,
      assetProof: buildProofBundle({
        seller: primary,
        summary: 'Vehicle fixture intentionally stopped after reveal deadline.',
        provenanceNote: 'Use this to test timeout settlement and reserve handling.',
        authenticityGuarantee: 'Seller can settle after timeout without extra reserve-cancel action.',
        certificateId: 'CAR-FIX-21004',
        proofFiles: [createProofFile('vehicle-inspection.pdf')],
        itemPhotos: [redPhoto],
        token: 'USAD',
        assetType: 6,
      }),
      itemPhotos: [redPhoto],
      proofFiles: [createProofFile('vehicle-inspection.pdf')],
      bidRecords: [
        { bidder: otherBidder, amount: 27, revealed: true, txId: buildFakeTxId(401), timestamp: nowMs - 10_800_000 },
        { bidder: collector, amount: 29, revealed: false, txId: buildFakeTxId(402), timestamp: nowMs - 10_500_000 },
      ],
      localBids: [],
      offers: [],
      disputes: [],
    },
    {
      id: FIXTURE_IDS.CHALLENGE_READY,
      title: 'Fixture: Challenge Finalize Ready',
      description: 'Challenge-state auction with the dispute deadline already passed so the seller can finalize immediately.',
      currency: 'ALEO',
      currencyType: 1,
      assetType: 0,
      minBid: 11,
      reservePrice: 14,
      status: 'challenge',
      seller: primary,
      winner: otherWinner,
      createdAt: nowMs - (24 * 3600 * 1000),
      durationSeconds: 5 * 3600,
      endTimestamp: now - (18 * 3600),
      revealDeadline: now - (14 * 3600),
      disputeDeadline: now - 1800,
      winningAmount: toMicro(18.5),
      totalEscrowed: toMicro(33.25),
      reserveMet: true,
      itemReceived: false,
      paymentClaimed: false,
      settledAt: now - (8 * 3600),
      claimableAt: 0,
      confirmationTimeout: physicalTimeout,
      platformFeeAmount: toMicro(0.4625),
      sellerNetAmount: toMicro(18.0375),
      platformFeeClaimed: false,
      sellerVerification: verifiedSeller,
      assetProof: openCatalogProof,
      itemPhotos: [goldPhoto],
      proofFiles: openCatalogProof.proofFiles,
      bidRecords: [],
      localBids: [],
      offers: [],
      disputes: [],
      proofRoot: '111111111111111111111111111111111111111111111111111111111111field',
      disputeRoot: null,
      sellerProfile: 'seller_profile_fixture_challenge',
    },
    {
      id: FIXTURE_IDS.SETTLED_SELLER,
      title: 'Fixture: Seller Claim Available',
      description: 'Settled auction where seller claim is already unlocked by timeout.',
      currency: 'USDCx',
      currencyType: 0,
      assetType: 2,
      minBid: 40,
      reservePrice: 50,
      status: 'settled',
      seller: primary,
      winner: otherWinner,
      createdAt: nowMs - (9 * 24 * 3600 * 1000),
      durationSeconds: 2 * 24 * 3600,
      endTimestamp: now - (7 * 24 * 3600),
      revealDeadline: now - (6 * 24 * 3600),
      disputeDeadline: now - (5 * 24 * 3600),
      winningAmount: toMicro(64),
      totalEscrowed: toMicro(95),
      reserveMet: true,
      itemReceived: false,
      paymentClaimed: false,
      settledAt: now - (4 * 24 * 3600),
      claimableAt: now - 3600,
      confirmationTimeout: 90 * 24 * 3600,
      platformFeeAmount: toMicro(1.6),
      sellerNetAmount: toMicro(62.4),
      platformFeeClaimed: false,
      sellerVerification: verifiedSeller,
      assetProof: openCatalogProof,
      itemPhotos: [goldPhoto],
      proofFiles: openCatalogProof.proofFiles,
      bidRecords: [],
      localBids: [],
      offers: [],
      disputes: [],
      proofRoot: '222222222222222222222222222222222222222222222222222222222222field',
      disputeRoot: null,
      sellerProfile: 'seller_profile_fixture_settled_claim',
    },
    {
      id: FIXTURE_IDS.SETTLED_WINNER,
      title: 'Fixture: Winner Receipt Pending',
      description: 'Settled auction where the connected wallet is the winner and can confirm receipt.',
      currency: 'ALEO',
      currencyType: 1,
      assetType: 3,
      minBid: 6,
      reservePrice: 9,
      status: 'settled',
      seller: otherSeller,
      winner: primary,
      createdAt: nowMs - (5 * 24 * 3600 * 1000),
      durationSeconds: 24 * 3600,
      endTimestamp: now - (4 * 24 * 3600),
      revealDeadline: now - (3 * 24 * 3600),
      disputeDeadline: now - (3 * 24 * 3600) + 7200,
      winningAmount: toMicro(11.5),
      totalEscrowed: toMicro(24),
      reserveMet: true,
      itemReceived: false,
      paymentClaimed: false,
      settledAt: now - (2 * 24 * 3600),
      claimableAt: now + (8 * 3600),
      confirmationTimeout: digitalTimeout,
      platformFeeAmount: toMicro(0.2875),
      sellerNetAmount: toMicro(11.2125),
      platformFeeClaimed: false,
      sellerVerification: submittedSeller,
      assetProof: buildProofBundle({
        seller: otherSeller,
        summary: 'Winner-side receipt confirmation path for a digital asset delivery.',
        provenanceNote: 'Minted and transferred through private workflow.',
        authenticityGuarantee: 'Supports confirm-receipt testing without seller payout already claimed.',
        certificateId: 'DIGI-FIX-21007',
        proofFiles: [createProofFile('delivery-note.txt', 'text/plain')],
        itemPhotos: [greenPhoto],
        token: 'ALEO',
        assetType: 3,
      }),
      itemPhotos: [greenPhoto],
      proofFiles: [createProofFile('delivery-note.txt', 'text/plain')],
      bidRecords: [],
      localBids: [
        { wallet: primary, amount: 11.5, txId: buildFakeTxId(701), revealed: true, privacy: 'private', currency: 'aleo' },
      ],
      commitments: [
        { wallet: primary, amountMicro: toMicro(11.5), nonce: 'fixture-nonce-winner', commitment: '777777777field', privacy: 'private', currency: 'aleo', transactionId: buildFakeTxId(701) },
      ],
      offers: [],
      disputes: [],
      proofRoot: '333333333333333333333333333333333333333333333333333333333333field',
      disputeRoot: null,
      sellerProfile: 'seller_profile_fixture_winner_receipt',
    },
    {
      id: FIXTURE_IDS.SETTLED_FEE,
      title: 'Fixture: Platform Fee Ready',
      description: 'Settled auction with seller already paid, leaving platform fee claimable for ops/platform-owner testing.',
      currency: 'USAD',
      currencyType: 2,
      assetType: 4,
      minBid: 15,
      reservePrice: 18,
      status: 'settled',
      seller: otherSeller,
      winner: collector,
      createdAt: nowMs - (14 * 24 * 3600 * 1000),
      durationSeconds: 2 * 24 * 3600,
      endTimestamp: now - (11 * 24 * 3600),
      revealDeadline: now - (10 * 24 * 3600),
      disputeDeadline: now - (9 * 24 * 3600),
      winningAmount: toMicro(22),
      totalEscrowed: toMicro(34),
      reserveMet: true,
      itemReceived: true,
      itemReceivedAt: now - (8 * 24 * 3600),
      paymentClaimed: true,
      paymentClaimedAt: now - (7 * 24 * 3600),
      settledAt: now - (8 * 24 * 3600),
      claimableAt: now - (8 * 24 * 3600),
      confirmationTimeout: 30 * 24 * 3600,
      platformFeeAmount: toMicro(0.55),
      sellerNetAmount: toMicro(21.45),
      platformFeeClaimed: false,
      sellerVerification: submittedSeller,
      assetProof: buildProofBundle({
        seller: otherSeller,
        summary: 'Back-office payout and platform-fee scenario.',
        provenanceNote: 'Used to test platform-owner follow-up after seller payout.',
        authenticityGuarantee: 'Ops fixture only.',
        certificateId: 'FEE-FIX-21008',
        proofFiles: [createProofFile('settlement-ledger.csv', 'text/csv')],
        itemPhotos: [bluePhoto],
        token: 'USAD',
        assetType: 4,
      }),
      itemPhotos: [bluePhoto],
      proofFiles: [createProofFile('settlement-ledger.csv', 'text/csv')],
      bidRecords: [],
      localBids: [],
      offers: [],
      disputes: [],
      proofRoot: '444444444444444444444444444444444444444444444444444444444444field',
      disputeRoot: null,
      sellerProfile: 'seller_profile_fixture_fee_ready',
    },
    {
      id: FIXTURE_IDS.CANCELLED_REFUND,
      title: 'Fixture: Reserve Miss Refund',
      description: 'Cancelled auction where reserve was not met and bidder refund should be available.',
      currency: 'ALEO',
      currencyType: 1,
      assetType: 5,
      minBid: 4,
      reservePrice: 10,
      status: 'cancelled',
      seller: otherSeller,
      winner: null,
      createdAt: nowMs - (4 * 24 * 3600 * 1000),
      durationSeconds: 12 * 3600,
      endTimestamp: now - (3 * 24 * 3600),
      revealDeadline: now - (2 * 24 * 3600),
      disputeDeadline: 0,
      winningAmount: toMicro(7),
      totalEscrowed: toMicro(17),
      reserveMet: false,
      itemReceived: false,
      paymentClaimed: false,
      settledAt: now - (2 * 24 * 3600),
      claimableAt: 0,
      confirmationTimeout: 7 * 24 * 3600,
      platformFeeAmount: 0,
      sellerNetAmount: 0,
      platformFeeClaimed: false,
      sellerVerification: submittedSeller,
      assetProof: buildProofBundle({
        seller: otherSeller,
        summary: 'Reserve miss path for refund testing.',
        provenanceNote: 'The winning reveal stayed below reserve.',
        authenticityGuarantee: 'Refunds should be enabled for all bidders.',
        certificateId: 'CANCEL-FIX-21009',
        proofFiles: [createProofFile('reserve-analysis.pdf')],
        itemPhotos: [redPhoto],
        token: 'ALEO',
        assetType: 5,
      }),
      itemPhotos: [redPhoto],
      proofFiles: [createProofFile('reserve-analysis.pdf')],
      bidRecords: [
        { bidder: primary, amount: 7, revealed: true, txId: buildFakeTxId(901), timestamp: nowMs - (3 * 24 * 3600) },
      ],
      localBids: [
        { wallet: primary, amount: 7, txId: buildFakeTxId(901), revealed: true, privacy: 'public', currency: 'aleo' },
      ],
      commitments: [
        { wallet: primary, amountMicro: toMicro(7), nonce: 'fixture-nonce-refund', commitment: '999999999field', privacy: 'public', currency: 'aleo', transactionId: buildFakeTxId(901) },
      ],
      offers: [],
      disputes: [],
      proofRoot: '555555555555555555555555555555555555555555555555555555555555field',
      disputeRoot: null,
      sellerProfile: 'seller_profile_fixture_refund',
    },
    {
      id: FIXTURE_IDS.DISPUTED_CASE,
      title: 'Fixture: Active Dispute Case',
      description: 'Disputed auction with local dispute record, on-chain dispute root, and private offer history for ops testing.',
      currency: 'USDCx',
      currencyType: 0,
      assetType: 2,
      minBid: 55,
      reservePrice: 60,
      status: 'disputed',
      seller: primary,
      winner: collector,
      createdAt: nowMs - (12 * 24 * 3600 * 1000),
      durationSeconds: 24 * 3600,
      endTimestamp: now - (11 * 24 * 3600),
      revealDeadline: now - (10 * 24 * 3600),
      disputeDeadline: now - (9 * 24 * 3600),
      winningAmount: toMicro(74),
      totalEscrowed: toMicro(122),
      reserveMet: true,
      itemReceived: false,
      paymentClaimed: false,
      settledAt: now - (9 * 24 * 3600),
      claimableAt: now + (2 * 24 * 3600),
      confirmationTimeout: 90 * 24 * 3600,
      platformFeeAmount: toMicro(1.85),
      sellerNetAmount: toMicro(72.15),
      platformFeeClaimed: false,
      sellerVerification: verifiedSeller,
      assetProof: openCatalogProof,
      itemPhotos: [goldPhoto, bluePhoto],
      proofFiles: [...openCatalogProof.proofFiles, createProofFile('inspection-video.mp4', 'video/mp4')],
      bidRecords: [],
      localBids: [],
      offers: [
        { wallet: otherBidder, amount: 70, currency: 'USDCx', note: '[Fixture] Buyer requested escrow-backed OTC fallback.', disclosureMode: 'anonymous', proofOfFundsStatus: 'custodian-confirmed', status: 'pending' },
      ],
      disputes: [
        {
          wallet: collector,
          seller: primary,
          role: 'winner',
          title: '[Fixture] Shipping damage dispute',
          description: 'Winner claims the delivered item arrived with a mismatched serial seal and requests refund through the dispute flow.',
          evidence: ['inspection-photo-set', 'courier-receipt', 'serial-mismatch-report'],
          status: 'open',
          timelineEntries: [
            {
              at: new Date((now - (3 * 24 * 3600)) * 1000).toISOString(),
              label: 'Evidence package expanded',
              note: 'Additional courier and inspection notes were attached for ops review.',
            },
          ],
        },
      ],
      proofRoot: '666666666666666666666666666666666666666666666666666666666666field',
      disputeRoot: '777777777777777777777777777777777777777777777777777777777777field',
      sellerProfile: 'seller_profile_fixture_disputed',
    },
  ];

  const myAuctions = auctions.map((auction) => ({
    id: auction.id,
    title: auction.title,
    description: auction.description,
    minBid: String(auction.minBid),
    reservePrice: String(auction.reservePrice),
    currency: auction.currency,
    assetType: auction.assetType,
    itemPhotos: auction.itemPhotos,
    sellerDisplayName: auction.sellerVerification?.sellerDisplayName || null,
    sellerVerification: auction.sellerVerification,
    assetProof: auction.assetProof,
    proofFiles: auction.proofFiles,
    durationValue: String(Math.max(1, Math.round(auction.durationSeconds / 3600))),
    durationUnit: 'hours',
    durationSeconds: auction.durationSeconds,
    durationLabel: `${Math.max(1, Math.round(auction.durationSeconds / 3600))} hours`,
    creator: auction.seller,
    createdAt: auction.createdAt,
    txId: buildFakeTxId(auction.id),
    mockOnChain: buildMockOnChain({
      seller: auction.seller,
      minBid: auction.minBid,
      reservePrice: auction.reservePrice,
      currencyType: auction.currencyType,
      assetType: auction.assetType,
      endTimestamp: auction.endTimestamp,
      revealPeriod,
      disputePeriod,
      state: auction.status === 'open' ? 0 : auction.status === 'closed' ? 1 : auction.status === 'challenge' ? 2 : auction.status === 'settled' ? 3 : auction.status === 'cancelled' ? 4 : 5,
      winner: auction.winner,
      winningAmount: auction.winningAmount,
      revealDeadline: auction.revealDeadline,
      disputeDeadline: auction.disputeDeadline,
      totalEscrowed: auction.totalEscrowed,
      itemReceived: auction.itemReceived,
      itemReceivedAt: auction.itemReceivedAt || 0,
      paymentClaimed: auction.paymentClaimed,
      paymentClaimedAt: auction.paymentClaimedAt || 0,
      confirmationTimeout: auction.confirmationTimeout,
      settledAt: auction.settledAt,
      claimableAt: auction.claimableAt,
      platformFeeAmount: auction.platformFeeAmount,
      sellerNetAmount: auction.sellerNetAmount,
      platformFeeClaimed: auction.platformFeeClaimed,
      platformFeeClaimedAt: auction.platformFeeClaimedAt || 0,
      reserveMet: auction.reserveMet,
    }),
    mockHighestBid: auction.winningAmount > 0 ? `${auction.winningAmount}u128` : null,
    mockHighestBidder: auction.winner || null,
    mockSellerProfile: auction.sellerProfile || null,
    mockProofRoot: auction.proofRoot || null,
    mockDisputeRoot: auction.disputeRoot || null,
    isFixture: true,
    fixtureVersion: SHADOWBID_FIXTURE_VERSION,
  }));

  const legacyAuctions = auctions.map((auction) => buildLegacyAuction({
    id: auction.id,
    title: auction.title,
    category: ['Collectibles', 'Physical Goods', 'Digital Assets', 'RWA'][auction.assetType % 4] || 'General',
    description: auction.description,
    minBid: auction.minBid,
    seller: auction.seller,
    createdAt: auction.createdAt,
    durationSeconds: Math.max(auction.durationSeconds, 60),
    image: auction.itemPhotos[0]?.data || createSvgDataUri(auction.title, '#111827', '#334155'),
    status: auction.id === FIXTURE_IDS.OPEN_CATALOG || auction.id === FIXTURE_IDS.OPEN_OVERDUE ? 'active' : auction.status,
    bids: auction.bidRecords.length,
  }));

  const shadowbidBids = auctions.flatMap((auction) => (auction.localBids || []).map((bid) => ({
    auctionId: String(auction.id),
    txId: bid.txId,
    amount: bid.amount,
    timestamp: nowMs - 60_000,
  })));

  return {
    version: SHADOWBID_FIXTURE_VERSION,
    wallets: {
      primary,
      otherSeller,
      otherBidder,
      otherWinner,
      collector,
      platform: PLATFORM_ADDRESS,
    },
    auctions,
    myAuctions,
    legacyAuctions,
    shadowbidBids,
    auctionIds: auctions.map((auction) => String(auction.id)),
  };
}

function mergeFixtureAuctions(existing, nextAuctions) {
  const fixtureIds = new Set(nextAuctions.map((auction) => String(auction.id)));
  const preserved = (Array.isArray(existing) ? existing : []).filter((auction) => {
    if (!auction) {
      return false;
    }

    const auctionId = String(auction.id);
    return !fixtureIds.has(auctionId) && auction.fixtureVersion !== SHADOWBID_FIXTURE_VERSION;
  });

  return [...nextAuctions, ...preserved];
}

function writeLocalStorageBundle(bundle) {
  localStorage.setItem('myAuctions', JSON.stringify(mergeFixtureAuctions(
    JSON.parse(localStorage.getItem('myAuctions') || '[]'),
    bundle.myAuctions
  )));
  localStorage.setItem('shadowbid_auctions', JSON.stringify(mergeFixtureAuctions(
    JSON.parse(localStorage.getItem('shadowbid_auctions') || '[]'),
    bundle.legacyAuctions
  )));
  localStorage.setItem('shadowbid_bids', JSON.stringify(bundle.shadowbidBids));
  localStorage.setItem(SHADOWBID_FIXTURE_STORAGE_KEY, JSON.stringify({
    version: bundle.version,
    auctionIds: bundle.auctionIds,
    seededAt: new Date().toISOString(),
    wallets: bundle.wallets,
  }));

  for (const auction of bundle.auctions) {
    const key = `auction_${auction.id}_bids`;
    localStorage.setItem(key, JSON.stringify(auction.bidRecords || []));
  }

  for (const auction of bundle.auctions) {
    for (const commitment of auction.commitments || []) {
      clearCommitment(auction.id, commitment.wallet);
      clearNonce(auction.id, commitment.wallet);
      saveNonce(auction.id, commitment.nonce, commitment.wallet);
      saveCommitment(
        auction.id,
        commitment.commitment,
        commitment.amountMicro,
        commitment.wallet,
        commitment.currency,
        {
          transactionId: commitment.transactionId,
          explorerTransactionId: commitment.transactionId,
          status: 'confirmed',
          privacy: commitment.privacy,
          confirmedAt: Date.now(),
        }
      );
    }
  }
}

async function syncFixturesToOps(bundle, debugInfo) {
  if (!debugInfo.isLocalTarget) {
    return {
      synced: false,
      skipped: true,
      reason: `Ops target is ${debugInfo.baseUrl || 'not configured'}, so browser-local fixture data was seeded without touching shared Ops storage.`,
    };
  }

  await resetOpsTestData();

  for (const auction of bundle.auctions) {
    await syncAuctionSnapshot({
      id: auction.id,
      title: auction.title,
      status: auction.status,
      contractState: auction.status.toUpperCase(),
      seller: auction.seller,
      winner: auction.winner,
      token: auction.currency,
      endTimestamp: auction.endTimestamp,
      revealDeadline: auction.revealDeadline,
      disputeDeadline: auction.disputeDeadline,
      reservePrice: auction.reservePrice,
      reserveMet: auction.reserveMet,
      settledAt: auction.settledAt,
      claimableAt: auction.claimableAt,
      itemReceived: auction.itemReceived,
      paymentClaimed: auction.paymentClaimed,
      platformFeeClaimed: auction.platformFeeClaimed,
      winningBid: auction.winningAmount > 0 ? auction.winningAmount / 1_000_000 : 0,
      winningAmountMicro: auction.winningAmount > 0 ? String(auction.winningAmount) : null,
      platformFee: auction.platformFeeAmount / 1_000_000,
      platformFeeMicro: auction.platformFeeAmount > 0 ? String(auction.platformFeeAmount) : null,
      sellerNetAmount: auction.sellerNetAmount / 1_000_000,
      sellerNetAmountMicro: auction.sellerNetAmount > 0 ? String(auction.sellerNetAmount) : null,
      totalEscrowed: auction.totalEscrowed / 1_000_000,
      totalEscrowedMicro: String(auction.totalEscrowed),
      assetType: auction.assetType,
      currencyType: auction.currencyType,
      itemPhotosCount: auction.itemPhotos.length,
      proofFilesCount: auction.proofFiles.length,
      verificationStatus: auction.sellerVerification?.status || 'pending',
    });

    await syncAuctionRole({
      auctionId: auction.id,
      wallet: auction.seller,
      roles: ['seller'],
    });

    if (auction.winner) {
      await syncAuctionRole({
        auctionId: auction.id,
        wallet: auction.winner,
        roles: ['winner', 'bidder'],
      });
    }

    for (const bid of auction.localBids || []) {
      await syncAuctionRole({
        auctionId: auction.id,
        wallet: bid.wallet,
        roles: ['bidder'],
      });
    }

    await upsertSellerVerification(auction.seller, auction.sellerVerification || {});
    await upsertAuctionProofBundle(auction.id, {
      ...(auction.assetProof || {}),
      proofFiles: auction.proofFiles,
      itemPhotos: auction.itemPhotos,
      seller: auction.seller,
      token: auction.currency,
      assetType: auction.assetType,
    });

    const existingOffers = await getOffers({ auctionId: auction.id });
    for (const offer of auction.offers || []) {
      const alreadyExists = existingOffers.some((candidate) => candidate.note === offer.note);
      if (!alreadyExists) {
        await createOffer({
          auctionId: auction.id,
          wallet: offer.wallet,
          amount: offer.amount,
          currency: offer.currency,
          note: offer.note,
          type: 'make_offer',
          disclosureMode: offer.disclosureMode,
          proofOfFundsStatus: offer.proofOfFundsStatus,
          status: offer.status,
        });
      }
    }

    const existingDisputes = await getDisputes({ auctionId: auction.id });
    for (const dispute of auction.disputes || []) {
      const alreadyExists = existingDisputes.some((candidate) => candidate.title === dispute.title);
      if (!alreadyExists) {
        const created = await createDispute({
          auctionId: auction.id,
          wallet: dispute.wallet,
          seller: dispute.seller,
          role: dispute.role,
          title: dispute.title,
          description: dispute.description,
          evidence: dispute.evidence,
          status: dispute.status,
        });

        if (created && Array.isArray(dispute.timelineEntries) && dispute.timelineEntries.length > 0) {
          await updateDispute(created.id, {
            status: dispute.status,
            timelineEntries: dispute.timelineEntries,
            onChainDisputeRoot: auction.disputeRoot || null,
          });
        }
      }
    }
  }

  await saveWatchlist(bundle.wallets.primary, {
    auctionIds: [
      String(FIXTURE_IDS.OPEN_CATALOG),
      String(FIXTURE_IDS.CLOSED_REVEAL),
      String(FIXTURE_IDS.DISPUTED_CASE),
    ],
    sellers: [bundle.wallets.primary, bundle.wallets.otherSeller],
    categories: ['Collectibles', 'Digital Assets', 'RWA'],
  });

  await saveSavedSearches(bundle.wallets.primary, [
    {
      id: 'fixture-search-closing-soon',
      label: 'Fixture: Closing Soon',
      query: '',
      filters: {
        status: 'open',
        category: 'Collectibles',
      },
    },
    {
      id: 'fixture-search-disputes',
      label: 'Fixture: Disputes',
      query: 'Fixture',
      filters: {
        status: 'disputed',
      },
    },
  ]);

  await runExecutorScan();

  return {
    synced: true,
    skipped: false,
    reason: `Ops fixtures synced to ${debugInfo.baseUrl}.`,
  };
}

export async function seedShadowBidV221Fixtures({ primaryWallet } = {}) {
  const bundle = buildFixtureBundle(primaryWallet);
  writeLocalStorageBundle(bundle);

  const debugInfo = getOpsApiDebugInfo();
  const opsResult = await syncFixturesToOps(bundle, debugInfo);

  return {
    bundle,
    opsResult,
  };
}

export async function clearShadowBidV221Fixtures() {
  const fixtureState = JSON.parse(localStorage.getItem(SHADOWBID_FIXTURE_STORAGE_KEY) || '{}');
  const fixtureIds = new Set(Array.isArray(fixtureState.auctionIds) ? fixtureState.auctionIds.map(String) : []);

  const filterFixtures = (key) => {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = Array.isArray(parsed)
      ? parsed.filter((entry) => !fixtureIds.has(String(entry?.id ?? entry?.auctionId)))
      : [];
    localStorage.setItem(key, JSON.stringify(filtered));
  };

  filterFixtures('myAuctions');
  filterFixtures('shadowbid_auctions');
  filterFixtures('shadowbid_bids');

  for (const auctionId of fixtureIds) {
    localStorage.removeItem(`auction_${auctionId}_bids`);
  }

  const wallets = fixtureState.wallets || {};
  for (const auctionId of fixtureIds) {
    for (const wallet of Object.values(wallets)) {
      if (typeof wallet === 'string' && wallet.startsWith('aleo1')) {
        clearCommitment(auctionId, wallet);
        clearNonce(auctionId, wallet);
      }
    }
  }

  localStorage.removeItem(SHADOWBID_FIXTURE_STORAGE_KEY);

  const debugInfo = getOpsApiDebugInfo();
  if (debugInfo.isLocalTarget) {
    await resetOpsTestData();
  }

  return {
    clearedAuctionIds: [...fixtureIds],
    opsReset: debugInfo.isLocalTarget,
  };
}

function readFixtureState() {
  try {
    return JSON.parse(localStorage.getItem(SHADOWBID_FIXTURE_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function getShadowBidFixtureMeta() {
  const fixtureState = readFixtureState();
  return {
    version: fixtureState.version || null,
    seededAt: fixtureState.seededAt || null,
    auctionIds: Array.isArray(fixtureState.auctionIds) ? fixtureState.auctionIds : [],
    wallets: fixtureState.wallets || null,
  };
}

export function getMockFixtureAuctionById(auctionId) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = JSON.parse(localStorage.getItem('myAuctions') || '[]');
    return stored.find((auction) => String(auction.id) === String(auctionId) && auction?.mockOnChain) || null;
  } catch {
    return null;
  }
}

export function getMockFixtureAuctionInfo(auctionId) {
  return getMockFixtureAuctionById(auctionId)?.mockOnChain || null;
}

export function getMockFixtureHighestBid(auctionId) {
  return getMockFixtureAuctionById(auctionId)?.mockHighestBid || null;
}

export function getMockFixtureHighestBidder(auctionId) {
  return getMockFixtureAuctionById(auctionId)?.mockHighestBidder || null;
}

export function getMockFixtureSellerProfile(address) {
  if (typeof window === 'undefined' || !address) {
    return null;
  }

  try {
    const stored = JSON.parse(localStorage.getItem('myAuctions') || '[]');
    const match = stored.find((auction) => auction?.creator === address && auction?.mockSellerProfile);
    return match?.mockSellerProfile || null;
  } catch {
    return null;
  }
}

export function getMockFixtureProofRoot(auctionId) {
  return getMockFixtureAuctionById(auctionId)?.mockProofRoot || null;
}

export function getMockFixtureDisputeRoot(auctionId) {
  return getMockFixtureAuctionById(auctionId)?.mockDisputeRoot || null;
}
