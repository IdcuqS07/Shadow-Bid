import { useState, useEffect } from 'react';
import { useLocalAuctions } from './useLocalAuctions';

/**
 * Hook to track unrevealed bids and their urgency
 * Returns notifications for bids that need to be revealed
 */
export function useUnrevealedBids() {
  const { auctions } = useLocalAuctions();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const checkUnrevealedBids = () => {
      const now = Date.now();
      const newNotifications = [];

      auctions.forEach((auction) => {
        // Only check active auctions
        if (auction.status !== 'active') return;

        // Get bids for this auction from localStorage
        const storedBids = localStorage.getItem(`auction_${auction.id}_bids`);
        if (!storedBids) return;

        try {
          const bids = JSON.parse(storedBids);
          const unrevealedBids = bids.filter(bid => !bid.revealed);

          if (unrevealedBids.length > 0) {
            // Parse closing date
            const closingDate = new Date(auction.closingDate);
            const timeRemaining = closingDate.getTime() - now;
            const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
            const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

            // Determine urgency level
            let urgency = 'normal';
            if (timeRemaining < 0) {
              urgency = 'expired';
            } else if (hoursRemaining < 2) {
              urgency = 'critical';
            } else if (hoursRemaining < 24) {
              urgency = 'high';
            }

            newNotifications.push({
              id: `auction-${auction.id}`,
              auctionId: auction.id,
              auctionTitle: auction.title,
              unrevealedCount: unrevealedBids.length,
              totalBids: bids.length,
              closingDate: auction.closingDate,
              timeRemaining,
              hoursRemaining,
              minutesRemaining,
              urgency,
              timestamp: now,
            });
          }
        } catch (error) {
          console.error(`[useUnrevealedBids] Error checking auction ${auction.id}:`, error);
        }
      });

      setNotifications(newNotifications);
    };

    // Check immediately
    checkUnrevealedBids();

    // Check every minute
    const interval = setInterval(checkUnrevealedBids, 60000);

    return () => clearInterval(interval);
  }, [auctions]);

  const getTotalUnrevealed = () => {
    return notifications.reduce((sum, n) => sum + n.unrevealedCount, 0);
  };

  const getCriticalCount = () => {
    return notifications.filter(n => n.urgency === 'critical' || n.urgency === 'expired').length;
  };

  const dismissNotification = (notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  return {
    notifications,
    totalUnrevealed: getTotalUnrevealed(),
    criticalCount: getCriticalCount(),
    dismissNotification,
  };
}
