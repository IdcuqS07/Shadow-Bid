import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import * as AleoServiceV2 from '@/services/aleoServiceV2';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';

export default function ClaimRefundCardV2() {
  const { connected, executeTransaction, address } = useWallet();
  const [auctionId, setAuctionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refundInfo, setRefundInfo] = useState(null);
  const [auctionInfo, setAuctionInfo] = useState(null);
  const [currency, setCurrency] = useState(null);  // NEW
  const [isWinner, setIsWinner] = useState(false);

  useEffect(() => {
    const fetchAuctionData = async () => {
      if (auctionId && address) {
        console.log('[ClaimRefund] Fetching data for auction:', auctionId, 'wallet:', address);
        
        // Get auction info from on-chain to check winner FIRST
        const auction = await AleoServiceV2.getAuctionInfo(parseInt(auctionId));
        console.log('[ClaimRefund] Raw auction data:', auction);
        
        if (auction) {
          // Parse Leo-formatted response
          let auctionData;
          if (typeof auction === 'string') {
            // Parse Leo format: "{\n  seller: aleo1...,\n  min_bid_usdx: 1000000u64,\n  ...}"
            try {
              // Extract values using regex
              const sellerMatch = auction.match(/seller:\s*([a-z0-9]+)/);
              const winnerMatch = auction.match(/winner:\s*([a-z0-9]+)/);
              const winningAmountMatch = auction.match(/winning_amount:\s*(\d+)u128/);
              const stateMatch = auction.match(/state:\s*(\d+)u8/);
              const currencyTypeMatch = auction.match(/currency_type:\s*(\d+)u8/);
              
              auctionData = {
                seller: sellerMatch ? sellerMatch[1] : null,
                winner: winnerMatch ? winnerMatch[1] : null,
                winning_amount: winningAmountMatch ? winningAmountMatch[1] : '0',
                state: stateMatch ? stateMatch[1] : '0',
                currency_type: currencyTypeMatch ? parseInt(currencyTypeMatch[1]) : 0
              };
              console.log('[ClaimRefund] Parsed auction data:', auctionData);
            } catch (e) {
              console.error('[ClaimRefund] Parse error:', e);
              auctionData = auction;
            }
          } else {
            // Already an object
            auctionData = auction;
            console.log('[ClaimRefund] Auction data (object):', auctionData);
          }
          
          setAuctionInfo(auctionData);
          
          // NEW: Detect currency
          const detectedCurrency = AleoServiceV2.getAuctionCurrency(auctionData);
          setCurrency(detectedCurrency);
          console.log('[ClaimRefund] Detected currency:', detectedCurrency);
          
          // Check if current wallet is the winner
          // Handle both string and object winner format
          let winnerAddress;
          if (typeof auctionData.winner === 'string') {
            winnerAddress = auctionData.winner.replace(/\s/g, '').toLowerCase();
          } else if (auctionData.winner && typeof auctionData.winner === 'object') {
            // Winner might be an object, extract the address
            winnerAddress = String(auctionData.winner).replace(/\s/g, '').toLowerCase();
          } else {
            winnerAddress = null;
          }
          
          const currentAddress = address?.replace(/\s/g, '').toLowerCase();
          console.log('[ClaimRefund] Winner comparison:', { winnerAddress, currentAddress, winnerType: typeof auctionData.winner });
          
          const winner = winnerAddress && winnerAddress === currentAddress;
          setIsWinner(winner);
          console.log('[ClaimRefund] Is winner?', winner);

          // If winner, show winning amount from auction data
          if (winner) {
            const winningAmount = parseInt(auctionData.winning_amount) / 1_000_000;
            console.log('[ClaimRefund] Winner detected! Amount:', winningAmount);
            setRefundInfo({
              amount: winningAmount,
              commitment: null
            });
            return; // Don't check localStorage for winners
          }
        } else {
          console.log('[ClaimRefund] No auction data found');
          setAuctionInfo(null);
          setIsWinner(false);
        }

        // For non-winners, get commitment data from localStorage
        const commitmentData = AleoServiceV2.getCommitmentData(parseInt(auctionId), address);
        console.log('[ClaimRefund] Commitment data from localStorage:', commitmentData);
        
        if (commitmentData?.status === 'confirmed') {
          // Use 'amount' field if available, fallback to 'amountUsdx' for backward compatibility
          const amount = commitmentData.amount || commitmentData.amountUsdx;
          setRefundInfo({
            amount: amount / 1_000_000,
            commitment: commitmentData.commitment
          });
        } else {
          setRefundInfo(null);
        }
      } else {
        // Reset state when inputs are cleared
        setRefundInfo(null);
        setAuctionInfo(null);
        setIsWinner(false);
      }
    };

    fetchAuctionData();
  }, [auctionId, address]);

  const handleClaimRefund = async () => {
    if (!connected) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!auctionId || !currency) {
      toast.error('Please enter auction ID and wait for data to load');
      return;
    }

    if (isWinner) {
      toast.error('You are the winner! Winners cannot claim refunds.');
      return;
    }

    if (!refundInfo || !refundInfo.amount) {
      toast.error('No refund amount found. Please check your bid data.');
      return;
    }

    setIsSubmitting(true);
    try {
      const auctionIdNum = parseInt(auctionId);
      const refundAmountMicro = Math.floor(refundInfo.amount * 1_000_000);
      const currencyLabel = AleoServiceV2.getCurrencyLabel(currency);
      
      toast.info(`Claiming ${currencyLabel} refund with automatic transfer...`);
      
      // Route to correct function based on currency
      let result;
      if (currency === 'aleo') {
        result = await AleoServiceV2.claimRefundAleo(
          executeTransaction,
          auctionIdNum,
          refundAmountMicro
        );
      } else {
        result = await AleoServiceV2.claimRefund(
          executeTransaction,
          auctionIdNum,
          refundAmountMicro
        );
      }

      toast.success(`Refund claimed! TX: ${result?.transactionId?.slice(0, 12)}...`);
      toast.success(`Your ${refundInfo?.amount || ''} ${currencyLabel} has been automatically refunded to your wallet`);

    } catch (error) {
      console.error('[ClaimRefund] Error:', error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Claim Refund</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="auction-id">Auction ID</Label>
          <Input
            id="auction-id"
            value={auctionId}
            onChange={(e) => setAuctionId(e.target.value)}
            placeholder="e.g. 236585538"
            type="number"
          />
        </div>

        {/* Winner Status */}
        {isWinner && refundInfo && (
          <div className="rounded-lg border border-purple-500/30 bg-purple-950/40 p-3 text-center">
            <p className="text-sm font-semibold text-purple-200">🏆 You Won - No Refund</p>
          </div>
        )}

        {/* Refund Amount */}
        {!isWinner && refundInfo && currency && (
          <div className={`rounded-lg border p-3 ${
            currency === 'aleo'
              ? 'border-purple-500/30 bg-purple-950/40'
              : 'border-green-500/30 bg-green-950/40'
          }`}>
            <p className={`text-xs mb-1 ${currency === 'aleo' ? 'text-purple-400' : 'text-green-400'}`}>
              Refund Amount
            </p>
            <p className={`text-2xl font-bold ${currency === 'aleo' ? 'text-purple-100' : 'text-green-100'}`}>
              {refundInfo.amount} {AleoServiceV2.getCurrencyLabel(currency)}
            </p>
          </div>
        )}

        {/* No Bid Found */}
        {!refundInfo && auctionId && address && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-950/30 p-3">
            <p className="text-sm text-amber-200">⚠️ No bid found from your wallet</p>
          </div>
        )}

        <Button
          onClick={handleClaimRefund}
          disabled={isSubmitting || !connected || !refundInfo || isWinner}
          className={`w-full ${currency === 'aleo' ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
        >
          {isSubmitting ? 'Claiming...' : isWinner ? 'Winner - No Refund' : refundInfo && currency ? `Claim ${refundInfo.amount} ${AleoServiceV2.getCurrencyLabel(currency)}` : 'Claim Refund'}
        </Button>
      </CardContent>
    </Card>
  );
}
