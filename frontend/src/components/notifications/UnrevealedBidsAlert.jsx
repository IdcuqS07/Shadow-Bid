import { AlertTriangle, Clock, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useUnrevealedBids } from '@/hooks/useUnrevealedBids';

export function UnrevealedBidsAlert() {
  const { notifications, totalUnrevealed } = useUnrevealedBids();

  // Only show if there are unrevealed bids
  if (totalUnrevealed === 0) return null;

  // Get most urgent notification
  const urgentNotification = notifications.find(n => n.urgency === 'critical' || n.urgency === 'expired') 
    || notifications[0];

  const formatTimeRemaining = (notification) => {
    if (notification.urgency === 'expired') {
      return 'Auction has closed!';
    }
    
    const { hoursRemaining, minutesRemaining } = notification;
    if (hoursRemaining > 0) {
      return `${hoursRemaining}h ${minutesRemaining}m remaining`;
    }
    return `${minutesRemaining}m remaining`;
  };

  const getAlertStyle = () => {
    if (urgentNotification.urgency === 'expired') {
      return 'border-red-500/30 bg-red-950/30';
    }
    if (urgentNotification.urgency === 'critical') {
      return 'border-orange-500/30 bg-orange-950/30';
    }
    return 'border-amber-500/30 bg-amber-950/30';
  };

  return (
    <Card className={`border ${getAlertStyle()}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="rounded-full bg-amber-500/20 p-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white">
                  {totalUnrevealed} Unrevealed Bid{totalUnrevealed > 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-slate-300 mt-1">
                  {urgentNotification.auctionTitle}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <p className="text-sm font-medium text-amber-200">
                    {formatTimeRemaining(urgentNotification)}
                  </p>
                </div>
                {notifications.length > 1 && (
                  <p className="text-xs text-slate-400 mt-2">
                    +{notifications.length - 1} more auction{notifications.length > 2 ? 's' : ''} need attention
                  </p>
                )}
              </div>
              <Button asChild size="sm" className="bg-purple-600 hover:bg-purple-700">
                <Link to="/reveal-bid" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Reveal Now
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
