import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { Bell, Bot, Clock3, ShieldCheck, Wallet, X } from 'lucide-react';
import {
  dismissNotification,
  getLocalApiHealth,
  getNotifications,
  markNotificationsRead,
} from '@/services/localOpsService';

function getIcon(notificationType) {
  if (notificationType === 'seller_claimable' || notificationType === 'platform_fee_claimable') {
    return Wallet;
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

export default function PremiumNotificationCenter() {
  const navigate = useNavigate();
  const { connected, address } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [isApiAvailable, setIsApiAvailable] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const notificationIds = useMemo(
    () => notifications.map((notification) => notification.id),
    [notifications]
  );

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

  useEffect(() => {
    if (!isOpen || !address || notificationIds.length === 0) {
      return;
    }

    markNotificationsRead(address, notificationIds);
  }, [address, isOpen, notificationIds]);

  const handleDismiss = async (notificationId) => {
    if (!address) {
      return;
    }

    await dismissNotification(address, notificationId);
    const response = await getNotifications(address);
    setNotifications(response.notifications);
    setUnreadCount(response.unreadCount);
  };

  const handleOpenNotification = (notification) => {
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
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!isApiAvailable && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100">
                Start the local API with `npm run dev:api` to enable notifications, executor insights, and analytics sync.
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
                              onClick={() => handleOpenNotification(notification)}
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
                          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-mono uppercase tracking-[0.18em] text-white/45">
                            <span>{notification.auctionTitle}</span>
                            {!notification.read && <span className="text-red-200">New</span>}
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
