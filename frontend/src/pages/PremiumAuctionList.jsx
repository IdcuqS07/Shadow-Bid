import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { getAuctionInfo, getAssetTypeName, getAssetTypeIcon } from '@/services/aleoServiceV2';
import {
  getSavedSearches,
  getWatchlist,
  saveSavedSearches,
  saveWatchlist,
  syncAuctionRole,
  syncAuctionSnapshot,
} from '@/services/localOpsService';
import GlassCard from '@/components/premium/GlassCard';
import PremiumButton from '@/components/premium/PremiumButton';
import PremiumNav from '@/components/premium/PremiumNav';
import StatusBadge from '@/components/premium/StatusBadge';
import { Clock, TrendingUp, Shield, Search, Filter, Info, CheckCircle, Bookmark, BookmarkCheck } from 'lucide-react';

function parseAleoInteger(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const match = value.match(/-?\d+/);
    return match ? parseInt(match[0], 10) : null;
  }

  return null;
}

function getAuctionMetadataEndTime(auction) {
  if (!auction?.createdAt) {
    return null;
  }

  if (Number.isFinite(auction.durationSeconds)) {
    return Math.floor(auction.createdAt / 1000) + auction.durationSeconds;
  }

  const durationValue = parseInt(auction.durationValue ?? auction.duration ?? 24, 10);
  if (!Number.isFinite(durationValue) || durationValue <= 0) {
    return Math.floor(auction.createdAt / 1000) + 24 * 3600;
  }

  const durationUnit = auction.durationUnit || 'hours';
  const multiplier = durationUnit === 'minutes'
    ? 60
    : durationUnit === 'days'
      ? 24 * 3600
      : 3600;

  return Math.floor(auction.createdAt / 1000) + durationValue * multiplier;
}

