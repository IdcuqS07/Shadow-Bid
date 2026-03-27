import { useState, useEffect } from 'react';
import { getAuctionInfo } from '@/services/aleoService';

/**
 * Hook to fetch auction info from on-chain mapping
 * @param {string|number} auctionId - The auction ID to query
 * @returns {Object} { auctionInfo, loading, error, refresh }
 */
export function useAuctionInfo(auctionId) {
  const [auctionInfo, setAuctionInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAuctionInfo = async () => {
    if (!auctionId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const info = await getAuctionInfo(auctionId);
      setAuctionInfo(info);
    } catch (err) {
      console.error('[useAuctionInfo] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctionInfo();
  }, [auctionId]);

  return {
    auctionInfo,
    loading,
    error,
    refresh: fetchAuctionInfo
  };
}
