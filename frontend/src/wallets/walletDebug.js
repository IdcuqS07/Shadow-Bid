const WALLET_DEBUG_HISTORY_KEY = '__shadowbidWalletDebugHistory';
const WALLET_DEBUG_API_KEY = '__shadowbidWalletDebug';
const MAX_WALLET_DEBUG_ENTRIES = 200;

function getHistory() {
  if (typeof window === 'undefined') {
    return [];
  }

  if (!Array.isArray(window[WALLET_DEBUG_HISTORY_KEY])) {
    window[WALLET_DEBUG_HISTORY_KEY] = [];
  }

  return window[WALLET_DEBUG_HISTORY_KEY];
}

function installWalletDebugApi() {
  if (typeof window === 'undefined' || window[WALLET_DEBUG_API_KEY]) {
    return;
  }

  window[WALLET_DEBUG_API_KEY] = {
    get history() {
      return [...getHistory()];
    },
    clear() {
      window[WALLET_DEBUG_HISTORY_KEY] = [];
    },
    latest() {
      const history = getHistory();
      return history[history.length - 1] ?? null;
    },
  };
}

function serializeDetails(details = {}) {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => {
      if (value instanceof Error) {
        return [key, value.message];
      }

      return [key, value];
    })
  );
}

export function recordWalletDebug(event, details = {}) {
  if (typeof window === 'undefined') {
    return null;
  }

  installWalletDebugApi();

  const entry = {
    timestamp: new Date().toISOString(),
    event,
    origin: window.location.origin,
    href: window.location.href,
    ...serializeDetails(details),
  };

  const history = getHistory();
  history.push(entry);

  if (history.length > MAX_WALLET_DEBUG_ENTRIES) {
    history.splice(0, history.length - MAX_WALLET_DEBUG_ENTRIES);
  }

  console.info('[ShadowBid WalletDebug]', entry);

  return entry;
}

