import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { BidActivityChart } from "@/components/dashboard/BidActivityChart";
import { MyBidsCard } from "@/components/bid/MyBidsCard";
import { FeatureBadges } from "@/components/demo/FeatureBadges";
import { UnrevealedBidsAlert } from "@/components/notifications/UnrevealedBidsAlert";
import { useAleoBalance } from "@/hooks/useAleoBalance";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { useTxHistory } from "@/hooks/useTxHistory";
import { useLocalAuctions } from "@/hooks/useLocalAuctions";
import { useLocalBids } from "@/hooks/useLocalBids";
import { RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import * as AleoServiceV2 from "@/services/aleoServiceV2";

export default function DashboardPage() {
  const { auctions } = useLocalAuctions();
  const { bids } = useLocalBids();
  const recentAuctions = auctions.slice(0, 5);
  const { formatted, loading } = useAleoBalance();
  const { connected } = useWallet();
  const { txHistory, loading: txLoading, refresh } = useTxHistory();
  const [winnersData, setWinnersData] = useState([]);

  const chartData = auctions.map((a) => ({ label: a.id, bids: a.bids }));
  
  // Calculate real KPIs from user data
  const activeAuctionsCount = auctions.filter(a => a.status === 'active').length;
  const totalBidsCount = bids.length;
  const pendingSettlementsCount = auctions.filter(
    (auction) => auction.status === 'closed' || auction.status === 'challenge' || auction.status === 'disputed'
  ).length;
  const settledAuctions = auctions.filter(a => a.status === 'settled').slice(0, 3);

  // Fetch winner data for settled auctions
  useEffect(() => {
    const fetchWinnersData = async () => {
      const winnersInfo = await Promise.all(
        settledAuctions.map(async (auction) => {
          try {
            const auctionInfo = await AleoServiceV2.getAuctionInfo(parseInt(auction.id));
            if (auctionInfo) {
              let parsedData;
              if (typeof auctionInfo === 'string') {
                const winnerMatch = auctionInfo.match(/winner:\s*([a-z0-9]+)/);
                const winningAmountMatch = auctionInfo.match(/winning_amount:\s*(\d+)u128/);
                const currencyTypeMatch = auctionInfo.match(/currency_type:\s*(\d+)u8/);
                
                parsedData = {
                  winner: winnerMatch ? winnerMatch[1] : null,
                  winning_amount: winningAmountMatch ? winningAmountMatch[1] : '0',
                  currency_type: currencyTypeMatch ? parseInt(currencyTypeMatch[1]) : 0
                };
              } else {
                parsedData = auctionInfo;
              }
              
              return {
                ...auction,
                winner: parsedData.winner,
                winningAmount: parseInt(parsedData.winning_amount) / 1_000_000,
                currency: parsedData.currency_type === 1 ? 'aleo' : 'usdc'
              };
            }
            return { ...auction, winner: null, winningAmount: 0, currency: 'usdc' };
          } catch (error) {
            console.error(`Error fetching winner data for auction ${auction.id}:`, error);
            return { ...auction, winner: null, winningAmount: 0, currency: 'usdc' };
          }
        })
      );
      setWinnersData(winnersInfo);
    };

    if (settledAuctions.length > 0) {
      fetchWinnersData();
    }
  }, [settledAuctions.length]);
  
  const kpiData = [
    { 
      label: "Active Auctions", 
      value: activeAuctionsCount.toString(), 
      delta: auctions.length > 0 ? `${auctions.length} total` : "Create your first",
      color: "indigo"
    },
    { 
      label: "Your Bids", 
      value: totalBidsCount.toString(), 
      delta: totalBidsCount > 0 ? "Committed" : "No bids yet",
      color: "purple"
    },
    { 
      label: "Pending", 
      value: pendingSettlementsCount.toString(), 
      delta: pendingSettlementsCount > 0 ? "Need action" : "All settled",
      color: "amber"
    },
    { 
      label: "Settled", 
      value: settledAuctions.length.toString(), 
      delta: "Completed",
      color: "green"
    },
  ];

  return (
    <div className="space-y-12" data-testid="dashboard-page">
      {/* Hero Section - Modern Bold Design */}
      <section className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 p-8 md:p-16">
        {/* Background Glow Effect */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-4xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-950/30 px-4 py-2 text-sm mb-6">
            <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="font-semibold uppercase tracking-wider text-purple-300">
              Live on Aleo Testnet
            </span>
          </div>

          {/* Main Heading */}
          <div className="mb-6">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-tight">
              Sealed Bids.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                Zero Knowledge.
              </span>
            </h1>
          </div>

          {/* Description */}
          <p className="text-xl text-slate-300 max-w-2xl mb-8">
            The first sealed-bid auction where your bids are{' '}
            <span className="text-purple-400 font-semibold">cryptographically invisible</span>.
            Built on Aleo with zero-knowledge proofs.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 mb-12">
            <Button 
              asChild 
              size="lg"
              className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20"
            >
              <Link to="/create" className="gap-2">
                <span>Start Bidding</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button 
              asChild 
              variant="outline" 
              size="lg"
              className="border-slate-700 hover:bg-slate-800"
            >
              <Link to="/how-it-works">How It Works</Link>
            </Button>
          </div>

          {/* Feature Badges */}
          <FeatureBadges />
        </div>
      </section>

      {/* Unrevealed Bids Alert */}
      <UnrevealedBidsAlert />

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4" data-testid="dashboard-kpi-grid">
        {kpiData.map((kpi, index) => (
          <div 
            key={kpi.label} 
            className={`rounded-xl border p-4 ${
              kpi.color === 'indigo' ? 'border-indigo-500/20 bg-indigo-950/30' :
              kpi.color === 'purple' ? 'border-purple-500/20 bg-purple-950/30' :
              kpi.color === 'amber' ? 'border-amber-500/20 bg-amber-950/30' :
              'border-green-500/20 bg-green-950/30'
            }`}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <p className="text-xs text-slate-400">{kpi.label}</p>
            <p className="mt-2 text-3xl font-bold text-white">{kpi.value}</p>
            <p className="mt-1 text-xs text-slate-400">{kpi.delta}</p>
          </div>
        ))}
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Auctions - 2 columns */}
        <Card className="lg:col-span-2" data-testid="dashboard-recent-auctions-card">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle data-testid="dashboard-recent-auctions-title">Recent Auctions</CardTitle>
            <Button asChild variant="ghost" size="sm" data-testid="dashboard-recent-auctions-link">
              <Link to="/auctions" className="text-indigo-400 hover:text-indigo-300">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentAuctions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 mb-4">No auctions yet. Create your first auction!</p>
                <Button asChild size="sm">
                  <Link to="/create">Create Auction</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentAuctions.map((auction) => (
                  <Link
                    key={auction.id}
                    to={`/auctions/${auction.id}`}
                    className="block rounded-lg border border-slate-700/50 bg-slate-800/30 p-4 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{auction.title}</h3>
                        <p className="text-xs text-slate-400 mt-1 font-mono">{auction.id}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={auction.status} />
                        <p className="text-xs text-slate-400">{auction.closingDate}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Winners - 1 column */}
        <Card data-testid="dashboard-winners-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              Recent Winners
            </CardTitle>
          </CardHeader>
          <CardContent>
            {settledAuctions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400">No settled auctions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {winnersData.length > 0 ? (
                  winnersData.map((auction) => (
                    <div
                      key={auction.id}
                      className="rounded-lg border border-green-500/20 bg-green-950/20 p-3"
                    >
                      <p className="text-sm font-semibold text-green-200 truncate">{auction.title}</p>
                      <p className="text-xs text-green-300/70 mt-1 font-mono">{auction.id}</p>
                      {auction.winner && (
                        <div className="mt-2 pt-2 border-t border-green-500/20">
                          <p className="text-xs text-green-400 mb-1">🏆 Winner</p>
                          <p className="text-xs text-green-300 font-mono truncate">{auction.winner}</p>
                          <p className="text-sm text-green-200 font-semibold mt-1">
                            Bid: {auction.winningAmount} {AleoServiceV2.getCurrencyLabel(auction.currency)}
                          </p>
                        </div>
                      )}
                      {!auction.winner && (
                        <div className="mt-2 pt-2 border-t border-green-500/20">
                          <p className="text-xs text-green-400">✓ Settled</p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  settledAuctions.map((auction) => (
                    <div
                      key={auction.id}
                      className="rounded-lg border border-green-500/20 bg-green-950/20 p-3"
                    >
                      <p className="text-sm font-semibold text-green-200 truncate">{auction.title}</p>
                      <p className="text-xs text-green-300/70 mt-1 font-mono">{auction.id}</p>
                      <div className="mt-2 pt-2 border-t border-green-500/20">
                        <p className="text-xs text-green-400">✓ Settled</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* My Bids */}
      <MyBidsCard />

      {/* Bid Activity Chart */}
      <section data-testid="dashboard-chart-section">
        <Card>
          <CardHeader>
            <CardTitle>Bid Activity</CardTitle>
            <p className="text-xs text-slate-400">Sealed commitments per auction</p>
          </CardHeader>
          <CardContent>
            <BidActivityChart data={chartData} />
          </CardContent>
        </Card>
      </section>

      {/* TX History */}
      {connected && (
        <section data-testid="dashboard-tx-history-section">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Recent Transactions</CardTitle>
              <Button variant="ghost" size="icon" onClick={refresh} disabled={txLoading}>
                <RefreshCw className={`h-4 w-4 ${txLoading ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>
            <CardContent>
              {txHistory.length > 0 ? (
                <div className="space-y-2">
                  {txHistory.slice(0, 5).map((tx) => (
                    <a
                      key={tx.transactionId ?? tx.id}
                      href={`https://explorer.provable.com/transaction/${tx.transactionId ?? tx.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 hover:bg-slate-800/50 transition-colors"
                    >
                      <p className="font-mono text-xs text-slate-300 truncate">
                        {tx.transactionId ?? tx.id}
                      </p>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  Load transaction history on demand to avoid extra wallet approval prompts immediately after connect.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
