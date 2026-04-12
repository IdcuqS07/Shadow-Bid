import { useState, useEffect } from 'react';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as AleoServiceV2 from '@/services/aleoServiceV2';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { fetchAuctionInfo, validateAction, getStateDescription } from '@/utils/auctionStateValidator';


export default function CommitBidPageV2() {
  const { connected, executeTransaction, address } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    auctionId: '',
    bidAmount: '',
  });
  const [commitmentInfo, setCommitmentInfo] = useState(null);
  const [auctionInfo, setAuctionInfo] = useState(null);
  const [currency, setCurrency] = useState(null);  // NEW: Track currency
  const [isLoadingAuction, setIsLoadingAuction] = useState(false);

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  
  // Load auction info when auction ID changes
  useEffect(() => {
    if (form.auctionId) {
      loadAuctionInfo();
    } else {
      setAuctionInfo(null);
    }
  }, [form.auctionId]);
  
  const loadAuctionInfo = async () => {
    if (!form.auctionId) return;
    
    setIsLoadingAuction(true);
    try {
      const result = await fetchAuctionInfo(parseInt(form.auctionId));
      if (result.error) {
        if (result.notFound) {
          toast.error('Auction not found on-chain');
        } else {
          console.error('[CommitBid] Failed to fetch auction:', result.error);
        }
        setAuctionInfo(null);
        setCurrency(null);
      } else {
        setAuctionInfo(result.auction);
        // NEW: Detect currency from currency_type field
        const detectedCurrency = result.auction.currency_type === 1 ? 'aleo' : 'usdcx';
        setCurrency(detectedCurrency);
        console.log('[CommitBid] Detected currency:', detectedCurrency, 'currency_type:', result.auction.currency_type);
      }
    } catch (error) {
      console.error('[CommitBid] Error loading auction:', error);
    } finally {
      setIsLoadingAuction(false);
    }
  };

  const handleCommitBid = async () => {
    console.log('[CommitBid] Starting commit bid (V2.14 - Dual Currency)');
    
    if (!connected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!form.auctionId || !form.bidAmount) {
      toast.error('Please fill all fields');
      return;
    }
    
    if (!auctionInfo || !currency) {
      toast.error('Please wait for auction info to load');
      return;
    }
    
    const validation = validateAction('commit_bid', auctionInfo.state);
    if (!validation.valid) {
      toast.error(validation.message);
      toast.info(`Current state: ${validation.currentState}, Required: ${validation.requiredState}`);
      return;
    }

    if (auctionInfo.seller?.toLowerCase() === address?.toLowerCase()) {
      toast.error('Seller wallet cannot place a bid on its own auction');
      return;
    }

    setIsSubmitting(true);
    try {
      const auctionId = parseInt(form.auctionId);
      const bidAmount = Math.round(parseFloat(form.bidAmount) * 1_000_000);
      const currencyLabel = AleoServiceV2.getCurrencyLabel(currency);

      // Generate nonce; the contract derives the commitment on-chain.
      const nonce = AleoServiceV2.generateNonce();

      console.log('[CommitBid] Commit params:', {
        auctionId,
        bidAmount,
        currency,
        nonce: nonce.substring(0, 20) + '...'
      });

      // Route to correct function based on currency
      let result;
      if (currency === 'aleo') {
        // TWO-STEP PROCESS for Aleo (same as old USDC approach)
        console.log('[CommitBid] Starting two-step commit for Aleo');
        
        // Step 1: Transfer Aleo credits to contract
        toast.info('Step 1/2: Transferring Aleo credits...');
        toast.info('⚠️ Please approve the first transaction');
        
        const contractAddress = AleoServiceV2.PROGRAM_ID;
        
        console.log('[CommitBid] Step 1: Transfer params:', {
          to: contractAddress,
          amount: bidAmount
        });
        
        const transferResult = await executeTransaction({
          program: 'credits.aleo',
          function: 'transfer_public',
          inputs: [contractAddress, `${bidAmount}u64`],
          fee: 1_000_000,
          privateFee: false
        });
        
        console.log('[CommitBid] Step 1 result:', transferResult);
        
        if (!transferResult?.transactionId) {
          throw new Error('Step 1 failed: Credits transfer rejected or failed');
        }
        
        toast.success(`✅ Step 1 complete! TX: ${transferResult.transactionId.slice(0, 12)}...`);
        
        // Step 2: Record commitment (no transfer in contract)
        toast.info('Step 2/2: Recording commitment...');
        toast.info('⚠️ Please approve the second transaction');
        
        console.log('[CommitBid] Step 2: Commit params:', {
          auctionId,
          nonce: `${nonce.substring(0, 20)}...`,
          bidAmount
        });
        
        result = await AleoServiceV2.commitBidAleo(
          executeTransaction,
          auctionId,
          nonce,
          bidAmount
        );
        
        console.log('[CommitBid] Step 2 result:', result);
        
      } else {
        // USDC - single transaction (uses transfer_public_as_signer)
        console.log('[CommitBid] Using commit_bid (USDCx)');
        toast.info(`Committing bid with ${currencyLabel}...`);
        toast.info('⚠️ Please approve the transaction in your wallet');
        
        result = await AleoServiceV2.commitBid(
          executeTransaction,
          auctionId,
          nonce,
          bidAmount
        );
      }

      console.log('[CommitBid] Result:', result);

      // Save nonce and commitment locally with currency
      AleoServiceV2.saveNonce(auctionId, nonce, address);
      AleoServiceV2.saveCommitment(auctionId, null, bidAmount, address, currency, {
        transactionId: result?.transactionId,
        commitmentMode: 'contract-derived',
      });
      
      // Save currency to localStorage for this bid
      const bidData = {
        auctionId,
        bidAmount: form.bidAmount,
        currency,  // NEW
        txId: result?.transactionId,
        timestamp: Date.now(),
        commitmentMode: 'contract-derived',
      };
      localStorage.setItem(`bid_${auctionId}_${address}`, JSON.stringify(bidData));

      setCommitmentInfo(bidData);

      toast.success(`✅ Bid committed! TX: ${result?.transactionId?.slice(0, 12)}...`);
      toast.success(`${currencyLabel} transferred and commitment recorded!`);
      toast.success('Nonce saved locally for reveal phase');
      toast.info('Remember to reveal your bid after auction closes!');
      
      await loadAuctionInfo();

    } catch (error) {
      console.error('[CommitBid] Error:', error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          Commit Bid
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Submit commit-reveal bid
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bid Details</CardTitle>
          {!connected && (
            <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-950/30 p-2">
              <p className="text-sm text-amber-200">⚠️ Connect wallet to continue</p>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Currency Alert - NEW */}
          {auctionInfo && currency && (
            <div className={`rounded-lg border-2 p-4 ${
              currency === 'aleo' 
                ? 'border-slate-600 bg-slate-800/50' 
                : 'border-blue-500 bg-blue-950/50'
            }`}>
              <div>
                <p className="text-lg font-bold text-white">
                  {AleoServiceV2.getCurrencyLabel(currency)} Auction
                </p>
                <p className="text-sm text-slate-300">
                  You need {currency === 'aleo' ? 'Aleo' : 'USDC'} to bid
                </p>
              </div>
            </div>
          )}
          
          <div>
            <Label htmlFor="auction-id">Auction ID</Label>
            <Input
              id="auction-id"
              value={form.auctionId}
              onChange={(e) => updateField('auctionId', e.target.value)}
              placeholder="e.g. 1234567890"
              type="number"
            />
          </div>

          <div>
            <Label htmlFor="bid-amount">
              Bid Amount ({currency ? AleoServiceV2.getCurrencyLabel(currency) : 'Loading...'})
            </Label>
            <Input
              id="bid-amount"
              value={form.bidAmount}
              onChange={(e) => updateField('bidAmount', e.target.value)}
              placeholder={currency === 'aleo' ? 'e.g. 1.0' : 'e.g. 100.0'}
              type="number"
              step="0.000001"
            />
            {currency && (
              <p className="text-xs text-slate-400 mt-1">
                {currency === 'aleo' 
                  ? '1 Aleo = 1,000,000 microcredits' 
                  : '1 USDC = 1,000,000 micro-units'}
              </p>
            )}
          </div>
          
          {auctionInfo && (
            <div className={`rounded-lg border p-3 ${
              auctionInfo.state === 0 
                ? 'border-green-500/20 bg-green-950/30' 
                : 'border-amber-500/20 bg-amber-950/30'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {getStateDescription(auctionInfo.state).icon}
                <span className={`text-sm font-semibold ${auctionInfo.state === 0 ? 'text-green-200' : 'text-amber-200'}`}>
                  {auctionInfo.stateName}
                </span>
              </div>
              <div className={`text-sm ${auctionInfo.state === 0 ? 'text-green-100' : 'text-amber-100'}`}>
                <p>Min Bid: {auctionInfo.minBidUsdx ? (auctionInfo.minBidUsdx / 1_000_000).toFixed(2) : 'N/A'} {currency ? AleoServiceV2.getCurrencyLabel(currency) : ''}</p>
                {auctionInfo.state !== 0 && (
                  <p className="mt-1 font-medium">⚠️ {validateAction('commit_bid', auctionInfo.state).message}</p>
                )}
              </div>
            </div>
          )}
          
          {isLoadingAuction && (
            <div className="rounded-lg border border-slate-500/20 bg-slate-950/30 p-2">
              <p className="text-sm text-slate-300">🔄 Loading auction...</p>
            </div>
          )}

          {commitmentInfo && (
            <div className="rounded-lg border border-green-500/20 bg-green-950/30 p-3">
              <h3 className="text-sm font-semibold text-green-200 mb-1">✅ Bid Committed</h3>
              <div className="text-sm text-green-100 space-y-0.5">
                <p>Amount: {commitmentInfo.bidAmount} {AleoServiceV2.getCurrencyLabel(commitmentInfo.currency)}</p>
                <p>TX: {commitmentInfo.txId?.substring(0, 20)}...</p>
                <p className="mt-2 text-amber-200">⚠️ Nonce saved locally - don't clear browser data</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleCommitBid}
              disabled={isSubmitting || !connected || !auctionInfo || auctionInfo.state !== 0}
              className={currency === 'aleo' ? 'bg-slate-700 hover:bg-slate-600 border border-slate-600' : 'bg-blue-600 hover:bg-blue-700'}
            >
              {isSubmitting ? 'Committing...' : `Commit Bid${currency ? ` with ${AleoServiceV2.getCurrencyLabel(currency)}` : ''}`}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setForm({ auctionId: '', bidAmount: '' });
                setCommitmentInfo(null);
              }}
              disabled={isSubmitting}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
