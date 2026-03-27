import { useEffect, useState } from 'react';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { AlertCircle, Bot, ChartColumn, RefreshCw, ShieldCheck, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  isPlatformOwner,
  resolveDisputeRefundWinnerOnChain,
  resolveDisputeReleaseSellerOnChain,
} from '@/services/aleoServiceV2';
import {
  getAnalyticsOverview,
  getDisputes,
  getExecutorState,
  getLocalApiHealth,
  runExecutorScan,
  updateDispute,
  updateExecutorSettings,
} from '@/services/localOpsService';

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatAmount(value) {
  return Number(value || 0).toFixed(2);
}

export default function AdminDashboardV3() {
  const { connected, address, executeTransaction } = useWallet();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [resolvingDisputeId, setResolvingDisputeId] = useState(null);
  const [health, setHealth] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [executor, setExecutor] = useState({
    settings: null,
    jobs: [],
    recentRuns: [],
  });
  const platformOwnerConnected = Boolean(address && isPlatformOwner(address));

  const refresh = async () => {
    setLoading(true);

    const [healthResponse, analyticsResponse, executorResponse, disputesResponse] = await Promise.all([
      getLocalApiHealth(),
      getAnalyticsOverview(),
      getExecutorState(),
      getDisputes(),
    ]);

    setHealth(healthResponse);
    setAnalytics(analyticsResponse);
    setExecutor(executorResponse);
    setDisputes(disputesResponse);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRunExecutor = async () => {
    setRunning(true);
    await runExecutorScan();
    await refresh();
    setRunning(false);
  };

  const handleToggleExecutor = async () => {
    if (!executor.settings) {
      return;
    }

    await updateExecutorSettings({
      enabled: !executor.settings.enabled,
    });
    await refresh();
  };

  const handleResolveDispute = async (dispute, resolution) => {
    if (!platformOwnerConnected) {
      alert('Connect the platform owner wallet to resolve disputes on-chain.');
      return;
    }

    if (!executeTransaction) {
      alert('Your wallet does not expose transaction execution right now.');
      return;
    }

    setResolvingDisputeId(dispute.id);

    try {
      const auctionId = Number.parseInt(dispute.auctionId, 10);
      const result = resolution === 'release_seller'
        ? await resolveDisputeReleaseSellerOnChain(executeTransaction, auctionId)
        : await resolveDisputeRefundWinnerOnChain(executeTransaction, auctionId);

      const label = resolution === 'release_seller'
        ? 'Seller released on-chain'
        : 'Winner refund submitted on-chain';
      const timelineEntry = {
        at: new Date().toISOString(),
        label,
        note: result?.transactionId
          ? `Transaction submitted: ${result.transactionId}`
          : 'Resolution transaction submitted from the admin console.',
      };

      await updateDispute(dispute.id, {
        status: resolution === 'release_seller' ? 'seller_released' : 'winner_refunded',
        resolution,
        resolutionTxId: result?.transactionId || null,
        resolvedBy: address,
        resolvedAt: new Date().toISOString(),
        timelineEntry,
      });

      await refresh();
      alert(
        result?.transactionId
          ? `Dispute resolution submitted.\n\nTransaction ID: ${result.transactionId}`
          : 'Dispute resolution submitted on-chain.'
      );
    } catch (error) {
      console.error('Failed to resolve dispute on-chain:', error);
      alert(`Failed to resolve dispute:\n\n${error.message || error}`);
    } finally {
      setResolvingDisputeId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">Operations Console</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Analytics, Executor, and Verification Ops</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            This console reads from the app data layer to surface business analytics, lifecycle automation,
            and seller-proof readiness alongside the live V2.20 flow.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleRunExecutor} disabled={running || !health}>
            <Zap className="h-4 w-4" />
            {running ? 'Running executor...' : 'Run Executor Scan'}
          </Button>
        </div>
      </div>

      {!connected && (
        <Card className="border-amber-500/30">
          <CardContent className="pt-6 text-sm text-amber-100">
            Connect a wallet to preview address-aware analytics and lifecycle notifications.
          </CardContent>
        </Card>
      )}

      {!health && !loading && (
        <Card className="border-red-500/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 text-sm text-red-100">
              <AlertCircle className="mt-0.5 h-5 w-5 text-red-300" />
              <div>
                <div className="font-semibold">Local API is offline</div>
                <div className="mt-1 text-red-100/80">
                  Start it with `npm run dev:api` inside `shadowbid-marketplace` to enable analytics sync, local
                  notifications, and executor jobs.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Auctions</CardDescription>
            <CardTitle>{analytics?.totals.auctions ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-300">Tracked inside the app operations data store.</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>GMV</CardDescription>
            <CardTitle>{formatAmount(analytics?.financials.gmv)} credits</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-300">Settled auction volume based on synced snapshots.</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Fee Potential</CardDescription>
            <CardTitle>{formatAmount(analytics?.financials.feePotential)} credits</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-300">Platform fee estimate derived from V2.20 settlement data.</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Executor Queue</CardDescription>
            <CardTitle>{executor.jobs.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-300">Lifecycle actions currently recommended by the local executor.</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Watchlists</CardDescription>
            <CardTitle>{analytics?.totals.activeWatchlists ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-300">Wallets currently following at least one auction.</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Private Offers</CardDescription>
            <CardTitle>{analytics?.totals.offers ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-300">Private offers captured through the hybrid offer flow.</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Disputes</CardDescription>
            <CardTitle>{analytics?.totals.disputes ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-300">Cases currently tracked in the local dispute center.</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-cyan-300" />
                  Auto Lifecycle Executor
                </CardTitle>
                <CardDescription>
                  Queue for `close`, `determine winner`, `finalize`, and post-settlement claim actions.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={handleToggleExecutor} disabled={!executor.settings}>
                {executor.settings?.enabled ? 'Disable' : 'Enable'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <div className="flex items-center justify-between gap-3">
                <span>Mode</span>
                <span className="font-mono text-cyan-300">{executor.settings?.mode || 'simulate'}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span>Polling</span>
                <span className="font-mono text-cyan-300">{executor.settings?.pollingSeconds || 60}s</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span>Last run</span>
                <span className="font-mono text-cyan-300">{executor.settings?.lastRunAt || 'Never'}</span>
              </div>
            </div>

            <div className="space-y-3">
              {executor.jobs.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  No executor actions are queued yet. Visit premium auction pages to sync snapshots into the operations store.
                </div>
              )}

              {executor.jobs.map((job) => (
                <div key={job.id} className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-white">{job.auctionTitle}</div>
                      <div className="mt-1 text-xs font-mono uppercase tracking-[0.18em] text-cyan-200">{job.action}</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em] text-white/70">
                      {job.priority}
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-cyan-50/90">{job.reason}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChartColumn className="h-5 w-5 text-green-300" />
                Revenue Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-200">
              <div className="flex items-center justify-between gap-3">
                <span>Settled auctions</span>
                <span className="font-mono text-green-300">{analytics?.totals.settled ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Fee claimed</span>
                <span className="font-mono text-green-300">{formatAmount(analytics?.financials.feeClaimed)} credits</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Reserve miss rate</span>
                <span className="font-mono text-green-300">{formatPercent(analytics?.rates.reserveMissRate ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Settlement rate</span>
                <span className="font-mono text-green-300">{formatPercent(analytics?.rates.settlementRate ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Refund eligible</span>
                <span className="font-mono text-green-300">{analytics?.financials.refundsEligible ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-300" />
                Verification Readiness
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-200">
              <div className="flex items-center justify-between gap-3">
                <span>Verified sellers</span>
                <span className="font-mono text-amber-300">{analytics?.totals.verifiedSellers ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Connected wallet</span>
                <span className="font-mono text-amber-300">{address || 'Not connected'}</span>
              </div>
              </CardContent>
            </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dispute Resolution</CardTitle>
              <CardDescription>
                Owner-only controls wired to the V2.20 dispute resolution transitions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!platformOwnerConnected && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                  Connect the platform owner wallet to resolve disputes on-chain. Other wallets stay read-only here.
                </div>
              )}

              {disputes.length === 0 && (
                <div className="text-sm text-slate-300">No disputes recorded yet.</div>
              )}

              {disputes.slice(0, 5).map((dispute) => {
                const isResolved = ['seller_released', 'winner_refunded'].includes(dispute.status);

                return (
                  <div key={dispute.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{dispute.title}</div>
                        <div className="mt-1 text-xs font-mono uppercase tracking-[0.18em] text-slate-400">
                          Auction {dispute.auctionId} • {dispute.status}
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">{dispute.createdAt}</span>
                    </div>
                    <div className="mt-2 line-clamp-3 text-xs text-slate-300">{dispute.description}</div>
                    {dispute.onChainDisputeRoot && (
                      <div className="mt-2 break-all font-mono text-[11px] text-cyan-300">
                        {dispute.onChainDisputeRoot}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!platformOwnerConnected || !executeTransaction || isResolved || resolvingDisputeId === dispute.id}
                        onClick={() => handleResolveDispute(dispute, 'release_seller')}
                      >
                        {resolvingDisputeId === dispute.id ? 'Submitting...' : 'Release Seller'}
                      </Button>
                      <Button
                        size="sm"
                        disabled={!platformOwnerConnected || !executeTransaction || isResolved || resolvingDisputeId === dispute.id}
                        onClick={() => handleResolveDispute(dispute, 'refund_winner')}
                      >
                        {resolvingDisputeId === dispute.id ? 'Submitting...' : 'Refund Winner'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Executor Runs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {executor.recentRuns.length === 0 && (
                <div className="text-sm text-slate-300">No executor runs yet.</div>
              )}
              {executor.recentRuns.map((run) => (
                <div key={run.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{run.jobsQueued} jobs</span>
                    <span className="font-mono text-xs text-slate-400">{run.createdAt}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-300">
                    {Object.entries(run.summary || {}).map(([key, value]) => `${key}: ${value}`).join(' • ') || 'No actions'}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
