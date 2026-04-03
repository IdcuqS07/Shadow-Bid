import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import {
  calculatePlatformFee,
  calculateSellerNetAmount,
  EMPTY_ALEO_ADDRESS,
  getAuctionInfo,
  getAssetTypeName,
  getAssetTypeIcon,
} from '@/services/aleoServiceV2';
import {
  getAuctionSnapshots,
  getOpsApiDebugInfo,
  getSavedSearches,
  getWatchlist,
  saveSavedSearches,
  saveWatchlist,
  syncAuctionRole,
  syncAuctionSnapshot,
} from '@/services/localOpsService';
import { mapStateToStatus } from '@/lib/auctionUtils';
import GlassCard from '@/components/premium/GlassCard';
import PremiumButton from '@/components/premium/PremiumButton';
import PremiumNav from '@/components/premium/PremiumNav';
import PremiumSelect from '@/components/premium/PremiumSelect';
import StatusBadge from '@/components/premium/StatusBadge';
import { Clock, TrendingUp, Shield, Search, Filter, Info, CheckCircle, Bookmark, BookmarkCheck, UserRoundCheck } from 'lucide-react';

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

function parseAleoUnsignedIntegerString(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value).toString();
  }

  if (typeof value === 'bigint' && value >= 0n) {
    return value.toString();
  }

  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d+)(?:u\d+)?(?:\.(?:public|private))?$/);
    return match ? match[1] : null;
  }

  return null;
}

function parseAleoBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }

  return null;
}

function microToDisplayAmount(value) {
  const parsedValue = parseAleoInteger(value);
  return parsedValue !== null ? parsedValue / 1_000_000 : 0;
}

function hasMeaningfulMicroAmount(value) {
  const parsedValue = parseAleoUnsignedIntegerString(value);
  return parsedValue !== null && parsedValue !== '0';
}

function formatCompactAmount(value) {
  const parsedValue = microToDisplayAmount(value);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: parsedValue > 0 && parsedValue < 10 ? 1 : 0,
    maximumFractionDigits: parsedValue > 0 && parsedValue < 1 ? 2 : 2,
  }).format(parsedValue);
}

