import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as AleoServiceV2 from '@/services/aleoServiceV2';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { fetchAuctionInfo, validateAction, getStateDescription } from '@/utils/auctionStateValidator';
import { UnrevealedBidsList } from '@/components/bid/UnrevealedBidsList';

export default function RevealBidPageV2() {
  const { connected, executeTransaction, address } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auctionId, setAuctionId] = useState('');
  const [commitmentData, setCommitmentData] = useState(null);
  const [auctionInfo, setAuctionInfo] = useState(null);
  const [isLoadingAuction, setIsLoadingAuction] = useState(false);
  const normalizedRevealStatus = typeof commitmentData?.revealStatus === 'string'
    ? commitmentData.revealStatus.trim().toLowerCase()
    : '';
  const isRevealPending = normalizedRevealStatus.includes('pending')
    || normalizedRevealStatus.includes('submitted')
    || normalizedRevealStatus.includes('checking');
  const isAlreadyRevealed = commitmentData?.revealed === true
    || Number(commitmentData?.revealedAt || commitmentData?.revealConfirmedAt || 0) > 0
    || normalizedRevealStatus === 'confirmed'
    || normalizedRevealStatus === 'revealed';

  const loadAuctionInfo = useCallback(async () => {
    if (!auctionId) return;
    
    setIsLoadingAuction(true);
    try {
      const result = await fetchAuctionInfo(parseInt(auctionId));
      if (result.error) {
        if (result.notFound) {
          toast.error('Auction not found on-chain');
        } else {
          console.error('[RevealBid] Failed to fetch auction:', result.error);
        }
        setAuctionInfo(null);
      } else {
        setAuctionInfo(result.auction);
      }
    } catch (error) {
      console.error('[RevealBid] Error loading auction:', error);
    } finally {
      setIsLoadingAuction(false);
    }
  }, [auctionId]);

  useEffect(() => {
    if (auctionId && address) {
      const data = AleoServiceV2.getCommitmentData(parseInt(auctionId), address);
      setCommitmentData(data?.status === 'confirmed' ? data : null);
      
      // Fetch auction state
      void loadAuctionInfo();
    }
  }, [auctionId, address, loadAuctionInfo]);

  const handleRevealBid = async () => {
    console.log('[RevealBid] Starting reveal bid (V2)');
    
    if (!connected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!auctionId) {
      toast.error('Please enter auction ID');
      return;
    }
    
    // Validate auction state
    if (!auctionInfo) {
      toast.error('Please wait for auction info to load');
      return;
    }
    
    const validation = validateAction('reveal_bid', auctionInfo.state);
    if (!validation.valid) {
      toast.error(validation.message);
      toast.info(`Current state: ${validation.currentState}, Required: ${validation.requiredState}`);
      return;
    }

    const auctionIdNum = parseInt(auctionId);
    const nonce = AleoServiceV2.getNonce(auctionIdNum, address);
    
    if (!nonce) {
      toast.error('Nonce not found! Did you commit a bid for this auction with this wallet?');
      return;
    }

    if (!commitmentData) {
      toast.error('Commitment data not found!');
      return;
    }

    if (isAlreadyRevealed) {
      toast.info('This bid is already revealed on-chain.');
      return;
    }

    if (isRevealPending) {
      toast.info('Reveal is already submitted and still waiting for confirmation.');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('[RevealBid] Reveal params:', {
        auctionId: auctionIdNum,
        amountUsdx: commitmentData.amountUsdx,
        nonce: nonce.substring(0, 20) + '...'
      });

      toast.info('Revealing bid on blockchain...');
      
      const result = await AleoServiceV2.revealBid(
        executeTransaction,
        auctionIdNum,
        commitmentData.amountUsdx,
        nonce
      );

      console.log('[RevealBid] Transaction result:', result);

      const revealTransactionId = result?.transactionId || null;
      const revealExplorerTransactionId = typeof result?.explorerTransactionId === 'string' && result.explorerTransactionId.startsWith('at1')
        ? result.explorerTransactionId
        : typeof revealTransactionId === 'string' && revealTransactionId.startsWith('at1')
          ? revealTransactionId
          : null;

      if (revealTransactionId) {
        AleoServiceV2.updateCommitmentData(auctionIdNum, address, {
          revealed: false,
          revealStatus: 'pending-confirmation',
          revealSubmittedAt: Date.now(),
          revealTransactionId: revealExplorerTransactionId || revealTransactionId,
          revealWalletTransactionId: revealTransactionId,
          revealExplorerTransactionId,
          revealError: null,
        });

        const refreshedCommitment = AleoServiceV2.getCommitmentData(auctionIdNum, address);
        setCommitmentData(refreshedCommitment?.status === 'confirmed' ? refreshedCommitment : null);
      }

      toast.success(`Reveal submitted${revealTransactionId ? `: ${revealTransactionId.slice(0, 12)}...` : ''}`);
      toast.info('Explorer confirmation may still be pending. The reveal button will stay locked meanwhile.');
      
      // Reload auction info
      await loadAuctionInfo();

    } catch (error) {
      console.error('[RevealBid] Error:', error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          Reveal Bid
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Disclose your bid amount after auction closes
        </p>
      </div>

      {/* Unrevealed Bids List */}
      <UnrevealedBidsList onSelectAuction={(id) => setAuctionId(id.toString())} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reveal Details</CardTitle>
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

          {commitmentData && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-950/30 p-3">
              <h3 className="text-sm font-semibold text-blue-200 mb-1">📋 Your Commitment</h3>
              <div className="text-sm text-blue-100">
                <p>Amount: {commitmentData.amountUsdx / 1_000_000} {commitmentData.currency ? AleoServiceV2.getCurrencyLabel(commitmentData.currency) : 'tokens'}</p>
                <p>Committed: {new Date(commitmentData.timestamp).toLocaleString()}</p>
                <p>Reveal: {isAlreadyRevealed ? 'confirmed' : isRevealPending ? 'pending confirmation' : 'not submitted'}</p>
              </div>
            </div>
          )}
          
          {auctionInfo && (
            <div className={`rounded-lg border p-3 ${
              auctionInfo.state === 1 
                ? 'border-green-500/20 bg-green-950/30' 
                : 'border-amber-500/20 bg-amber-950/30'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {getStateDescription(auctionInfo.state).icon}
                <span className={`text-sm font-semibold ${auctionInfo.state === 1 ? 'text-green-200' : 'text-amber-200'}`}>
                  {auctionInfo.stateName}
                </span>
              </div>
              <div className={`text-sm ${auctionInfo.state === 1 ? 'text-green-100' : 'text-amber-100'}`}>
                {auctionInfo.state !== 1 && (
                  <p className="font-medium">⚠️ {validateAction('reveal_bid', auctionInfo.state).message}</p>
                )}
              </div>
            </div>
          )}
          
          {isLoadingAuction && (
            <div className="rounded-lg border border-slate-500/20 bg-slate-950/30 p-2">
              <p className="text-sm text-slate-300">🔄 Loading auction...</p>
            </div>
          )}

          {!commitmentData && auctionId && !isLoadingAuction && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-950/30 p-2">
              <p className="text-sm text-amber-200">⚠️ No commitment found. Did you commit a bid?</p>
            </div>
          )}

          <Button
            onClick={handleRevealBid}
            disabled={isSubmitting || !connected || !commitmentData || !auctionInfo || auctionInfo.state !== 1 || isAlreadyRevealed || isRevealPending}
            className="w-full"
          >
            {isSubmitting ? 'Revealing...' : isAlreadyRevealed ? 'Already Revealed' : isRevealPending ? 'Reveal Pending...' : 'Reveal Bid'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
