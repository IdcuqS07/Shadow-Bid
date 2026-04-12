/* global Buffer, process */
import crypto from 'node:crypto';

export const PLATFORM_ADDRESS = 'aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8';
export const OPS_DB_SCHEMA_VERSION = 2;

function resolveCorsOrigin(configuredOrigin = '*', requestOrigin = '') {
  if (!configuredOrigin || configuredOrigin === '*') {
    return '*';
  }

  const allowedOrigins = configuredOrigin
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    return '*';
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins[0];
}

function createCorsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function createDbMeta(meta = {}) {
  const now = new Date().toISOString();
  const createdAt = typeof meta.createdAt === 'string' && meta.createdAt ? meta.createdAt : now;
  const updatedAt = typeof meta.updatedAt === 'string' && meta.updatedAt ? meta.updatedAt : createdAt;
  const lastMigrationAt = typeof meta.lastMigrationAt === 'string' && meta.lastMigrationAt
    ? meta.lastMigrationAt
    : createdAt;

  return {
    schemaVersion: OPS_DB_SCHEMA_VERSION,
    revision: toNumber(meta.revision, 0),
    createdAt,
    updatedAt,
    lastMigrationAt,
  };
}

export function createDefaultDb() {
  const now = new Date().toISOString();

  return {
    meta: createDbMeta({
      createdAt: now,
      updatedAt: now,
      lastMigrationAt: now,
      revision: 0,
    }),
    settings: {
      executor: {
        enabled: true,
        mode: 'simulate',
        pollingSeconds: 60,
        autoNotify: true,
        lastRunAt: null,
      },
    },
    auctions: {},
    engagements: {},
    sellerVerifications: {},
    auctionProofs: {},
    watchlists: {},
    savedSearches: {},
    notificationState: {},
    disputes: {},
    reputations: {},
    offers: {},
    executorRuns: [],
    eventLog: [],
  };
}

export function mergeDefaults(db = {}) {
  const defaults = createDefaultDb();
  const sourceMeta = db.meta && typeof db.meta === 'object' ? db.meta : {};
  const needsMigration = !db.meta || toNumber(sourceMeta.schemaVersion, 0) !== OPS_DB_SCHEMA_VERSION;
  const normalizedMeta = createDbMeta(sourceMeta);

  return {
    ...defaults,
    ...db,
    meta: {
      ...normalizedMeta,
      schemaVersion: OPS_DB_SCHEMA_VERSION,
      lastMigrationAt: needsMigration
        ? new Date().toISOString()
        : normalizedMeta.lastMigrationAt,
    },
    settings: {
      ...defaults.settings,
      ...(db.settings || {}),
      executor: {
        ...defaults.settings.executor,
        ...(db.settings?.executor || {}),
      },
    },
    auctions: Object.fromEntries(
      Object.entries(db.auctions || {}).map(([auctionId, snapshot]) => {
        const normalizedSnapshot = normalizeStoredAuctionSnapshot(snapshot, auctionId);
        return [String(normalizedSnapshot.id || auctionId), normalizedSnapshot];
      })
    ),
    engagements: db.engagements || {},
    sellerVerifications: db.sellerVerifications || {},
    auctionProofs: db.auctionProofs || {},
    watchlists: db.watchlists || {},
    savedSearches: db.savedSearches || {},
    notificationState: db.notificationState || {},
    disputes: db.disputes || {},
    reputations: db.reputations || {},
    offers: db.offers || {},
    executorRuns: Array.isArray(db.executorRuns) ? db.executorRuns : [],
    eventLog: Array.isArray(db.eventLog) ? db.eventLog : [],
  };
}

export function serializeDb(db) {
  return JSON.stringify(mergeDefaults(db), null, 2);
}

export function deserializeDb(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return createDefaultDb();
  }

  return mergeDefaults(JSON.parse(raw));
}

export function prepareDbForSave(db) {
  const normalized = mergeDefaults(db);

  return {
    ...normalized,
    meta: {
      ...normalized.meta,
      schemaVersion: OPS_DB_SCHEMA_VERSION,
      revision: toNumber(normalized.meta?.revision, 0) + 1,
      updatedAt: new Date().toISOString(),
    },
  };
}

function normalizeAddress(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function dedupe(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))];
}

function toDisplayAmount(value) {
  if (value == null || value === '') {
    return 0;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }

    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed) / 1_000_000;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatTimeDistance(seconds) {
  if (!Number.isFinite(seconds)) {
    return 'Unknown';
  }

  if (seconds <= 0) {
    return 'Now';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function toOptionalTrimmedString(value, fallback = null) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeProgramId(value) {
  return toOptionalTrimmedString(value);
}

function normalizeAuctionVersionLabel(value) {
  const normalizedValue = toOptionalTrimmedString(value);
  if (!normalizedValue) {
    return null;
  }

  const explicitVersionMatch = normalizedValue.toLowerCase().match(/\bv\d+\.\d+\b/);
  return explicitVersionMatch ? explicitVersionMatch[0] : normalizedValue.toLowerCase();
}

function detectAuctionVersionInText(text) {
  const normalizedText = toOptionalTrimmedString(text);
  if (!normalizedText) {
    return null;
  }

  const versionMatch = normalizedText.toLowerCase().match(/\bv\d+\.\d+\b/);
  return versionMatch ? versionMatch[0] : null;
}

function inferVersionFromProgramId(programId) {
  const normalizedProgramId = normalizeProgramId(programId);
  const versionMatch = normalizedProgramId?.match(/shadowbid_marketplace_v(\d+)_(\d+)\.aleo/i);
  return versionMatch ? `v${versionMatch[1]}.${versionMatch[2]}` : null;
}

function inferProgramIdFromVersion(version) {
  const normalizedVersion = normalizeAuctionVersionLabel(version);
  const versionMatch = normalizedVersion?.match(/^v(\d+)\.(\d+)$/i);
  return versionMatch ? `shadowbid_marketplace_v${versionMatch[1]}_${versionMatch[2]}.aleo` : null;
}

function deriveAuctionContractIdentity(snapshot) {
  const explicitVersion = normalizeAuctionVersionLabel(snapshot?.explicitVersion)
    || normalizeAuctionVersionLabel(snapshot?.contractVersion)
    || detectAuctionVersionInText(snapshot?.title)
    || detectAuctionVersionInText(snapshot?.description)
    || normalizeAuctionVersionLabel(snapshot?.version);
  const programId = normalizeProgramId(
    snapshot?.programId
      || snapshot?.contractProgramId
      || snapshot?.onChainProgramId
  ) || inferProgramIdFromVersion(explicitVersion);
  const resolvedVersion = explicitVersion || inferVersionFromProgramId(programId);

  return {
    programId,
    version: resolvedVersion,
    contractVersion: resolvedVersion ? resolvedVersion.toUpperCase() : null,
    explicitVersion,
  };
}

function normalizeStoredAuctionSnapshot(snapshot, fallbackId) {
  const normalizedSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const contractIdentity = deriveAuctionContractIdentity(normalizedSnapshot);

  return {
    ...normalizedSnapshot,
    id: String(normalizedSnapshot.id ?? fallbackId ?? ''),
    programId: contractIdentity.programId,
    contractProgramId: contractIdentity.programId,
    onChainProgramId: contractIdentity.programId,
    version: contractIdentity.version,
    contractVersion: contractIdentity.contractVersion,
    explicitVersion: contractIdentity.explicitVersion,
  };
}

function sanitizeProofAttachment(attachment, options = {}) {
  if (!attachment || typeof attachment !== 'object') {
    return null;
  }

  const {
    fallbackName = 'Attachment',
    keepData = true,
  } = options;

  const sanitized = {
    name: toOptionalTrimmedString(attachment.name, fallbackName),
    type: toOptionalTrimmedString(attachment.type, 'application/octet-stream'),
    size: Math.max(0, toNumber(attachment.size, 0)),
  };

  if (keepData && typeof attachment.data === 'string' && attachment.data.trim()) {
    sanitized.data = attachment.data;
  }

  return sanitized;
}

function sanitizeAttachmentList(values, options = {}) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value, index) => sanitizeProofAttachment(value, {
      ...options,
      fallbackName: `${options.fallbackName || 'Attachment'} ${index + 1}`,
    }))
    .filter(Boolean)
    .slice(0, 12);
}

