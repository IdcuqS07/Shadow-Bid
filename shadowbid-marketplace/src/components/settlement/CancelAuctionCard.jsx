import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import * as AleoServiceV2 from '@/services/aleoServiceV2';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { useLocalAuctions } from '@/hooks/useLocalAuctions';

export default function CancelAuctionCard() {
  const { connected, executeTransaction } = useWallet();
  const { updateAuctionStatus } = useLocalAuctions();
  const [auctionId, setAuctionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCancelAuction = async () => {
    if (!connected) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!auctionId) {
      toast.error('Please enter auction ID');
      return;
    }

    setIsSubmitting(true);
    try {
      const auctionIdNum = parseInt(auctionId);
      
      toast.info('Cancelling auction...');
      
      const result = await AleoServiceV2.cancelAuction(
        executeTransaction,
        auctionIdNum
      );

      toast.success(`Auction cancelled! TX: ${result?.transactionId?.slice(0, 12)}...`);
      
      // Update status in localStorage
      updateAuctionStatus(auctionId, 'cancelled');
      
      setAuctionId('');

    } catch (error) {
      console.error('[CancelAuction] Error:', error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cancel Auction</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="auction-id">Auction ID</Label>
          <Input
            id="auction-id"
            value={auctionId}
            onChange={(e) => setAuctionId(e.target.value)}
            placeholder="e.g. 1234567890"
            type="number"
          />
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-amber-950/30 p-2">
          <p className="text-sm text-amber-200">
            ⚠️ Only if no bids placed yet
          </p>
        </div>

        <Button
          onClick={handleCancelAuction}
          disabled={isSubmitting || !connected}
          className="w-full"
          variant="destructive"
        >
          {isSubmitting ? 'Cancelling...' : 'Cancel Auction'}
        </Button>
      </CardContent>
    </Card>
  );
}
