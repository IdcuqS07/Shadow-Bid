import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ExternalLink } from 'lucide-react';
import { useLocalBids } from '@/hooks/useLocalBids';
import { toast } from '@/components/ui/sonner';

export function MyBidsCard() {
  const { bids, clearBids } = useLocalBids();

  const handleClearBids = () => {
    if (confirm('Are you sure you want to clear all locally stored bids? This cannot be undone.')) {
      clearBids();
      toast.success('All bids cleared');
    }
  };

  if (bids.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Bids</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">
            No bids submitted yet. Your bids will be saved here for reference.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>My Bids ({bids.length})</CardTitle>
        <Button variant="ghost" size="sm" onClick={handleClearBids}>
          <Trash2 className="h-4 w-4 mr-1" />
          Clear All
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {bids.map((bid, index) => (
          <div
            key={`${bid.auctionId}-${bid.timestamp}`}
            className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">Auction #{bid.auctionId}</p>
              <p className="text-xs text-slate-500">
                {new Date(bid.timestamp).toLocaleDateString()}
              </p>
            </div>
            <p className="text-sm font-semibold text-white">
              {bid.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} credits
            </p>
            {bid.txId && (
              <a
                href={`https://testnet.explorer.provable.com/transaction/${bid.txId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
              >
                View TX <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ))}
        <div className="rounded-lg border border-indigo-500/20 bg-indigo-950/30 p-3">
          <p className="text-xs text-indigo-200">
            💡 These bids are stored locally in your browser. Your actual bid amounts are private on-chain.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