function sanitizeSellerVerification(value, options = {}) {
  const verification = value && typeof value === 'object' ? value : {};
  const now = new Date().toISOString();
  const allowedStatuses = new Set(['pending', 'submitted', 'verified']);
  const allowedTiers = new Set(['standard', 'enhanced', 'institutional']);
  const wallet = normalizeAddress(options.wallet || verification.wallet);

  return {
    wallet: wallet || null,
    sellerDisplayName: toOptionalTrimmedString(verification.sellerDisplayName),
    status: allowedStatuses.has(verification.status) ? verification.status : 'pending',
    tier: allowedTiers.has(verification.tier) ? verification.tier : 'standard',
    issuingAuthority: toOptionalTrimmedString(verification.issuingAuthority),
    certificateId: toOptionalTrimmedString(verification.certificateId),
    provenanceNote: toOptionalTrimmedString(verification.provenanceNote),
    authenticityGuarantee: toOptionalTrimmedString(verification.authenticityGuarantee),
    submittedAt: toOptionalTrimmedString(verification.submittedAt),
    createdAt: toOptionalTrimmedString(verification.createdAt, now),
    updatedAt: now,
  };
}

function sanitizeAuctionProofBundle(value, options = {}) {
  const proofBundle = value && typeof value === 'object' ? value : {};
  const now = new Date().toISOString();
  const proofFiles = sanitizeAttachmentList(proofBundle.proofFiles, {
    fallbackName: 'Proof file',
    keepData: true,
  });
  const itemPhotos = sanitizeAttachmentList(proofBundle.itemPhotos, {
    fallbackName: 'Item photo',
    keepData: true,
  });

  return {
    auctionId: String(options.auctionId || proofBundle.auctionId || ''),
    seller: normalizeAddress(proofBundle.seller) || null,
    token: toOptionalTrimmedString(proofBundle.token, 'ALEO'),
    assetType: toNumber(proofBundle.assetType, 0),
    summary: toOptionalTrimmedString(proofBundle.summary),
    provenanceNote: toOptionalTrimmedString(proofBundle.provenanceNote),
    authenticityGuarantee: toOptionalTrimmedString(proofBundle.authenticityGuarantee),
    certificateId: toOptionalTrimmedString(proofBundle.certificateId),
    proofFiles,
    itemPhotos,
    proofFilesCount: proofFiles.length,
    itemPhotosCount: itemPhotos.length,
    createdAt: toOptionalTrimmedString(proofBundle.createdAt, now),
    updatedAt: now,
  };
}

function sanitizeWatchlist(value, options = {}) {
  const watchlist = value && typeof value === 'object' ? value : {};
  const wallet = normalizeAddress(options.wallet || watchlist.wallet);

  return {
    wallet,
    auctionIds: dedupe(Array.isArray(watchlist.auctionIds) ? watchlist.auctionIds.map(String) : []),
    sellers: dedupe(Array.isArray(watchlist.sellers) ? watchlist.sellers.map(normalizeAddress) : []),
    categories: dedupe(Array.isArray(watchlist.categories) ? watchlist.categories.map((category) => String(category)) : []),
    updatedAt: toOptionalTrimmedString(watchlist.updatedAt),
  };
}

function sanitizeSavedSearchEntry(value, index = 0) {
  const entry = value && typeof value === 'object' ? value : {};
  const allowedFilters = new Set([
    'all',
    'active',
    'open',
    'awaiting-close',
    'closed',
    'challenge',
    'disputed',
    'settled',
    'cancelled',
    'ending-soon',
  ]);
  const categoryFilter = entry.categoryFilter === 'all' || entry.categoryFilter == null
    ? 'all'
    : String(entry.categoryFilter);
  const fallbackLabel = entry.query
    ? `Search: ${String(entry.query).trim()}`
    : `Saved Filter ${index + 1}`;

  return {
    id: toOptionalTrimmedString(entry.id, `search_${index + 1}`),
    label: toOptionalTrimmedString(entry.label, fallbackLabel),
    query: toOptionalTrimmedString(entry.query, ''),
    filter: allowedFilters.has(entry.filter) ? entry.filter : 'all',
    categoryFilter,
    savedAt: toOptionalTrimmedString(entry.savedAt, new Date().toISOString()),
  };
}

function sanitizeSavedSearchCollection(value, options = {}) {
  const collection = value && typeof value === 'object' ? value : {};
  const wallet = normalizeAddress(options.wallet || collection.wallet);

  return {
    wallet,
    searches: Array.isArray(collection.searches)
      ? collection.searches.map((entry, index) => sanitizeSavedSearchEntry(entry, index)).slice(0, 12)
      : [],
    updatedAt: toOptionalTrimmedString(collection.updatedAt),
  };
}

function getAssetCategoryLabel(assetType) {
  switch (String(assetType)) {
    case '0':
      return 'Physical';
    case '1':
      return 'Collectibles';
    case '2':
      return 'Real Estate';
    case '3':
      return 'Digital';
    case '4':
      return 'Services';
    case '5':
      return 'Tickets';
    case '6':
      return 'Vehicles';
    case '7':
      return 'IP';
    default:
      return 'Category';
  }
}

function generateId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function getWalletNotificationState(db, wallet) {
  const normalizedWallet = normalizeAddress(wallet);
  if (!normalizedWallet) {
    return {
      dismissed: [],
      read: [],
      updatedAt: null,
    };
  }

  if (!db.notificationState[normalizedWallet]) {
    db.notificationState[normalizedWallet] = {
      dismissed: [],
      read: [],
      updatedAt: null,
    };
  }

  return db.notificationState[normalizedWallet];
}

function sortNotifications(notifications) {
  const priorityMap = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return notifications.sort((left, right) => {
    const readDelta = Number(Boolean(left.read)) - Number(Boolean(right.read));
    if (readDelta !== 0) {
      return readDelta;
    }

    const urgencyDelta = (priorityMap[left.urgency] ?? 99) - (priorityMap[right.urgency] ?? 99);
    if (urgencyDelta !== 0) {
      return urgencyDelta;
    }

    return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
  });
}

function getAuctionWatchSignals(db, auction, wallet) {
  const normalizedWallet = normalizeAddress(wallet);
  if (!normalizedWallet) {
    return {
      hasMatch: false,
      matchedAuction: false,
      matchedSeller: false,
      matchedCategory: false,
      sourceLabel: null,
      contextLabel: null,
      matchedReasons: [],
    };
  }

  const watchlist = sanitizeWatchlist(db.watchlists?.[normalizedWallet], { wallet: normalizedWallet });
  const normalizedAuctionId = String(auction.id);
  const normalizedSeller = normalizeAddress(auction.seller);
  const normalizedCategory = String(toNumber(auction.assetType, 0));
  const matchedAuction = watchlist.auctionIds.includes(normalizedAuctionId);
  const matchedSeller = normalizedSeller ? watchlist.sellers.includes(normalizedSeller) : false;
  const matchedCategory = watchlist.categories.includes(normalizedCategory);
  const matchedReasons = [];

  if (matchedAuction) {
    matchedReasons.push('watched auction');
  }
  if (matchedSeller) {
    matchedReasons.push('watched seller');
  }
  if (matchedCategory) {
    matchedReasons.push(`${getAssetCategoryLabel(normalizedCategory)} category`);
  }

  const hasMatch = matchedReasons.length > 0;

  return {
    hasMatch,
    matchedAuction,
    matchedSeller,
    matchedCategory,
    sourceLabel: hasMatch ? 'Watchlist' : null,
    contextLabel: hasMatch ? matchedReasons.join(' + ') : null,
    matchedReasons,
  };
}

