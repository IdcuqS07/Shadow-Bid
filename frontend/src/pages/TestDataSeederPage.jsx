import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FlaskConical,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getOpsApiDebugInfo } from '@/services/localOpsService';
import {
  APPROVAL_PACK_CONTRACT_VERSION,
  APPROVAL_PACK_PROGRAM_ID,
  APPROVAL_PACK_SCENARIOS,
} from '@/lib/testData/onChainApprovalPack';
import {
  buildApprovalPackProgress,
  createRepresentativeApprovalPack,
} from '@/lib/testData/approvalPackRunner';
import {
  clearShadowBidV221Fixtures,
  getShadowBidFixtureMeta,
  seedShadowBidV221Fixtures,
} from '@/lib/testData/shadowbidV221Fixtures';

const LOCAL_FIXTURE_SCENARIOS = [
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

function formatScenarioWindow(seconds) {
  if (seconds <= 0) {
    return 'Closable now';
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `Ends in ${minutes}m`;
  }

  const hours = Math.round((seconds / 3600) * 10) / 10;
  return `Ends in ${hours}h`;
}

function truncateTxId(value) {
  if (typeof value !== 'string' || value.length < 18) {
    return value || '-';
  }

  return `${value.slice(0, 12)}...${value.slice(-6)}`;
}

export default function TestDataSeederPage() {
  const { address, connected, executeTransaction } = useWallet();
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isCreatingPack, setIsCreatingPack] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState(null);
  const [fixtureResult, setFixtureResult] = useState(null);
  const [packSummary, setPackSummary] = useState(null);
  const [fixtureMeta, setFixtureMeta] = useState(() => getShadowBidFixtureMeta());
  const [packProgress, setPackProgress] = useState(() => buildApprovalPackProgress());
  const opsInfo = useMemo(() => getOpsApiDebugInfo(), []);
  const activeContractVersionLabel = APPROVAL_PACK_CONTRACT_VERSION.toUpperCase();

  const updatePackProgress = (scenarioId, patch) => {
    setPackProgress((previous) => previous.map((item) => (
      item.id === scenarioId
        ? { ...item, ...patch }
        : item
    )));
  };

  const handleCreateRepresentativePack = async () => {
    if (!connected || !address) {
      toast.error('Connect your wallet first so the representative pack can be created on-chain.');
      return;
    }

    if (!executeTransaction) {
      toast.error('This wallet connection cannot submit transactions right now. Reconnect and try again.');
      return;
    }

    setIsCreatingPack(true);
    setActiveScenarioId(null);
    setPackSummary(null);
    setPackProgress(buildApprovalPackProgress());

    toast.info(`Approve ${APPROVAL_PACK_SCENARIOS.length} create_auction transactions to seed the ${activeContractVersionLabel} example pack.`);

    try {
      const summary = await createRepresentativeApprovalPack({
        address,
        executeTransaction,
        onScenarioUpdate: (scenario, patch) => {
          updatePackProgress(scenario.id, patch);

          if (patch.status === 'awaiting-approval') {
            setActiveScenarioId(scenario.id);
          }
        },
      });

      setPackSummary(summary);

      if (summary.error) {
        toast.error(`Representative pack stopped at "${summary.failedScenarioTitle}": ${summary.error}`);
        return;
      }

      toast.success(`Representative ${activeContractVersionLabel} pack created: ${summary.createdCount} auctions submitted.`);
    } catch (error) {
      const message = error?.message || String(error);
      setPackSummary({
        createdCount: 0,
        syncWarningTotal: 0,
        failedScenarioTitle: null,
        error: message,
      });
      toast.error(`Failed to create representative pack: ${message}`);
    } finally {
      setActiveScenarioId(null);
      setIsCreatingPack(false);
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const response = await seedShadowBidV221Fixtures({
        sellerWallet: address,
      });

      setFixtureResult(response);
      setFixtureMeta(getShadowBidFixtureMeta());

      toast.success(`${activeContractVersionLabel} fixture auctions seeded locally.`);
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
      setFixtureResult(null);
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
            Test Auction Toolkit
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">ShadowBid {activeContractVersionLabel} Test Auctions</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-300">
                Use the representative approval pack for real on-chain {activeContractVersionLabel} auctions that only need wallet approval,
                or keep using local fixtures when you want instant mock states across the full lifecycle.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleCreateRepresentativePack} disabled={isCreatingPack}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isCreatingPack ? 'animate-spin' : ''}`} />
                {isCreatingPack
                  ? activeScenarioId
                    ? `Approving ${packProgress.find((item) => item.id === activeScenarioId)?.title || 'auction'}...`
                    : 'Preparing approvals...'
                  : `Create Representative Pack (${APPROVAL_PACK_SCENARIOS.length} approvals)`}
              </Button>
              <Button onClick={handleSeed} disabled={isSeeding}>
                <Database className={`mr-2 h-4 w-4 ${isSeeding ? 'animate-spin' : ''}`} />
                {isSeeding ? 'Seeding fixtures...' : 'Seed Local Fixtures'}
              </Button>
              <Button variant="outline" onClick={handleClear} disabled={isClearing}>
                <Trash2 className={`mr-2 h-4 w-4 ${isClearing ? 'animate-spin' : ''}`} />
                {isClearing ? 'Clearing...' : 'Clear Local Fixtures'}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-cyan-500/20 bg-cyan-950/20">
            <CardHeader className="pb-2">
              <CardDescription>Connected Wallet</CardDescription>
              <CardTitle className="break-all text-base">{connected && address ? address : 'Not connected'}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-300">
              The connected wallet becomes the seller for both the on-chain approval pack and any local fixtures you seed. Bidder and winner fixture roles are assigned to separate test wallets automatically.
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader className="pb-2">
              <CardDescription>Active Program</CardDescription>
              <CardTitle className="break-all text-base">{APPROVAL_PACK_PROGRAM_ID}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-300">
              Representative example-pack auctions are created on the active contract and tagged in metadata as {APPROVAL_PACK_CONTRACT_VERSION.toUpperCase()}.
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader className="pb-2">
              <CardDescription>Ops API Target</CardDescription>
              <CardTitle className="break-all text-base">{opsInfo.baseUrl || 'Unavailable'}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-300">
              Snapshot sync is best effort. Even if Ops sync is unavailable, created auctions are still stored in browser metadata for this wallet.
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader className="pb-2">
              <CardDescription>Fixture Status</CardDescription>
              <CardTitle className="text-base">{fixtureMeta.auctionIds.length > 0 ? `${fixtureMeta.auctionIds.length} local fixtures seeded` : 'No local fixture bundle yet'}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-300">
              {fixtureMeta.seededAt
                ? `Last local fixture seed at ${new Date(fixtureMeta.seededAt).toLocaleString()}`
                : 'Use local fixtures when you need instant challenge, settled, refund, and dispute states.'}
            </CardContent>
          </Card>
        </div>

        <Card className="border-cyan-500/30 bg-cyan-950/20">
          <CardHeader>
            <CardTitle>Representative On-Chain Approval Pack</CardTitle>
            <CardDescription>
              Creates real auctions on the active {activeContractVersionLabel} program with one wallet approval per auction. Proof bundles, seller verification,
              local metadata, and Ops snapshots are synced automatically without extra approval prompts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-cyan-500/20 bg-black/20 p-4 text-sm text-cyan-50">
              This pack is tuned for guided premium-create coverage: eight open example auctions spanning multiple currencies,
              asset categories, and proof layouts in the premium UI.
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {APPROVAL_PACK_SCENARIOS.map((scenario) => {
                const progress = packProgress.find((item) => item.id === scenario.id);
                const status = progress?.status || 'pending';

                return (
                  <div key={scenario.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{scenario.title}</div>
                        <div className="mt-2 text-sm text-slate-300">{scenario.detail}</div>
                      </div>
                      <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-300">
                        {status}
                      </div>
                    </div>
                    <div className="mt-4 space-y-1 text-xs text-slate-400">
                      <div>{scenario.currency} • {scenario.assetLabel}</div>
                      <div>Min {scenario.minBid} / Reserve {scenario.reservePrice}</div>
                      <div>{formatScenarioWindow(scenario.endOffsetSeconds)}</div>
                      {progress?.auctionId ? <div>Auction #{progress.auctionId}</div> : null}
                      {progress?.txId ? <div>TX {truncateTxId(progress.txId)}</div> : null}
                      {progress?.error ? <div className="text-rose-300">{progress.error}</div> : null}
                      {progress?.syncWarningCount > 0 ? (
                        <div className="text-amber-300">Ops sync warnings: {progress.syncWarningCount}</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {packSummary && (
          <Card className={packSummary.error ? 'border-amber-500/30 bg-amber-950/20' : 'border-green-500/30 bg-green-950/20'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {packSummary.error ? (
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-300" />
                )}
                Representative Pack Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-200">
              <div>
                {packSummary.error
                  ? `Stopped after ${packSummary.createdCount} successful auctions.`
                  : `${packSummary.createdCount} representative auctions were submitted successfully.`}
              </div>
              {packSummary.failedScenarioTitle ? (
                <div className="text-amber-100">
                  Failed scenario: {packSummary.failedScenarioTitle}
                </div>
              ) : null}
              {packSummary.error ? (
                <div className="text-amber-100">
                  Error: {packSummary.error}
                </div>
              ) : null}
              {packSummary.syncWarningTotal > 0 ? (
                <div className="text-xs text-amber-200">
                  Some Ops sync calls failed, but the successful on-chain transactions and browser metadata were still kept.
                </div>
              ) : (
                <div className="text-xs text-slate-300">
                  On-chain creates and metadata sync both completed cleanly for this run.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!opsInfo.isLocalTarget && (
          <Card className="border-amber-500/30 bg-amber-950/20">
            <CardContent className="pt-6 text-sm text-amber-100">
              The current Ops target is not local. Local fixture reset stays browser-only, while the representative approval pack
              still creates real on-chain auctions and attempts normal snapshot sync to the configured target.
            </CardContent>
          </Card>
        )}

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle>Local Fixture Bundle</CardTitle>
            <CardDescription>
              These mocked scenarios still help when you need immediate settled, refund, dispute, and executor-ready states without waiting on chain time.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {LOCAL_FIXTURE_SCENARIOS.map((scenario) => (
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

        {fixtureResult?.opsResult && (
          <Card className={fixtureResult.opsResult.synced ? 'border-green-500/30 bg-green-950/20' : 'border-slate-700 bg-slate-900/60'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Local Fixture Seeder Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-200">
              <div>{fixtureResult.opsResult.reason}</div>
              <div className="text-xs text-slate-400">
                Seeded auction IDs: {fixtureResult.bundle.auctionIds.join(', ')}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
