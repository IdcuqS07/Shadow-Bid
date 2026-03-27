import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';

export default function TestUSDCxTransferPage() {
  const { connected, executeTransaction, address } = useWallet();
  const [receiver, setReceiver] = useState('shadowbid_marketplace_v2_6.aleo');
  const [amount, setAmount] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleTransfer = async () => {
    if (!connected) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!receiver || !amount) {
      toast.error('Please fill all fields');
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const amountMicro = Math.round(parseFloat(amount) * 1_000_000);
      
      console.log('[TestTransfer] Params:', {
        receiver,
        amount: amountMicro,
        from: address
      });

      toast.info('Transferring USDCx...');

      // Direct call to test_usdcx_stablecoin.aleo
      const txResult = await executeTransaction({
        program: 'test_usdcx_stablecoin.aleo',
        function: 'transfer_public',
        inputs: [
          receiver,
          `${amountMicro}u128`
        ],
        fee: 1000000 // 1 ALEO
      });

      console.log('[TestTransfer] Result:', txResult);

      setResult({
        success: true,
        txId: txResult?.transactionId,
        receiver,
        amount: amountMicro
      });

      toast.success(`Transfer successful!`);
      toast.success(`TX: ${txResult?.transactionId?.slice(0, 12)}...`);
      toast.info('Check contract balance on explorer');

    } catch (error) {
      console.error('[TestTransfer] Error:', error);
      
      setResult({
        success: false,
        error: error.message
      });

      toast.error(`Transfer failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
          Test USDCx Transfer
        </h1>
        <p className="mt-2 text-sm text-slate-300 md:text-base">
          Test direct USDCx transfer to contract address to verify cross-program call behavior.
        </p>
      </div>

      <Card className="border-amber-500/20 bg-amber-950/30">
        <CardHeader>
          <CardTitle className="text-amber-200">⚠️ Test Purpose Only</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-amber-100">
          <p>This page tests if contract address can receive USDCx tokens directly.</p>
          <p><strong>Objective</strong>: Determine if V2.5 needs one-step or two-step commit process.</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>If transfer succeeds → Contract can receive USDCx → Issue is cross-program call context</li>
            <li>If transfer fails → Contract cannot receive USDCx → Need different approach</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transfer USDCx</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connected && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-950/30 p-3">
              <p className="text-sm text-amber-200">
                ⚠️ Please connect your wallet first
              </p>
            </div>
          )}

          {connected && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-950/30 p-3">
              <p className="text-sm text-blue-200">
                <strong>Connected Wallet:</strong>
              </p>
              <p className="text-xs text-blue-100 font-mono mt-1 break-all">
                {address}
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="receiver">Receiver Address</Label>
            <Input
              id="receiver"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              placeholder="e.g. shadowbid_marketplace_v2_6.aleo"
              disabled={isSubmitting}
            />
            <p className="text-xs text-slate-400 mt-1">
              Contract address or wallet address
            </p>
          </div>

          <div>
            <Label htmlFor="amount">Amount (USDCx)</Label>
            <Input
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1"
              type="number"
              step="0.000001"
              disabled={isSubmitting}
            />
            <p className="text-xs text-slate-400 mt-1">
              Amount in USDCx (1 USDCx = $1)
            </p>
          </div>

          <Button
            onClick={handleTransfer}
            disabled={isSubmitting || !connected}
            className="w-full"
          >
            {isSubmitting ? 'Transferring...' : 'Transfer USDCx'}
          </Button>

          {result && (
            <div className={`rounded-lg border p-4 ${
              result.success 
                ? 'border-green-500/20 bg-green-950/30' 
                : 'border-red-500/20 bg-red-950/30'
            }`}>
              <h3 className={`font-semibold mb-2 ${
                result.success ? 'text-green-200' : 'text-red-200'
              }`}>
                {result.success ? '✅ Transfer Successful' : '❌ Transfer Failed'}
              </h3>
              
              {result.success ? (
                <div className="text-sm space-y-2">
                  <div>
                    <p className="text-green-300">Transaction ID:</p>
                    <p className="text-xs text-green-100 font-mono break-all">
                      {result.txId}
                    </p>
                  </div>
                  <div>
                    <p className="text-green-300">Receiver:</p>
                    <p className="text-xs text-green-100 font-mono">
                      {result.receiver}
                    </p>
                  </div>
                  <div>
                    <p className="text-green-300">Amount:</p>
                    <p className="text-xs text-green-100">
                      {result.amount / 1_000_000} USDCx ({result.amount} microcredits)
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-green-500/20">
                    <p className="text-green-300 mb-2">Verify on Explorer:</p>
                    <a
                      href={`https://testnet.explorer.provable.com/transaction/${result.txId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-200 underline hover:text-green-100"
                    >
                      View Transaction
                    </a>
                    <br />
                    <p className="text-xs text-green-200 mt-2">
                      Check contract balance:
                    </p>
                    <code className="text-xs text-green-100 block mt-1 p-2 bg-green-950/50 rounded">
                      curl "https://api.explorer.provable.com/v1/testnet/program/test_usdcx_stablecoin.aleo/mapping/balances/{result.receiver}"
                    </code>
                  </div>
                </div>
              ) : (
                <div className="text-sm space-y-2">
                  <p className="text-red-100">Error: {result.error}</p>
                  <div className="mt-3 pt-3 border-t border-red-500/20">
                    <p className="text-red-300 text-xs">
                      This indicates that contract address cannot receive USDCx directly.
                      We may need to use a different approach (escrow wallet or record-based transfers).
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-indigo-500/20 bg-indigo-950/30">
        <CardHeader>
          <CardTitle>Interpretation Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-indigo-100">
          <div>
            <p className="font-semibold text-indigo-200">If Transfer Succeeds ✅</p>
            <ul className="list-disc list-inside space-y-1 mt-1 text-indigo-100">
              <li>Contract address CAN receive USDCx tokens</li>
              <li>Problem is with cross-program call context in commit_bid</li>
              <li>Solution: Implement two-step commit process</li>
              <li>Step 1: User transfers USDCx to contract</li>
              <li>Step 2: User calls commit_bid (without internal transfer)</li>
            </ul>
          </div>
          
          <div>
            <p className="font-semibold text-indigo-200">If Transfer Fails ❌</p>
            <ul className="list-disc list-inside space-y-1 mt-1 text-indigo-100">
              <li>Contract address CANNOT receive USDCx tokens</li>
              <li>Need different architecture approach</li>
              <li>Options: Use escrow wallet, record-based transfers, or revert to V2.4</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