function getNotificationAudience({ isSeller, isWinner, isBidder, isWatcher, isPlatform }) {
  if (isSeller) {
    return {
      audience: 'seller',
      audienceLabel: 'Seller',
    };
  }

  if (isWinner) {
    return {
      audience: 'winner',
      audienceLabel: 'Winner',
    };
  }

  if (isBidder) {
    return {
      audience: 'bidder',
      audienceLabel: 'Bidder',
    };
  }

  if (isWatcher) {
    return {
      audience: 'watcher',
      audienceLabel: 'Watcher',
    };
  }

  if (isPlatform) {
    return {
      audience: 'platform',
      audienceLabel: 'Platform',
    };
  }

  return {
    audience: 'participant',
    audienceLabel: 'Participant',
  };
}

function toIsoFromUnix(value) {
  const parsedValue = toNumber(value, 0);
  return parsedValue > 0
    ? new Date(parsedValue * 1000).toISOString()
    : null;
}

function getAuctionNotificationTimestamp(auction, fallbackUnix = null) {
  return (
    toOptionalTrimmedString(auction.updatedAt)
    || toOptionalTrimmedString(auction.createdAt)
    || toIsoFromUnix(fallbackUnix)
    || new Date().toISOString()
  );
}

function getAuctionRoles(db, auction, wallet) {
  const normalizedWallet = normalizeAddress(wallet);
  if (!normalizedWallet) {
    return new Set();
  }

  const engagement = db.engagements[normalizedWallet]?.[String(auction.id)] || {};
  const roles = new Set(Array.isArray(engagement.roles) ? engagement.roles : []);

  if (normalizeAddress(auction.seller) === normalizedWallet) {
    roles.add('seller');
  }

  if (normalizeAddress(auction.winner) === normalizedWallet) {
    roles.add('winner');
  }

  if (getAuctionWatchSignals(db, auction, normalizedWallet).hasMatch) {
    roles.add('watcher');
  }

  return roles;
}

function deriveExecutorJobs(db) {
  const now = Math.floor(Date.now() / 1000);
  const auctions = Object.values(db.auctions || {});
  const jobs = [];

  for (const auction of auctions) {
    const baseJob = {
      auctionId: String(auction.id),
      auctionTitle: auction.title || `Auction #${auction.id}`,
      seller: auction.seller || null,
      status: auction.status || 'unknown',
      generatedAt: new Date().toISOString(),
    };

    if (auction.status === 'open' && auction.endTimestamp && auction.endTimestamp <= now) {
      jobs.push({
        ...baseJob,
        id: `close_${auction.id}`,
        action: 'close_auction',
        priority: 'high',
        ready: true,
        reason: 'Auction end time passed and seller still needs to close the auction.',
      });
    }

    if (auction.status === 'closed') {
      const revealWindowEnded = !auction.revealDeadline || auction.revealDeadline <= now;
      jobs.push({
        ...baseJob,
        id: `settle_reveal_timeout_${auction.id}`,
        action: 'settle_after_reveal_timeout',
        priority: 'medium',
        ready: revealWindowEnded,
        reason: revealWindowEnded
          ? 'Reveal window ended, so the seller can settle the auction and move it to CHALLENGE or CANCELLED.'
          : `Reveal window still active for ${formatTimeDistance(auction.revealDeadline - now)}.`,
      });
    }

    if (auction.status === 'challenge') {
      const disputeWindowEnded = !auction.disputeDeadline || auction.disputeDeadline <= now;
      jobs.push({
        ...baseJob,
        id: `challenge_${auction.id}`,
        action: 'finalize_winner',
        priority: 'high',
        ready: disputeWindowEnded,
        reason: disputeWindowEnded
          ? 'Dispute window ended, so the seller can finalize the winner.'
          : `Dispute window still active for ${formatTimeDistance(auction.disputeDeadline - now)}.`,
      });
    }

    if (
      auction.status === 'settled' &&
      !auction.paymentClaimed &&
      (
        auction.itemReceived ||
        (auction.claimableAt && auction.claimableAt <= now)
      )
    ) {
      jobs.push({
        ...baseJob,
        id: `seller_claim_${auction.id}`,
        action: 'seller_claim_ready',
        priority: 'medium',
        ready: true,
        reason: 'Seller can now claim the net settlement amount.',
      });
    }

    if (
      auction.status === 'settled' &&
      auction.paymentClaimed &&
      auction.platformFeeMicro &&
      !auction.platformFeeClaimed
    ) {
      jobs.push({
        ...baseJob,
        id: `platform_fee_${auction.id}`,
        action: 'claim_platform_fee',
        priority: 'low',
        ready: true,
        reason: 'Platform fee is available after seller payment is claimed.',
      });
    }
  }

  return jobs;
}

