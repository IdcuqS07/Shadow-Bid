import { useState, useEffect } from 'react';

/**
 * Hook to manage locally stored auctions
 * Stores auctions created by the user in localStorage
 */
export function useLocalAuctions() {
  const [auctions, setAuctions] = useState([]);

  const loadAuctions = () => {
    try {
      const stored = localStorage.getItem('shadowbid_auctions');
      if (stored) {
        setAuctions(JSON.parse(stored));
      }
    } catch (error) {
      console.error('[useLocalAuctions] Error loading auctions:', error);
    }
  };

  const addAuction = (auctionData) => {
    try {
      const newAuction = {
        id: auctionData.auctionId.toString(),
        title: auctionData.title,
        category: auctionData.category || 'General',
        description: auctionData.description || '',
        minBid: auctionData.minBid,
        endBlock: auctionData.endBlock,
        closingDate: auctionData.closingDate,
        seller: auctionData.seller,
        txId: auctionData.txId,
        status: 'active',
        bids: 0,
        createdAt: Date.now(),
        location: 'On-Chain',
        image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop',
        highestBid: 'Sealed'
      };
      
      const stored = JSON.parse(localStorage.getItem('shadowbid_auctions') || '[]');
      stored.unshift(newAuction); // Add to beginning
      localStorage.setItem('shadowbid_auctions', JSON.stringify(stored));
      
      setAuctions(stored);
      return newAuction;
    } catch (error) {
      console.error('[useLocalAuctions] Error adding auction:', error);
      throw error;
    }
  };

  const updateAuctionStatus = (auctionId, status) => {
    try {
      const stored = JSON.parse(localStorage.getItem('shadowbid_auctions') || '[]');
      const updated = stored.map(auction => 
        auction.id === auctionId.toString() 
          ? { ...auction, status } 
          : auction
      );
      localStorage.setItem('shadowbid_auctions', JSON.stringify(updated));
      setAuctions(updated);
    } catch (error) {
      console.error('[useLocalAuctions] Error updating status:', error);
    }
  };

  const incrementBidCount = (auctionId) => {
    try {
      const stored = JSON.parse(localStorage.getItem('shadowbid_auctions') || '[]');
      const updated = stored.map(auction => 
        auction.id === auctionId.toString() 
          ? { ...auction, bids: (auction.bids || 0) + 1 } 
          : auction
      );
      localStorage.setItem('shadowbid_auctions', JSON.stringify(updated));
      setAuctions(updated);
    } catch (error) {
      console.error('[useLocalAuctions] Error incrementing bid count:', error);
    }
  };

  const getAuctionById = (auctionId) => {
    return auctions.find(auction => auction.id === auctionId.toString());
  };

  const clearAuctions = () => {
    localStorage.removeItem('shadowbid_auctions');
    setAuctions([]);
  };

  useEffect(() => {
    loadAuctions();
  }, []);

  return {
    auctions,
    addAuction,
    updateAuctionStatus,
    incrementBidCount,
    getAuctionById,
    clearAuctions,
    refresh: loadAuctions
  };
}
