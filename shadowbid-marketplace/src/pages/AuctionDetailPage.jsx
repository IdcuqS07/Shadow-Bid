import { Link, useParams } from 'react-router-dom';
import { Building2, Calendar, MapPin, Trophy, DollarSign, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ZkPrivacyIndicator } from '@/components/common/ZkPrivacyIndicator';
import { AuctionPhaseTimeline } from '@/components/common/AuctionPhaseTimeline';
import { OnChainAuctionInfo } from '@/components/auction/OnChainAuctionInfo';
import { useAuctionWinner } from '@/hooks/useAuctionWinner';
import { useLocalAuctions } from '@/hooks/useLocalAuctions';
import { useLocalBids } from '@/hooks/useLocalBids';
import { useState, useEffect } from 'react';
import * as AleoServiceV2 from '@/services/aleoServiceV2';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { mapStateToStatus } from '@/lib/auctionUtils';

function zkStateFromBidStatus(status) {
  if (status === 'revealed') return 'revealed';
  if (status === 'committed') return 'protected';
  return 'verified';
}

export default function AuctionDetailPage() {
  const { auctionId } = useParams();
  const { address } = useWallet();
  const { auctions, updateAuctionStatus } = useLocalAuctions();
  const { getBidsForAuction } = useLocalBids();
  const auction = auctions.find((item) => item.id === auctionId);
  const { winner, highestBid, loading: winnerLoading } = useAuctionWinner(
    auction?.id,
    auction?.status
  );
  
  const [auctionStats, setAuctionStats] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [currency, setCurrency] = useState('usdcx'); // NEW: Track currency

  // Fetch auction statistics from on-chain and sync status
  useEffect(() => {
    const fetchStats = async () => {
      if (auction?.id && address) {
        const auctionData = await AleoServiceV2.getAuctionInfo(parseInt(auction.id));
        if (auctionData) {
          // Parse Leo format
          let parsed;
          if (typeof auctionData === 'string') {
            const sellerMatch = auctionData.match(/seller:\s*([a-z0-9]+)/);
            const winnerMatch = auctionData.match(/winner:\s*([a-z0-9]+)/);
            const winningAmountMatch = auctionData.match(/winning_amount:\s*(\d+)u128/);
            const totalEscrowedMatch = auctionData.match(/total_escrowed_usdx:\s*(\d+)u128/);
            const stateMatch = auctionData.match(/state:\s*(\d+)u8/);
            
            parsed = {
              seller: sellerMatch ? sellerMatch[1] : null,
              winner: winnerMatch ? winnerMatch[1] : null,
              winning_amount: winningAmountMatch ? winningAmountMatch[1] : '0',
              total_escrowed_usdx: totalEscrowedMatch ? totalEscrowedMatch[1] : '0',
              state: stateMatch ? stateMatch[1] : '0'
            };
            
            // NEW: Detect currency
            const detectedCurrency = AleoServiceV2.getAuctionCurrency(auctionData);
            setCurrency(detectedCurrency);
          } else {
            parsed = auctionData;
            // NEW: Detect currency
            const detectedCurrency = AleoServiceV2.getAuctionCurrency(auctionData);
            setCurrency(detectedCurrency);
          }
          
          setAuctionStats(parsed);
          
          // Sync status from on-chain to localStorage
          const onChainState = parseInt(parsed.state);
          const newStatus = mapStateToStatus(onChainState);
          if (auction.status !== newStatus) {
            updateAuctionStatus(auction.id, newStatus);
          }
          
          // Determine user role
          const currentAddr = address?.toLowerCase();
          const sellerAddr = parsed.seller?.toLowerCase();
          const winnerAddr = parsed.winner?.toLowerCase();
          
          if (currentAddr === sellerAddr) {
            setUserRole('seller');
          } else if (winnerAddr && currentAddr === winnerAddr) {
            setUserRole('winner');
          } else {
            setUserRole('other');
          }
        }
      }
    };
    
    fetchStats();
  }, [auction?.id, address, auction?.status, updateAuctionStatus]);

  // Get bids for this auction from localStorage
  const localBids = auction ? getBidsForAuction(auction.id) : [];
  const bids = localBids.map(bid => ({
    bidder: 'You',
    amount: `${bid.amount} credits`,
    status: 'committed'
  }));

  if (!auction) {
    return (
      <Card className="mx-auto max-w-xl" data-testid="auction-not-found-card">
        <CardHeader>
          <CardTitle data-testid="auction-not-found-title">Auction not found</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild data-testid="auction-not-found-back-button">
            <Link to="/auctions">Back to auction list</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" data-testid="auction-detail-page">
      <div className="space-y-6 lg:col-span-2">

        {/* Hero */}
        <Card className="overflow-hidden" data-testid="auction-detail-hero-card">
          <div className="aspect-[16/8] w-full overflow-hidden">
            <img
              src={auction.image}
              alt={auction.title}
              className="h-full w-full object-cover object-center"
              data-testid="auction-detail-image"
            />
          </div>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white" data-testid="auction-detail-title">
                {auction.title}
              </h1>
              <StatusBadge status={auction.status} testId="auction-detail-status" />
            </div>
            <p className="mt-3 text-sm text-slate-300 md:text-base" data-testid="auction-detail-description">
              {auction.description}
            </p>
          </CardContent>
        </Card>

        {/* Phase Timeline */}
        <Card data-testid="auction-detail-phase-card">
          <CardHeader>
            <CardTitle>Auction Phase</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <AuctionPhaseTimeline status={auction.status} />
          </CardContent>
        </Card>

        {/* Specs */}
        <Card data-testid="auction-detail-spec-card">
          <CardHeader>
            <CardTitle data-testid="auction-detail-spec-title">Auction Specifications</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Auction ID</p>
              <p className="mt-1 font-mono text-sm text-white">{auction.id}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Category</p>
              <p className="mt-1 font-medium text-white">{auction.category}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Minimum Bid</p>
              <p className="mt-1 text-lg font-bold text-indigo-400">{auction.minBid}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">End Block</p>
              <p className="mt-1 font-mono text-sm text-white">{auction.endBlock}</p>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-300">{auction.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-300">{auction.seller}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-300">Close: {auction.closingDate}</span>
            </div>
          </CardContent>
        </Card>

        {/* Winner — only when settled */}
        {auction.status === 'settled' && (
          <Card className="border-amber-500/30 bg-gradient-to-br from-amber-950/40 to-slate-800/80" data-testid="auction-detail-winner-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-300">
                <Trophy className="h-5 w-5" />
                Winner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {winnerLoading ? (
                <p className="text-sm text-slate-400">Fetching winner from chain...</p>
              ) : winner ? (
                <>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Winner Address</p>
                  <p className="font-mono text-sm text-amber-200 break-all">{winner}</p>
                  {highestBid !== null && (
                    <p className="text-sm text-slate-300">
                      Winning Bid:{' '}
                      <span className="font-semibold text-white">
                        {highestBid.toLocaleString('en-US', { maximumFractionDigits: 2 })} credits
                      </span>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  Winner not yet recorded on-chain for this auction.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Panel */}
      <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        {/* On-Chain Verification */}
        <OnChainAuctionInfo auctionId={auction.id} />

        {/* Auction Statistics - Only show when winner determined */}
        {auctionStats && parseInt(auctionStats.state) >= 2 && (
          <Card className="border-indigo-500/20 bg-indigo-950/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-indigo-300">
                <TrendingUp className="h-4 w-4" />
                Auction Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Winning Bid - Prominent */}
              <div className="rounded-lg border border-green-500/30 bg-green-950/40 p-4">
                <p className="text-xs uppercase tracking-wider text-green-400 mb-1">Winning Bid</p>
                <p className="text-3xl font-bold text-green-100">
                  {(parseInt(auctionStats.winning_amount) / 1_000_000).toLocaleString()} {AleoServiceV2.getCurrencyLabel(currency)}
                </p>
              </div>

              {/* User-specific Info */}
              {userRole === 'winner' && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-950/40 p-3 text-center">
                  <p className="text-sm font-semibold text-amber-200">🏆 You Won!</p>
                </div>
              )}
              
              {userRole === 'seller' && (
                <div className="rounded-lg border border-purple-500/20 bg-purple-950/30 p-3">
                  <p className="text-xs text-purple-400 mb-1">Winner Address</p>
                  <p className="font-mono text-xs text-purple-200 break-all">
                    {auctionStats.winner?.substring(0, 12)}...{auctionStats.winner?.substring(auctionStats.winner.length - 8)}
                  </p>
                </div>
              )}

              {/* Total Escrowed - Secondary info */}
              <div className="pt-2 border-t border-slate-700/50">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-slate-400">Total Escrowed</p>
                  <p className="text-sm font-semibold text-slate-200">
                    {(parseInt(auctionStats.total_escrowed_usdx) / 1_000_000).toLocaleString()} {AleoServiceV2.getCurrencyLabel(currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bidding Actions - Only show when auction is active */}
        {auction.status !== 'settled' && (
          <Card data-testid="auction-detail-control-panel-card">
            <CardHeader>
              <CardTitle className="text-base" data-testid="auction-detail-control-panel-title">
                Place Your Bid
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-950/30 p-3">
                <p className="text-xs text-slate-400">Minimum Bid</p>
                <p className="text-xl font-bold text-indigo-300">{auction.minBid}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-slate-400">Total Bids</p>
                  <p className="font-semibold text-white">{auction.bids}</p>
                </div>
                <div>
                  <p className="text-slate-400">Highest</p>
                  <p className="font-semibold text-white">{auction.highestBid}</p>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <Button asChild className="w-full" data-testid="auction-detail-submit-bid-button">
                  <Link to="/commit-bid">Commit Bid</Link>
                </Button>
                <Button asChild variant="outline" className="w-full" data-testid="auction-detail-reveal-bid-button">
                  <Link to="/reveal-bid">Reveal Bid</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bid History - Only show if there are bids */}
        {bids.length > 0 && (
          <Card data-testid="auction-detail-history-card">
            <CardHeader>
              <CardTitle className="text-base" data-testid="auction-detail-history-title">
                Your Bids
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {bids.map((bid, index) => (
                <div
                  key={`${bid.bidder}-${index}`}
                  className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3"
                  data-testid={`auction-detail-history-item-${index}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-white">{bid.bidder}</p>
                    <ZkPrivacyIndicator state={zkStateFromBidStatus(bid.status)} showLabel={false} />
                  </div>
                  <p className="text-xs text-slate-400">
                    {bid.status === 'committed' ? '••••• (sealed)' : bid.amount}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
