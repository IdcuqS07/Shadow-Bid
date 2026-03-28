const configuredLocalApiBase = import.meta.env.VITE_LOCAL_API_URL?.trim();
const browserHostname = typeof window !== 'undefined' ? window.location.hostname : '';
const inferredProductionApiBase = ['shadowbid.xyz', 'www.shadowbid.xyz'].includes(browserHostname)
  ? 'https://api.shadowbid.xyz'
  : '';
const OPS_API_BASE = configuredLocalApiBase || (import.meta.env.DEV ? 'http://127.0.0.1:8787' : inferredProductionApiBase);

function resolveOpsApiDebugInfo() {
  if (!OPS_API_BASE) {
    return {
      configuredBaseUrl: '',
      baseUrl: '',
      hostname: '',
      isConfigured: false,
      isLocalTarget: false,
    };
  }

  try {
    const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const resolvedUrl = new URL(OPS_API_BASE, fallbackOrigin);
    const hostname = resolvedUrl.hostname.toLowerCase();

    return {
      configuredBaseUrl: OPS_API_BASE,
      baseUrl: resolvedUrl.origin,
      hostname,
      isConfigured: true,
      isLocalTarget: ['localhost', '127.0.0.1', '::1'].includes(hostname),
    };
  } catch {
    return {
      configuredBaseUrl: OPS_API_BASE,
      baseUrl: OPS_API_BASE,
      hostname: '',
      isConfigured: true,
      isLocalTarget: false,
    };
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${OPS_API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Ops API request failed (${response.status})`);
  }

  return response.json();
}

export function getOpsApiDebugInfo() {
  return resolveOpsApiDebugInfo();
}

export async function getLocalApiHealth() {
  try {
    return await request('/api/health');
  } catch {
    return null;
  }
}

export async function syncAuctionSnapshot(snapshot) {
  try {
    const response = await request('/api/auctions/sync', {
      method: 'POST',
      body: JSON.stringify(snapshot),
    });
    return response.auction || null;
  } catch {
    return null;
  }
}

export async function syncAuctionRole({ auctionId, wallet, roles }) {
  if (!auctionId || !wallet || !Array.isArray(roles) || roles.length === 0) {
    return null;
  }

  try {
    return await request('/api/engagements/sync', {
      method: 'POST',
      body: JSON.stringify({
        auctionId,
        wallet,
        roles,
      }),
    });
  } catch {
    return null;
  }
}

export async function getNotifications(wallet) {
  if (!wallet) {
    return {
      notifications: [],
      unreadCount: 0,
    };
  }

  try {
    const response = await request(`/api/notifications/${encodeURIComponent(wallet)}`);
    return {
      notifications: response.notifications || [],
      unreadCount: response.unreadCount || 0,
    };
  } catch {
    return {
      notifications: [],
      unreadCount: 0,
    };
  }
}

export async function dismissNotification(wallet, notificationId) {
  if (!wallet || !notificationId) {
    return null;
  }

  try {
    return await request(`/api/notifications/${encodeURIComponent(wallet)}/dismiss`, {
      method: 'POST',
      body: JSON.stringify({
        notificationId,
      }),
    });
  } catch {
    return null;
  }
}

export async function markNotificationsRead(wallet, notificationIds) {
  if (!wallet || !Array.isArray(notificationIds) || notificationIds.length === 0) {
    return null;
  }

  try {
    return await request(`/api/notifications/${encodeURIComponent(wallet)}/read`, {
      method: 'POST',
      body: JSON.stringify({
        notificationIds,
      }),
    });
  } catch {
    return null;
  }
}

export async function getSellerVerification(wallet) {
  if (!wallet) {
    return null;
  }

  try {
    const response = await request(`/api/verifications/sellers/${encodeURIComponent(wallet)}`);
    return response.verification || null;
  } catch {
    return null;
  }
}

export async function upsertSellerVerification(wallet, verification) {
  if (!wallet || !verification) {
    return null;
  }

  try {
    const response = await request(`/api/verifications/sellers/${encodeURIComponent(wallet)}`, {
      method: 'PUT',
      body: JSON.stringify(verification),
    });
    return response.verification || null;
  } catch {
    return null;
  }
}

export async function getAuctionProofBundle(auctionId) {
  if (!auctionId) {
    return null;
  }

  try {
    const response = await request(`/api/proofs/auctions/${encodeURIComponent(auctionId)}`);
    return response.proofBundle || null;
  } catch {
    return null;
  }
}

export async function upsertAuctionProofBundle(auctionId, proofBundle) {
  if (!auctionId || !proofBundle) {
    return null;
  }

  try {
    const response = await request(`/api/proofs/auctions/${encodeURIComponent(auctionId)}`, {
      method: 'PUT',
      body: JSON.stringify(proofBundle),
    });
    return response.proofBundle || null;
  } catch {
    return null;
  }
}

export async function getAnalyticsOverview() {
  try {
    const response = await request('/api/analytics/overview');
    return response.analytics || null;
  } catch {
    return null;
  }
}

export async function getExecutorState() {
  try {
    const response = await request('/api/executor/state');
    return {
      settings: response.settings || null,
      jobs: response.jobs || [],
      recentRuns: response.recentRuns || [],
    };
  } catch {
    return {
      settings: null,
      jobs: [],
      recentRuns: [],
    };
  }
}

export async function runExecutorScan() {
  try {
    return await request('/api/executor/run', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } catch {
    return null;
  }
}

export async function updateExecutorSettings(settings) {
  try {
    return await request('/api/executor/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  } catch {
    return null;
  }
}

export async function resetOpsTestData() {
  const debugInfo = getOpsApiDebugInfo();

  if (!debugInfo.isLocalTarget) {
    return {
      ok: false,
      skipped: true,
      reason: `Refusing to reset non-local Ops target: ${debugInfo.baseUrl || 'not configured'}`,
    };
  }

  try {
    return await request('/api/dev/reset', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } catch {
    return null;
  }
}

export async function getWatchlist(wallet) {
  if (!wallet) {
    return {
      auctionIds: [],
      sellers: [],
      categories: [],
    };
  }

  try {
    const response = await request(`/api/watchlists/${encodeURIComponent(wallet)}`);
    return response.watchlist || {
      auctionIds: [],
      sellers: [],
      categories: [],
    };
  } catch {
    return {
      auctionIds: [],
      sellers: [],
      categories: [],
    };
  }
}

export async function saveWatchlist(wallet, watchlist) {
  if (!wallet) {
    return null;
  }

  try {
    const response = await request(`/api/watchlists/${encodeURIComponent(wallet)}`, {
      method: 'PUT',
      body: JSON.stringify(watchlist),
    });
    return response.watchlist || null;
  } catch {
    return null;
  }
}

export async function getSavedSearches(wallet) {
  if (!wallet) {
    return {
      searches: [],
    };
  }

  try {
    const response = await request(`/api/saved-searches/${encodeURIComponent(wallet)}`);
    return response.savedSearches || {
      searches: [],
    };
  } catch {
    return {
      searches: [],
    };
  }
}

export async function saveSavedSearches(wallet, searches) {
  if (!wallet) {
    return null;
  }

  try {
    const response = await request(`/api/saved-searches/${encodeURIComponent(wallet)}`, {
      method: 'PUT',
      body: JSON.stringify({
        searches,
      }),
    });
    return response.savedSearches || null;
  } catch {
    return null;
  }
}

export async function getDisputes(params = {}) {
  try {
    const searchParams = new URLSearchParams();
    if (params.auctionId) {
      searchParams.set('auctionId', params.auctionId);
    }
    if (params.wallet) {
      searchParams.set('wallet', params.wallet);
    }

    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await request(`/api/disputes${suffix}`);
    return response.disputes || [];
  } catch {
    return [];
  }
}

export async function createDispute(dispute) {
  try {
    const response = await request('/api/disputes', {
      method: 'POST',
      body: JSON.stringify(dispute),
    });
    return response.dispute || null;
  } catch {
    return null;
  }
}

export async function updateDispute(disputeId, patch) {
  if (!disputeId || !patch) {
    return null;
  }

  try {
    const response = await request(`/api/disputes/${encodeURIComponent(disputeId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return response.dispute || null;
  } catch {
    return null;
  }
}

export async function getOffers(params = {}) {
  try {
    const searchParams = new URLSearchParams();
    if (params.auctionId) {
      searchParams.set('auctionId', params.auctionId);
    }
    if (params.wallet) {
      searchParams.set('wallet', params.wallet);
    }

    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await request(`/api/offers${suffix}`);
    return response.offers || [];
  } catch {
    return [];
  }
}

export async function createOffer(offer) {
  try {
    const response = await request('/api/offers', {
      method: 'POST',
      body: JSON.stringify(offer),
    });
    return response.offer || null;
  } catch {
    return null;
  }
}

export async function getReputation(wallet) {
  if (!wallet) {
    return null;
  }

  try {
    const response = await request(`/api/reputations/${encodeURIComponent(wallet)}`);
    return response.reputation || null;
  } catch {
    return null;
  }
}
