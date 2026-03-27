import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.LOCAL_API_PORT || 8787);
const HOST = process.env.LOCAL_API_HOST || '127.0.0.1';
const PLATFORM_ADDRESS = 'aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8';
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

function createDefaultDb() {
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

async function ensureDbFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(createDefaultDb(), null, 2), 'utf8');
  }
}

function mergeDefaults(db) {
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

async function loadDb() {
  await ensureDbFile();

  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    return mergeDefaults(JSON.parse(raw));
  } catch {
    const fallback = createDefaultDb();
    await fs.writeFile(DB_PATH, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

async function saveDb(db) {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
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
      jobs.push({
        ...baseJob,
        id: `determine_${auction.id}`,
        action: 'determine_winner',
        priority: 'medium',
        ready: true,
        reason: 'Auction is closed and ready for winner determination.',
      });
    }

    if (auction.status === 'challenge') {
      jobs.push({
        ...baseJob,
        id: `challenge_${auction.id}`,
        action: auction.reserveMet === false ? 'cancel_auction_reserve_not_met' : 'finalize_winner',
        priority: 'high',
        ready: true,
        reason: auction.reserveMet === false
          ? 'Reserve was not met, so the seller can cancel and unlock refunds.'
          : 'Winner can be finalized from the challenge phase.',
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
        actionPath: '/standard/admin-v3',
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
    reservePrice: toNumber(snapshot.reservePrice, 0),
    reserveMet: typeof snapshot.reserveMet === 'boolean' ? snapshot.reserveMet : snapshot.reserveMet ?? null,
    settledAt: toNumber(snapshot.settledAt, 0),
    claimableAt: toNumber(snapshot.claimableAt, 0),
    itemReceived: Boolean(snapshot.itemReceived),
    paymentClaimed: Boolean(snapshot.paymentClaimed),
    platformFeeClaimed: Boolean(snapshot.platformFeeClaimed),
    winningBid: snapshot.winningBid ?? 0,
    winningAmountMicro: snapshot.winningAmountMicro ?? null,
    platformFee: snapshot.platformFee ?? 0,
    platformFeeMicro: snapshot.platformFeeMicro ?? null,
    sellerNetAmount: snapshot.sellerNetAmount ?? 0,
    sellerNetAmountMicro: snapshot.sellerNetAmountMicro ?? null,
    totalEscrowed: snapshot.totalEscrowed ?? 0,
    totalEscrowedMicro: snapshot.totalEscrowedMicro ?? null,
    assetType: toNumber(snapshot.assetType, 0),
    currencyType: toNumber(snapshot.currencyType, 1),
    itemPhotosCount: toNumber(snapshot.itemPhotosCount, 0),
    proofFilesCount: toNumber(snapshot.proofFilesCount, 0),
    verificationStatus: snapshot.verificationStatus || 'pending',
    updatedAt: new Date().toISOString(),
  };
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function notFound(response) {
  sendJson(response, 404, {
    ok: false,
    error: 'Not found',
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    response.end();
    return;
  }

  const url = new URL(request.url || '/', `http://${request.headers.host || `${HOST}:${PORT}`}`);
  const pathname = url.pathname;
  const method = request.method || 'GET';

  try {
    if (method === 'GET' && pathname === '/api/health') {
      sendJson(response, 200, {
        ok: true,
        service: 'shadowbid-local-ops-api',
        port: PORT,
        platformAddress: PLATFORM_ADDRESS,
      });
      return;
    }

    let db = await loadDb();
    let body = null;

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      body = await readJsonBody(request);
    }

    if (method === 'POST' && pathname === '/api/auctions/sync') {
      const snapshot = sanitizeSnapshot(body || {});
      db.auctions[snapshot.id] = {
        ...(db.auctions[snapshot.id] || {}),
        ...snapshot,
      };
      await saveDb(db);
      sendJson(response, 200, {
        ok: true,
        auction: db.auctions[snapshot.id],
      });
      return;
    }

    if (method === 'POST' && pathname === '/api/engagements/sync') {
      const wallet = normalizeAddress(body?.wallet);
      const auctionId = String(body?.auctionId || '');
      const roles = dedupe(Array.isArray(body?.roles) ? body.roles : []);

      if (!wallet || !auctionId) {
        sendJson(response, 400, {
          ok: false,
          error: 'wallet and auctionId are required',
        });
        return;
      }

      if (!db.engagements[wallet]) {
        db.engagements[wallet] = {};
      }

      db.engagements[wallet][auctionId] = {
        roles,
        updatedAt: new Date().toISOString(),
      };

      await saveDb(db);
      sendJson(response, 200, {
        ok: true,
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/analytics/overview') {
      sendJson(response, 200, {
        ok: true,
        analytics: computeAnalytics(db),
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/executor/state') {
      sendJson(response, 200, {
        ok: true,
        settings: db.settings.executor,
        jobs: deriveExecutorJobs(db),
        recentRuns: db.executorRuns.slice(0, 12),
      });
      return;
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

      await saveDb(db);
      sendJson(response, 200, {
        ok: true,
        run,
        jobs,
      });
      return;
    }

    if (method === 'POST' && pathname === '/api/executor/settings') {
      db.settings.executor = {
        ...db.settings.executor,
        ...(body || {}),
      };

      await saveDb(db);
      sendJson(response, 200, {
        ok: true,
        settings: db.settings.executor,
      });
      return;
    }

    const notificationMatch = pathname.match(/^\/api\/notifications\/([^/]+)(?:\/(dismiss|read))?$/);
    if (notificationMatch) {
      const wallet = normalizeAddress(decodeURIComponent(notificationMatch[1]));
      const action = notificationMatch[2];

      if (method === 'GET' && !action) {
        sendJson(response, 200, {
          ok: true,
          ...buildNotifications(db, wallet),
        });
        return;
      }

      const notificationState = getWalletNotificationState(db, wallet);
      const ids = dedupe(Array.isArray(body?.notificationIds) ? body.notificationIds : body?.notificationId ? [body.notificationId] : []);

      if (method === 'POST' && action === 'dismiss') {
        notificationState.dismissed = dedupe([...(notificationState.dismissed || []), ...ids]);
        notificationState.updatedAt = new Date().toISOString();
        await saveDb(db);
        sendJson(response, 200, {
          ok: true,
        });
        return;
      }

      if (method === 'POST' && action === 'read') {
        notificationState.read = dedupe([...(notificationState.read || []), ...ids]);
        notificationState.updatedAt = new Date().toISOString();
        await saveDb(db);
        sendJson(response, 200, {
          ok: true,
        });
        return;
      }
    }

    const verificationMatch = pathname.match(/^\/api\/verifications\/sellers\/([^/]+)$/);
    if (verificationMatch) {
      const wallet = normalizeAddress(decodeURIComponent(verificationMatch[1]));

      if (method === 'GET') {
        sendJson(response, 200, {
          ok: true,
          verification: db.sellerVerifications[wallet] || null,
        });
        return;
      }

      if (method === 'PUT') {
        db.sellerVerifications[wallet] = {
          ...(db.sellerVerifications[wallet] || {}),
          ...(body || {}),
          wallet,
          updatedAt: new Date().toISOString(),
        };
        await saveDb(db);
        sendJson(response, 200, {
          ok: true,
          verification: db.sellerVerifications[wallet],
        });
        return;
      }
    }

    const proofMatch = pathname.match(/^\/api\/proofs\/auctions\/([^/]+)$/);
    if (proofMatch) {
      const auctionId = String(decodeURIComponent(proofMatch[1]));

      if (method === 'GET') {
        sendJson(response, 200, {
          ok: true,
          proofBundle: db.auctionProofs[auctionId] || null,
        });
        return;
      }

      if (method === 'PUT') {
        db.auctionProofs[auctionId] = {
          ...(db.auctionProofs[auctionId] || {}),
          ...(body || {}),
          auctionId,
          updatedAt: new Date().toISOString(),
        };
        await saveDb(db);
        sendJson(response, 200, {
          ok: true,
          proofBundle: db.auctionProofs[auctionId],
        });
        return;
      }
    }

    const watchlistMatch = pathname.match(/^\/api\/watchlists\/([^/]+)$/);
    if (watchlistMatch) {
      const wallet = normalizeAddress(decodeURIComponent(watchlistMatch[1]));

      if (method === 'GET') {
        sendJson(response, 200, {
          ok: true,
          watchlist: db.watchlists[wallet] || {
            wallet,
            auctionIds: [],
            sellers: [],
            categories: [],
            updatedAt: null,
          },
        });
        return;
      }

      if (method === 'PUT') {
        db.watchlists[wallet] = {
          wallet,
          auctionIds: dedupe(Array.isArray(body?.auctionIds) ? body.auctionIds.map(String) : []),
          sellers: dedupe(Array.isArray(body?.sellers) ? body.sellers : []),
          categories: dedupe(Array.isArray(body?.categories) ? body.categories.map(String) : []),
          updatedAt: new Date().toISOString(),
        };
        await saveDb(db);
        sendJson(response, 200, {
          ok: true,
          watchlist: db.watchlists[wallet],
        });
        return;
      }
    }

    const savedSearchMatch = pathname.match(/^\/api\/saved-searches\/([^/]+)$/);
    if (savedSearchMatch) {
      const wallet = normalizeAddress(decodeURIComponent(savedSearchMatch[1]));

      if (method === 'GET') {
        sendJson(response, 200, {
          ok: true,
          savedSearches: db.savedSearches[wallet] || {
            wallet,
            searches: [],
            updatedAt: null,
          },
        });
        return;
      }

      if (method === 'PUT') {
        db.savedSearches[wallet] = {
          wallet,
          searches: Array.isArray(body?.searches) ? body.searches : [],
          updatedAt: new Date().toISOString(),
        };
        await saveDb(db);
        sendJson(response, 200, {
          ok: true,
          savedSearches: db.savedSearches[wallet],
        });
        return;
      }
    }

    if (pathname === '/api/disputes') {
      if (method === 'GET') {
        const auctionId = url.searchParams.get('auctionId');
        const wallet = normalizeAddress(url.searchParams.get('wallet'));
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

        sendJson(response, 200, {
          ok: true,
          disputes,
        });
        return;
      }

      if (method === 'POST') {
        const disputeId = generateId('dispute');
        const auctionId = String(body?.auctionId || '');
        const wallet = normalizeAddress(body?.wallet);

        if (!auctionId || !wallet) {
          sendJson(response, 400, {
            ok: false,
            error: 'auctionId and wallet are required',
          });
          return;
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
              note: 'Initial evidence package was attached in local prototype mode.',
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveDb(db);
        sendJson(response, 200, {
          ok: true,
          dispute: db.disputes[disputeId],
        });
        return;
      }
    }

    const disputeMatch = pathname.match(/^\/api\/disputes\/([^/]+)$/);
    if (disputeMatch && method === 'PATCH') {
      const disputeId = String(decodeURIComponent(disputeMatch[1]));
      const existingDispute = db.disputes[disputeId];

      if (!existingDispute) {
        sendJson(response, 404, {
          ok: false,
          error: 'Dispute not found',
        });
        return;
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

      await saveDb(db);
      sendJson(response, 200, {
        ok: true,
        dispute: db.disputes[disputeId],
      });
      return;
    }

    if (pathname === '/api/offers') {
      if (method === 'GET') {
        const auctionId = url.searchParams.get('auctionId');
        const wallet = normalizeAddress(url.searchParams.get('wallet'));
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

        sendJson(response, 200, {
          ok: true,
          offers,
        });
        return;
      }

      if (method === 'POST') {
        const offerId = generateId('offer');
        const auctionId = String(body?.auctionId || '');
        const wallet = normalizeAddress(body?.wallet);

        if (!auctionId || !wallet) {
          sendJson(response, 400, {
            ok: false,
            error: 'auctionId and wallet are required',
          });
          return;
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
        await saveDb(db);
        sendJson(response, 200, {
          ok: true,
          offer: db.offers[offerId],
        });
        return;
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
      await saveDb(db);
      sendJson(response, 200, {
        ok: true,
        reputation,
      });
      return;
    }

    notFound(response);
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown local API error',
    });
  }
});

server.listen(PORT, HOST, async () => {
  await ensureDbFile();
  console.log(`[shadowbid-local-api] listening on http://${HOST}:${PORT}`);
});
