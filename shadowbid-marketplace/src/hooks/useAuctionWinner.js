import { useState, useEffect } from 'react';
import { getAuctionWinner, getHighestBid } from '@/services/aleoService';

export function useAuctionWinner(auctionId, status) {
  const [winner, setWinner] = useState(null);
  const [highestBid, setHighestBid] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auctionId || status !== 'settled') return;

    const fetch = async () => {
      setLoading(true);
      try {
        const [w, h] = await Promise.all([
          getAuctionWinner(auctionId),
          getHighestBid(auctionId),
        ]);
        setWinner(w ? String(w).replace(/"/g, '') : null);
        setHighestBid(h);
      } catch {
        // silently fail — on-chain data may not exist for mock auctions
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [auctionId, status]);

  return { winner, highestBid, loading };
}
