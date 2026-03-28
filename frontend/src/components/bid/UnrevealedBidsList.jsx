import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, AlertTriangle, Eye } from 'lucide-react';
import { useLocalAuctions } from '@/hooks/useLocalAuctions';

export function UnrevealedBidsList({ onSelectAuction }) {
  const { auctions } = useLocalAuctions();
  const [unrevealedBids, setUnrevealedBids] = useState([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    // Update time every minute
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkUnrevealedBids = () => {
      const unrevealed = [];

      auctions.forEach((auction) => {
        // Only check active auctions
        if (auction.status !== 'active') return;

        // Get bids for this auction from localStorage
        const storedBids = localStorage.getItem(`auction_${auction.id}_bids`);
        if (!storedBids) return;

        try {
          const bids = JSON.parse(storedBids);
          const unrevealedCount = bids.filter(bid => !bid.revealed).length;

          if (unrevealedCount > 0) {
            unrevealed.push({
              auction,
              unrevealedCount,
              totalBids: bids.length,
            });
          }
        } catch (error) {
          console.error(`[UnrevealedBidsList] Error checking auction ${auction.id}:`, error);
        }
      });

      setUnrevealedBids(unrevealed);
    };

    checkUnrevealedBids();
  }, [auctions, currentTime]);

  const getTimeRemaining = (closingDate) => {
    const closing = new Date(closingDate);
    const remaining = closing.getTime() - currentTime;
    
    if (remaining < 0) {
      return { expired: true, text: 'Auction closed' };
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return { 
        expired: false, 
        critical: hours < 2,
        text: `${hours}h ${minutes}m remaining` 
      };
    }
    
    return { 
      expired: false, 
      critical: true,
      text: `${minutes}m remaining` 
    };
  };

  const getUrgencyStyle = (timeInfo) => {
    if (timeInfo.expired) {
      return 'border-red-500/30 bg-red-950/30';
    }
    if (timeInfo.critical) {
      return 'border-orange-500/30 bg-orange-950/30';
    }
    return 'border-amber-500/30 bg-amber-950/30';
  };

  if (unrevealedBids.length === 0) {
    return (
      <Card className="border-green-500/20 bg-green-950/20">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-green-500/20 p-3">
              <Eye className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-green-200">All Bids Revealed!</p>
              <p className="text-sm text-green-300/70 mt-1">
                You don't have any unrevealed bids
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          Unrevealed Bids ({unrevealedBids.length})
        </CardTitle>
        <p className="text-xs text-slate-400">
          Click to reveal your bids before auction closes
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {unrevealedBids.map(({ auction, unrevealedCount, totalBids }) => {
          const timeInfo = getTimeRemaining(auction.closingDate);
          
          return (
            <div
              key={auction.id}
              className={`rounded-lg border p-4 ${getUrgencyStyle(timeInfo)}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">
                    {auction.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    ID: {auction.id}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Clock className={`h-4 w-4 ${timeInfo.expired ? 'text-red-400' : timeInfo.critical ? 'text-orange-400' : 'text-amber-400'}`} />
                    <p className={`text-sm font-medium ${timeInfo.expired ? 'text-red-200' : timeInfo.critical ? 'text-orange-200' : 'text-amber-200'}`}>
                      {timeInfo.text}
                    </p>
                  </div>
                  <p className="text-xs text-slate-300 mt-2">
                    {unrevealedCount} of {totalBids} bid{totalBids > 1 ? 's' : ''} unrevealed
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => onSelectAuction(auction.id)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Reveal
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
