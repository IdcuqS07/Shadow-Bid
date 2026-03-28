import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { useAuctionInfo } from '@/hooks/useAuctionInfo';

const STATE_LABELS = {
  0: 'OPEN',
  1: 'CLOSED',
  2: 'CHALLENGE',
  3: 'SETTLED',
  4: 'CANCELLED',
  5: 'DISPUTED',
};

function parseNumericValue(value) {
  if (value == null) {
    return null;
  }

  const parsed = Number.parseInt(String(value).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

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

  const seller = auctionInfo?.seller || 'Unknown';
  const minBidAmount = parseNumericValue(auctionInfo?.min_bid_amount);
  const endTime = parseNumericValue(auctionInfo?.end_time);
  const revealDeadline = parseNumericValue(auctionInfo?.reveal_deadline);
  const disputeDeadline = parseNumericValue(auctionInfo?.dispute_deadline);
  const state = parseNumericValue(auctionInfo?.state);
  const stateLabel = STATE_LABELS[state] || 'UNKNOWN';
  const minBidCredits = minBidAmount !== null ? (minBidAmount / 1_000_000).toFixed(2) : '0.00';

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
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">End Time</p>
            <p className="mt-1 font-mono text-sm text-white">{endTime ?? 'Not set'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Status</p>
            <div className="mt-1 flex gap-2">
              <div className="flex items-center gap-1">
                {state >= 1 ? (
                  <CheckCircle2 className="h-3 w-3 text-green-400" />
                ) : (
                  <XCircle className="h-3 w-3 text-slate-500" />
                )}
                <span className="text-xs text-slate-300">Closed</span>
              </div>
              <div className="flex items-center gap-1">
                {state === 3 ? (
                  <CheckCircle2 className="h-3 w-3 text-green-400" />
                ) : (
                  <XCircle className="h-3 w-3 text-slate-500" />
                )}
                <span className="text-xs text-slate-300">Settled</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">State</p>
            <p className="mt-1 font-mono text-sm text-white">{stateLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Reveal Deadline</p>
            <p className="mt-1 font-mono text-sm text-white">{revealDeadline ?? 'Not set'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Dispute Deadline</p>
            <p className="mt-1 font-mono text-sm text-white">{disputeDeadline ?? 'Not set'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
