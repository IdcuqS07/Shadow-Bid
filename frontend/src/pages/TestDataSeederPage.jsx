import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { ArrowRight, Database, FlaskConical, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  clearShadowBidV221Fixtures,
  getShadowBidFixtureMeta,
  seedShadowBidV221Fixtures,
} from '@/lib/testData/shadowbidV221Fixtures';
import { getOpsApiDebugInfo } from '@/services/localOpsService';

const SCENARIOS = [
  { id: 'open-catalog', title: 'Open catalog listing', detail: 'Proof bundle, seller verification, and future end time.' },
  { id: 'open-overdue', title: 'Open but overdue', detail: 'Lets seller test close action and executor close job.' },
  { id: 'closed-reveal', title: 'Closed with reveal active', detail: 'Connected wallet gets bidder commitment data ready to reveal.' },
  { id: 'closed-timeout', title: 'Closed after reveal timeout', detail: 'Seller can test settle_after_reveal_timeout immediately.' },
  { id: 'challenge-finalize', title: 'Challenge finalize ready', detail: 'Dispute deadline already passed for finalize_winner flow.' },
  { id: 'settled-seller', title: 'Settled seller claim', detail: 'Seller payment is unlocked by timeout.' },
  { id: 'settled-winner', title: 'Settled winner receipt', detail: 'Connected wallet becomes winner and can confirm receipt.' },
  { id: 'settled-fee', title: 'Settled platform fee', detail: 'Ops Console sees claimable platform fee readiness.' },
  { id: 'cancelled-refund', title: 'Cancelled reserve miss', detail: 'Bidder refund flow is available.' },
  { id: 'disputed-case', title: 'Disputed case', detail: 'Offers, dispute center, and ops dispute resolution data are present.' },
];

export default function TestDataSeederPage() {
  const { address, connected } = useWallet();
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [result, setResult] = useState(null);
  const [fixtureMeta, setFixtureMeta] = useState(() => getShadowBidFixtureMeta());
  const opsInfo = useMemo(() => getOpsApiDebugInfo(), []);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const response = await seedShadowBidV221Fixtures({
        primaryWallet: address,
      });

      setResult(response);
      setFixtureMeta(getShadowBidFixtureMeta());

      toast.success('V2.22 fixture auctions seeded locally.');
    } catch (error) {
      console.error('[TestDataSeederPage] Failed to seed fixtures:', error);
      toast.error(`Failed to seed fixtures: ${error.message || error}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClear = async () => {
    setIsClearing(true);
    try {
      await clearShadowBidV221Fixtures();
      setResult(null);
      setFixtureMeta(getShadowBidFixtureMeta());
      toast.success('Fixture auctions cleared from browser storage.');
    } catch (error) {
      console.error('[TestDataSeederPage] Failed to clear fixtures:', error);
      toast.error(`Failed to clear fixtures: ${error.message || error}`);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-mono uppercase tracking-[0.24em] text-cyan-300">
            <FlaskConical className="h-4 w-4" />
            Local Fixture Seeder
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">ShadowBid V2.22 Test Auctions</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-300">
                Seed a realistic local bundle of auctions that exercises the full V2.22 lifecycle:
                seller verification, proof bundles, reveal timeout, dispute flow, settlement, refunds,
                and ops analytics.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSeed} disabled={isSeeding}>
                <Database className={`mr-2 h-4 w-4 ${isSeeding ? 'animate-spin' : ''}`} />
                {isSeeding ? 'Seeding fixtures...' : 'Seed Fixtures'}
              </Button>
              <Button variant="outline" onClick={handleClear} disabled={isClearing}>
                <Trash2 className={`mr-2 h-4 w-4 ${isClearing ? 'animate-spin' : ''}`} />
                {isClearing ? 'Clearing...' : 'Clear Fixtures'}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-cyan-500/20 bg-cyan-950/20">
            <CardHeader className="pb-2">
              <CardDescription>Connected Wallet</CardDescription>
              <CardTitle className="break-all text-base">{connected && address ? address : 'Not connected'}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-300">
              When connected, this wallet becomes the seller and bidder across selected fixtures so action buttons are visible.
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader className="pb-2">
              <CardDescription>Ops API Target</CardDescription>
              <CardTitle className="break-all text-base">{opsInfo.baseUrl || 'Unavailable'}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-300">
              {opsInfo.isLocalTarget
                ? 'Safe local target detected. Seeder will also reset and refill Ops data.'
                : 'Non-local target detected. Seeder only writes browser-local fixture data to avoid touching shared ops storage.'}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader className="pb-2">
              <CardDescription>Fixture Status</CardDescription>
              <CardTitle className="text-base">{fixtureMeta.auctionIds.length > 0 ? `${fixtureMeta.auctionIds.length} auctions seeded` : 'No local fixture bundle yet'}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-300">
              {fixtureMeta.seededAt
                ? `Last seeded at ${new Date(fixtureMeta.seededAt).toLocaleString()}`
                : 'Seed once, then open Premium Auctions or Ops Console to explore the scenarios.'}
            </CardContent>
          </Card>
        </div>

        {!opsInfo.isLocalTarget && (
          <Card className="border-amber-500/30 bg-amber-950/20">
            <CardContent className="pt-6 text-sm text-amber-100">
              Ops seeding is intentionally disabled because the current app target is not local.
              For full local Ops Console coverage, run `npm run dev:api` in `frontend/` and point
              `VITE_LOCAL_API_URL` to `http://127.0.0.1:8787`.
            </CardContent>
          </Card>
        )}

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle>Included Scenarios</CardTitle>
            <CardDescription>
              Each seeded auction is designed to light up a different part of the V2.22 UI and lifecycle.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {SCENARIOS.map((scenario) => (
              <div key={scenario.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="font-semibold text-white">{scenario.title}</div>
                <div className="mt-2 text-sm text-slate-300">{scenario.detail}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle>Where To Check</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Button asChild variant="outline" className="justify-between">
              <Link to="/premium-auctions">
                Premium Auctions
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-between">
              <Link to="/ops">
                Ops Console
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-between">
              <Link to="/standard">
                Standard Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {result?.opsResult && (
          <Card className={result.opsResult.synced ? 'border-green-500/30 bg-green-950/20' : 'border-slate-700 bg-slate-900/60'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Seeder Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-200">
              <div>{result.opsResult.reason}</div>
              <div className="text-xs text-slate-400">
                Seeded auction IDs: {result.bundle.auctionIds.join(', ')}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
