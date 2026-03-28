/* global Buffer, process */
import crypto from 'node:crypto';

export const PLATFORM_ADDRESS = 'aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8';

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

export function createDefaultDb() {
  return {
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

  return {
    ...defaults,
    ...db,
    settings: {
      ...defaults.settings,
      ...(db.settings || {}),
      executor: {
        ...defaults.settings.executor,
        ...(db.settings?.executor || {}),
      },
    },
    auctions: db.auctions || {},
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
    const urgencyDelta = (priorityMap[left.urgency] ?? 99) - (priorityMap[right.urgency] ?? 99);
    if (urgencyDelta !== 0) {
      return urgencyDelta;
    }

    return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
  });
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
    const endingIn = auction.endTimestamp ? auction.endTimestamp - now : null;
    const isBidder = roles.has('bidder');
    const isSeller = roles.has('seller');
    const isWinner = roles.has('winner');
    const isWatcher = roles.has('watcher');
    const isPlatform = normalizedWallet === normalizeAddress(PLATFORM_ADDRESS);

    const pushNotification = (type, payload) => {
      const notification = {
        id: `${auction.id}:${type}:${normalizedWallet}`,
        type,
        auctionId: String(auction.id),
        auctionTitle: auction.title || `Auction #${auction.id}`,
        actionPath: `/premium-auction/${auction.id}`,
        createdAt: new Date().toISOString(),
        ...payload,
      };

      if (!dismissed.has(notification.id)) {
        notifications.push({
          ...notification,
          read: read.has(notification.id),
        });
      }
    };

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
      });
    }

    if (isSeller && auction.status === 'open' && auction.endTimestamp && auction.endTimestamp <= now) {
      pushNotification('seller_close_due', {
        urgency: 'high',
        title: 'Close auction now',
        description: 'Auction end time passed and seller action is required to close it.',
      });
    }

    if (isWinner && ['challenge', 'settled'].includes(auction.status)) {
      pushNotification('winner_selected', {
        urgency: 'medium',
        title: 'You are the current winner',
        description: 'You appear as the winner in the current on-chain auction state.',
      });
    }

    if (isSeller && auction.reserveMet === false && ['challenge', 'cancelled'].includes(auction.status)) {
      pushNotification('reserve_not_met', {
        urgency: 'medium',
        title: 'Reserve was not met',
        description: 'Seller can cancel the auction and let bidders claim refunds.',
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
      });
    }
  }

  const sorted = sortNotifications(notifications);

  return {
    notifications: sorted,
    unreadCount: sorted.filter((notification) => !notification.read).length,
  };
}

function sanitizeSnapshot(snapshot) {
  return {
    id: String(snapshot.id),
    title: snapshot.title || `Auction #${snapshot.id}`,
    status: snapshot.status || 'open',
    contractState: snapshot.contractState || String(snapshot.status || 'open').toUpperCase(),
    seller: snapshot.seller || null,
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
    itemPhotosCount: toNumber(snapshot.itemPhotosCount, 0),
    proofFilesCount: toNumber(snapshot.proofFilesCount, 0),
    verificationStatus: snapshot.verificationStatus || 'pending',
    updatedAt: new Date().toISOString(),
  };
}

function createHealthPayload({ serviceName, environment, storageDriver, db }) {
  return {
    ok: true,
    service: serviceName,
    environment,
    storageDriver,
    platformAddress: PLATFORM_ADDRESS,
    totals: {
      auctions: Object.keys(db.auctions || {}).length,
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
    const db = await storage.loadDb();

    return {
      status: 200,
      payload: createHealthPayload({
        serviceName,
        environment,
        storageDriver,
        db,
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
          disputes: 0,
          offers: 0,
          watchlists: 0,
        },
        generatedAt: new Date().toISOString(),
      },
    };
  }

  let db = await storage.loadDb();

  if (method === 'POST' && pathname === '/api/auctions/sync') {
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
      return {
        status: 200,
        payload: {
          ok: true,
          ...buildNotifications(db, wallet),
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
      db.sellerVerifications[wallet] = {
        ...(db.sellerVerifications[wallet] || {}),
        ...(body || {}),
        wallet,
        updatedAt: new Date().toISOString(),
      };
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
      db.auctionProofs[auctionId] = {
        ...(db.auctionProofs[auctionId] || {}),
        ...(body || {}),
        auctionId,
        updatedAt: new Date().toISOString(),
      };
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
          watchlist: db.watchlists[wallet] || {
            wallet,
            auctionIds: [],
            sellers: [],
            categories: [],
            updatedAt: null,
          },
        },
      };
    }

    if (method === 'PUT') {
      db.watchlists[wallet] = {
        wallet,
        auctionIds: dedupe(Array.isArray(body?.auctionIds) ? body.auctionIds.map(String) : []),
        sellers: dedupe(Array.isArray(body?.sellers) ? body.sellers : []),
        categories: dedupe(Array.isArray(body?.categories) ? body.categories.map(String) : []),
        updatedAt: new Date().toISOString(),
      };
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
          savedSearches: db.savedSearches[wallet] || {
            wallet,
            searches: [],
            updatedAt: null,
          },
        },
      };
    }

    if (method === 'PUT') {
      db.savedSearches[wallet] = {
        wallet,
        searches: Array.isArray(body?.searches) ? body.searches : [],
        updatedAt: new Date().toISOString(),
      };
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
        wallet,
        seller: body?.seller || null,
        role: body?.role || 'bidder',
        title: body?.title || 'Dispute opened',
        description: body?.description || '',
        evidence: Array.isArray(body?.evidence) ? body.evidence : [],
        status: body?.status || 'open',
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
      wallet: existingDispute.wallet,
      seller: body?.seller ?? existingDispute.seller,
      evidence: Array.isArray(body?.evidence) ? body.evidence : existingDispute.evidence,
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

      const result = await runOpsRoute({
        storage,
        serviceName,
        environment,
        storageDriver,
        method,
        pathname,
        searchParams: url.searchParams,
        body,
      });

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

      const result = await runOpsRoute({
        storage,
        serviceName,
        environment,
        storageDriver,
        method,
        pathname,
        searchParams: url.searchParams,
        body,
      });

      return createJsonResponse(result.status, result.payload, corsHeaders);
    } catch (error) {
      return createJsonResponse(500, {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown ops API error',
      }, corsHeaders);
    }
  };
}
