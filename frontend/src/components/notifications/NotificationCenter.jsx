import { useState } from 'react';
import { Bell, X, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUnrevealedBids } from '@/hooks/useUnrevealedBids';
import { Link } from 'react-router-dom';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, totalUnrevealed, criticalCount, dismissNotification } = useUnrevealedBids();

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'expired':
        return 'border-red-500/30 bg-red-950/30';
      case 'critical':
        return 'border-orange-500/30 bg-orange-950/30';
      case 'high':
        return 'border-amber-500/30 bg-amber-950/30';
      default:
        return 'border-blue-500/30 bg-blue-950/30';
    }
  };

  const getUrgencyIcon = (urgency) => {
    if (urgency === 'expired' || urgency === 'critical') {
      return <AlertTriangle className="h-4 w-4 text-red-400" />;
    }
    return <Clock className="h-4 w-4 text-amber-400" />;
  };

  const formatTimeRemaining = (notification) => {
    if (notification.urgency === 'expired') {
      return 'Auction closed';
    }
    
    const { hoursRemaining, minutesRemaining } = notification;
    if (hoursRemaining > 0) {
      return `${hoursRemaining}h ${minutesRemaining}m remaining`;
    }
    return `${minutesRemaining}m remaining`;
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {totalUnrevealed > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {totalUnrevealed > 9 ? '9+' : totalUnrevealed}
          </span>
        )}
      </Button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-12 z-50 w-96 rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 p-4">
              <div>
                <h3 className="font-semibold text-white">Notifications</h3>
                {totalUnrevealed > 0 && (
                  <p className="text-xs text-slate-400">
                    {totalUnrevealed} unrevealed bid{totalUnrevealed > 1 ? 's' : ''}
                    {criticalCount > 0 && ` · ${criticalCount} urgent`}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="mx-auto h-12 w-12 text-slate-600" />
                  <p className="mt-3 text-sm text-slate-400">No notifications</p>
                  <p className="mt-1 text-xs text-slate-500">
                    You'll be notified when you have unrevealed bids
                  </p>
                </div>
              ) : (
                <div className="space-y-2 p-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`rounded-lg border p-3 ${getUrgencyColor(notification.urgency)}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getUrgencyIcon(notification.urgency)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {notification.auctionTitle}
                          </p>
                          <p className="text-xs text-slate-300 mt-1">
                            {notification.unrevealedCount} unrevealed bid{notification.unrevealedCount > 1 ? 's' : ''}
                          </p>
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimeRemaining(notification)}
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Link
                              to="/reveal-bid"
                              onClick={() => setIsOpen(false)}
                            >
                              <Button size="sm" className="h-7 text-xs bg-purple-600 hover:bg-purple-700">
                                Reveal Now
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => dismissNotification(notification.id)}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
