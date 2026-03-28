import { useState, useEffect } from 'react';
import { getAuctionInfo, getHighestBid } from '@/services/aleoServiceV2';

function parseAuctionWinnerData(auctionInfo) {
  if (!auctionInfo) {
    return {
      winner: null,
      winningAmount: null,
    };
  }

  if (typeof auctionInfo === 'string') {
    const winnerMatch = auctionInfo.match(/winner:\s*(aleo1[a-z0-9]+)/);
    const winningAmountMatch = auctionInfo.match(/winning_amount:\s*(\d+)u128/);

    return {
      winner: winnerMatch ? winnerMatch[1] : null,
      winningAmount: winningAmountMatch ? Number.parseInt(winningAmountMatch[1], 10) : null,
    };
  }

  const winner = typeof auctionInfo.winner === 'string' && auctionInfo.winner.startsWith('aleo1')
    ? auctionInfo.winner
    : null;
  const winningAmount = auctionInfo.winning_amount != null
    ? Number.parseInt(String(auctionInfo.winning_amount).replace(/[^\d]/g, ''), 10)
    : null;

  return {
    winner,
    winningAmount: Number.isFinite(winningAmount) ? winningAmount : null,
  };
}

export function useAuctionWinner(auctionId, status) {
  const [winner, setWinner] = useState(null);
  const [highestBid, setHighestBid] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auctionId || status !== 'settled') return;

    const fetch = async () => {
      setLoading(true);
      try {
        const [auctionInfo, highestBidValue] = await Promise.all([
          getAuctionInfo(auctionId),
          getHighestBid(auctionId),
        ]);

        const parsedAuction = parseAuctionWinnerData(auctionInfo);
        const parsedHighestBid = highestBidValue == null
          ? null
          : Number.parseInt(String(highestBidValue).replace(/[^\d]/g, ''), 10);

        setWinner(parsedAuction.winner);
        setHighestBid(
          Number.isFinite(parsedAuction.winningAmount) && parsedAuction.winningAmount > 0
            ? parsedAuction.winningAmount / 1_000_000
            : Number.isFinite(parsedHighestBid)
              ? parsedHighestBid / 1_000_000
              : null
        );
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