function computeAnalytics(db) {
  const auctions = Object.values(db.auctions || {});
  const settled = auctions.filter((auction) => auction.status === 'settled');
  const cancelled = auctions.filter((auction) => auction.status === 'cancelled');
  const reserveMisses = auctions.filter((auction) => auction.reserveMet === false);
  const paymentClaimed = auctions.filter((auction) => auction.paymentClaimed);
  const feeClaimed = auctions.filter((auction) => auction.platformFeeClaimed);
  const verifiedSellers = Object.values(db.sellerVerifications || {})
    .filter((verification) => verification.status === 'verified');
  const disputes = Object.values(db.disputes || {});
  const offers = Object.values(db.offers || {});
  const watchlists = Object.values(db.watchlists || {});

  const gmv = settled.reduce((sum, auction) => sum + toDisplayAmount(auction.winningBid ?? auction.winningAmountMicro), 0);
  const totalFeePotential = settled.reduce((sum, auction) => sum + toDisplayAmount(auction.platformFee ?? auction.platformFeeMicro), 0);
  const totalFeeClaimed = feeClaimed.reduce((sum, auction) => sum + toDisplayAmount(auction.platformFee ?? auction.platformFeeMicro), 0);
  const refundEligible = auctions.filter((auction) => auction.status === 'cancelled').length;
  const executorJobs = deriveExecutorJobs(db);
  const byProgramId = auctions.reduce((accumulator, auction) => {
    const contractIdentity = deriveAuctionContractIdentity(auction);
    const programId = contractIdentity.programId || 'unknown';

    if (!accumulator[programId]) {
      accumulator[programId] = {
        programId,
        version: contractIdentity.version || null,
        contractVersion: contractIdentity.contractVersion || null,
        auctions: 0,
        settled: 0,
        cancelled: 0,
      };
    }

    accumulator[programId].auctions += 1;

    if (auction.status === 'settled') {
      accumulator[programId].settled += 1;
    }

    if (auction.status === 'cancelled') {
      accumulator[programId].cancelled += 1;
    }

    return accumulator;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      auctions: auctions.length,
      settled: settled.length,
      cancelled: cancelled.length,
      reserveMisses: reserveMisses.length,
      verifiedSellers: verifiedSellers.length,
      notificationsConfigured: Object.keys(db.notificationState || {}).length,
      activeWatchlists: watchlists.filter((watchlist) => (watchlist.auctionIds || []).length > 0).length,
      disputes: disputes.length,
      offers: offers.length,
      executorJobs: executorJobs.length,
    },
    financials: {
      gmv,
      feePotential: totalFeePotential,
      feeClaimed: totalFeeClaimed,
      sellerClaimsCompleted: paymentClaimed.length,
      refundsEligible: refundEligible,
    },
    rates: {
      reserveMissRate: auctions.length > 0 ? reserveMisses.length / auctions.length : 0,
      settlementRate: auctions.length > 0 ? settled.length / auctions.length : 0,
      feeClaimRate: settled.length > 0 ? feeClaimed.length / settled.length : 0,
    },
    byStatus: auctions.reduce((accumulator, auction) => {
      const key = auction.status || 'unknown';
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {}),
    byProgramId,
  };
}

function computeWalletReputation(db, wallet) {
  const normalizedWallet = normalizeAddress(wallet);
  if (!normalizedWallet) {
    return null;
  }

  const auctions = Object.values(db.auctions || {});
  const disputes = Object.values(db.disputes || {});
  const offers = Object.values(db.offers || {});
  const verification = db.sellerVerifications[normalizedWallet] || null;

  const sellerAuctions = auctions.filter((auction) => normalizeAddress(auction.seller) === normalizedWallet);
  const bidderAuctions = auctions.filter((auction) => {
    const roles = getAuctionRoles(db, auction, normalizedWallet);
    return roles.has('bidder') || roles.has('winner');
  });
  const sellerSettled = sellerAuctions.filter((auction) => auction.status === 'settled');
  const sellerCancelled = sellerAuctions.filter((auction) => auction.status === 'cancelled');
  const sellerDisputes = disputes.filter(
    (dispute) => normalizeAddress(dispute.seller) === normalizedWallet || normalizeAddress(dispute.wallet) === normalizedWallet
  );
  const bidderWins = auctions.filter((auction) => normalizeAddress(auction.winner) === normalizedWallet);
  const buyerDisputes = disputes.filter((dispute) => normalizeAddress(dispute.wallet) === normalizedWallet);
  const outgoingOffers = offers.filter((offer) => normalizeAddress(offer.wallet) === normalizedWallet);

  const averageSettlementHours = sellerSettled.length > 0
    ? sellerSettled.reduce((sum, auction) => {
      const durationSeconds = Math.max(0, toNumber(auction.settledAt, 0) - toNumber(auction.endTimestamp, 0));
      return sum + (durationSeconds / 3600);
    }, 0) / sellerSettled.length
    : null;

  const sellerSuccessRate = sellerAuctions.length > 0 ? sellerSettled.length / sellerAuctions.length : 0;
  const disputeRatio = sellerAuctions.length > 0 ? sellerDisputes.length / sellerAuctions.length : 0;
  const bidderWinRate = bidderAuctions.length > 0 ? bidderWins.length / bidderAuctions.length : 0;

  let trustScore = 45;
  trustScore += verification?.status === 'verified' ? 20 : verification?.status === 'submitted' ? 10 : 0;
  trustScore += Math.round(sellerSuccessRate * 20);
  trustScore += Math.round(bidderWinRate * 10);
  trustScore -= Math.round(disputeRatio * 20);
  trustScore = Math.max(0, Math.min(100, trustScore));

  return {
    wallet: normalizedWallet,
    trustScore,
    verificationStatus: verification?.status || 'pending',
    seller: {
      auctionsCreated: sellerAuctions.length,
      auctionsSettled: sellerSettled.length,
      auctionsCancelled: sellerCancelled.length,
      successRate: sellerSuccessRate,
      averageSettlementHours,
      disputeRatio,
    },
    bidder: {
      participations: bidderAuctions.length,
      wins: bidderWins.length,
      winRate: bidderWinRate,
      offersSubmitted: outgoingOffers.length,
      disputesOpened: buyerDisputes.length,
    },
    updatedAt: new Date().toISOString(),
  };
}

function buildNotifications(db, wallet) {
  const normalizedWallet = normalizeAddress(wallet);
  const state = getWalletNotificationState(db, normalizedWallet);
  const dismissed = new Set(state.dismissed || []);
  const read = new Set(state.read || []);
  const notifications = [];
  const now = Math.floor(Date.now() / 1000);

  for (const auction of Object.values(db.auctions || {})) {
    const roles = getAuctionRoles(db, auction, normalizedWallet);
    const watchSignals = getAuctionWatchSignals(db, auction, normalizedWallet);
    const endingIn = auction.endTimestamp ? auction.endTimestamp - now : null;
    const isBidder = roles.has('bidder');
    const isSeller = roles.has('seller');
    const isWinner = roles.has('winner');
    const isWatcher = roles.has('watcher');
    const isPlatform = normalizedWallet === normalizeAddress(PLATFORM_ADDRESS);
    const audienceInfo = getNotificationAudience({
      isSeller,
      isWinner,
      isBidder,
      isWatcher,
      isPlatform,
    });

    const pushNotification = (type, payload) => {
      const notification = {
        id: `${auction.id}:${type}:${normalizedWallet}`,
        type,
        auctionId: String(auction.id),
        auctionTitle: auction.title || `Auction #${auction.id}`,
        actionPath: `/premium-auction/${auction.id}`,
        createdAt: payload.createdAt || getAuctionNotificationTimestamp(auction),
        audience: payload.audience || audienceInfo.audience,
        audienceLabel: payload.audienceLabel || audienceInfo.audienceLabel,
        sourceKind: payload.sourceKind || (watchSignals.hasMatch ? 'watchlist' : 'lifecycle'),
        sourceLabel: payload.sourceLabel || (watchSignals.hasMatch ? watchSignals.sourceLabel : 'Auction lifecycle'),
        contextLabel: payload.contextLabel || (watchSignals.hasMatch ? watchSignals.contextLabel : null),
        ...payload,
      };

      if (!dismissed.has(notification.id)) {
        notifications.push({
          ...notification,
          read: read.has(notification.id),
        });
      }
    };

    if (isWatcher && auction.status === 'open' && watchSignals.hasMatch) {
      pushNotification('watchlist_match', {
        urgency: endingIn !== null && endingIn > 0 && endingIn <= 7200 ? 'medium' : 'low',
        title: watchSignals.matchedAuction ? 'Watched auction is live' : 'Watchlist match is live',
        description: watchSignals.matchedAuction
          ? `${auction.title} is active in your premium watchlist.`
          : `${auction.title} matches ${watchSignals.contextLabel || 'your watchlist'}.`,
        sourceKind: 'watchlist',
        sourceLabel: watchSignals.sourceLabel,
        contextLabel: watchSignals.contextLabel,
        audience: 'watcher',
        audienceLabel: 'Watcher',
        createdAt: getAuctionNotificationTimestamp(auction, auction.endTimestamp),
      });
    }

    if (
      endingIn !== null &&
      endingIn > 0 &&
      endingIn <= 7200 &&
      (isBidder || isSeller || isWatcher)
    ) {
      pushNotification('auction_ending', {
        urgency: endingIn <= 900 ? 'high' : 'medium',
        title: 'Auction ending soon',
        description: `${auction.title} closes in ${formatTimeDistance(endingIn)}.`,
        createdAt: toIsoFromUnix(Math.max(auction.endTimestamp - 7200, 0)),
      });
    }

    if (isSeller && auction.status === 'open' && auction.endTimestamp && auction.endTimestamp <= now) {
      pushNotification('seller_close_due', {
        urgency: 'high',
        title: 'Close auction now',
        description: 'Auction end time passed and seller action is required to close it.',
        createdAt: toIsoFromUnix(auction.endTimestamp),
      });
    }

    if (isWinner && ['challenge', 'settled'].includes(auction.status)) {
      pushNotification('winner_selected', {
        urgency: 'medium',
        title: 'You are the current winner',
        description: 'You appear as the winner in the current on-chain auction state.',
        createdAt: getAuctionNotificationTimestamp(auction, auction.settledAt || auction.disputeDeadline),
      });
    }

    if (isSeller && auction.reserveMet === false && ['challenge', 'cancelled'].includes(auction.status)) {
      pushNotification('reserve_not_met', {
        urgency: 'medium',
        title: 'Reserve was not met',
        description: 'Seller can cancel the auction and let bidders claim refunds.',
        createdAt: getAuctionNotificationTimestamp(auction, auction.disputeDeadline || auction.endTimestamp),
      });
    }

    if (
      isSeller &&
      auction.status === 'settled' &&
      !auction.paymentClaimed &&
      (
        auction.itemReceived ||
        (auction.claimableAt && auction.claimableAt <= now)
      )
    ) {
      pushNotification('seller_claimable', {
        urgency: 'high',
        title: 'Seller claim is available',
        description: 'The seller can now claim the net settlement amount.',
        createdAt: getAuctionNotificationTimestamp(auction, auction.claimableAt || auction.itemReceivedAt || auction.settledAt),
      });
    }

    if (
      isBidder &&
      (
        auction.status === 'cancelled' ||
        (auction.status === 'settled' && normalizeAddress(auction.winner) !== normalizedWallet)
      )
    ) {
      pushNotification('bidder_refund', {
        urgency: 'medium',
        title: 'Refund is available',
        description: 'A bidder refund path is now available for this auction.',
        createdAt: getAuctionNotificationTimestamp(auction, auction.settledAt || auction.disputeDeadline || auction.endTimestamp),
      });
    }

    if (
      isPlatform &&
      auction.status === 'settled' &&
      auction.paymentClaimed &&
      auction.platformFeeMicro &&
      !auction.platformFeeClaimed
    ) {
      pushNotification('platform_fee_claimable', {
        urgency: 'low',
        title: 'Platform fee can be claimed',
        description: 'The settled platform fee is available to claim.',
        actionPath: '/ops',
        createdAt: getAuctionNotificationTimestamp(auction, auction.paymentClaimedAt || auction.settledAt),
      });
    }

    if (
      (isWatcher || isBidder || isSeller) &&
      (toNumber(auction.proofFilesCount, 0) > 0 || auction.verificationStatus === 'verified')
    ) {
      pushNotification('proof_bundle_ready', {
        urgency: 'low',
        title: 'Proof bundle is attached',
        description: 'Seller verification metadata and supporting proof files are available for review.',
        sourceKind: 'trust',
        sourceLabel: 'Proof bundle',
        contextLabel: toNumber(auction.proofFilesCount, 0) > 0
          ? `${toNumber(auction.proofFilesCount, 0)} files`
          : 'Verification ready',
        createdAt: getAuctionNotificationTimestamp(auction),
      });
    }
  }

  const sorted = sortNotifications(notifications);

  return {
    notifications: sorted,
    unreadCount: sorted.filter((notification) => !notification.read).length,
  };
}

function listAuctionSnapshots(db) {
  return Object.values(db.auctions || {}).sort((left, right) => {
    const updatedDiff = String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
    if (updatedDiff !== 0) {
      return updatedDiff;
    }

    return toNumber(right.id, 0) - toNumber(left.id, 0);
  });
}

function isAuctionReadModelCollectionPath(pathname) {
  return pathname === '/api/auctions' || pathname === '/api/read-model/auctions';
}

function matchAuctionReadModelEntryPath(pathname) {
  return pathname.match(/^\/api\/auctions\/([^/]+)$/)
    || pathname.match(/^\/api\/read-model\/auctions\/([^/]+)$/);
}

function isAuctionReadModelSyncPath(pathname) {
  return pathname === '/api/auctions/sync' || pathname === '/api/read-model/auctions/sync';
}

function sanitizeSnapshot(snapshot) {
  const contractIdentity = deriveAuctionContractIdentity(snapshot);
  const sellerVerification = sanitizeSellerVerification({
    ...(snapshot.sellerVerification || {}),
    wallet: snapshot.sellerVerification?.wallet || snapshot.seller,
    sellerDisplayName: snapshot.sellerDisplayName ?? snapshot.sellerVerification?.sellerDisplayName,
    status: snapshot.verificationStatus ?? snapshot.sellerVerification?.status,
  });
  const assetProof = sanitizeAuctionProofBundle({
    ...(snapshot.assetProof || {}),
    auctionId: snapshot.id,
    seller: snapshot.seller,
    token: snapshot.token || snapshot.currency,
    assetType: snapshot.assetType,
    summary: snapshot.assetProof?.summary ?? snapshot.proofSummary,
    provenanceNote: snapshot.assetProof?.provenanceNote ?? snapshot.provenanceNote,
    authenticityGuarantee: snapshot.assetProof?.authenticityGuarantee ?? snapshot.authenticityGuarantee,
    certificateId: snapshot.assetProof?.certificateId ?? snapshot.certificateId,
  });

  return {
    id: String(snapshot.id),
    title: snapshot.title || `Auction #${snapshot.id}`,
    description: snapshot.description || '',
    status: snapshot.status || 'open',
    contractState: snapshot.contractState || String(snapshot.status || 'open').toUpperCase(),
    programId: contractIdentity.programId,
    contractProgramId: contractIdentity.programId,
    onChainProgramId: contractIdentity.programId,
    version: contractIdentity.version,
    contractVersion: contractIdentity.contractVersion,
    explicitVersion: contractIdentity.explicitVersion,
    seller: snapshot.seller || null,
    creator: snapshot.creator || snapshot.seller || null,
    winner: snapshot.winner || null,
    token: snapshot.token || 'ALEO',
    endTimestamp: toNumber(snapshot.endTimestamp, 0),
    revealPeriod: toNumber(snapshot.revealPeriod, 0),
    disputePeriod: toNumber(snapshot.disputePeriod, 0),
    revealDeadline: toNumber(snapshot.revealDeadline, 0),
    disputeDeadline: toNumber(snapshot.disputeDeadline, 0),
    reservePrice: toNumber(snapshot.reservePrice, 0),
    reservePriceMicro: snapshot.reservePriceMicro ?? null,
    reserveMet: typeof snapshot.reserveMet === 'boolean' ? snapshot.reserveMet : snapshot.reserveMet ?? null,
    settledAt: toNumber(snapshot.settledAt, 0),
    claimableAt: toNumber(snapshot.claimableAt, 0),
    itemReceived: Boolean(snapshot.itemReceived),
    itemReceivedAt: toNumber(snapshot.itemReceivedAt, 0),
    paymentClaimed: Boolean(snapshot.paymentClaimed),
    paymentClaimedAt: toNumber(snapshot.paymentClaimedAt, 0),
    platformFeeClaimed: Boolean(snapshot.platformFeeClaimed),
    platformFeeClaimedAt: toNumber(snapshot.platformFeeClaimedAt, 0),
    winningBid: snapshot.winningBid ?? 0,
    winningAmountMicro: snapshot.winningAmountMicro ?? null,
    platformFee: snapshot.platformFee ?? 0,
    platformFeeMicro: snapshot.platformFeeMicro ?? null,
    sellerNetAmount: snapshot.sellerNetAmount ?? 0,
    sellerNetAmountMicro: snapshot.sellerNetAmountMicro ?? null,
    totalEscrowed: snapshot.totalEscrowed ?? 0,
    totalEscrowedMicro: snapshot.totalEscrowedMicro ?? null,
    confirmationTimeout: toNumber(snapshot.confirmationTimeout, 0),
    assetType: toNumber(snapshot.assetType, 0),
    currencyType: toNumber(snapshot.currencyType, 1),
    sellerVerification,
    sellerDisplayName: snapshot.sellerDisplayName || sellerVerification.sellerDisplayName,
    assetProof,
    itemPhotosCount: toNumber(snapshot.itemPhotosCount, assetProof.itemPhotosCount),
    proofFilesCount: toNumber(snapshot.proofFilesCount, assetProof.proofFilesCount),
    verificationStatus: snapshot.verificationStatus || sellerVerification.status || 'pending',
    updatedAt: new Date().toISOString(),
  };
}

function createHealthPayload({ serviceName, environment, storageDriver, db, storageInfo = null }) {
  return {
    ok: true,
    service: serviceName,
    environment,
    storageDriver,
    platformAddress: PLATFORM_ADDRESS,
    database: {
      schemaVersion: toNumber(db.meta?.schemaVersion, OPS_DB_SCHEMA_VERSION),
      revision: toNumber(db.meta?.revision, 0),
      createdAt: db.meta?.createdAt || null,
      updatedAt: db.meta?.updatedAt || null,
      lastMigrationAt: db.meta?.lastMigrationAt || null,
    },
    storage: storageInfo,
    totals: {
      auctions: Object.keys(db.auctions || {}).length,
      sharedReadModelAuctions: Object.keys(db.auctions || {}).length,
      disputes: Object.keys(db.disputes || {}).length,
      offers: Object.keys(db.offers || {}).length,
      watchlists: Object.keys(db.watchlists || {}).length,
    },
    generatedAt: new Date().toISOString(),
  };
}

function resolvePathname(pathname, searchParams) {
  if (pathname !== '/api') {
    return pathname;
  }

  const nestedPath = searchParams.get('path');
  if (!nestedPath) {
    return pathname;
  }

  return `/api/${String(nestedPath).replace(/^\/+/, '')}`;
}

async function runOpsRoute({
  storage,
  serviceName,
  environment,
  storageDriver,
  method,
  pathname,
  searchParams,
  body,
}) {
  if (method === 'GET' && pathname === '/api/health') {
    const [db, storageInfo] = await Promise.all([
      storage.loadDb(),
      typeof storage.getInfo === 'function' ? storage.getInfo() : Promise.resolve(null),
    ]);

    return {
      status: 200,
      payload: createHealthPayload({
        serviceName,
        environment,
        storageDriver,
        db,
        storageInfo,
      }),
    };
  }

  if (environment !== 'production' && method === 'POST' && pathname === '/api/dev/reset') {
    const db = createDefaultDb();
    await storage.saveDb(db);

    return {
      status: 200,
      payload: {
        ok: true,
        reset: true,
        environment,
        totals: {
          auctions: 0,
          sharedReadModelAuctions: 0,
          disputes: 0,
          offers: 0,
          watchlists: 0,
        },
        generatedAt: new Date().toISOString(),
      },
    };
  }

  let db = await storage.loadDb();

  if (method === 'GET' && isAuctionReadModelCollectionPath(pathname)) {
    return {
      status: 200,
      payload: {
        ok: true,
        auctions: listAuctionSnapshots(db),
      },
    };
  }

  const auctionMatch = matchAuctionReadModelEntryPath(pathname);
  if (method === 'GET' && auctionMatch) {
    const auctionId = String(decodeURIComponent(auctionMatch[1]));
    const auction = db.auctions[auctionId] || null;

    if (!auction) {
      return {
        status: 404,
        payload: {
          ok: false,
          error: 'auction not found',
        },
      };
    }

    return {
      status: 200,
      payload: {
        ok: true,
        auction,
      },
    };
  }

  if (method === 'POST' && isAuctionReadModelSyncPath(pathname)) {
    const snapshot = sanitizeSnapshot(body || {});
    db.auctions[snapshot.id] = {
      ...(db.auctions[snapshot.id] || {}),
      ...snapshot,
    };
    await storage.saveDb(db);

    return {
      status: 200,
      payload: {
        ok: true,
        auction: db.auctions[snapshot.id],
      },
    };
  }

  const engagementMatch = pathname.match(/^\/api\/engagements\/([^/]+)$/);
  if (method === 'GET' && engagementMatch) {
    const wallet = normalizeAddress(decodeURIComponent(engagementMatch[1]));
    const auctionId = String(searchParams.get('auctionId') || '');

    if (!wallet || !auctionId) {
      return {
        status: 400,
        payload: {
          ok: false,
          error: 'wallet and auctionId are required',
        },
      };
    }

    const persistedEngagement = db.engagements[wallet]?.[auctionId] || null;
    const snapshot = db.auctions[auctionId] || null;
    const roles = snapshot
      ? Array.from(getAuctionRoles(db, snapshot, wallet))
      : dedupe(Array.isArray(persistedEngagement?.roles) ? persistedEngagement.roles : []);

    return {
      status: 200,
      payload: {
        ok: true,
        engagement: {
          wallet,
          auctionId,
          roles,
          updatedAt: persistedEngagement?.updatedAt || null,
        },
      },
    };
  }

  if (method === 'POST' && pathname === '/api/engagements/sync') {
    const wallet = normalizeAddress(body?.wallet);
    const auctionId = String(body?.auctionId || '');
    const roles = dedupe(Array.isArray(body?.roles) ? body.roles : []);

    if (!wallet || !auctionId) {
      return {
        status: 400,
        payload: {
          ok: false,
          error: 'wallet and auctionId are required',
        },
      };
    }

    if (!db.engagements[wallet]) {
      db.engagements[wallet] = {};
    }

    db.engagements[wallet][auctionId] = {
      roles,
      updatedAt: new Date().toISOString(),
    };

    await storage.saveDb(db);

    return {
      status: 200,
      payload: {
        ok: true,
      },
    };
  }

  if (method === 'GET' && pathname === '/api/analytics/overview') {
    return {
      status: 200,
      payload: {
        ok: true,
        analytics: computeAnalytics(db),
      },
    };
  }

  if (method === 'GET' && pathname === '/api/executor/state') {
    return {
      status: 200,
      payload: {
        ok: true,
        settings: db.settings.executor,
        jobs: deriveExecutorJobs(db),
        recentRuns: db.executorRuns.slice(0, 12),
      },
    };
  }

  if (method === 'POST' && pathname === '/api/executor/run') {
    const jobs = deriveExecutorJobs(db);
    const run = {
      id: generateId('executor_run'),
      createdAt: new Date().toISOString(),
      mode: db.settings.executor.mode,
      enabled: db.settings.executor.enabled,
      jobsQueued: jobs.length,
      summary: jobs.reduce((accumulator, job) => {
        accumulator[job.action] = (accumulator[job.action] || 0) + 1;
        return accumulator;
      }, {}),
    };

    db.settings.executor.lastRunAt = run.createdAt;
    db.executorRuns.unshift(run);
    db.executorRuns = db.executorRuns.slice(0, 25);
    db.eventLog.unshift({
      id: generateId('event'),
      createdAt: run.createdAt,
      type: 'executor.run',
      payload: run,
    });
    db.eventLog = db.eventLog.slice(0, 100);

    await storage.saveDb(db);

    return {
      status: 200,
      payload: {
        ok: true,
        run,
        jobs,
      },
    };
  }

  if (method === 'POST' && pathname === '/api/executor/settings') {
    db.settings.executor = {
      ...db.settings.executor,
      ...(body || {}),
    };

    await storage.saveDb(db);

    return {
      status: 200,
      payload: {
        ok: true,
        settings: db.settings.executor,
      },
    };
  }

  const notificationMatch = pathname.match(/^\/api\/notifications\/([^/]+)(?:\/(dismiss|read))?$/);
  if (notificationMatch) {
    const wallet = normalizeAddress(decodeURIComponent(notificationMatch[1]));
    const action = notificationMatch[2];

    if (method === 'GET' && !action) {
      const nextNotificationState = getWalletNotificationState(db, wallet);
      const notificationResponse = buildNotifications(db, wallet);

      return {
        status: 200,
        payload: {
          ok: true,
          ...notificationResponse,
          state: nextNotificationState,
        },
      };
    }

    const notificationState = getWalletNotificationState(db, wallet);
    const ids = dedupe(Array.isArray(body?.notificationIds) ? body.notificationIds : body?.notificationId ? [body.notificationId] : []);

    if (method === 'POST' && action === 'dismiss') {
      notificationState.dismissed = dedupe([...(notificationState.dismissed || []), ...ids]);
      notificationState.updatedAt = new Date().toISOString();
      await storage.saveDb(db);

      return {
        status: 200,
        payload: {
          ok: true,
        },
      };
    }

    if (method === 'POST' && action === 'read') {
      notificationState.read = dedupe([...(notificationState.read || []), ...ids]);
      notificationState.updatedAt = new Date().toISOString();
      await storage.saveDb(db);

      return {
        status: 200,
        payload: {
          ok: true,
        },
      };
    }
  }

  const verificationMatch = pathname.match(/^\/api\/verifications\/sellers\/([^/]+)$/);
  if (verificationMatch) {
    const wallet = normalizeAddress(decodeURIComponent(verificationMatch[1]));

    if (method === 'GET') {
      return {
        status: 200,
        payload: {
          ok: true,
          verification: db.sellerVerifications[wallet] || null,
        },
      };
    }

    if (method === 'PUT') {
      db.sellerVerifications[wallet] = sanitizeSellerVerification({
        ...(db.sellerVerifications[wallet] || {}),
        ...(body || {}),
        wallet,
      }, { wallet });
      await storage.saveDb(db);

      return {
        status: 200,
        payload: {
          ok: true,
          verification: db.sellerVerifications[wallet],
        },
      };
    }
  }

  const proofMatch = pathname.match(/^\/api\/proofs\/auctions\/([^/]+)$/);
  if (proofMatch) {
    const auctionId = String(decodeURIComponent(proofMatch[1]));

    if (method === 'GET') {
      return {
        status: 200,
        payload: {
          ok: true,
          proofBundle: db.auctionProofs[auctionId] || null,
        },
      };
    }

    if (method === 'PUT') {
      db.auctionProofs[auctionId] = sanitizeAuctionProofBundle({
        ...(db.auctionProofs[auctionId] || {}),
        ...(body || {}),
        auctionId,
      }, { auctionId });
      await storage.saveDb(db);

      return {
        status: 200,
        payload: {
          ok: true,
          proofBundle: db.auctionProofs[auctionId],
        },
      };
    }
  }

  const watchlistMatch = pathname.match(/^\/api\/watchlists\/([^/]+)$/);
  if (watchlistMatch) {
    const wallet = normalizeAddress(decodeURIComponent(watchlistMatch[1]));

    if (method === 'GET') {
      return {
        status: 200,
        payload: {
          ok: true,
          watchlist: sanitizeWatchlist(db.watchlists[wallet], { wallet }),
        },
      };
    }

    if (method === 'PUT') {
      db.watchlists[wallet] = sanitizeWatchlist({
        ...(db.watchlists[wallet] || {}),
        ...(body || {}),
        wallet,
        updatedAt: new Date().toISOString(),
      }, { wallet });
      await storage.saveDb(db);

      return {
        status: 200,
        payload: {
          ok: true,
          watchlist: db.watchlists[wallet],
        },
      };
    }
  }

  const savedSearchMatch = pathname.match(/^\/api\/saved-searches\/([^/]+)$/);
  if (savedSearchMatch) {
    const wallet = normalizeAddress(decodeURIComponent(savedSearchMatch[1]));

    if (method === 'GET') {
      return {
        status: 200,
        payload: {
          ok: true,
          savedSearches: sanitizeSavedSearchCollection(db.savedSearches[wallet], { wallet }),
        },
      };
    }

    if (method === 'PUT') {
      db.savedSearches[wallet] = sanitizeSavedSearchCollection({
        ...(db.savedSearches[wallet] || {}),
        ...(body || {}),
        wallet,
        updatedAt: new Date().toISOString(),
      }, { wallet });
      await storage.saveDb(db);

      return {
        status: 200,
        payload: {
          ok: true,
          savedSearches: db.savedSearches[wallet],
        },
      };
    }
  }

  if (pathname === '/api/disputes') {
    if (method === 'GET') {
      const auctionId = searchParams.get('auctionId');
      const wallet = normalizeAddress(searchParams.get('wallet'));
      const disputes = Object.values(db.disputes || {})
        .filter((dispute) => {
          if (auctionId && String(dispute.auctionId) !== String(auctionId)) {
            return false;
          }

          if (
            wallet &&
            normalizeAddress(dispute.wallet) !== wallet &&
            normalizeAddress(dispute.seller) !== wallet
          ) {
            return false;
          }

          return true;
        })
        .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));

      return {
        status: 200,
        payload: {
          ok: true,
          disputes,
        },
      };
    }

    if (method === 'POST') {
      const disputeId = generateId('dispute');
      const auctionId = String(body?.auctionId || '');
      const wallet = normalizeAddress(body?.wallet);

      if (!auctionId || !wallet) {
        return {
          status: 400,
          payload: {
            ok: false,
            error: 'auctionId and wallet are required',
          },
        };
      }

      db.disputes[disputeId] = {
        id: disputeId,
        auctionId,
        auctionTitle: toOptionalTrimmedString(body?.auctionTitle),
        auctionStatus: toOptionalTrimmedString(body?.auctionStatus),
        contractState: toOptionalTrimmedString(body?.contractState),
        wallet,
        seller: body?.seller || null,
        sellerDisplayName: toOptionalTrimmedString(body?.sellerDisplayName),
        role: body?.role || 'bidder',
        token: toOptionalTrimmedString(body?.token),
        title: body?.title || 'Dispute opened',
        description: body?.description || '',
        evidence: Array.isArray(body?.evidence) ? body.evidence : [],
        status: body?.status || 'open',
        requestedResolution: toOptionalTrimmedString(body?.requestedResolution),
        onChainDisputeRoot: toOptionalTrimmedString(body?.onChainDisputeRoot),
        onChainTransactionId: toOptionalTrimmedString(body?.onChainTransactionId),
        timeline: [
          {
            at: new Date().toISOString(),
            label: 'Dispute submitted',
            note: 'Initial evidence package was attached in the shared operations console.',
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await storage.saveDb(db);

      return {
        status: 200,
        payload: {
          ok: true,
          dispute: db.disputes[disputeId],
        },
      };
    }
  }

  const disputeMatch = pathname.match(/^\/api\/disputes\/([^/]+)$/);
  if (disputeMatch && method === 'PATCH') {
    const disputeId = String(decodeURIComponent(disputeMatch[1]));
    const existingDispute = db.disputes[disputeId];

    if (!existingDispute) {
      return {
        status: 404,
        payload: {
          ok: false,
          error: 'Dispute not found',
        },
      };
    }

    const appendedTimelineEntries = Array.isArray(body?.timelineEntries)
      ? body.timelineEntries
      : body?.timelineEntry
        ? [body.timelineEntry]
        : [];

    db.disputes[disputeId] = {
      ...existingDispute,
      ...(body || {}),
      id: disputeId,
      auctionId: existingDispute.auctionId,
      auctionTitle: body?.auctionTitle ?? existingDispute.auctionTitle ?? null,
      auctionStatus: body?.auctionStatus ?? existingDispute.auctionStatus ?? null,
      contractState: body?.contractState ?? existingDispute.contractState ?? null,
      wallet: existingDispute.wallet,
      seller: body?.seller ?? existingDispute.seller,
      sellerDisplayName: body?.sellerDisplayName ?? existingDispute.sellerDisplayName ?? null,
      token: body?.token ?? existingDispute.token ?? null,
      evidence: Array.isArray(body?.evidence) ? body.evidence : existingDispute.evidence,
      requestedResolution: body?.requestedResolution ?? existingDispute.requestedResolution ?? null,
      onChainDisputeRoot: body?.onChainDisputeRoot ?? existingDispute.onChainDisputeRoot ?? null,
      onChainTransactionId: body?.onChainTransactionId ?? existingDispute.onChainTransactionId ?? null,
      timeline: [
        ...(Array.isArray(existingDispute.timeline) ? existingDispute.timeline : []),
        ...appendedTimelineEntries.filter((entry) => entry && typeof entry === 'object'),
      ],
      updatedAt: new Date().toISOString(),
    };

    await storage.saveDb(db);

    return {
      status: 200,
      payload: {
        ok: true,
        dispute: db.disputes[disputeId],
      },
    };
  }

  if (pathname === '/api/offers') {
    if (method === 'GET') {
      const auctionId = searchParams.get('auctionId');
      const wallet = normalizeAddress(searchParams.get('wallet'));
      const offers = Object.values(db.offers || {})
        .filter((offer) => {
          if (auctionId && String(offer.auctionId) !== String(auctionId)) {
            return false;
          }

          if (wallet && normalizeAddress(offer.wallet) !== wallet) {
            return false;
          }

          return true;
        })
        .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));

      return {
        status: 200,
        payload: {
          ok: true,
          offers,
        },
      };
    }

    if (method === 'POST') {
      const offerId = generateId('offer');
      const auctionId = String(body?.auctionId || '');
      const wallet = normalizeAddress(body?.wallet);

      if (!auctionId || !wallet) {
        return {
          status: 400,
          payload: {
            ok: false,
            error: 'auctionId and wallet are required',
          },
        };
      }

      db.offers[offerId] = {
        id: offerId,
        auctionId,
        wallet,
        amount: toNumber(body?.amount, 0),
        currency: body?.currency || 'ALEO',
        note: body?.note || '',
        type: body?.type || 'make_offer',
        disclosureMode: body?.disclosureMode || 'selective',
        proofOfFundsStatus: body?.proofOfFundsStatus || 'self-attested',
        status: body?.status || 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await storage.saveDb(db);

      return {
        status: 200,
        payload: {
          ok: true,
          offer: db.offers[offerId],
        },
      };
    }
  }

  const reputationMatch = pathname.match(/^\/api\/reputations\/([^/]+)$/);
  if (reputationMatch && method === 'GET') {
    const wallet = normalizeAddress(decodeURIComponent(reputationMatch[1]));
    const reputation = {
      ...(db.reputations[wallet] || {}),
      ...computeWalletReputation(db, wallet),
    };
    db.reputations[wallet] = reputation;
    await storage.saveDb(db);

    return {
      status: 200,
      payload: {
        ok: true,
        reputation,
      },
    };
  }

  return {
    status: 404,
    payload: {
      ok: false,
      error: 'Not found',
    },
  };
}

export async function readJsonBody(request) {
  if (request.body != null) {
    if (typeof request.body === 'string') {
      return request.body ? JSON.parse(request.body) : {};
    }

    if (Buffer.isBuffer(request.body) || request.body instanceof Uint8Array) {
      return request.body.length > 0 ? JSON.parse(Buffer.from(request.body).toString('utf8')) : {};
    }

    if (typeof request.body === 'object') {
      return request.body;
    }
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(response, statusCode, payload, corsHeaders) {
  response.statusCode = statusCode;

  for (const [header, value] of Object.entries(corsHeaders)) {
    response.setHeader(header, value);
  }

  response.end(JSON.stringify(payload));
}

function sendNoContent(response, corsHeaders) {
  response.statusCode = 204;

  for (const [header, value] of Object.entries(corsHeaders)) {
    if (header !== 'Content-Type') {
      response.setHeader(header, value);
    }
  }

  response.end();
}

function createJsonResponse(statusCode, payload, corsHeaders) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: corsHeaders,
  });
}

