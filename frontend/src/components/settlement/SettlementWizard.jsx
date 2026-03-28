import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import * as AleoServiceV2 from '@/services/aleoServiceV2';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { CheckCircle2, Circle, Clock, ArrowRight } from 'lucide-react';

const STEPS = {
  CLOSE: { id: 1, label: 'Close Auction', state: 0 },
  REVEAL: { id: 2, label: 'Bidders Reveal', state: 1 },
  SETTLE: { id: 3, label: 'Settle After Reveal Timeout', state: 1 },
  CHALLENGE: { id: 4, label: 'Challenge Period', state: 2 },
  FINALIZE: { id: 5, label: 'Finalize Winner', state: 2 },
};

export function SettlementWizard() {
  const { connected, executeTransaction, address } = useWallet();
  const [auctionId, setAuctionId] = useState('');
  const [auctionInfo, setAuctionInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [bidRecords, setBidRecords] = useState([]);
  const [currency, setCurrency] = useState('usdcx'); // NEW: Track currency

  useEffect(() => {
    if (auctionId && address) {
      loadAuctionInfo();
    }
  }, [auctionId, address]);

  const loadAuctionInfo = async () => {
    setIsLoading(true);
    try {
      const auction = await AleoServiceV2.getAuctionInfo(parseInt(auctionId));
      if (auction) {
        let parsed;
        if (typeof auction === 'string') {
          const stateMatch = auction.match(/state:\s*(\d+)u8/);
          const sellerMatch = auction.match(/seller:\s*([a-z0-9]+)/);
          const winnerMatch = auction.match(/winner:\s*([a-z0-9]+)/);
          const winningAmountMatch = auction.match(/winning_amount:\s*(\d+)u128/);
          const revealDeadlineMatch = auction.match(/reveal_deadline:\s*(\d+)i64/);
          const disputeDeadlineMatch = auction.match(/dispute_deadline:\s*(\d+)i64/);
          
          parsed = {
            state: stateMatch ? stateMatch[1] : '0',
            seller: sellerMatch ? sellerMatch[1] : null,
            winner: winnerMatch ? winnerMatch[1] : null,
            winning_amount: winningAmountMatch ? winningAmountMatch[1] : '0',
            reveal_deadline: revealDeadlineMatch ? revealDeadlineMatch[1] : '0',
            dispute_deadline: disputeDeadlineMatch ? disputeDeadlineMatch[1] : '0',
          };
          
          // NEW: Detect currency
          const detectedCurrency = AleoServiceV2.getAuctionCurrency(auction);
          setCurrency(detectedCurrency);
        } else {
          parsed = auction;
          // NEW: Detect currency
          const detectedCurrency = AleoServiceV2.getAuctionCurrency(auction);
          setCurrency(detectedCurrency);
        }
        
        setAuctionInfo(parsed);
        determineCurrentStep(parsed);
        
        // Load bid records to check for unrevealed bids
        await loadBidRecords();
      }
    } catch (error) {
      console.error('[SettlementWizard] Error:', error);
      toast.error('Failed to load auction info');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBidRecords = async () => {
    try {
      // Try to get bid records from localStorage
      const storedBids = localStorage.getItem(`auction_${auctionId}_bids`);
      if (storedBids) {
        const bids = JSON.parse(storedBids);
        setBidRecords(bids);
      }
    } catch (error) {
      console.error('[SettlementWizard] Error loading bids:', error);
    }
  };

  const determineCurrentStep = (auction) => {
    const state = parseInt(auction.state);
    const now = Math.floor(Date.now() / 1000);
    const revealDeadline = parseInt(auction.reveal_deadline || '0', 10);
    const disputeDeadline = parseInt(auction.dispute_deadline || '0', 10);
    
    if (state === 0) {
      setCurrentStep(STEPS.CLOSE);
    } else if (state === 1) {
      setCurrentStep(revealDeadline > now ? STEPS.REVEAL : STEPS.SETTLE);
    } else if (state === 2) {
      if (disputeDeadline > now) {
        setCurrentStep(STEPS.CHALLENGE);
      } else {
        setCurrentStep(STEPS.FINALIZE);
      }
    } else {
      setCurrentStep(null);
    }
  };

  const handleCloseAuction = async () => {
    if (!connected) {
      toast.error('Please connect your wallet');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await AleoServiceV2.closeAuction(executeTransaction, parseInt(auctionId));
      toast.success(`Auction closed! TX: ${result?.transactionId?.slice(0, 12)}...`);
      await loadAuctionInfo();
    } catch (error) {
      console.error('[SettlementWizard] Error:', error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSettleAfterRevealTimeout = async () => {
    if (!connected) {
      toast.error('Please connect your wallet');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const revealDeadline = parseInt(auctionInfo?.reveal_deadline || '0', 10);

    if (revealDeadline > now) {
      toast.error('Reveal window is still active. Wait until that deadline passes before settling the auction.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await AleoServiceV2.settleAfterRevealTimeout(executeTransaction, parseInt(auctionId));
      toast.success(`Reveal timeout settled! TX: ${result?.transactionId?.slice(0, 12)}...`);
      toast.info('Auction will move to CHALLENGE if reserve is met, otherwise CANCELLED.');
      await loadAuctionInfo();
    } catch (error) {
      console.error('[SettlementWizard] Error:', error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizeWinner = async () => {
    if (!connected) {
      toast.error('Please connect your wallet');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const disputeDeadline = parseInt(auctionInfo?.dispute_deadline || '0', 10);

    if (disputeDeadline > now) {
      toast.error('Challenge period is still active. Wait until that deadline passes before finalizing the winner.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await AleoServiceV2.finalizeWinner(executeTransaction, parseInt(auctionId));
      toast.success(`Winner finalized! TX: ${result?.transactionId?.slice(0, 12)}...`);
      toast.success('Auction settled!');
      await loadAuctionInfo();
    } catch (error) {
      console.error('[SettlementWizard] Error:', error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepStatus = (step) => {
    if (!currentStep) return 'completed';
    if (step.id < currentStep.id) return 'completed';
    if (step.id === currentStep.id) return 'current';
    return 'pending';
  };

  const renderStepIcon = (status) => {
    if (status === 'completed') {
      return <CheckCircle2 className="h-5 w-5 text-green-400" />;
    } else if (status === 'current') {
      return <Circle className="h-5 w-5 text-purple-400 fill-purple-400" />;
    } else {
      return <Circle className="h-5 w-5 text-slate-600" />;
    }
  };

  const checkUnrevealedBids = () => {
    if (!bidRecords || bidRecords.length === 0) {
      return {
        hasUnrevealed: false,
        message: 'No bid records found. This is normal if bids were made in different sessions.',
      };
    }

    const unrevealedBids = bidRecords.filter(bid => !bid.revealed);
    const revealedBids = bidRecords.filter(bid => bid.revealed);

    if (unrevealedBids.length === 0) {
      return {
        hasUnrevealed: false,
        message: `All ${revealedBids.length} known bids have been revealed.`,
      };
    }

    return {
      hasUnrevealed: true,
      unrevealedCount: unrevealedBids.length,
      revealedCount: revealedBids.length,
      totalCount: bidRecords.length,
      message: `${unrevealedBids.length} of ${bidRecords.length} known bids have not been revealed yet.`,
    };
  };

  const renderActionButton = () => {
    const unrevealedInfo = checkUnrevealedBids();

    if (!currentStep) {
      const isCancelled = parseInt(auctionInfo?.state || '0', 10) === 4;
      const isDisputed = parseInt(auctionInfo?.state || '0', 10) === 5;
      return (
        <div className="text-center py-8">
          <CheckCircle2 className={`h-12 w-12 mx-auto mb-3 ${isCancelled ? 'text-amber-400' : isDisputed ? 'text-red-400' : 'text-green-400'}`} />
          <p className="text-lg font-semibold text-white">
            {isCancelled ? 'Auction Cancelled' : isDisputed ? 'Auction Disputed' : 'Auction Settled!'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {isCancelled
              ? 'Reserve was not met or no valid reveal was recorded.'
              : isDisputed
                ? 'Resolve the on-chain dispute before continuing settlement.'
                : 'All steps completed'}
          </p>
        </div>
      );
    }

    if (currentStep.id === STEPS.CLOSE.id) {
      return (
        <Button
          onClick={handleCloseAuction}
          disabled={isSubmitting || !connected}
          className="w-full bg-purple-600 hover:bg-purple-700"
          size="lg"
        >
          {isSubmitting ? 'Closing...' : 'Close Auction'}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      );
    }

    if (currentStep.id === STEPS.REVEAL.id) {
      const now = Math.floor(Date.now() / 1000);
      const revealDeadline = parseInt(auctionInfo.reveal_deadline || '0', 10);
      const remaining = Math.max(0, revealDeadline - now);
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);

      return (
        <div className="text-center py-6 space-y-4">
          <Clock className="h-10 w-10 text-amber-400 mx-auto animate-pulse" />
          <div>
            <p className="text-sm font-semibold text-amber-200">Waiting for Bidders to Reveal</p>
            <p className="text-xs text-slate-400 mt-1">
              Settlement unlocks after the reveal window closes, even if some bidders never reveal.
            </p>
          </div>
          
          <div className="rounded-lg border border-blue-500/20 bg-blue-950/30 p-3 text-left">
            <p className="text-xs text-blue-200">
              Reveal window remaining: {hours}h {minutes}m
            </p>
          </div>
          
          <div className="flex gap-2 justify-center">
            <Button
              onClick={loadAuctionInfo}
              variant="outline"
              size="sm"
            >
              Refresh Status
            </Button>
          </div>
        </div>
      );
    }

    if (currentStep.id === STEPS.SETTLE.id) {
      return (
        <div className="space-y-4">
          {/* Warning about unrevealed bids */}
          {unrevealedInfo.hasUnrevealed && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-200">Some Bidders May Not Have Revealed</p>
                  <p className="text-xs text-amber-300 mt-1">
                    {unrevealedInfo.message}
                  </p>
                  <p className="text-xs text-amber-400 mt-2">
                    Only revealed bids will be counted. Unrevealed bids will be ignored.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-4 text-left">
            <p className="text-sm font-semibold text-cyan-200">Settle after reveal timeout</p>
            <p className="text-xs text-cyan-100 mt-1">
              This moves the auction to CHALLENGE if the highest revealed bid meets reserve, otherwise to CANCELLED.
            </p>
          </div>
          
          <Button
            onClick={handleSettleAfterRevealTimeout}
            disabled={isSubmitting || !connected}
            className="w-full bg-purple-600 hover:bg-purple-700"
            size="lg"
          >
            {isSubmitting ? 'Settling...' : 'Settle After Reveal Timeout'}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      );
    }

    if (currentStep.id === STEPS.CHALLENGE.id) {
      const now = Math.floor(Date.now() / 1000);
      const challengeEnd = parseInt(auctionInfo.dispute_deadline || '0', 10);
      const remaining = Math.max(0, challengeEnd - now);
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);

      return (
        <div className="text-center py-6">
          <Clock className="h-10 w-10 text-blue-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-blue-200">Challenge Period Active</p>
          <p className="text-2xl font-bold text-white mt-2">
            {hours}h {minutes}m remaining
          </p>
          <p className="text-xs text-slate-400 mt-1">Waiting for the dispute window to end</p>
        </div>
      );
    }

    if (currentStep.id === STEPS.FINALIZE.id) {
      return (
        <Button
          onClick={handleFinalizeWinner}
          disabled={isSubmitting || !connected}
          className="w-full bg-green-600 hover:bg-green-700"
          size="lg"
        >
          {isSubmitting ? 'Finalizing...' : 'Finalize Winner'}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      );
    }
  };

  return (
    <Card className="border-purple-500/20">
      <CardHeader>
        <CardTitle className="text-xl">Settlement Wizard</CardTitle>
        <p className="text-sm text-slate-400">Guided seller flow for the live V2.21 contract</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auction ID Input */}
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

        {/* Progress Steps */}
        {auctionInfo && (
          <>
            <div className="space-y-3">
              {Object.values(STEPS).map((step) => {
                const status = getStepStatus(step);
                return (
                  <div key={step.id} className="flex items-center gap-3">
                    {renderStepIcon(status)}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        status === 'completed' ? 'text-green-400' :
                        status === 'current' ? 'text-purple-400' :
                        'text-slate-500'
                      }`}>
                        {step.label}
                      </p>
                    </div>
                    {status === 'current' && (
                      <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                        Current
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Winner Info */}
            {auctionInfo.winner && auctionInfo.winner !== 'aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc' && (
              <div className="rounded-lg border border-green-500/20 bg-green-950/20 p-3">
                <p className="text-sm font-semibold text-green-200 mb-1">🏆 Winner</p>
                <p className="text-xs text-green-100 font-mono">{auctionInfo.winner.substring(0, 20)}...</p>
                <p className="text-sm text-green-100 mt-1">
                  Bid: {parseInt(auctionInfo.winning_amount) / 1_000_000} {AleoServiceV2.getCurrencyLabel(currency)}
                </p>
              </div>
            )}

            {/* Action Button */}
            <div className="pt-4">
              {renderActionButton()}
            </div>
          </>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">Loading auction info...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