function normalizeWalletAddress(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function formatDurationLabel(totalSeconds) {
  if (!Number.isFinite(totalSeconds)) {
    return 'Unknown';
  }

  if (totalSeconds <= 0) {
    return 'Ended';
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return '<1m';
}

function deriveAuctionPresentation({
  status,
  endTimestamp,
  revealDeadline,
  disputeDeadline,
  winningAmountMicro,
  totalEscrowedMicro,
  currency,
}) {
  const now = Math.floor(Date.now() / 1000);
  const biddingEnded = Number.isFinite(endTimestamp) && endTimestamp <= now;
  const revealWindowOpen = Number.isFinite(revealDeadline) && revealDeadline > now;
  const disputeWindowOpen = Number.isFinite(disputeDeadline) && disputeDeadline > now;
  const hasWinningAmount = hasMeaningfulMicroAmount(winningAmountMicro);
  const hasEscrow = hasMeaningfulMicroAmount(totalEscrowedMicro);
  const formattedWinningAmount = hasWinningAmount ? formatCompactAmount(winningAmountMicro) : null;

  if (status === 'settled') {
    return {
      displayStatus: 'settled',
      metricLabel: hasWinningAmount ? 'Winning Bid' : 'Settlement',
      metricValue: hasWinningAmount ? formattedWinningAmount : 'Complete',
      metricCurrency: hasWinningAmount ? currency : null,
      timingLabel: 'Settlement',
      timingValue: 'Completed',
      isLiveBidding: false,
      isAwaitingClose: false,
      isEndingSoon: false,
    };
  }

  if (status === 'disputed') {
    return {
      displayStatus: 'disputed',
      metricLabel: 'Dispute',
      metricValue: 'Active',
      metricCurrency: null,
      timingLabel: 'Status',
      timingValue: 'In review',
      isLiveBidding: false,
      isAwaitingClose: false,
      isEndingSoon: false,
    };
  }

  if (status === 'challenge') {
    return {
      displayStatus: 'dispute-window',
      metricLabel: 'Winning Bid',
      metricValue: hasWinningAmount ? formattedWinningAmount : 'Pending',
      metricCurrency: hasWinningAmount ? currency : null,
      timingLabel: 'Dispute Window',
      timingValue: disputeWindowOpen ? formatDurationLabel(disputeDeadline - now) : 'Ready to finalize',
      isLiveBidding: false,
      isAwaitingClose: false,
      isEndingSoon: false,
    };
  }

  if (status === 'closed') {
    if (revealWindowOpen) {
      return {
        displayStatus: 'reveal-phase',
        metricLabel: 'Highest Reveal',
        metricValue: hasWinningAmount ? formattedWinningAmount : 'Pending',
        metricCurrency: hasWinningAmount ? currency : null,
        timingLabel: 'Reveal Window',
        timingValue: formatDurationLabel(revealDeadline - now),
        isLiveBidding: false,
        isAwaitingClose: false,
        isEndingSoon: false,
      };
    }

    return {
      displayStatus: 'awaiting-settlement',
      metricLabel: 'Highest Reveal',
      metricValue: hasWinningAmount ? formattedWinningAmount : 'No valid reveal',
      metricCurrency: hasWinningAmount ? currency : null,
      timingLabel: 'Settlement',
      timingValue: 'Seller can settle',
      isLiveBidding: false,
      isAwaitingClose: false,
      isEndingSoon: false,
    };
  }

  if (status === 'cancelled') {
    return {
      displayStatus: 'cancelled',
      metricLabel: 'Outcome',
      metricValue: 'Cancelled',
      metricCurrency: null,
      timingLabel: 'Refunds',
      timingValue: hasEscrow ? 'Available' : 'No escrow',
      isLiveBidding: false,
      isAwaitingClose: false,
      isEndingSoon: false,
    };
  }

  if (biddingEnded) {
    return {
      displayStatus: 'awaiting-close',
      metricLabel: 'Bid Visibility',
      metricValue: 'Sealed',
      metricCurrency: null,
      timingLabel: 'Bidding Ended',
      timingValue: 'Seller must close',
      isLiveBidding: false,
      isAwaitingClose: true,
      isEndingSoon: false,
    };
  }

  const secondsRemaining = Number.isFinite(endTimestamp) ? endTimestamp - now : null;

  return {
    displayStatus: 'active',
    metricLabel: 'Bid Visibility',
    metricValue: 'Sealed',
    metricCurrency: null,
    timingLabel: 'Ends In',
    timingValue: formatDurationLabel(secondsRemaining),
    isLiveBidding: true,
    isAwaitingClose: false,
    isEndingSoon: Number.isFinite(secondsRemaining) && secondsRemaining > 0 && secondsRemaining < 3600,
  };
}

function getFeaturedAuctionRank(auction) {
  const priority = {
    active: 0,
    'awaiting-close': 1,
    'reveal-phase': 2,
    'awaiting-settlement': 3,
    'dispute-window': 4,
    disputed: 5,
    settled: 6,
    cancelled: 7,
  };

  return priority[auction.displayStatus] ?? 99;
}

function getContractStateLabel(state) {
  switch (state) {
    case 0:
      return 'OPEN';
    case 1:
      return 'CLOSED';
    case 2:
      return 'CHALLENGE';
    case 3:
      return 'SETTLED';
    case 4:
      return 'CANCELLED';
    case 5:
      return 'DISPUTED';
    default:
      return 'OPEN';
  }
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

function normalizeAuctionLifecycleStatus(status) {
  if (typeof status !== 'string') {
    return null;
  }

  switch (status.trim().toLowerCase()) {
    case 'active':
      return 'open';
    case 'open':
    case 'closed':
    case 'challenge':
    case 'settled':
    case 'cancelled':
    case 'disputed':
      return status.trim().toLowerCase();
    default:
      return null;
  }
}

function inferCurrencyFromAuction(auction) {
  if (typeof auction?.currency === 'string' && auction.currency.trim()) {
    return auction.currency.trim();
  }

  if (typeof auction?.token === 'string' && auction.token.trim()) {
    return auction.token.trim();
  }

  switch (Number(auction?.currencyType)) {
    case 0:
      return 'USDCx';
    case 2:
      return 'USAD';
    case 1:
    default:
      return 'ALEO';
  }
}

function normalizeAuctionSeed(auction) {
  if (!auction || auction.id == null) {
    return null;
  }

  const normalizedId = Number(auction.id);
  if (!Number.isFinite(normalizedId)) {
    return null;
  }

  const proofFiles = Array.isArray(auction.proofFiles) ? auction.proofFiles : [];
  const itemPhotos = Array.isArray(auction.itemPhotos) ? auction.itemPhotos : [];
  const proofFilesCount = Number.isFinite(Number(auction.proofFilesCount))
    ? Number(auction.proofFilesCount)
    : proofFiles.length;
  const itemPhotosCount = Number.isFinite(Number(auction.itemPhotosCount))
    ? Number(auction.itemPhotosCount)
    : itemPhotos.length;

  return {
    ...auction,
    id: normalizedId,
    title: auction.title || `Auction #${normalizedId}`,
    currency: inferCurrencyFromAuction(auction),
    creator: auction.creator || auction.seller || null,
    status: normalizeAuctionLifecycleStatus(auction.status),
    assetType: Number(auction.assetType || 0),
    minBid: auction.minBid ?? auction.reservePrice ?? '0',
    reservePrice: auction.reservePrice ?? auction.minBid ?? '0',
    sellerVerification: auction.sellerVerification || (
      auction.verificationStatus
        ? { status: auction.verificationStatus }
        : null
    ),
    proofFiles,
    itemPhotos,
    proofFilesCount,
    itemPhotosCount,
  };
}

function mergeAuctionSeedRecord(existingAuction, incomingAuction) {
  if (!existingAuction) {
    return incomingAuction;
  }

  return {
    ...existingAuction,
    ...incomingAuction,
    title: incomingAuction.title || existingAuction.title,
    description: incomingAuction.description || existingAuction.description,
    currency: incomingAuction.currency || existingAuction.currency,
    creator: incomingAuction.creator || existingAuction.creator || existingAuction.seller || null,
    minBid: incomingAuction.minBid ?? existingAuction.minBid,
    reservePrice: incomingAuction.reservePrice ?? existingAuction.reservePrice,
    endTimestamp: incomingAuction.endTimestamp ?? existingAuction.endTimestamp,
    sellerVerification: incomingAuction.sellerVerification || existingAuction.sellerVerification || null,
    proofFiles: incomingAuction.proofFiles.length > 0 ? incomingAuction.proofFiles : existingAuction.proofFiles,
    itemPhotos: incomingAuction.itemPhotos.length > 0 ? incomingAuction.itemPhotos : existingAuction.itemPhotos,
    proofFilesCount: incomingAuction.proofFilesCount || existingAuction.proofFilesCount || 0,
    itemPhotosCount: incomingAuction.itemPhotosCount || existingAuction.itemPhotosCount || 0,
    status: incomingAuction.status || existingAuction.status,
  };
}

function mergeAuctionSources(localAuctions, sharedAuctions) {
  const mergedById = new Map();

  for (const auction of sharedAuctions.map(normalizeAuctionSeed).filter(Boolean)) {
    mergedById.set(String(auction.id), auction);
  }

  for (const auction of localAuctions.map(normalizeAuctionSeed).filter(Boolean)) {
    const key = String(auction.id);
    mergedById.set(key, mergeAuctionSeedRecord(mergedById.get(key), auction));
  }

  return Array.from(mergedById.values());
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Live' },
  { value: 'awaiting-close', label: 'Await Close' },
  { value: 'closed', label: 'Closed' },
  { value: 'challenge', label: 'Challenge' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'settled', label: 'Settled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'ending-soon', label: 'Ending Soon' },
];

const CATEGORY_FILTER_OPTIONS = [
  { value: 'all', label: 'All', icon: null },
  { value: '0', label: 'Physical', icon: '📦' },
  { value: '1', label: 'Collectibles', icon: '🎨' },
  { value: '2', label: 'Real Estate', icon: '🏠' },
  { value: '3', label: 'Digital', icon: '💎' },
  { value: '4', label: 'Services', icon: '💼' },
  { value: '5', label: 'Tickets', icon: '🎫' },
  { value: '6', label: 'Vehicles', icon: '🚗' },
  { value: '7', label: 'IP', icon: '📜' },
];

export default function PremiumAuctionList() {
  const navigate = useNavigate();
  const { address } = useWallet();
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
  const opsDebugInfo = getOpsApiDebugInfo();

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
      const localAuctions = JSON.parse(localStorage.getItem('myAuctions') || '[]');
      const sharedAuctions = await getAuctionSnapshots();
      const auctionSeeds = mergeAuctionSources(localAuctions, sharedAuctions);

      console.log('📋 Loaded local auctions:', localAuctions);
      console.log('🌐 Loaded shared auction snapshots:', sharedAuctions);
      console.log('🧩 Merged auction seeds:', auctionSeeds);
      
      // Fetch on-chain data for each auction
      const auctionsWithData = await Promise.all(
        auctionSeeds.map(async (auction) => {
          try {
            console.log(`🔍 Fetching on-chain data for auction ${auction.id}...`);
            const onChainData = await getAuctionInfo(auction.id);
            console.log(`📊 On-chain data for ${auction.id}:`, onChainData);
            
            const now = Math.floor(Date.now() / 1000);
            const endTime = parseAleoInteger(onChainData?.end_time)
              ?? auction.endTimestamp
              ?? getAuctionMetadataEndTime(auction)
              ?? (now + 24 * 3600);
            const state = parseAleoInteger(onChainData?.state);
            const status = state !== null
              ? mapStateToStatus(state)
              : normalizeAuctionLifecycleStatus(auction.status)
                ?? (endTime <= now ? 'closed' : 'open');

            const fallbackCurrencyType =
              auction.currency === 'ALEO'
                ? 1
                : auction.currency === 'USAD'
                  ? 2
                  : 0;
            const currencyType = parseAleoInteger(onChainData?.currency_type) ?? fallbackCurrencyType;
            const winningAmountMicro = parseAleoUnsignedIntegerString(onChainData?.winning_amount);
            const currentBid = winningAmountMicro
              ? formatCompactAmount(winningAmountMicro)
              : '0';
            const winner = typeof onChainData?.winner === 'string' && onChainData.winner !== EMPTY_ALEO_ADDRESS
              ? onChainData.winner
              : null;
            const reservePriceMicro = parseAleoUnsignedIntegerString(onChainData?.reserve_price)
              ?? (
                auction.reservePrice
                  ? `${Math.round(parseFloat(auction.reservePrice) * 1_000_000)}`
                  : null
              );
            const platformFeeMicro = parseAleoUnsignedIntegerString(onChainData?.platform_fee_amount)
              ?? (winningAmountMicro ? calculatePlatformFee(winningAmountMicro) : null);
            const sellerNetAmountMicro = parseAleoUnsignedIntegerString(onChainData?.seller_net_amount)
              ?? (winningAmountMicro ? calculateSellerNetAmount(winningAmountMicro) : null);
            const totalEscrowedMicro = parseAleoUnsignedIntegerString(onChainData?.total_escrowed) || '0';
            const revealDeadline = parseAleoInteger(onChainData?.reveal_deadline) ?? 0;
            const disputeDeadline = parseAleoInteger(onChainData?.dispute_deadline) ?? 0;
            const presentation = deriveAuctionPresentation({
              status,
              endTimestamp: endTime,
              revealDeadline,
              disputeDeadline,
              winningAmountMicro,
              totalEscrowedMicro,
              currency: auction.currency || 'ALEO',
            });

            const auctionData = {
              id: auction.id,
              title: auction.title,
              description: auction.description || '',
              format: 'Sealed-Bid',
              currentBid,
              minBid: auction.minBid,
              status,
              displayStatus: presentation.displayStatus,
              contractState: getContractStateLabel(state),
              state,
              isEndingSoon: presentation.isEndingSoon,
              bidCount: onChainData?.bid_count || 0,
              currency: auction.currency || 'ALEO',
              currencyType,
              assetType: auction.assetType || 0, // NEW: Asset type
              creator: auction.creator || auction.seller || null,
              seller: onChainData?.seller || auction.creator || null,
              sellerDisplayName: auction.sellerDisplayName || null,
              winner,
              winningBid: winningAmountMicro ? microToDisplayAmount(winningAmountMicro) : 0,
              winningAmountMicro,
              endTimestamp: endTime,
              revealPeriod: parseAleoInteger(onChainData?.reveal_period) ?? parseAleoInteger(onChainData?.challenge_period) ?? 0,
              disputePeriod: parseAleoInteger(onChainData?.dispute_period) ?? parseAleoInteger(onChainData?.challenge_period) ?? 0,
              revealDeadline,
              disputeDeadline,
              reservePrice: auction.reservePrice || auction.minBid || '0',
              reservePriceMicro,
              reserveMet: parseAleoBoolean(onChainData?.reserve_met),
              settledAt: parseAleoInteger(onChainData?.settled_at) ?? 0,
              claimableAt: parseAleoInteger(onChainData?.claimable_at) ?? 0,
              itemReceived: parseAleoBoolean(onChainData?.item_received) ?? false,
              itemReceivedAt: parseAleoInteger(onChainData?.item_received_at) ?? 0,
              paymentClaimed: parseAleoBoolean(onChainData?.payment_claimed) ?? false,
              paymentClaimedAt: parseAleoInteger(onChainData?.payment_claimed_at) ?? 0,
              platformFeeClaimed: parseAleoBoolean(onChainData?.platform_fee_claimed) ?? false,
              platformFeeClaimedAt: parseAleoInteger(onChainData?.platform_fee_claimed_at) ?? 0,
              platformFee: microToDisplayAmount(platformFeeMicro),
              platformFeeMicro,
              sellerNetAmount: microToDisplayAmount(sellerNetAmountMicro),
              sellerNetAmountMicro,
              totalEscrowed: microToDisplayAmount(totalEscrowedMicro),
              totalEscrowedMicro,
              confirmationTimeout: parseAleoInteger(onChainData?.confirmation_timeout) ?? 0,
              proofFilesCount: auction.proofFilesCount ?? (Array.isArray(auction.proofFiles) ? auction.proofFiles.length : 0),
              itemPhotosCount: auction.itemPhotosCount ?? (Array.isArray(auction.itemPhotos) ? auction.itemPhotos.length : 0),
              verificationStatus: auction.sellerVerification?.status || auction.verificationStatus || 'pending',
              featured: false,
              isFixture: Boolean(auction.isFixture || auction.mockOnChain),
              metricLabel: presentation.metricLabel,
              metricValue: presentation.metricValue,
              metricCurrency: presentation.metricCurrency,
              timingLabel: presentation.timingLabel,
              timingValue: presentation.timingValue,
              isLiveBidding: presentation.isLiveBidding,
              isAwaitingClose: presentation.isAwaitingClose,
            };
            
            console.log(`✅ Processed auction ${auction.id}:`, auctionData);
            return auctionData;
          } catch (error) {
            console.error(`❌ Error loading auction ${auction.id}:`, error);
            // Return auction with local data only
            const now = Math.floor(Date.now() / 1000);
            const fallbackStatus = normalizeAuctionLifecycleStatus(auction.status)
              ?? ((auction.endTimestamp ?? getAuctionMetadataEndTime(auction) ?? now + 24 * 3600) <= now ? 'closed' : 'open');
            const fallbackEndTimestamp = auction.endTimestamp ?? getAuctionMetadataEndTime(auction) ?? (now + 24 * 3600);
            const fallbackPresentation = deriveAuctionPresentation({
              status: fallbackStatus,
              endTimestamp: fallbackEndTimestamp,
              revealDeadline: Number(auction.revealDeadline) || 0,
              disputeDeadline: Number(auction.disputeDeadline) || 0,
              winningAmountMicro: auction.winningAmountMicro ?? null,
              totalEscrowedMicro: auction.totalEscrowedMicro ?? '0',
              currency: auction.currency || 'ALEO',
            });

            return {
              id: auction.id,
              title: auction.title,
              description: auction.description || '',
              format: 'Sealed-Bid',
              currentBid: '0',
              minBid: auction.minBid,
              status: fallbackStatus,
              displayStatus: fallbackPresentation.displayStatus,
              contractState: auction.contractState || fallbackStatus.toUpperCase(),
              state: 0,
              isEndingSoon: fallbackPresentation.isEndingSoon,
              bidCount: 0,
              currency: auction.currency || 'ALEO',
              currencyType: auction.currency === 'ALEO' ? 1 : auction.currency === 'USAD' ? 2 : 0,
              assetType: auction.assetType || 0, // NEW: Asset type
              creator: auction.creator || auction.seller || null,
              seller: auction.creator || null,
              sellerDisplayName: auction.sellerDisplayName || null,
              winner: null,
              winningBid: 0,
              winningAmountMicro: null,
              endTimestamp: fallbackEndTimestamp,
              revealPeriod: Number(auction.revealPeriod) || 0,
              disputePeriod: Number(auction.disputePeriod) || 0,
              revealDeadline: Number(auction.revealDeadline) || 0,
              disputeDeadline: Number(auction.disputeDeadline) || 0,
              reservePrice: auction.reservePrice || auction.minBid || '0',
              reservePriceMicro: auction.reservePriceMicro ?? null,
              reserveMet: null,
              settledAt: 0,
              claimableAt: 0,
              itemReceived: false,
              itemReceivedAt: 0,
              paymentClaimed: false,
              paymentClaimedAt: 0,
              platformFeeClaimed: false,
              platformFeeClaimedAt: 0,
              platformFee: 0,
              platformFeeMicro: null,
              sellerNetAmount: 0,
              sellerNetAmountMicro: null,
              totalEscrowed: 0,
              totalEscrowedMicro: auction.totalEscrowedMicro ?? '0',
              confirmationTimeout: 0,
              proofFilesCount: auction.proofFilesCount ?? (Array.isArray(auction.proofFiles) ? auction.proofFiles.length : 0),
              itemPhotosCount: auction.itemPhotosCount ?? (Array.isArray(auction.itemPhotos) ? auction.itemPhotos.length : 0),
              verificationStatus: auction.sellerVerification?.status || auction.verificationStatus || 'pending',
              featured: false,
              isFixture: Boolean(auction.isFixture || auction.mockOnChain),
              metricLabel: fallbackPresentation.metricLabel,
              metricValue: fallbackPresentation.metricValue,
              metricCurrency: fallbackPresentation.metricCurrency,
              timingLabel: fallbackPresentation.timingLabel,
              timingValue: fallbackPresentation.timingValue,
              isLiveBidding: fallbackPresentation.isLiveBidding,
              isAwaitingClose: fallbackPresentation.isAwaitingClose,
            };
          }
        })
      );
      
      // Sort by creation time (newest first)
      auctionsWithData.sort((a, b) => b.id - a.id);
      
      // Mark the most actionable auction as featured
      if (auctionsWithData.length > 0) {
        const featuredIndex = auctionsWithData
          .map((auction, index) => ({ auction, index }))
          .sort((left, right) => {
            const rankDiff = getFeaturedAuctionRank(left.auction) - getFeaturedAuctionRank(right.auction);
            if (rankDiff !== 0) {
              return rankDiff;
            }

            return Number(right.auction.id) - Number(left.auction.id);
          })[0]?.index;

        if (Number.isInteger(featuredIndex)) {
          auctionsWithData[featuredIndex].featured = true;
        }
      }
      
      console.log('📊 Final auctions list:', auctionsWithData);
      setAuctions(auctionsWithData);

      await Promise.allSettled(auctionsWithData
        .filter((auction) => opsDebugInfo.isLocalTarget || !auction.isFixture)
        .map(async (auction) => {
        await syncAuctionSnapshot({
          id: auction.id,
          title: auction.title,
          description: auction.description || '',
          status: auction.status,
          contractState: auction.contractState,
          seller: auction.seller,
          creator: auction.creator || auction.seller,
          sellerDisplayName: auction.sellerDisplayName || null,
          winner: auction.winner,
          token: auction.currency,
          endTimestamp: auction.endTimestamp ?? getAuctionMetadataEndTime(auctionSeeds.find((item) => item.id === auction.id)),
          revealPeriod: auction.revealPeriod,
          disputePeriod: auction.disputePeriod,
          revealDeadline: auction.revealDeadline,
          disputeDeadline: auction.disputeDeadline,
          reservePrice: parseFloat(auction.reservePrice || '0'),
          reservePriceMicro: auction.reservePriceMicro,
          reserveMet: auction.reserveMet,
          settledAt: auction.settledAt,
          claimableAt: auction.claimableAt,
          itemReceived: auction.itemReceived,
          itemReceivedAt: auction.itemReceivedAt,
          paymentClaimed: auction.paymentClaimed,
          paymentClaimedAt: auction.paymentClaimedAt,
          platformFeeClaimed: auction.platformFeeClaimed,
          platformFeeClaimedAt: auction.platformFeeClaimedAt,
          winningBid: auction.winningBid ?? parseFloat(auction.currentBid || '0'),
          winningAmountMicro: auction.winningAmountMicro,
          platformFee: auction.platformFee,
          platformFeeMicro: auction.platformFeeMicro,
          sellerNetAmount: auction.sellerNetAmount,
          sellerNetAmountMicro: auction.sellerNetAmountMicro,
          totalEscrowed: auction.totalEscrowed,
          totalEscrowedMicro: auction.totalEscrowedMicro,
          confirmationTimeout: auction.confirmationTimeout,
          assetType: auction.assetType,
          currencyType: auction.currencyType,
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

  const persistWatchlist = async (nextWatchlist) => {
    setWatchlist(nextWatchlist);
    const persistedWatchlist = await saveWatchlist(address, nextWatchlist);

    if (persistedWatchlist) {
      setWatchlist(persistedWatchlist);
    }
  };

  const handleToggleWatchlist = async (auctionId, event) => {
    event?.stopPropagation();

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

    await persistWatchlist(nextWatchlist);
  };

  const handleToggleSellerWatch = async (seller, event) => {
    event?.stopPropagation();

    if (!address) {
      alert('Connect your wallet first to follow sellers.');
      return;
    }

    const normalizedSeller = normalizeWalletAddress(seller);
    if (!normalizedSeller) {
      return;
    }

    const nextSellers = watchlist.sellers.includes(normalizedSeller)
      ? watchlist.sellers.filter((value) => value !== normalizedSeller)
      : [...watchlist.sellers, normalizedSeller];

    await persistWatchlist({
      ...watchlist,
      sellers: nextSellers,
    });
  };

  const handleToggleCategoryWatch = async () => {
    if (!address) {
      alert('Connect your wallet first to follow categories.');
      return;
    }

    if (categoryFilter === 'all') {
      alert('Pick a category filter first, then save it to your watchlist.');
      return;
    }

    const normalizedCategory = String(categoryFilter);
    const nextCategories = watchlist.categories.includes(normalizedCategory)
      ? watchlist.categories.filter((value) => value !== normalizedCategory)
      : [...watchlist.categories, normalizedCategory];

    await persistWatchlist({
      ...watchlist,
      categories: nextCategories,
    });
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

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredAuctions = auctions.filter(auction => {
    // Status filter
    if (filter !== 'all') {
      if (filter === 'ending-soon') {
        if (!auction.isEndingSoon) return false;
      } else if (filter === 'active') {
        if (auction.displayStatus !== 'active') return false;
      } else if (filter === 'awaiting-close') {
        if (auction.displayStatus !== 'awaiting-close') return false;
      } else if (filter === 'closed') {
        if (!['reveal-phase', 'awaiting-settlement'].includes(auction.displayStatus)) return false;
      } else if (auction.status !== filter) {
        return false;
      }
    }
    
    // Category filter (NEW)
    if (categoryFilter !== 'all' && auction.assetType !== parseInt(categoryFilter)) return false;
    
    // Search query
    if (normalizedSearchQuery) {
      const matchesTitle = auction.title.toLowerCase().includes(normalizedSearchQuery);
      const matchesId = String(auction.id).includes(normalizedSearchQuery);

      if (!matchesTitle && !matchesId) return false;
    }
    
    return true;
  });

  const visibleAuctions = [...filteredAuctions].sort((left, right) => {
    if (left.featured !== right.featured) {
      return left.featured ? -1 : 1;
    }

    return Number(right.id) - Number(left.id);
  });

  const stats = [
    { label: 'Live Bidding', value: auctions.filter((auction) => auction.isLiveBidding).length, icon: TrendingUp },
    { label: 'Awaiting Close', value: auctions.filter((auction) => auction.isAwaitingClose).length, icon: Clock },
    { label: 'Challenge', value: auctions.filter((auction) => auction.status === 'challenge').length, icon: Shield },
    { label: 'Settled', value: auctions.filter((auction) => auction.status === 'settled').length, icon: CheckCircle },
  ];
  const activeFilterChips = [];

  if (filter !== 'all') {
    activeFilterChips.push({
      key: 'status',
      label: `Status: ${STATUS_FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? filter}`,
    });
  }

  if (categoryFilter !== 'all') {
    activeFilterChips.push({
      key: 'category',
      label: `Category: ${CATEGORY_FILTER_OPTIONS.find((option) => option.value === categoryFilter)?.label ?? categoryFilter}`,
    });
  }

  if (normalizedSearchQuery) {
    activeFilterChips.push({
      key: 'search',
      label: `Search: ${searchQuery.trim()}`,
    });
  }

  const visibleCountLabel = visibleAuctions.length === 1
    ? '1 auction visible'
    : `${visibleAuctions.length} auctions visible`;
  const overviewCountLabel = visibleAuctions.length === auctions.length
    ? visibleCountLabel
    : `${visibleAuctions.length} of ${auctions.length} auctions visible`;
  const cardGridLayout = visibleAuctions.length >= 4
    ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'
    : visibleAuctions.length === 3
      ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'
    : visibleAuctions.length === 2
        ? 'grid grid-cols-1 gap-4 md:grid-cols-2'
        : 'mx-auto grid max-w-[720px] grid-cols-1 gap-4';
  const isWatched = (auctionId) => watchlist.auctionIds.includes(String(auctionId));
  const isSellerWatched = (seller) => {
    const normalizedSeller = normalizeWalletAddress(seller);
    return Boolean(normalizedSeller) && watchlist.sellers.includes(normalizedSeller);
  };
  const isCategoryWatched = (assetType) => watchlist.categories.includes(String(assetType));
  const activeWatchCount = watchlist.auctionIds.length + watchlist.sellers.length + watchlist.categories.length;

  return (
    <div className="relative min-h-screen overflow-hidden bg-void-900 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(0,229,255,0.08),transparent_24%),linear-gradient(to_bottom,rgba(255,255,255,0.015),transparent_26%)]" />

      <div className="relative">
        <PremiumNav />

        <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 xl:px-8">
          <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent p-6 sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,229,255,0.09),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(212,175,55,0.08),transparent_30%)]" />

            <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.85fr)] xl:items-end">
              <div className="max-w-3xl">
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.24em] text-white/45">
                  Powered by Zero-Knowledge
                </div>

                <h1 className="mt-4 text-3xl font-display font-bold leading-tight text-white sm:text-4xl xl:text-[2.8rem]">
                  <span className="block">Commit-Reveal</span>
                  <span className="block text-white/92">Auctions on Aleo</span>
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62 sm:text-base">
                  V2.22 uses commit-reveal bidding with contract-verifiable settlement. Bidder-local reveal secrets stay off-chain,
                  while public funding transactions can still expose amounts until fully private escrow ships.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.18em] text-cyan-300">
                    <Info className="h-3.5 w-3.5" />
                    V2.22 Live
                  </span>

                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/55">
                    {overviewCountLabel}
                  </span>

                  {activeFilterChips.map((chip) => (
                    <span
                      key={chip.key}
                      className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-mono text-white/60"
                    >
                      {chip.label}
                    </span>
                  ))}

                  {activeFilterChips.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setFilter('all');
                        setCategoryFilter('all');
                      }}
                      className="inline-flex items-center rounded-full border border-white/10 bg-transparent px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/50 transition-colors hover:border-white/20 hover:text-white"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className={`rounded-2xl border p-4 sm:p-5 ${
                      stat.value > 0
                        ? 'border-gold-500/20 bg-gradient-to-br from-gold-500/10 to-transparent'
                        : 'border-white/10 bg-black/20'
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40">
                        {stat.label}
                      </div>
                      <stat.icon className={`h-4 w-4 shrink-0 ${stat.value > 0 ? 'text-gold-400' : 'text-white/28'}`} />
                    </div>
                    <div className="text-2xl font-display font-bold text-white sm:text-[2rem]">
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-mono uppercase tracking-[0.24em] text-white/38">
                      Search
                    </span>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                      <input
                        type="text"
                        placeholder="Search title or auction ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-void-800/85 pl-11 pr-4 text-sm text-white placeholder:text-white/28 transition-all focus:border-gold-500/35 focus:outline-none focus:ring-2 focus:ring-gold-500/10"
                      />
                    </div>
                  </label>

                  <PremiumSelect
                    label="Category"
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    options={CATEGORY_FILTER_OPTIONS.map((categoryOption) => ({
                      value: categoryOption.value,
                      label: categoryOption.icon
                        ? `${categoryOption.icon} ${categoryOption.label}`
                        : categoryOption.label,
                    }))}
                    className="h-12 rounded-2xl border-white/10 bg-void-800/85 px-4 py-3 text-sm text-white/85"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-void-800/55 p-4">
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.24em] text-white/38">
                    <Filter className="h-3.5 w-3.5" />
                    Auction Status
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_FILTER_OPTIONS.map((statusOption) => (
                      <button
                        key={statusOption.value}
                        type="button"
                        onClick={() => setFilter(statusOption.value)}
                        className={`rounded-xl border px-3 py-2 text-[11px] font-mono uppercase tracking-[0.16em] transition-all ${
                          filter === statusOption.value
                            ? 'border-gold-500/45 bg-gold-500 text-void-900 shadow-[0_10px_22px_rgba(212,175,55,0.16)]'
                            : 'border-white/10 bg-transparent text-white/60 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        {statusOption.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 xl:pt-7">
                {categoryFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={handleToggleCategoryWatch}
                    className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-[11px] font-mono uppercase tracking-[0.18em] transition-colors ${
                      isCategoryWatched(categoryFilter)
                        ? 'border-gold-500/35 bg-gold-500/10 text-gold-300'
                        : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-gold-500/25 hover:bg-gold-500/10 hover:text-gold-300'
                    }`}
                  >
                    <BookmarkCheck className="h-4 w-4" />
                    {isCategoryWatched(categoryFilter) ? 'Watching Category' : 'Watch Category'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveCurrentSearch}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-[11px] font-mono uppercase tracking-[0.18em] text-white/70 transition-colors hover:border-cyan-500/25 hover:bg-cyan-500/10 hover:text-cyan-300"
                >
                  <Bookmark className="h-4 w-4" />
                  Save Search
                </button>

                <PremiumButton
                  size="sm"
                  className="h-11 rounded-2xl px-5"
                  onClick={() => navigate('/premium-create')}
                >
                  Create Auction
                </PremiumButton>
              </div>
            </div>

            {savedSearches.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
                <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-white/32">
                  Saved Searches
                </span>
                {savedSearches.map((savedSearch) => (
                  <button
                    key={savedSearch.id}
                    type="button"
                    title={savedSearch.label}
                    onClick={() => {
                      setSearchQuery(savedSearch.query || '');
                      setFilter(savedSearch.filter || 'all');
                      setCategoryFilter(savedSearch.categoryFilter || 'all');
                    }}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-mono text-white/68 transition-colors hover:bg-white/10"
                  >
                    <BookmarkCheck className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                    <span className="max-w-[220px] truncate">{savedSearch.label}</span>
                  </button>
                ))}
              </div>
            )}

            {activeWatchCount > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
                <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-white/32">
                  Watchlist
                </span>
                <span className="inline-flex items-center rounded-full border border-gold-500/25 bg-gold-500/10 px-3 py-1.5 text-[11px] font-mono text-gold-300">
                  {watchlist.auctionIds.length} auctions
                </span>
                <span className="inline-flex items-center rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-mono text-cyan-300">
                  {watchlist.sellers.length} sellers
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-mono text-white/68">
                  {watchlist.categories.length} categories
                </span>
              </div>
            )}
          </section>

          {loading && (
            <div className="py-12 text-center">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-void-800/80 px-6 py-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
                <span className="font-mono text-white/60">Loading auctions...</span>
              </div>
            </div>
          )}

          {!loading && auctions.length === 0 && (
            <div className="py-12 text-center">
              <GlassCard className="mx-auto max-w-md p-12">
                <Shield className="mx-auto mb-4 h-16 w-16 text-white/20" />
                <h3 className="mb-2 text-xl font-display font-bold">No Auctions Yet</h3>
                <p className="mb-6 text-white/60">
                  Create your first commit-reveal auction
                </p>
                <PremiumButton onClick={() => navigate('/premium-create')}>
                  Create Auction
                </PremiumButton>
              </GlassCard>
            </div>
          )}

          {!loading && auctions.length > 0 && visibleAuctions.length === 0 && (
            <div className="py-6">
              <GlassCard className="mx-auto max-w-2xl p-10 text-center">
                <Search className="mx-auto mb-4 h-10 w-10 text-white/20" />
                <h3 className="mb-2 text-xl font-display font-bold">No auctions match this search</h3>
                <p className="mb-6 text-white/60">
                  Try another keyword or reset the current filters to see more auctions.
                </p>
                <PremiumButton
                  variant="ghost"
                  size="sm"
                  className="h-11 rounded-2xl px-5"
                  onClick={() => {
                    setSearchQuery('');
                    setFilter('all');
                    setCategoryFilter('all');
                  }}
                >
                  Reset Filters
                </PremiumButton>
              </GlassCard>
            </div>
          )}

          {!loading && visibleAuctions.length > 0 && (
            <div className="mt-8">
              <div className={cardGridLayout}>
                {visibleAuctions.map((auction) => (
                  <GlassCard
                    key={auction.id}
                    hover
                    className={`group relative flex h-full min-h-[320px] cursor-pointer flex-col overflow-hidden p-5 ${
                      auction.featured
                        ? 'border-gold-500/28 shadow-[0_18px_50px_rgba(212,175,55,0.08)]'
                        : ''
                    }`}
                    onClick={() => navigate(`/premium-auction/${auction.id}`)}
                  >
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                    {auction.featured && (
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/75 to-transparent" />
                    )}

                    <div className="relative flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={auction.displayStatus} size="sm" />
                          {auction.featured && (
                            <span className="inline-flex items-center rounded-full border border-gold-500/28 bg-gold-500/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-gold-400">
                              Featured
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-mono text-white/46">
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 uppercase tracking-[0.16em]">
                            {auction.format}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/24 bg-cyan-500/10 px-2.5 py-1 text-cyan-300">
                            <span>{getAssetTypeIcon(auction.assetType)}</span>
                            <span>{getAssetTypeName(auction.assetType)}</span>
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(event) => handleToggleWatchlist(auction.id, event)}
                        className={`rounded-2xl border p-2.5 text-white/60 transition-colors ${
                          isWatched(auction.id)
                            ? 'border-gold-500/35 bg-gold-500/10 text-gold-400'
                            : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {isWatched(auction.id) ? (
                          <BookmarkCheck className="h-3.5 w-3.5" />
                        ) : (
                          <Bookmark className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="relative mt-6 min-w-0 flex-1">
                      <h2 className="overflow-hidden break-words text-[1.4rem] font-display font-bold leading-tight text-white transition-colors group-hover:text-gold-400 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                        {auction.title}
                      </h2>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-white/42">
                        <span>Auction #{auction.id}</span>
                        {auction.sellerDisplayName && (
                          <span className="max-w-full truncate">by {auction.sellerDisplayName}</span>
                        )}
                        {isSellerWatched(auction.seller) && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/24 bg-cyan-500/10 px-2 py-1 text-cyan-300">
                            <UserRoundCheck className="h-3 w-3" />
                            Watched Seller
                          </span>
                        )}
                        {isCategoryWatched(auction.assetType) && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-gold-500/24 bg-gold-500/10 px-2 py-1 text-gold-300">
                            <BookmarkCheck className="h-3 w-3" />
                            Watched Category
                          </span>
                        )}
                      </div>

                      {auction.seller && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={(event) => handleToggleSellerWatch(auction.seller, event)}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors ${
                              isSellerWatched(auction.seller)
                                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
                                : 'border-white/10 bg-white/[0.04] text-white/58 hover:border-cyan-500/25 hover:bg-cyan-500/10 hover:text-cyan-200'
                            }`}
                          >
                            <UserRoundCheck className="h-3.5 w-3.5" />
                            {isSellerWatched(auction.seller) ? 'Following Seller' : 'Follow Seller'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="relative mt-5 rounded-[22px] border border-white/10 bg-void-800/58 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/38">
                            {auction.metricLabel}
                          </div>
                          <div className="mt-2 break-words text-[1.65rem] font-display font-bold leading-tight text-gold-400">
                            {auction.metricValue}
                          </div>
                          {auction.metricCurrency && (
                            <div className="mt-1 text-[11px] font-mono text-cyan-300">{auction.metricCurrency}</div>
                          )}
                        </div>

                        <div className="min-w-0 text-right">
                          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/38">
                            {auction.timingLabel}
                          </div>
                          <div className="mt-2 inline-flex max-w-full items-center justify-end gap-1.5 text-sm font-mono leading-6 text-white/82">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-gold-500" />
                            <span className="max-w-[112px] truncate sm:max-w-[140px]">{auction.timingValue}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="relative mt-4 grid grid-cols-2 gap-3 border-t border-white/5 pt-4">
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/38">
                          Min Bid
                        </div>
                        <div className="mt-1 break-words text-sm font-display font-semibold leading-tight text-white">
                          {auction.minBid}{' '}
                          <span className="text-[11px] font-mono text-cyan-400">{auction.currency}</span>
                        </div>
                      </div>

                      <div className="min-w-0 text-right">
                        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/38">
                          Committed Bids
                        </div>
                        <div className="mt-1 text-sm font-display font-semibold leading-tight text-white">
                          {auction.bidCount}
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