function createNoContentResponse(corsHeaders) {
  const headers = new Headers();

  for (const [header, value] of Object.entries(corsHeaders)) {
    if (header !== 'Content-Type') {
      headers.set(header, value);
    }
  }

  return new Response(null, {
    status: 204,
    headers,
  });
}

async function readFetchJsonBody(request) {
  const raw = await request.text();
  return raw ? JSON.parse(raw) : {};
}

export function createOpsHttpHandler({
  storage,
  serviceName = 'shadowbid-ops-api',
  environment = process.env.VERCEL_ENV || process.env.NODE_ENV || 'local',
  storageDriver = 'memory',
  corsOrigin = process.env.OPS_ALLOWED_ORIGIN || '*',
}) {
  return async function handleOpsRequest(request, response) {
    const requestOrigin = request.headers.origin || '';
    const corsHeaders = createCorsHeaders(resolveCorsOrigin(corsOrigin, requestOrigin));

    if ((request.method || 'GET').toUpperCase() === 'OPTIONS') {
      sendNoContent(response, corsHeaders);
      return;
    }

    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const pathname = resolvePathname(url.pathname, url.searchParams);
    const method = (request.method || 'GET').toUpperCase();

    try {
      let body = null;

      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        try {
          body = await readJsonBody(request);
        } catch {
          sendJson(response, 400, {
            ok: false,
            error: 'Invalid JSON body',
          }, corsHeaders);
          return;
        }
      }

      const executeRoute = () => runOpsRoute({
        storage,
        serviceName,
        environment,
        storageDriver,
        method,
        pathname,
        searchParams: url.searchParams,
        body,
      });
      const result = method === 'GET' || typeof storage.withExclusive !== 'function'
        ? await executeRoute()
        : await storage.withExclusive(executeRoute);

      sendJson(response, result.status, result.payload, corsHeaders);
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown ops API error',
      }, corsHeaders);
    }
  };
}