export default function PremiumAuctionList() {
  const navigate = useNavigate();
  const { connected, address } = useWallet();
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all'); // NEW: Category filter
  const [searchQuery, setSearchQuery] = useState('');
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState({
    auctionIds: [],
    sellers: [],
    categories: [],
  });
  const [savedSearches, setSavedSearches] = useState([]);

  // V2.18 is now default - no need to set version

  // Load auctions from localStorage and blockchain
  useEffect(() => {
    loadAuctions();
  }, []);

  useEffect(() => {
    if (!address) {
      setWatchlist({
        auctionIds: [],
        sellers: [],
        categories: [],
      });
      setSavedSearches([]);
      return;
    }

    const loadEngagementData = async () => {
      const [watchlistResponse, savedSearchResponse] = await Promise.all([
        getWatchlist(address),
        getSavedSearches(address),
      ]);

      setWatchlist(watchlistResponse);
      setSavedSearches(savedSearchResponse.searches || []);
    };

    loadEngagementData();
  }, [address]);

  const loadAuctions = async () => {
    setLoading(true);
    try {
      // Get auctions from localStorage
      const myAuctions = JSON.parse(localStorage.getItem('myAuctions') || '[]');
      console.log('📋 Loaded auctions from localStorage:', myAuctions);
      
      // Fetch on-chain data for each auction
      const auctionsWithData = await Promise.all(
        myAuctions.map(async (auction) => {
          try {
            console.log(`🔍 Fetching on-chain data for auction ${auction.id}...`);
            const onChainData = await getAuctionInfo(auction.id);
            console.log(`📊 On-chain data for ${auction.id}:`, onChainData);
            
            // Calculate time remaining
            const now = Math.floor(Date.now() / 1000);
            const endTime = parseAleoInteger(onChainData?.end_time) || getAuctionMetadataEndTime(auction) || (now + 24 * 3600);
            const timeRemaining = endTime - now;
            
            let status = 'active';
            if (timeRemaining < 0) {
              status = 'ended';
            } else if (timeRemaining < 3600) {
              status = 'ending-soon';
            }
            
            // Format time remaining
            const hours = Math.floor(timeRemaining / 3600);
            const minutes = Math.floor((timeRemaining % 3600) / 60);
            const timeString = timeRemaining > 0 
              ? `${hours}h ${minutes}m`
              : 'Ended';
            
            const auctionData = {
              id: auction.id,
              title: auction.title,
              format: 'Sealed-Bid',
              currentBid: onChainData?.highest_bid ? (parseInt(onChainData.highest_bid) / 1_000_000).toFixed(1) : auction.minBid,
              minBid: auction.minBid,
              endTime: timeString,
              status,
              bidCount: onChainData?.bid_count || 0,
              currency: auction.currency || 'ALEO',
              assetType: auction.assetType || 0, // NEW: Asset type
              seller: auction.creator || null,
              reservePrice: auction.reservePrice || auction.minBid || '0',
              proofFilesCount: Array.isArray(auction.proofFiles) ? auction.proofFiles.length : 0,
              itemPhotosCount: Array.isArray(auction.itemPhotos) ? auction.itemPhotos.length : 0,
              verificationStatus: auction.sellerVerification?.status || 'pending',
              featured: false,
            };
            
            console.log(`✅ Processed auction ${auction.id}:`, auctionData);
            return auctionData;
          } catch (error) {
            console.error(`❌ Error loading auction ${auction.id}:`, error);
            // Return auction with local data only
            return {
              id: auction.id,
              title: auction.title,
              format: 'Sealed-Bid',
              currentBid: auction.minBid,
              minBid: auction.minBid,
              endTime: 'Loading...',
              status: 'active',
              bidCount: 0,
              currency: auction.currency || 'ALEO',
              assetType: auction.assetType || 0, // NEW: Asset type
              featured: false,
            };
          }
        })
      );
      
      // Sort by creation time (newest first)
      auctionsWithData.sort((a, b) => b.id - a.id);
      
      // Mark first active auction as featured
      const firstActive = auctionsWithData.findIndex(a => a.status === 'active');
      if (firstActive >= 0) {
        auctionsWithData[firstActive].featured = true;
      }
      
      console.log('📊 Final auctions list:', auctionsWithData);
      setAuctions(auctionsWithData);

      await Promise.allSettled(auctionsWithData.map(async (auction) => {
        await syncAuctionSnapshot({
          id: auction.id,
          title: auction.title,
          status: auction.status === 'active' || auction.status === 'ending-soon' ? 'open' : 'closed',
          contractState: auction.status.toUpperCase(),
          seller: auction.seller,
          winner: null,
          token: auction.currency,
          endTimestamp: getAuctionMetadataEndTime(myAuctions.find((item) => item.id === auction.id)),
          reservePrice: parseFloat(auction.reservePrice || '0'),
          reserveMet: null,
          settledAt: 0,
          claimableAt: 0,
          itemReceived: false,
          paymentClaimed: false,
          platformFeeClaimed: false,
          winningBid: parseFloat(auction.currentBid || '0'),
          winningAmountMicro: null,
          platformFee: 0,
          platformFeeMicro: null,
          sellerNetAmount: 0,
          sellerNetAmountMicro: null,
          totalEscrowed: 0,
          totalEscrowedMicro: 0,
          assetType: auction.assetType,
          currencyType: auction.currency === 'ALEO' ? 1 : auction.currency === 'USAD' ? 2 : 0,
          itemPhotosCount: auction.itemPhotosCount,
          proofFilesCount: auction.proofFilesCount,
          verificationStatus: auction.verificationStatus,
        });

        if (auction.seller) {
          await syncAuctionRole({
            auctionId: auction.id,
            wallet: auction.seller,
            roles: ['seller'],
          });
        }
      }));
    } catch (error) {
      console.error('❌ Error loading auctions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWatchlist = async (auctionId, event) => {
    event.stopPropagation();

    if (!address) {
      alert('Connect your wallet first to save a watchlist.');
      return;
    }

    const normalizedAuctionId = String(auctionId);
    const nextAuctionIds = watchlist.auctionIds.includes(normalizedAuctionId)
      ? watchlist.auctionIds.filter((id) => id !== normalizedAuctionId)
      : [...watchlist.auctionIds, normalizedAuctionId];

    const nextWatchlist = {
      ...watchlist,
      auctionIds: nextAuctionIds,
    };

    setWatchlist(nextWatchlist);
    await saveWatchlist(address, nextWatchlist);
  };

  const handleSaveCurrentSearch = async () => {
    if (!address) {
      alert('Connect your wallet first to save your filters.');
      return;
    }

    const nextSearch = {
      id: `search_${Date.now()}`,
      label: searchQuery ? `Search: ${searchQuery}` : `Filter ${filter}/${categoryFilter}`,
      query: searchQuery,
      filter,
      categoryFilter,
      savedAt: new Date().toISOString(),
    };
    const nextSearches = [nextSearch, ...savedSearches].slice(0, 6);
    setSavedSearches(nextSearches);
    await saveSavedSearches(address, nextSearches);
  };

  const filteredAuctions = auctions.filter(auction => {
    // Status filter
    if (filter !== 'all' && auction.status !== filter) return false;
    
    // Category filter (NEW)
    if (categoryFilter !== 'all' && auction.assetType !== parseInt(categoryFilter)) return false;
    
    // Search query
    if (searchQuery && !auction.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    return true;
  });

  const featuredAuction = filteredAuctions.find(a => a.featured);
  const regularAuctions = filteredAuctions.filter(a => !a.featured);
  const isWatched = (auctionId) => watchlist.auctionIds.includes(String(auctionId));

  return (
    <div className="min-h-screen bg-void-900 text-white">
      {/* Header */}
      <PremiumNav />
      
      <div className="border-b border-white/5 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between gap-6 mb-4">
            {/* Search */}
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                placeholder="Search auctions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-void-800 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:border-gold-500/50 focus:outline-none focus:ring-2 focus:ring-gold-500/20 transition-all"
              />
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-3">
              {['all', 'active', 'ending-soon'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg font-mono text-sm uppercase tracking-wider transition-all ${
                    filter === f
                      ? 'bg-gold-500 text-void-900'
                      : 'bg-void-800 text-white/60 hover:text-white'
                  }`}
                >
                  {f.replace('-', ' ')}
                </button>
              ))}
            </div>

            {/* Create Button */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveCurrentSearch}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-mono text-cyan-300 transition-colors hover:bg-cyan-500/20"
              >
                <Bookmark className="h-4 w-4" />
                Save Search
              </button>
              <PremiumButton onClick={() => navigate('/premium-create')}>
                Create Auction
              </PremiumButton>
            </div>
          </div>
          
          {/* Category Filter - NEW V2.18 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-mono text-white/60">
              <Filter className="w-4 h-4" />
              <span>Category:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all ${
                  categoryFilter === 'all'
                    ? 'bg-cyan-500 text-void-900'
                    : 'bg-void-800 text-white/60 hover:text-white border border-white/10'
                }`}
              >
                All
              </button>
              {[
                { value: '0', label: 'Physical', icon: '📦' },
                { value: '1', label: 'Collectibles', icon: '🎨' },
                { value: '2', label: 'Real Estate', icon: '🏠' },
                { value: '3', label: 'Digital', icon: '💎' },
                { value: '4', label: 'Services', icon: '💼' },
                { value: '5', label: 'Tickets', icon: '🎫' },
                { value: '6', label: 'Vehicles', icon: '🚗' },
                { value: '7', label: 'IP', icon: '📜' },
              ].map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategoryFilter(cat.value)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all flex items-center gap-1.5 ${
                    categoryFilter === cat.value
                      ? 'bg-gold-500 text-void-900'
                      : 'bg-void-800 text-white/60 hover:text-white border border-white/10'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/40 rounded text-xs font-mono text-green-400">
              <CheckCircle className="w-3 h-3" />
              V2.20
            </span>
          </div>

          {savedSearches.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {savedSearches.map((savedSearch) => (
                <button
                  key={savedSearch.id}
                  type="button"
                  onClick={() => {
                    setSearchQuery(savedSearch.query || '');
                    setFilter(savedSearch.filter || 'all');
                    setCategoryFilter(savedSearch.categoryFilter || 'all');
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-mono text-white/70 transition-colors hover:bg-white/10"
                >
                  <BookmarkCheck className="h-3.5 w-3.5 text-cyan-300" />
                  {savedSearch.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-8 py-12">
        {/* Version Notice */}
        <div className="mb-8 p-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-cyan-400 mt-0.5" />
            <div className="flex-1">
              <div className="font-mono text-sm text-cyan-400 mb-1">
                Currently Running: V2.20 (Production)
              </div>
              <div className="text-xs text-white/60">
                All auctions here use the contract-backed V2.20 sealed-bid flow with reserve price, secure payout checks, dispute resolution, and RWA settlement fields.
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Active Auctions', value: auctions.filter(a => a.status === 'active').length, icon: TrendingUp },
            { label: 'Total Auctions', value: auctions.length, icon: Shield },
            { label: 'Watchlist', value: watchlist.auctionIds.length, icon: Bookmark },
            { label: 'Ending Soon', value: auctions.filter(a => a.status === 'ending-soon').length, icon: Clock },
          ].map((stat, i) => (
            <GlassCard key={i} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="text-sm font-mono text-white/40 uppercase tracking-wider">
                  {stat.label}
                </div>
                <stat.icon className="w-5 h-5 text-gold-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-display font-bold text-white">
                  {stat.value}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-void-800 rounded-xl border border-white/10">
              <div className="w-4 h-4 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
              <span className="font-mono text-white/60">Loading auctions...</span>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && auctions.length === 0 && (
          <div className="text-center py-12">
            <GlassCard className="p-12 max-w-md mx-auto">
              <Shield className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <h3 className="text-xl font-display font-bold mb-2">No Auctions Yet</h3>
              <p className="text-white/60 mb-6">
                Create your first private sealed-bid auction
              </p>
              <PremiumButton onClick={() => navigate('/premium-create')}>
                Create Auction
              </PremiumButton>
            </GlassCard>
          </div>
        )}

        {/* Asymmetric Grid Layout */}
        {!loading && auctions.length > 0 && (
          <div className="grid grid-cols-12 gap-6">
          {/* Featured Auction - Large */}
          {featuredAuction && (
            <div className="col-span-12 lg:col-span-8">
              <GlassCard 
                hover 
                className="p-8 cursor-pointer group relative overflow-hidden"
                onClick={() => navigate(`/premium-auction/${featuredAuction.id}`)}
              >
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-gold-500/10 via-transparent to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <StatusBadge status={featuredAuction.status} />
                        <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
                          {featuredAuction.format}
                        </span>
                        {/* Category Badge - NEW */}
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/20 border border-cyan-500/40 rounded text-xs font-mono text-cyan-400">
                          {getAssetTypeIcon(featuredAuction.assetType)} {getAssetTypeName(featuredAuction.assetType)}
                        </span>
                      </div>
                      <h2 className="text-4xl font-display font-bold mb-2 group-hover:text-gold-400 transition-colors">
                        {featuredAuction.title}
                      </h2>
                      <p className="text-white/60 font-mono text-sm">
                        Auction #{featuredAuction.id}
                      </p>
                    </div>
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={(event) => handleToggleWatchlist(featuredAuction.id, event)}
                        className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
                          isWatched(featuredAuction.id)
                            ? 'border-gold-500/40 bg-gold-500/10 text-gold-300'
                            : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        {isWatched(featuredAuction.id) ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                        {isWatched(featuredAuction.id) ? 'Watching' : 'Watchlist'}
                      </button>
                      <div className="text-sm font-mono text-white/40 mb-1">Current Bid</div>
                      <div className="text-3xl font-display font-bold text-gold-500">
                        {featuredAuction.currentBid}
                      </div>
                      <div className="text-sm font-mono text-cyan-400">{featuredAuction.currency}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/5">
                    <div>
                      <div className="text-xs font-mono text-white/40 uppercase tracking-wider mb-2">
                        Min Bid
                      </div>
                      <div className="text-xl font-display font-bold">
                        {featuredAuction.minBid} <span className="text-sm text-cyan-400">{featuredAuction.currency}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-mono text-white/40 uppercase tracking-wider mb-2">
                        Ends In
                      </div>
                      <div className="text-xl font-display font-bold flex items-center gap-2">
                        <Clock className="w-5 h-5 text-gold-500" />
                        {featuredAuction.endTime}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-mono text-white/40 uppercase tracking-wider mb-2">
                        Total Bids
                      </div>
                      <div className="text-xl font-display font-bold">
                        {featuredAuction.bidCount}
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {/* Regular Auctions - Asymmetric Grid */}
          {regularAuctions.slice(0, 2).map((auction, i) => (
            <div key={auction.id} className="col-span-12 lg:col-span-4">
              <GlassCard 
                hover 
                className="p-6 cursor-pointer group h-full"
                onClick={() => navigate(`/premium-auction/${auction.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <StatusBadge status={auction.status} />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
                      {auction.format}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => handleToggleWatchlist(auction.id, event)}
                      className="rounded-full border border-white/10 bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {isWatched(auction.id) ? <BookmarkCheck className="h-3.5 w-3.5 text-gold-300" /> : <Bookmark className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                
                <h3 className="text-xl font-display font-bold mb-2 group-hover:text-gold-400 transition-colors">
                  {auction.title}
                </h3>
                <p className="text-white/60 font-mono text-xs mb-4">
                  #{auction.id}
                </p>

                <div className="space-y-3 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white/40">Current Bid</span>
                    <span className="text-lg font-display font-bold text-gold-500">
                      {auction.currentBid} <span className="text-xs text-cyan-400">{auction.currency}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white/40">Ends In</span>
                    <span className="text-sm font-mono text-white flex items-center gap-1">
                      <Clock className="w-4 h-4 text-gold-500" />
                      {auction.endTime}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white/40">Bids</span>
                    <span className="text-sm font-mono text-white">{auction.bidCount}</span>
                  </div>
                </div>
              </GlassCard>
            </div>
          ))}

          {/* Wide Card */}
          {regularAuctions[2] && (
            <div className="col-span-12 lg:col-span-8">
              <GlassCard 
                hover 
                className="p-6 cursor-pointer group"
                onClick={() => navigate(`/premium-auction/${regularAuctions[2].id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <StatusBadge status={regularAuctions[2].status} />
                      <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
                        {regularAuctions[2].format}
                      </span>
                      {/* Category Badge - NEW */}
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/20 border border-cyan-500/40 rounded text-xs font-mono text-cyan-400">
                        {getAssetTypeIcon(regularAuctions[2].assetType)} {getAssetTypeName(regularAuctions[2].assetType)}
                      </span>
                    </div>
                    <h3 className="text-2xl font-display font-bold mb-1 group-hover:text-gold-400 transition-colors">
                      {regularAuctions[2].title}
                    </h3>
                    <p className="text-white/60 font-mono text-xs">
                      #{regularAuctions[2].id}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-8">
                    <button
                      type="button"
                      onClick={(event) => handleToggleWatchlist(regularAuctions[2].id, event)}
                      className="rounded-full border border-white/10 bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {isWatched(regularAuctions[2].id) ? <BookmarkCheck className="h-4 w-4 text-gold-300" /> : <Bookmark className="h-4 w-4" />}
                    </button>
                    <div className="text-right">
                      <div className="text-xs font-mono text-white/40 mb-1">Current Bid</div>
                      <div className="text-2xl font-display font-bold text-gold-500">
                        {regularAuctions[2].currentBid}
                      </div>
                      <div className="text-xs font-mono text-cyan-400">{regularAuctions[2].currency}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono text-white/40 mb-1">Ends In</div>
                      <div className="text-xl font-display font-bold flex items-center gap-2">
                        <Clock className="w-5 h-5 text-gold-500" />
                        {regularAuctions[2].endTime}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono text-white/40 mb-1">Bids</div>
                      <div className="text-xl font-display font-bold">
                        {regularAuctions[2].bidCount}
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {/* Remaining Cards */}
          {regularAuctions.slice(3).map((auction) => (
            <div key={auction.id} className="col-span-12 lg:col-span-4">
              <GlassCard 
                hover 
                className="p-6 cursor-pointer group h-full"
                onClick={() => navigate(`/premium-auction/${auction.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <StatusBadge status={auction.status} />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
                      {auction.format}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => handleToggleWatchlist(auction.id, event)}
                      className="rounded-full border border-white/10 bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {isWatched(auction.id) ? <BookmarkCheck className="h-3.5 w-3.5 text-gold-300" /> : <Bookmark className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                
                <h3 className="text-xl font-display font-bold mb-2 group-hover:text-gold-400 transition-colors">
                  {auction.title}
                </h3>
                <p className="text-white/60 font-mono text-xs mb-4">
                  #{auction.id}
                </p>

                <div className="space-y-3 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white/40">Current Bid</span>
                    <span className="text-lg font-display font-bold text-gold-500">
                      {auction.currentBid} <span className="text-xs text-cyan-400">{auction.currency}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white/40">Ends In</span>
                    <span className="text-sm font-mono text-white flex items-center gap-1">
                      <Clock className="w-4 h-4 text-gold-500" />
                      {auction.endTime}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white/40">Bids</span>
                    <span className="text-sm font-mono text-white">{auction.bidCount}</span>
                  </div>
                </div>
              </GlassCard>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
