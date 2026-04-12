import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { Bell, Bot, CheckCheck, Clock3, ExternalLink, ShieldCheck, Sparkles, Wallet, X } from 'lucide-react';
import {
  dismissNotification,
  getOpsApiDebugInfo,
  getLocalApiHealth,
  getNotifications,
  markNotificationsRead,
} from '@/services/localOpsService';

function getIcon(notificationType) {
  if (notificationType === 'seller_claimable' || notificationType === 'platform_fee_claimable') {
    return Wallet;
  }

  if (notificationType === 'watchlist_match' || notificationType === 'proof_bundle_ready') {
    return Sparkles;
  }

  if (notificationType === 'seller_close_due') {
    return Bot;
  }

  if (notificationType === 'winner_selected') {
    return ShieldCheck;
  }

  return Clock3;
}

function getUrgencyClasses(urgency) {
  switch (urgency) {
    case 'critical':
    case 'high':
      return 'border-red-500/30 bg-red-500/10 text-red-100';
    case 'medium':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
    default:
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100';
  }
}

function getSourceClasses(sourceKind) {
  switch (sourceKind) {
    case 'watchlist':
      return 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200';
    case 'trust':
      return 'border-emerald-500/30 bg-emerald-500/12 text-emerald-200';
    default:
      return 'border-white/10 bg-white/5 text-white/65';
  }
}

function formatRelativeTimestamp(value) {
  if (!value) {
    return 'Just now';
  }

  const parsedValue = Date.parse(value);
  if (Number.isNaN(parsedValue)) {
    return 'Just now';
  }

  const deltaSeconds = Math.max(0, Math.round((Date.now() - parsedValue) / 1000));
  if (deltaSeconds < 60) {
    return 'Just now';
  }

  if (deltaSeconds < 3600) {
    return `${Math.floor(deltaSeconds / 60)}m ago`;
  }

  if (deltaSeconds < 86400) {
    return `${Math.floor(deltaSeconds / 3600)}h ago`;
  }

  return `${Math.floor(deltaSeconds / 86400)}d ago`;
}

export default function PremiumNotificationCenter() {
  const navigate = useNavigate();
  const { connected, address } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [isApiAvailable, setIsApiAvailable] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const unreadIds = useMemo(
    () => notifications.filter((notification) => !notification.read).map((notification) => notification.id),
    [notifications]
  );
  const opsApiDebugInfo = getOpsApiDebugInfo();

  const refreshNotifications = async (walletAddress) => {
    if (!walletAddress) {
      setNotifications([]);
      setUnreadCount(0);
      return null;
    }

    const response = await getNotifications(walletAddress);
    setNotifications(response.notifications);
    setUnreadCount(response.unreadCount);
    return response;
  };

  useEffect(() => {
    let isCancelled = false;

    const refresh = async () => {
      if (!connected || !address) {
        if (!isCancelled) {
          setNotifications([]);
          setUnreadCount(0);
          setIsApiAvailable(false);
        }
        return;
      }

      const health = await getLocalApiHealth();
      if (!health) {
        if (!isCancelled) {
          setNotifications([]);
          setUnreadCount(0);
          setIsApiAvailable(false);
        }
        return;
      }

      const response = await getNotifications(address);
      if (!isCancelled) {
        setIsApiAvailable(true);
        setNotifications(response.notifications);
        setUnreadCount(response.unreadCount);
      }
    };

    refresh();
    const interval = setInterval(refresh, 30000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [address, connected]);

  const handleDismiss = async (notificationId) => {
    if (!address) {
      return;
    }

    await dismissNotification(address, notificationId);
    await refreshNotifications(address);
  };

  const handleMarkAllRead = async () => {
    if (!address || unreadIds.length === 0) {
      return;
    }

    await markNotificationsRead(address, unreadIds);
    setNotifications((current) => current.map((notification) => ({
      ...notification,
      read: true,
    })));
    setUnreadCount(0);
  };

  const handleOpenNotification = async (notification) => {
    if (address && !notification.read) {
      await markNotificationsRead(address, [notification.id]);
      setNotifications((current) => current.map((item) => (
        item.id === notification.id
          ? { ...item, read: true }
          : item
      )));
      setUnreadCount((current) => Math.max(0, current - 1));
    }

    setIsOpen(false);
    navigate(notification.actionPath || `/premium-auction/${notification.auctionId}`);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-14 z-50 w-[360px] rounded-2xl border border-white/10 bg-void-900/95 p-4 shadow-2xl backdrop-blur-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-mono uppercase tracking-[0.2em] text-white/40">Auction Alerts</div>
                <div className="mt-1 text-lg font-display font-bold text-white">Notifications</div>
                {isApiAvailable && (
                  <div className="mt-2 text-xs text-white/45">
                    {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isApiAvailable && unreadIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 text-[10px] font-mono uppercase tracking-[0.16em] text-cyan-200 transition-colors hover:bg-cyan-500/18"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!isApiAvailable && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100">
                {!connected || !address
                  ? 'Connect a wallet to load address-aware notifications and executor insights.'
                  : opsApiDebugInfo.isLocalTarget
                    ? 'Start the ops API with `npm run dev:ops` from the repo root, or `npm run dev:api` inside `frontend`, to enable notifications, executor insights, and analytics sync.'
                    : opsApiDebugInfo.isLocalPage
                      ? 'Your local frontend is pointing at the shared ops backend, but that backend is not currently allowing this localhost origin.'
                    : 'Notifications and executor insights are temporarily unavailable while the shared ops backend reconnects.'}
                {connected && address && opsApiDebugInfo.baseUrl && (
                  <div className="mt-2 font-mono uppercase tracking-[0.16em] text-amber-100/70">
                    Target: {opsApiDebugInfo.baseUrl}
                  </div>
                )}
              </div>
            )}

            {isApiAvailable && notifications.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-center text-sm text-white/60">
                No notifications yet.
              </div>
            )}

            {isApiAvailable && notifications.length > 0 && (
              <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                {notifications.map((notification) => {
                  const Icon = getIcon(notification.type);

                  return (
                    <div
                      key={notification.id}
                      className={`rounded-xl border p-4 ${getUrgencyClasses(notification.urgency)}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-lg border border-white/10 bg-black/20 p-2">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => void handleOpenNotification(notification)}
                              className="text-left"
                            >
                              <div className="font-semibold">{notification.title}</div>
                              <div className="mt-1 text-xs text-white/70">{notification.description}</div>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDismiss(notification.id)}
                              className="text-white/50 transition-colors hover:text-white"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em]">
                            <span className="text-white/45">{notification.auctionTitle}</span>
                            {notification.sourceLabel && (
                              <span className={`rounded-full border px-2 py-1 ${getSourceClasses(notification.sourceKind)}`}>
                                {notification.sourceLabel}
                              </span>
                            )}
                            {notification.audienceLabel && (
                              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-white/55">
                                {notification.audienceLabel}
                              </span>
                            )}
                            {notification.contextLabel && (
                              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-white/50">
                                {notification.contextLabel}
                              </span>
                            )}
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-mono uppercase tracking-[0.18em] text-white/45">
                            <span>{formatRelativeTimestamp(notification.createdAt)}</span>
                            <div className="flex items-center gap-3">
                              {!notification.read && <span className="text-red-200">New</span>}
                              <button
                                type="button"
                                onClick={() => void handleOpenNotification(notification)}
                                className="inline-flex items-center gap-1 text-cyan-200 transition-colors hover:text-cyan-100"
                              >
                                Open
                                <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
