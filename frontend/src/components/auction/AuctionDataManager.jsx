import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Info } from 'lucide-react';
import { useLocalAuctions } from '@/hooks/useLocalAuctions';
import { useLocalBids } from '@/hooks/useLocalBids';
import { toast } from '@/components/ui/sonner';

export function AuctionDataManager() {
  const { auctions, clearAuctions } = useLocalAuctions();
  const { bids, clearBids } = useLocalBids();

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all local data? This includes your auctions and bids. This cannot be undone.')) {
      clearAuctions();
      clearBids();
      toast.success('All local data cleared');
    }
  };

  return (
    <Card className="border-indigo-500/20 bg-indigo-950/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-indigo-400" />
          <CardTitle>Local Data Storage</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-300">
          Your auctions and bids are stored locally in your browser for easy reference. 
          This data is not synced across devices.
        </p>
        
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
          <div>
            <p className="text-xs text-slate-400">Auctions Created</p>
            <p className="text-lg font-semibold text-white">{auctions.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Bids Submitted</p>
            <p className="text-lg font-semibold text-white">{bids.length}</p>
          </div>
        </div>

        {(auctions.length > 0 || bids.length > 0) && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClearAll}
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All Local Data
          </Button>
        )}

        <div className="rounded-lg border border-amber-500/20 bg-amber-950/30 p-3">
          <p className="text-xs text-amber-200">
            💡 Note: Clearing local data does not affect your on-chain transactions. 
            Your auctions and bids remain on the blockchain.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
