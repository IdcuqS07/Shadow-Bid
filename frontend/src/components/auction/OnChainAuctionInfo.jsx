import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { useAuctionInfo } from '@/hooks/useAuctionInfo';

export function OnChainAuctionInfo({ auctionId }) {
  const { auctionInfo, loading, error, refresh } = useAuctionInfo(auctionId);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>On-Chain Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">Loading auction data from blockchain...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !auctionInfo) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>On-Chain Status</CardTitle>
          <Button variant="ghost" size="icon" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">
            {error ? `Error: ${error}` : 'Auction not found on-chain. It may not be created yet.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { seller, min_bid, end_block, is_closed, is_settled } = auctionInfo;
  const minBidCredits = (parseInt(min_bid) / 1_000_000).toFixed(2);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>On-Chain Status</CardTitle>
        <Button variant="ghost" size="icon" onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Seller</p>
            <p className="mt-1 font-mono text-xs text-white break-all">{seller}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Min Bid</p>
            <p className="mt-1 font-semibold text-white">{minBidCredits} credits</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">End Block</p>
            <p className="mt-1 font-mono text-sm text-white">{end_block}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Status</p>
            <div className="mt-1 flex gap-2">
              <div className="flex items-center gap-1">
                {is_closed ? (
                  <CheckCircle2 className="h-3 w-3 text-green-400" />
                ) : (
                  <XCircle className="h-3 w-3 text-slate-500" />
                )}
                <span className="text-xs text-slate-300">Closed</span>
              </div>
              <div className="flex items-center gap-1">
                {is_settled ? (
                  <CheckCircle2 className="h-3 w-3 text-green-400" />
                ) : (
                  <XCircle className="h-3 w-3 text-slate-500" />
                )}
                <span className="text-xs text-slate-300">Settled</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
