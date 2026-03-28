import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Filter, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useLocalAuctions } from "@/hooks/useLocalAuctions";
import * as AleoServiceV2 from "@/services/aleoServiceV2";
import { mapStateToStatus } from "@/lib/auctionUtils";
import { toast } from "@/components/ui/sonner";

export default function AuctionsPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { auctions, updateAuctionStatus } = useLocalAuctions();
  const [isSyncing, setIsSyncing] = useState(false);

  // Function to sync all auction statuses from on-chain
  const syncAllStatuses = async () => {
    setIsSyncing(true);
    try {
      let updatedCount = 0;
      
      for (const auction of auctions) {
        try {
          const auctionData = await AleoServiceV2.getAuctionInfo(parseInt(auction.id));
          if (auctionData) {
            // Parse state from Leo format
            let state = 0;
            if (typeof auctionData === 'string') {
              const stateMatch = auctionData.match(/state:\s*(\d+)u8/);
              if (stateMatch) {
                state = parseInt(stateMatch[1]);
              }
            } else if (auctionData.state) {
              state = parseInt(auctionData.state);
            }
            
            const newStatus = mapStateToStatus(state);
            if (auction.status !== newStatus) {
              updateAuctionStatus(auction.id, newStatus);
              updatedCount++;
            }
          }
        } catch (error) {
          console.error(`[AuctionsPage] Error syncing auction ${auction.id}:`, error);
        }
      }
      
      if (updatedCount > 0) {
        toast.success(`Synced ${updatedCount} auction status(es)`);
      } else {
        toast.info('All statuses are up to date');
      }
    } catch (error) {
      console.error('[AuctionsPage] Error syncing statuses:', error);
      toast.error('Failed to sync statuses');
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredAuctions = useMemo(() => {
    return auctions.filter((auction) => {
      const matchesQuery = auction.title.toLowerCase().includes(query.toLowerCase()) || auction.id.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === "all" ? true : auction.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter, auctions]);

  return (
    <div className="space-y-6" data-testid="auctions-page">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl" data-testid="auctions-page-title">
          Auctions Directory
        </h1>
        <p className="mt-2 text-sm text-slate-300 md:text-base" data-testid="auctions-page-subtitle">
          Browse all private auctions, phase status, and bid details in real-time.
        </p>
      </div>

      <Card data-testid="auctions-filter-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle data-testid="auctions-filter-title">Filter Auctions</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={syncAllStatuses}
              disabled={isSyncing || auctions.length === 0}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Status'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by ID or title"
            data-testid="auctions-search-input"
          />
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 text-white pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              data-testid="auctions-status-filter"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="reveal_open">Reveal Open</option>
              <option value="pending_settlement">Pending Settlement</option>
              <option value="settled">Settled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <Button asChild data-testid="auctions-create-button">
            <Link to="/create">Create New Auction</Link>
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="auctions-table-card">
        <CardContent className="p-0">
          <div className="rounded-xl border border-slate-700/50" data-testid="auctions-table-wrapper">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead data-testid="auctions-table-head-id">ID</TableHead>
                  <TableHead data-testid="auctions-table-head-title">Auction</TableHead>
                  <TableHead data-testid="auctions-table-head-category">Category</TableHead>
                  <TableHead data-testid="auctions-table-head-minbid">Min Bid</TableHead>
                  <TableHead data-testid="auctions-table-head-status">Status</TableHead>
                  <TableHead data-testid="auctions-table-head-bids">Bids</TableHead>
                  <TableHead data-testid="auctions-table-head-action">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuctions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-slate-400">No auctions found. Create your first auction!</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAuctions.map((auction) => (
                    <TableRow key={auction.id} data-testid={`auctions-row-${auction.id.toLowerCase()}`}>
                      <TableCell className="font-mono text-xs" data-testid={`auctions-id-${auction.id.toLowerCase()}`}>
                        {auction.id}
                      </TableCell>
                      <TableCell data-testid={`auctions-title-${auction.id.toLowerCase()}`}>
                        <p className="font-medium text-white">{auction.title}</p>
                        <p className="text-xs text-slate-400">{auction.location}</p>
                      </TableCell>
                      <TableCell data-testid={`auctions-category-${auction.id.toLowerCase()}`}>{auction.category}</TableCell>
                      <TableCell data-testid={`auctions-minbid-${auction.id.toLowerCase()}`}>
                        <span className="font-semibold text-indigo-400">{auction.minBid}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={auction.status} testId={`auctions-status-${auction.id.toLowerCase()}`} />
                      </TableCell>
                      <TableCell data-testid={`auctions-bids-${auction.id.toLowerCase()}`}>{auction.bids}</TableCell>
                      <TableCell>
                        <Button asChild variant="outline" data-testid={`auctions-view-button-${auction.id.toLowerCase()}`}>
                          <Link to={`/auctions/${auction.id}`}>View Detail</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
