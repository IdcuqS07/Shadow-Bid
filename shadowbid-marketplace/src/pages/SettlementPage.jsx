import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SettlementWizard } from '@/components/settlement/SettlementWizard';
import ClaimRefundCardV2 from '@/components/settlement/ClaimRefundCardV2';
import CancelAuctionCard from '@/components/settlement/CancelAuctionCard';
import { AuctionDataManager } from '@/components/auction/AuctionDataManager';
import { useLocalAuctions } from '@/hooks/useLocalAuctions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SettlementPage() {
  const { auctions } = useLocalAuctions();
  const settledAuctions = auctions.filter(a => a.status === 'settled');

  return (
    <div className="space-y-6" data-testid="settlement-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white" data-testid="settlement-title">
          Settlement Center
        </h1>
        <p className="mt-1 text-sm text-slate-400" data-testid="settlement-subtitle">
          Manage auction settlement and claim refunds
        </p>
      </div>

      {/* Tabs for Seller vs Bidder */}
      <Tabs defaultValue="seller" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="seller">Seller Actions</TabsTrigger>
          <TabsTrigger value="bidder">Bidder Actions</TabsTrigger>
        </TabsList>

        {/* Seller Tab */}
        <TabsContent value="seller" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SettlementWizard />
            <CancelAuctionCard />
          </div>
        </TabsContent>

        {/* Bidder Tab */}
        <TabsContent value="bidder" className="space-y-6 mt-6">
          <div className="max-w-2xl">
            <ClaimRefundCardV2 />
          </div>
        </TabsContent>
      </Tabs>

      {/* Data Manager */}
      <AuctionDataManager />

      {/* Settled History */}
      <Card data-testid="settlement-history-card">
        <CardHeader>
          <CardTitle className="text-base" data-testid="settlement-history-title">
            Settled Auctions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {settledAuctions.length === 0 ? (
            <p className="text-center text-slate-400 py-8 text-sm">No settled auctions yet</p>
          ) : (
            <div className="space-y-2">
              {settledAuctions.map((auction) => (
                <div key={auction.id} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-white">{auction.title}</p>
                    <p className="font-mono text-xs text-slate-400">{auction.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-green-400">Settled</p>
                    <p className="text-xs text-slate-400">{auction.closingDate}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
