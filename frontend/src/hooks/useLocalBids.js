import { useState, useEffect } from 'react';

/**
 * Hook to manage locally stored bids
 * Bids are stored in localStorage since amounts are private on-chain
 */
export function useLocalBids() {
  const [bids, setBids] = useState([]);

  const loadBids = () => {
    try {
      const stored = localStorage.getItem('shadowbid_bids');
      if (stored) {
        setBids(JSON.parse(stored));
      }
    } catch (error) {
      console.error('[useLocalBids] Error loading bids:', error);
    }
  };

  const addBid = (auctionId, txId, amount) => {
    try {
      const newBid = {
        auctionId,
        txId,
        amount,
        timestamp: Date.now()
      };
      
      const stored = JSON.parse(localStorage.getItem('shadowbid_bids') || '[]');
      stored.push(newBid);
      localStorage.setItem('shadowbid_bids', JSON.stringify(stored));
      
      setBids(stored);
      return newBid;
    } catch (error) {
      console.error('[useLocalBids] Error adding bid:', error);
      throw error;
    }
  };

  const getBidsForAuction = (auctionId) => {
    return bids.filter(bid => bid.auctionId === auctionId);
  };

  const clearBids = () => {
    localStorage.removeItem('shadowbid_bids');
    setBids([]);
  };

  useEffect(() => {
    loadBids();
  }, []);

  return {
    bids,
    addBid,
    getBidsForAuction,
    clearBids,
    refresh: loadBids
  };
}