export function createOpsFetchHandler({
  storage,
  serviceName = 'shadowbid-ops-api',
  environment = process.env.VERCEL_ENV || process.env.NODE_ENV || 'production',
  storageDriver = 'memory',
  corsOrigin = process.env.OPS_ALLOWED_ORIGIN || '*',
}) {
  return async function handleOpsFetch(request) {
    const requestOrigin = request.headers.get('origin') || '';
    const corsHeaders = createCorsHeaders(resolveCorsOrigin(corsOrigin, requestOrigin));

    if ((request.method || 'GET').toUpperCase() === 'OPTIONS') {
      return createNoContentResponse(corsHeaders);
    }

    const url = new URL(request.url);
    const pathname = resolvePathname(url.pathname, url.searchParams);
    const method = (request.method || 'GET').toUpperCase();

    try {
      let body = null;

      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        try {
          body = await readFetchJsonBody(request);
        } catch {
          return createJsonResponse(400, {
            ok: false,
            error: 'Invalid JSON body',
          }, corsHeaders);
        }
      }

      const executeRoute = () => runOpsRoute({
        storage,
        serviceName,
        environment,
        storageDriver,
        method,
        pathname,
        searchParams: url.searchParams,
        body,
      });
      const result = method === 'GET' || typeof storage.withExclusive !== 'function'
        ? await executeRoute()
        : await storage.withExclusive(executeRoute);

      return createJsonResponse(result.status, result.payload, corsHeaders);
    } catch (error) {
      return createJsonResponse(500, {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown ops API error',
      }, corsHeaders);
    }
  };
}
