import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { toast } from 'sonner';
import {
  getAuctionInfo, 
  cancelAuction,
  commitBid,
  commitBidAleo,
  commitBidAleoPrivate,
  commitBidUSAD,
  generateNonce, 
  generateCommitment, 
  saveNonce, 
  saveCommitment,
  updateCommitmentData,
  clearCommitment,
  clearNonce,
  getNonce,
  getCommitmentData,
  waitForTransactionConfirmation,
  revealBid,
  closeAuction,
  claimRefund,
  claimRefundAleo,
  claimRefundAleoPrivate,
  claimRefundUSAD,
  settleAfterRevealTimeout,
  finalizeWinner,
  getAuctionDisputeRootOnChain,
  getAuctionProofRootOnChain,
  getHighestBidder,
  getHighestBid,
  confirmReceipt,
  claimWinningAleo,
  claimWinningUSDCx,
  claimWinningUSAD,
  calculatePlatformFee,
  calculateSellerNetAmount,
  getSellerProfileOnChain,
  hashJsonToField,
  isReserveMet,
  isPlatformOwner,
  openDisputeOnChain,
  claimPlatformFeeAleo,
  claimPlatformFeeUsdcx,
  claimPlatformFeeUsad,
  getCurrentTimestamp,
  getAssetTypeName,
  getAssetTypeIcon,
  getAssetTypeTimeout,
  getCategoryInstructions
} from '@/services/aleoServiceV2';
import {
  createDispute,
  createOffer,
  getOpsApiDebugInfo,
  getAuctionProofBundle,
  getDisputes,
  getOffers,
  getReputation,
  getSellerVerification,
  getWatchlist,
  saveWatchlist,
  syncAuctionRole,
  syncAuctionSnapshot,
  updateDispute,
} from '@/services/localOpsService';
import GlassCard from '@/components/premium/GlassCard';
import PremiumButton from '@/components/premium/PremiumButton';
import PremiumInput from '@/components/premium/PremiumInput';
import PremiumNav from '@/components/premium/PremiumNav';
import StatusBadge from '@/components/premium/StatusBadge';
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  Shield,
  AlertCircle,
  CheckCircle,
  Zap,
  BadgeCheck,
  FileText,
  Image as ImageIcon,
  Bookmark,
  BookmarkCheck,
  Gavel,
  Share2,
  UserRoundCheck,
} from 'lucide-react';

const PRIVATE_CREDITS_PROGRAM_ID = 'credits.aleo';
const EMPTY_ALEO_ADDRESS = 'aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc';
const CONTRACT_STATUS_BY_STATE = {
  0: 'open',
  1: 'closed',
  2: 'challenge',
  3: 'settled',
  4: 'cancelled',
  5: 'disputed',
};

function findNestedMicrocredits(value, depth = 0) {
  if (value == null || depth > 6) {
    return null;
  }

  if (typeof value === 'string') {
    const recordMatch = value.match(/microcredits:\s*(\d+)u64/);
    if (recordMatch) {
      return parseInt(recordMatch[1], 10);
    }

    const exactValueMatch = value.match(/^(\d+)u64(?:\.private|\.public)?$/);
    if (exactValueMatch) {
      return parseInt(exactValueMatch[1], 10);
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findNestedMicrocredits(item, depth + 1);
      if (nested !== null) {
        return nested;
      }
    }

    return null;
  }

  if (typeof value === 'object') {
    if ('microcredits' in value) {
      const direct = findNestedMicrocredits(value.microcredits, depth + 1);
      if (direct !== null) {
        return direct;
      }
    }

    if ('value' in value) {
      const directValue = findNestedMicrocredits(value.value, depth + 1);
      if (directValue !== null) {
        return directValue;
      }
    }
  }

  return null;
}

async function enrichPrivateRecord(record, decrypt) {
  if (!record || typeof record !== 'object') {
    return record;
  }

  if (typeof record.plaintext === 'string' || typeof record.record === 'string') {
    return record;
  }

  if (typeof record.recordCiphertext !== 'string' || typeof decrypt !== 'function') {
    return record;
  }

  try {
    const plaintext = await decrypt(record.recordCiphertext);

    if (typeof plaintext === 'string' && plaintext.trim()) {
      return {
        ...record,
        plaintext,
      };
    }
  } catch {
    // Ignore decrypt failures here; validation below will surface a user-facing error if needed.
  }

  return record;
}

function extractPrivateRecordMicrocredits(record) {
  if (!record) {
    return null;
  }

  const parseStringValue = (value) => {
    if (typeof value !== 'string') {
      return null;
    }

    const recordMatch = value.match(/microcredits:\s*(\d+)u64/);
    if (recordMatch) {
      return parseInt(recordMatch[1], 10);
    }

    const valueMatch = value.match(/(\d+)u64/);
    if (valueMatch) {
      return parseInt(valueMatch[1], 10);
    }

    return null;
  };

  if (typeof record === 'string') {
    return parseStringValue(record);
  }

  if (typeof record === 'object') {
    const directCandidates = [
      record.plaintext,
      record.record,
      record.data?.microcredits,
      record.microcredits,
    ];

    for (const candidate of directCandidates) {
      const parsedValue = parseStringValue(candidate);
      if (parsedValue !== null) {
        return parsedValue;
      }
    }
  }

  const nestedMicrocredits = findNestedMicrocredits(record);
  if (nestedMicrocredits !== null) {
    return nestedMicrocredits;
  }

  return null;
}

function getPrivateRecordLockStorageKey(walletAddress) {
  return `private_record_locks_${walletAddress}`;
}

function getCloseAuctionLockStorageKey(auctionId, walletAddress) {
  if (!auctionId || !walletAddress) {
    return null;
  }

  return `close_auction_lock_${auctionId}_${walletAddress.toLowerCase()}`;
}

function extractPrivateRecordIdentity(record) {
  if (!record) {
    return null;
  }

  if (typeof record === 'string') {
    return record;
  }

  if (typeof record === 'object') {
    const candidates = [
      record.serialNumber,
      record.serial_number,
      record.commitment,
      record.recordCiphertext,
      record.record_ciphertext,
      record.tag,
      record.id,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return null;
}

function isPrivateRecordMarkedSpent(record) {
  if (!record || typeof record !== 'object') {
    return false;
  }

  if (typeof record.spent === 'boolean') {
    return record.spent;
  }

  if (typeof record.isSpent === 'boolean') {
    return record.isSpent;
  }

  return false;
}

function getLockedPrivateRecordIds(walletAddress) {
  if (!walletAddress) {
    return [];
  }

  try {
    const rawValue = localStorage.getItem(getPrivateRecordLockStorageKey(walletAddress));
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsedValue)
      ? parsedValue.filter((value) => typeof value === 'string' && value.trim())
      : [];
  } catch {
    return [];
  }
}

function lockPrivateRecord(walletAddress, recordIdentity) {
  if (!walletAddress || !recordIdentity) {
    return;
  }

  const existingIds = getLockedPrivateRecordIds(walletAddress);
  if (existingIds.includes(recordIdentity)) {
    return;
  }

  localStorage.setItem(
    getPrivateRecordLockStorageKey(walletAddress),
    JSON.stringify([...existingIds, recordIdentity])
  );
}

function unlockPrivateRecord(walletAddress, recordIdentity) {
  if (!walletAddress || !recordIdentity) {
    return;
  }

  const remainingIds = getLockedPrivateRecordIds(walletAddress)
    .filter((value) => value !== recordIdentity);

  localStorage.setItem(
    getPrivateRecordLockStorageKey(walletAddress),
    JSON.stringify(remainingIds)
  );
}

function getPendingCloseAuction(auctionId, walletAddress) {
  const storageKey = getCloseAuctionLockStorageKey(auctionId, walletAddress);
  if (!storageKey) {
    return null;
  }

  try {
    const rawValue = localStorage.getItem(storageKey);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : null;
  } catch {
    return null;
  }
}

function savePendingCloseAuction(auctionId, walletAddress, data) {
  const storageKey = getCloseAuctionLockStorageKey(auctionId, walletAddress);
  if (!storageKey || !data || typeof data !== 'object') {
    return;
  }

  localStorage.setItem(storageKey, JSON.stringify(data));
}

function clearPendingCloseAuction(auctionId, walletAddress) {
  const storageKey = getCloseAuctionLockStorageKey(auctionId, walletAddress);
  if (!storageKey) {
    return;
  }

  localStorage.removeItem(storageKey);
}

function parseAleoInteger(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
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
  return parsedValue !== null ? parsedValue / 1_000_000 : null;
}

function getAuctionMetadataEndTime(auctionMetadata) {
  if (!auctionMetadata?.createdAt) {
    return null;
  }

  if (Number.isFinite(auctionMetadata.durationSeconds)) {
    return Math.floor(auctionMetadata.createdAt / 1000) + auctionMetadata.durationSeconds;
  }

  const durationValue = parseInt(
    auctionMetadata.durationValue ?? auctionMetadata.duration ?? 24,
    10
  );

  if (!Number.isFinite(durationValue) || durationValue <= 0) {
    return Math.floor(auctionMetadata.createdAt / 1000) + 24 * 3600;
  }

  const durationUnit = auctionMetadata.durationUnit || 'hours';
  const multiplier = durationUnit === 'minutes'
    ? 60
    : durationUnit === 'days'
      ? 24 * 3600
      : 3600;

  return Math.floor(auctionMetadata.createdAt / 1000) + durationValue * multiplier;
}

function hasSubmittedTransaction(commitmentData) {
  return Boolean(
    commitmentData &&
    typeof commitmentData === 'object' &&
    typeof commitmentData.transactionId === 'string' &&
    commitmentData.transactionId.trim() &&
    commitmentData.status === 'confirmed'
  );
}

function isPrivateCommitment(commitmentData) {
  return commitmentData?.privacy === 'private';
}

function hasPendingTransaction(commitmentData) {
  return Boolean(
    commitmentData &&
    typeof commitmentData === 'object' &&
    typeof commitmentData.transactionId === 'string' &&
    commitmentData.transactionId.trim() &&
    commitmentData.status !== 'confirmed' &&
    commitmentData.status !== 'failed' &&
    commitmentData.status !== 'rejected' &&
    commitmentData.status !== 'local-only'
  );
}

function looksLikeOnChainTransactionId(transactionId) {
  return typeof transactionId === 'string' && transactionId.startsWith('at1');
}

function normalizeWalletTransactionStatus(status) {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';

  if (!normalized) {
    return 'unknown';
  }

  if (normalized.includes('reject') || normalized.includes('fail') || normalized.includes('error')) {
    return 'rejected';
  }

  if (
    normalized.includes('accept') ||
    normalized.includes('final') ||
    normalized.includes('complete') ||
    normalized.includes('success')
  ) {
    return 'accepted';
  }

  if (normalized.includes('pending') || normalized.includes('process')) {
    return 'pending';
  }

  return normalized;
}

function formatUnixTimestamp(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 'Not recorded';
  }

  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp * 1000));
  } catch {
    return new Date(timestamp * 1000).toLocaleString();
  }
}

function formatOnChainValue(value) {
  if (value == null) {
    return 'Not anchored';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatAddressPreview(value, start = 10, end = 6) {
  if (typeof value !== 'string' || !value.trim()) {
    return 'Hidden';
  }

  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export default function PremiumAuctionDetail() {
  const { auctionId } = useParams();
  const navigate = useNavigate();
  const {
    connected,
    address,
    executeTransaction,
    transactionStatus,
    requestRecords,
    decrypt,
  } = useWallet();
  const [bidAmount, setBidAmount] = useState('');
  const [showBidForm, setShowBidForm] = useState(false);
  const [aleoStep, setAleoStep] = useState(1);
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosePending, setIsClosePending] = useState(false);
  const [isClaimingFee, setIsClaimingFee] = useState(false);
  const [isCancellingReserve, setIsCancellingReserve] = useState(false);
  const [bidSyncState, setBidSyncState] = useState('idle');
  const [usePrivateBid, setUsePrivateBid] = useState(false); // NEW: Private bid toggle
  const [sellerVerification, setSellerVerification] = useState(null);
  const [auctionProofBundle, setAuctionProofBundle] = useState(null);
  const [onChainSellerProfile, setOnChainSellerProfile] = useState(null);
  const [onChainProofRoot, setOnChainProofRoot] = useState(null);
  const [onChainDisputeRoot, setOnChainDisputeRoot] = useState(null);
  const [reputation, setReputation] = useState(null);
  const [offers, setOffers] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [watchlist, setWatchlist] = useState({
    auctionIds: [],
    sellers: [],
    categories: [],
  });
  const [offerForm, setOfferForm] = useState({
    amount: '',
    note: '',
    disclosureMode: 'selective',
    proofOfFundsStatus: 'self-attested',
  });
  const [disputeForm, setDisputeForm] = useState({
    title: '',
    description: '',
    evidence: '',
  });
  const autoLifecycleRef = useRef({
    inFlight: false,
    lastRunAt: new Map(),
  });
  const [, setCommitmentSyncVersion] = useState(0);
  const storedCommitmentData = address ? getCommitmentData(auctionId, address) : null;
  const submittedCommitmentData = hasSubmittedTransaction(storedCommitmentData) ? storedCommitmentData : null;
  const pendingCommitmentData = hasPendingTransaction(storedCommitmentData) ? storedCommitmentData : null;
  const activeCommitmentData = submittedCommitmentData || pendingCommitmentData;
  const hasStaleLocalBid = Boolean(
    storedCommitmentData &&
    !submittedCommitmentData &&
    !pendingCommitmentData
  );

  const refreshStoredCommitment = () => {
    setCommitmentSyncVersion((value) => value + 1);
  };

  const resolveTransactionStatus = async (transactionId, explorerTransactionId = null) => {
    let resolvedExplorerId = looksLikeOnChainTransactionId(explorerTransactionId)
      ? explorerTransactionId
      : looksLikeOnChainTransactionId(transactionId)
        ? transactionId
        : null;

    if (typeof transactionStatus === 'function' && typeof transactionId === 'string' && transactionId.trim()) {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          const walletResult = await transactionStatus(transactionId);
          const walletStatus = normalizeWalletTransactionStatus(walletResult?.status);
          const walletExplorerId = looksLikeOnChainTransactionId(walletResult?.transactionId)
            ? walletResult.transactionId
            : null;

          if (walletExplorerId) {
            resolvedExplorerId = walletExplorerId;
          }

          if (walletStatus === 'rejected') {
            return {
              status: 'rejected',
              explorerTransactionId: resolvedExplorerId,
              walletStatus,
              error: walletResult?.error || 'Transaction was rejected by wallet',
            };
          }

          if (walletStatus === 'accepted' && resolvedExplorerId) {
            break;
          }
        } catch {
          // Fall back to explorer checks below.
        }

        if (attempt < 5) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    if (resolvedExplorerId) {
      const explorerResult = await waitForTransactionConfirmation(resolvedExplorerId, {
        attempts: 8,
        intervalMs: 2000,
      });

      return {
        ...explorerResult,
        explorerTransactionId: resolvedExplorerId,
      };
    }

    return {
      status: 'pending',
      explorerTransactionId: null,
    };
  };

  const showLifecycleNotice = (message, options = {}) => {
    const { auto = false, tone = 'info' } = options;
    if (!message) {
      return;
    }

    if (!auto) {
      alert(message);
      return;
    }

    const normalizedMessage = String(message).replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();

    if (tone === 'success') {
      toast.success(normalizedMessage);
      return;
    }

    if (tone === 'error') {
      toast.error(normalizedMessage);
      return;
    }

    toast(normalizedMessage);
  };

  // V2.18 is now default - no need to set version

  // Load auction data
  useEffect(() => {
    // V2.18 is now default
    loadAuctionData();
  }, [auctionId]);

  useEffect(() => {
    if (!address || !pendingCommitmentData?.transactionId) {
      return undefined;
    }

    let isCancelled = false;

    const syncPendingBid = async () => {
      setBidSyncState('checking');

      try {
        const txResult = await resolveTransactionStatus(
          pendingCommitmentData.walletTransactionId || pendingCommitmentData.transactionId,
          pendingCommitmentData.explorerTransactionId || pendingCommitmentData.transactionId
        );

        if (isCancelled) {
          return;
        }

        if (txResult.status === 'confirmed') {
          updateCommitmentData(auctionId, address, {
            status: 'confirmed',
            confirmedAt: Date.now(),
            transactionId: txResult.explorerTransactionId || pendingCommitmentData.transactionId,
            explorerTransactionId: txResult.explorerTransactionId || pendingCommitmentData.explorerTransactionId || null,
          });
          setBidSyncState('confirmed');
        } else if (txResult.status === 'rejected') {
          if (pendingCommitmentData.privateRecordId) {
            lockPrivateRecord(address, pendingCommitmentData.privateRecordId);
          }
          clearCommitment(auctionId, address);
          clearNonce(auctionId, address);
          setBidSyncState('rejected');
        } else {
          updateCommitmentData(auctionId, address, {
            status: 'pending-confirmation',
            lastCheckedAt: Date.now(),
            explorerTransactionId: txResult.explorerTransactionId || pendingCommitmentData.explorerTransactionId || null,
          });
          setBidSyncState(txResult.status);
        }

        refreshStoredCommitment();
      } catch {
        if (isCancelled) {
          return;
        }

        updateCommitmentData(auctionId, address, {
          status: 'pending-confirmation',
          lastCheckedAt: Date.now(),
        });
        setBidSyncState('unknown');
        refreshStoredCommitment();
      }
    };

    syncPendingBid();

    return () => {
      isCancelled = true;
    };
  }, [
    address,
    auctionId,
    pendingCommitmentData?.transactionId,
    pendingCommitmentData?.walletTransactionId,
    pendingCommitmentData?.explorerTransactionId,
  ]);

  useEffect(() => {
    setIsClosePending(Boolean(getPendingCloseAuction(auctionId, address)));
  }, [address, auctionId]);

  const loadAuctionData = async () => {
    setLoading(true);
    try {
      // Get auction metadata from localStorage
      const myAuctions = JSON.parse(localStorage.getItem('myAuctions') || '[]');
      const auctionMetadata = myAuctions.find(a => a.id === parseInt(auctionId));

      // Get on-chain data - try multiple times if needed
      let onChainData = null;
      let retries = 0;
      const maxRetries = 3;
      
      while (!onChainData && retries < maxRetries) {
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        onChainData = await getAuctionInfo(auctionId);
        retries++;
      }
      
      if (!auctionMetadata && !onChainData) {
        setAuction(null);
        setLoading(false);
        return;
      }
      
      const minBidMicro = parseAleoInteger(onChainData?.min_bid_amount);
      const minBid = minBidMicro !== null
        ? minBidMicro / 1_000_000
        : parseFloat(auctionMetadata?.minBid || 0);

      const fallbackCurrencyType =
        auctionMetadata?.currency === 'ALEO'
          ? 1
          : auctionMetadata?.currency === 'USAD'
            ? 2
            : 0;

      const currencyType = parseAleoInteger(onChainData?.currency_type) ?? fallbackCurrencyType;
      
      const currency = currencyType === 1 ? 'ALEO' : currencyType === 0 ? 'USDCx' : 'USAD';
      
      const assetType = parseAleoInteger(onChainData?.asset_type) ?? Number(auctionMetadata?.assetType || 0);
      const state = parseAleoInteger(onChainData?.state) ?? 0;
      const status = CONTRACT_STATUS_BY_STATE[state] || 'open';
      const itemReceived = parseAleoBoolean(onChainData?.item_received) ?? false;
      const paymentClaimed = parseAleoBoolean(onChainData?.payment_claimed) ?? false;
      const itemReceivedAt = parseAleoInteger(onChainData?.item_received_at) ?? 0;
      const paymentClaimedAt = parseAleoInteger(onChainData?.payment_claimed_at) ?? 0;
      const revealPeriod = parseAleoInteger(onChainData?.reveal_period)
        ?? parseAleoInteger(onChainData?.challenge_period)
        ?? 0;
      const disputePeriod = parseAleoInteger(onChainData?.dispute_period)
        ?? parseAleoInteger(onChainData?.challenge_period)
        ?? 0;
      const revealDeadline = parseAleoInteger(onChainData?.reveal_deadline)
        ?? (state === 1 ? parseAleoInteger(onChainData?.challenge_end_time) : 0)
        ?? 0;
      const disputeDeadline = parseAleoInteger(onChainData?.dispute_deadline)
        ?? (state >= 2 ? parseAleoInteger(onChainData?.challenge_end_time) : 0)
        ?? 0;
      const confirmationTimeout = parseAleoInteger(onChainData?.confirmation_timeout) ?? getAssetTypeTimeout(assetType) * 24 * 3600;
      const totalEscrowedMicro = parseAleoInteger(onChainData?.total_escrowed) ?? 0;
      const settledAt = parseAleoInteger(onChainData?.settled_at) ?? 0;
      const claimableAt = parseAleoInteger(onChainData?.claimable_at) ?? 0;
      const platformFeeClaimed = parseAleoBoolean(onChainData?.platform_fee_claimed) ?? false;
      const platformFeeClaimedAt = parseAleoInteger(onChainData?.platform_fee_claimed_at) ?? 0;
      const reservePriceMicro = parseAleoInteger(onChainData?.reserve_price)
        ?? (
          auctionMetadata?.reservePrice
            ? Math.round(parseFloat(auctionMetadata.reservePrice) * 1_000_000)
            : minBidMicro ?? 0
        );
      
      const endTime = parseAleoInteger(onChainData?.end_time)
        ?? getAuctionMetadataEndTime(auctionMetadata)
        ?? Math.floor(Date.now() / 1000) + 24 * 3600;
      
      const now = Math.floor(Date.now() / 1000);
      const timeRemaining = endTime - now;
      
      // Parse winner and winning amount directly from auction info
      let winnerAddress = null;
      let winningBid = null;
      let winningAmountMicro = null;
      let platformFeeMicro = parseAleoUnsignedIntegerString(onChainData?.platform_fee_amount);
      let sellerNetAmountMicro = parseAleoUnsignedIntegerString(onChainData?.seller_net_amount);
      
      if (typeof onChainData?.winner === 'string' && onChainData.winner !== EMPTY_ALEO_ADDRESS) {
        winnerAddress = onChainData.winner;
      }
      
      const winningAmount = parseAleoInteger(onChainData?.winning_amount);
      const winningAmountRaw = parseAleoUnsignedIntegerString(onChainData?.winning_amount);
      if (winningAmount !== null && winningAmount > 0) {
        winningBid = winningAmount / 1_000_000;
        winningAmountMicro = winningAmountRaw ?? winningAmount.toString();
      }
      
      // FALLBACK: Always try to fetch from separate mappings if not found in auction info
      // This handles cases where API doesn't return full struct data
      if (!winnerAddress) {
        try {
          const winnerData = await getHighestBidder(auctionId);
          if (winnerData && typeof winnerData === 'string' && winnerData.startsWith('aleo1')) {
            winnerAddress = winnerData;
          }
        } catch (error) {
          console.error('Failed to fetch winner mapping:', error);
        }
      }
      
      if (!winningBid) {
        try {
          const bidData = await getHighestBid(auctionId);
          const highestBid = parseAleoInteger(bidData);
          const highestBidRaw = parseAleoUnsignedIntegerString(bidData);

          if (highestBid !== null && highestBid > 0) {
            winningBid = highestBid / 1_000_000;
            winningAmountMicro = highestBidRaw ?? highestBid.toString();
          }
        } catch (error) {
          console.error('Failed to fetch winning bid mapping:', error);
        }
      }

      if (!platformFeeMicro && winningAmountMicro) {
        platformFeeMicro = calculatePlatformFee(winningAmountMicro);
      }

      if (!sellerNetAmountMicro && winningAmountMicro) {
        sellerNetAmountMicro = calculateSellerNetAmount(winningAmountMicro);
      }

      const reserveStatusFromChain = parseAleoBoolean(onChainData?.reserve_met);
      const reserveMet = state >= 2
        ? (reserveStatusFromChain ?? (
            winningAmountMicro
              ? isReserveMet(winningAmountMicro, reservePriceMicro)
              : null
          ))
        : null;
      const reservePrice = reservePriceMicro / 1_000_000;
      const platformFee = microToDisplayAmount(platformFeeMicro);
      const sellerNetAmount = microToDisplayAmount(sellerNetAmountMicro);
      
      const hours = Math.floor(timeRemaining / 3600);
      const minutes = Math.floor((timeRemaining % 3600) / 60);
      const timeString = timeRemaining > 0 ? `${hours}h ${minutes}m` : 'Ended';
      
      const auctionData = {
        id: auctionId,
        title: auctionMetadata?.title || `Auction #${auctionId}`,
        description: auctionMetadata?.description || 'No description available',
        format: 'Sealed-Bid',
        currentBid: winningBid ? winningBid.toString() : '0',
        minBid: minBid.toString(),
        endTime: timeString,
        endTimestamp: endTime,
        status,
        contractState: status.toUpperCase(),
        seller: onChainData?.seller || auctionMetadata?.creator || 'Unknown',
        winner: winnerAddress,
        winningBid,
        winningAmountMicro,
        token: currency,
        currencyType,
        assetType,
        revealPeriod,
        disputePeriod,
        revealDeadline,
        disputeDeadline,
        totalEscrowed: totalEscrowedMicro / 1_000_000,
        totalEscrowedMicro,
        hasEscrow: totalEscrowedMicro > 0,
        settledAt,
        claimableAt,
        claimableAtReached: claimableAt > 0 ? now >= claimableAt : false,
        reservePrice,
        reservePriceMicro,
        reserveMet,
        platformFee,
        platformFeeMicro,
        platformFeePercent: 2.5,
        sellerNetAmount,
        sellerNetAmountMicro,
        platformFeeClaimed,
        platformFeeClaimedAt,
        itemReceived,
        itemReceivedAt,
        paymentClaimed,
        paymentClaimedAt,
        confirmationTimeout,
        confirmationTimeoutDays: Math.max(1, Math.round(confirmationTimeout / 86400)),
        contractVersion: 'V2.21',
        sellerDisplayName: auctionMetadata?.sellerDisplayName || null,
        itemPhotos: Array.isArray(auctionMetadata?.itemPhotos) ? auctionMetadata.itemPhotos : [],
        sellerVerification: auctionMetadata?.sellerVerification || null,
        assetProof: auctionMetadata?.assetProof || null,
        proofFiles: Array.isArray(auctionMetadata?.proofFiles) ? auctionMetadata.proofFiles : [],
        offers: Array.isArray(auctionMetadata?.offers) ? auctionMetadata.offers : [],
        disputes: Array.isArray(auctionMetadata?.disputes) ? auctionMetadata.disputes : [],
        isFixture: Boolean(auctionMetadata?.isFixture || auctionMetadata?.mockOnChain),
      };
      
      setAuction(auctionData);
    } catch (error) {
      console.error('❌ Error loading auction:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auction) {
      setSellerVerification(null);
      setAuctionProofBundle(null);
      setOnChainSellerProfile(null);
      setOnChainProofRoot(null);
      setOnChainDisputeRoot(null);
      return undefined;
    }

    let isCancelled = false;

    const loadOpsMetadata = async () => {
      const [verification, proofBundle, sellerProfile, proofRoot, disputeRoot] = await Promise.all([
        getSellerVerification(auction.seller),
        getAuctionProofBundle(auction.id),
        getSellerProfileOnChain(auction.seller),
        getAuctionProofRootOnChain(auction.id),
        getAuctionDisputeRootOnChain(auction.id),
      ]);

      if (isCancelled) {
        return;
      }

      setSellerVerification(verification || auction.sellerVerification || null);
      setAuctionProofBundle(proofBundle || auction.assetProof || null);
      setOnChainSellerProfile(sellerProfile);
      setOnChainProofRoot(proofRoot);
      setOnChainDisputeRoot(disputeRoot);
    };

    loadOpsMetadata();

    return () => {
      isCancelled = true;
    };
  }, [auction]);

  useEffect(() => {
    if (!auction) {
      setReputation(null);
      setOffers([]);
      setDisputes([]);
      return undefined;
    }

    let isCancelled = false;

    const loadOpsMarketData = async () => {
      const [reputationResponse, offersResponse, disputesResponse, watchlistResponse] = await Promise.all([
        getReputation(auction.seller),
        getOffers({ auctionId }),
        getDisputes({ auctionId }),
        address ? getWatchlist(address) : Promise.resolve({
          auctionIds: [],
          sellers: [],
          categories: [],
        }),
      ]);

      if (isCancelled) {
        return;
      }

      const fallbackReputation = auction.isFixture && auction.sellerVerification
        ? {
            wallet: auction.seller,
            trustScore: auction.sellerVerification.status === 'verified' ? 82 : 61,
            verificationStatus: auction.sellerVerification.status || 'pending',
            seller: {
              auctionsCreated: 1,
              auctionsSettled: auction.status === 'settled' ? 1 : 0,
              auctionsCancelled: auction.status === 'cancelled' ? 1 : 0,
              successRate: auction.status === 'settled' ? 1 : 0,
              averageSettlementHours: null,
              disputeRatio: auction.status === 'disputed' ? 1 : 0,
            },
            bidder: {
              participations: 0,
              wins: 0,
              winRate: 0,
              offersSubmitted: Array.isArray(auction.offers) ? auction.offers.length : 0,
              disputesOpened: Array.isArray(auction.disputes) ? auction.disputes.length : 0,
            },
            updatedAt: new Date().toISOString(),
          }
        : null;

      setReputation(reputationResponse || fallbackReputation);
      setOffers(Array.isArray(offersResponse) && offersResponse.length > 0 ? offersResponse : (auction.offers || []));
      setDisputes(Array.isArray(disputesResponse) && disputesResponse.length > 0 ? disputesResponse : (auction.disputes || []));
      setWatchlist(watchlistResponse);
    };

    loadOpsMarketData();

    return () => {
      isCancelled = true;
    };
  }, [address, auction, auctionId]);

  useEffect(() => {
    if (!auction) {
      return;
    }

    const roles = [];
    if (address && auction.seller?.toLowerCase() === address.toLowerCase()) {
      roles.push('seller');
    }

    if (address && auction.winner?.toLowerCase() === address.toLowerCase()) {
      roles.push('winner');
    }

    if (address && (submittedCommitmentData || pendingCommitmentData || storedCommitmentData)) {
      roles.push('bidder');
    }

    const syncSnapshot = async () => {
      const opsDebugInfo = getOpsApiDebugInfo();
      if (auction.isFixture && !opsDebugInfo.isLocalTarget) {
        return;
      }

      await syncAuctionSnapshot({
        ...auction,
        itemPhotosCount: Array.isArray(auction.itemPhotos) ? auction.itemPhotos.length : 0,
        proofFilesCount: Array.isArray(auctionProofBundle?.proofFiles)
          ? auctionProofBundle.proofFiles.length
          : Array.isArray(auction.proofFiles)
            ? auction.proofFiles.length
            : 0,
        verificationStatus: sellerVerification?.status || auction.sellerVerification?.status || 'pending',
      });

      if (address && roles.length > 0) {
        await syncAuctionRole({
          auctionId: auction.id,
          wallet: address,
          roles,
        });
      }
    };

    syncSnapshot();
  }, [
    address,
    auction,
    auctionProofBundle?.proofFiles,
    pendingCommitmentData,
    sellerVerification?.status,
    storedCommitmentData,
    submittedCommitmentData,
  ]);

  const waitForAuctionState = async (expectedStatus, options = {}) => {
    const attempts = options.attempts ?? 10;
    const intervalMs = options.intervalMs ?? 2000;
    const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const onChainData = await getAuctionInfo(auctionId);
      const state = parseAleoInteger(onChainData?.state);
      const currentStatus = state === null ? null : CONTRACT_STATUS_BY_STATE[state];

      if (currentStatus && expectedStatuses.includes(currentStatus)) {
        return true;
      }

      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    return false;
  };

  const waitForLifecycleTransaction = async (result, successMessage, pendingMessage, options = {}) => {
    const { auto = false } = options;
    const transactionId =
      typeof result?.walletTransactionId === 'string' && result.walletTransactionId.trim()
        ? result.walletTransactionId
        : typeof result?.transactionId === 'string' && result.transactionId.trim()
          ? result.transactionId
          : typeof result === 'string' && result.trim()
            ? result
            : null;
    const explorerTransactionId =
      typeof result?.explorerTransactionId === 'string' && result.explorerTransactionId.trim()
        ? result.explorerTransactionId
        : null;

    if (!transactionId) {
      showLifecycleNotice(successMessage, { auto, tone: 'success' });
      await loadAuctionData();
      return;
    }

    const confirmation = await resolveTransactionStatus(transactionId, explorerTransactionId);

    if (confirmation.status === 'rejected') {
      throw new Error(confirmation.error || 'Transaction was rejected by the network after submission');
    }

    if (confirmation.status === 'confirmed') {
      showLifecycleNotice(successMessage, { auto, tone: 'success' });
    } else {
      showLifecycleNotice(`${pendingMessage}\n\nTransaction ID: ${transactionId}`, { auto, tone: 'info' });
    }

    await loadAuctionData();
  };

  const waitForLifecycleState = async ({
    result,
    expectedStatus,
    expectedStatuses,
    successMessage,
    pendingMessage,
    statePendingMessage,
    auto = false,
  }) => {
    await waitForLifecycleTransaction(result, successMessage, pendingMessage, { auto });

    const expected = expectedStatuses || expectedStatus;

    if (!expected) {
      return true;
    }

    const stateReached = await waitForAuctionState(expected, {
      attempts: 8,
      intervalMs: 2000,
    });

    await loadAuctionData();

    if (!stateReached && statePendingMessage) {
      showLifecycleNotice(statePendingMessage, { auto, tone: 'info' });
    }

    return stateReached;
  };

  useEffect(() => {
    if (!address) {
      setIsClosePending(false);
      return undefined;
    }

    if (auction?.status && auction.status !== 'open') {
      clearPendingCloseAuction(auctionId, address);
      setIsClosePending(false);
      return undefined;
    }

    const pendingCloseAuction = getPendingCloseAuction(auctionId, address);
    if (!pendingCloseAuction?.transactionId) {
      setIsClosePending(false);
      return undefined;
    }

    let isCancelled = false;
    setIsClosePending(true);

    const syncPendingCloseAuction = async () => {
      try {
        const txResult = await resolveTransactionStatus(
          pendingCloseAuction.walletTransactionId || pendingCloseAuction.transactionId,
          pendingCloseAuction.explorerTransactionId || pendingCloseAuction.transactionId
        );

        if (isCancelled) {
          return;
        }

        if (txResult.status === 'rejected') {
          clearPendingCloseAuction(auctionId, address);
          setIsClosePending(false);
          return;
        }

        const stateReached = await waitForAuctionState('closed', {
          attempts: 4,
          intervalMs: 2000,
        });

        if (isCancelled) {
          return;
        }

        if (stateReached) {
          clearPendingCloseAuction(auctionId, address);
          setIsClosePending(false);
          await loadAuctionData();
          return;
        }

        savePendingCloseAuction(auctionId, address, {
          ...pendingCloseAuction,
          transactionId: txResult.explorerTransactionId || pendingCloseAuction.transactionId,
          explorerTransactionId: txResult.explorerTransactionId || pendingCloseAuction.explorerTransactionId || null,
          lastCheckedAt: Date.now(),
          status: txResult.status || pendingCloseAuction.status || 'pending',
        });
        setIsClosePending(true);
      } catch {
        if (!isCancelled) {
          setIsClosePending(true);
        }
      }
    };

    syncPendingCloseAuction();

    return () => {
      isCancelled = true;
    };
  }, [address, auction?.status, auctionId]);

  const persistBidSubmission = async ({
    commitment,
    nonce,
    amount,
    currency,
    privacy,
    transactionId,
    privateRecordId = null,
  }) => {
    const txResult = await resolveTransactionStatus(transactionId);

    if (txResult.status === 'rejected') {
      throw new Error(txResult.error || 'Transaction was rejected by the network after submission');
    }

    const commitmentStatus = txResult.status === 'confirmed'
      ? 'confirmed'
      : 'pending-confirmation';

    const storedTransactionId = txResult.explorerTransactionId || transactionId;

    saveNonce(auctionId, nonce, address);
    saveCommitment(auctionId, commitment, amount, address, currency, {
      privacy,
      transactionId: storedTransactionId,
      walletTransactionId: transactionId,
      explorerTransactionId: txResult.explorerTransactionId || null,
      privateRecordId,
      status: commitmentStatus,
      confirmedAt: commitmentStatus === 'confirmed' ? Date.now() : null,
      lastCheckedAt: Date.now(),
    });
    refreshStoredCommitment();

    return commitmentStatus;
  };

  const handleStartTransfer = async () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }

    if (auction.status !== 'open') {
      alert('Bidding is only available while the contract state is OPEN.');
      return;
    }
    
    if (!bidAmount || parseFloat(bidAmount) < parseFloat(auction.minBid)) {
      alert(`Bid amount must be at least ${auction.minBid} ${auction.token}`);
      return;
    }
    
    // Check if user already has a bid - BLOCK duplicate bids
    const existingBid = activeCommitmentData;
    if (existingBid) {
      const bidStateLabel = existingBid.status === 'pending-confirmation'
        ? 'is awaiting confirmation'
        : 'has already been recorded';
      alert(
        '❌ You Already Have a Bid!\n\n' +
        `Your bid: ${(existingBid.amount / 1_000_000).toFixed(2)} ${auction.token}\n\n` +
        `Current status: ${bidStateLabel}.\n\n` +
        '⚠️ Bids are final and cannot be changed or canceled.\n\n' +
        'This is a sealed-bid auction - once you place a bid, it is committed to the blockchain and cannot be modified.'
      );
      return;
    }
    
    // IMPORTANT: Warn about balance requirements for two-step process
    const bidAmountFloat = parseFloat(bidAmount);
    const estimatedFees = 0.002; // ~0.001 per transaction x 2 steps
    const requiredBalance = bidAmountFloat + estimatedFees;
    
    const proceed = window.confirm(
      `⚠️ Two-Step Bidding Process\n\n` +
      `Bid Amount: ${bidAmount} ALEO\n` +
      `Estimated Fees: ~${estimatedFees} ALEO (2 transactions)\n` +
      `Total Required: ~${requiredBalance.toFixed(3)} ALEO\n\n` +
      `IMPORTANT:\n` +
      `• Step 1: Transfer ${bidAmount} ALEO to contract\n` +
      `• Step 2: Submit commitment (requires fee)\n\n` +
      `Make sure you have at least ${requiredBalance.toFixed(3)} ALEO in your wallet.\n\n` +
      `If you don't have enough balance for Step 2 fee,\n` +
      `your transferred credits will be stuck until you\n` +
      `add more balance to complete Step 2.\n\n` +
      `Continue?`
    );
    
    if (!proceed) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const bidAmountMicro = Math.floor(parseFloat(bidAmount) * 1_000_000);
      
      if (!executeTransaction) {
        throw new Error('Wallet does not support transactions. Please reconnect your wallet.');
      }
      
      // CRITICAL: credits.aleo/transfer_public requires ACCOUNT ADDRESS, not program name
      // Program name: shadowbid_marketplace_v2_21.aleo
      // Program account: Need to query or compute from program ID
      
      // Temporary: Try with program name (may not work for all wallets)
      const programId = import.meta.env.VITE_PROGRAM_ID || 'shadowbid_marketplace_v2_21.aleo';
      
      const transferInputs = [
        programId,  // Try program name - wallet may resolve to address
        `${bidAmountMicro}u64`
      ];
      
      const transferResult = await executeTransaction({
        program: 'credits.aleo',
        function: 'transfer_public',
        inputs: transferInputs,
        fee: 1_000_000,
        privateFee: false,
      });
      
      // CRITICAL: Check if transaction was actually accepted by wallet
      if (!transferResult) {
        throw new Error('Transaction returned no result - likely rejected by wallet');
      }
      
      // Check for rejection status
      if (transferResult.status === 'REJECTED' || transferResult.error) {
        throw new Error(transferResult.error || 'Transaction was rejected by wallet');
      }
      
      // Check if transaction has ID (proof of acceptance)
      if (!transferResult.transactionId) {
        throw new Error('Transaction was not accepted - no transaction ID returned');
      }
      
      // Check for insufficient balance
      if (transferResult.message && transferResult.message.includes('insufficient balance')) {
        throw new Error('Insufficient balance for transaction');
      }
      
      // Move to Step 2 ONLY if transaction was successful
      setAleoStep(2);
      alert('✅ Transfer complete! Now click "Submit Commitment" to complete your bid.');
      
    } catch (error) {
      console.error('❌ Error in Step 1:', error);
      
      let errorMsg = '❌ Transfer Failed:\n\n';
      const errorStr = error.message || error.toString();
      
      if (errorStr.includes('rejected by wallet') || errorStr.includes('REJECTED')) {
        errorMsg = '❌ Transaction Rejected by Wallet\n\n';
        errorMsg += 'The wallet rejected the transfer.\n\n';
        errorMsg += 'Possible reasons:\n';
        errorMsg += '• Insufficient balance (need bid amount + ~0.002 ALEO for fees)\n';
        errorMsg += '• User cancelled the transaction\n';
        errorMsg += '• Wallet security settings blocked it\n\n';
        errorMsg += `Required: ${bidAmount} ALEO + ~0.002 ALEO fees = ~${(parseFloat(bidAmount) + 0.002).toFixed(3)} ALEO total`;
      } else if (errorStr.includes('insufficient balance')) {
        errorMsg = '❌ Insufficient Balance\n\n';
        errorMsg += `You need at least ${(parseFloat(bidAmount) + 0.002).toFixed(3)} ALEO:\n`;
        errorMsg += `• ${bidAmount} ALEO for bid\n`;
        errorMsg += `• ~0.002 ALEO for transaction fees (2 steps)\n\n`;
        errorMsg += 'Please add more ALEO to your wallet and try again.';
      } else if (errorStr.includes('no transaction ID')) {
        errorMsg = '❌ Transaction Not Accepted\n\n';
        errorMsg += 'The wallet did not accept the transaction.\n';
        errorMsg += 'This usually means the transaction was rejected.\n\n';
        errorMsg += 'Please check your wallet balance and try again.';
      } else {
        errorMsg += errorStr;
      }
      
      alert(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitCommitment = async () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }

    if (auction.status !== 'open') {
      alert('Commitment submission is only available while the contract state is OPEN.');
      return;
    }
    
    if (!bidAmount) {
      alert('Please enter bid amount first');
      return;
    }

    const existingBid = activeCommitmentData;
    if (existingBid) {
      const bidStateLabel = existingBid.status === 'pending-confirmation'
        ? 'still awaiting confirmation'
        : 'already confirmed';
      alert(`You already have a bid that is ${bidStateLabel}.`);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const bidAmountMicro = Math.floor(parseFloat(bidAmount) * 1_000_000);
      
      if (!executeTransaction) {
        throw new Error('Wallet does not support transactions. Please reconnect your wallet.');
      }
      
      // Generate nonce and commitment
      const nonce = generateNonce();
      const commitment = generateCommitment(bidAmountMicro, nonce, address, auctionId);
      
      const commitResult = await commitBidAleo(
        executeTransaction,
        parseInt(auctionId),
        commitment,
        bidAmountMicro
      );
      
      // CRITICAL: Verify transaction was accepted
      if (!commitResult) {
        throw new Error('Transaction returned no result - likely rejected by wallet');
      }
      
      // Check for rejection status
      if (commitResult.status === 'REJECTED' || commitResult.error) {
        throw new Error(commitResult.error || 'Transaction was rejected by wallet');
      }
      
      // Check if transaction has ID (proof of acceptance)
      if (!commitResult.transactionId) {
        throw new Error('Transaction was not accepted - no transaction ID returned');
      }
      
      // Check for insufficient balance
      if (commitResult.message && commitResult.message.includes('insufficient balance')) {
        throw new Error('Insufficient balance for transaction fee');
      }
      
      const bidStatus = await persistBidSubmission({
        commitment,
        nonce,
        amount: bidAmountMicro,
        currency: 'aleo',
        privacy: 'public',
        transactionId: commitResult.transactionId,
      });

      if (bidStatus === 'confirmed') {
        alert(`✅ Bid Submitted Successfully!\n\nYour bid of ${bidAmount} ALEO has been committed.\n\nTransaction ID: ${commitResult.transactionId}\n\nRemember to reveal your bid after the auction closes.`);
      } else {
        alert(`⏳ Bid Submitted to Network\n\nThe wallet returned transaction ID ${commitResult.transactionId}, but explorer confirmation is still pending.\n\nThis UI will switch to success automatically after the transaction is confirmed.`);
      }
      
      // Reset form
      setBidAmount('');
      setShowBidForm(false);
      setAleoStep(1);
      
      // Reload auction data
      await loadAuctionData();
      
    } catch (error) {
      console.error('❌ Error in Step 2:', error);
      
      let errorMsg = '❌ Failed to submit commitment:\n\n';
      
      const errorStr = error.message || error.toString();
      
      if (errorStr.includes('rejected by wallet') || errorStr.includes('REJECTED')) {
        errorMsg = '❌ Transaction Rejected by Wallet\n\n';
        errorMsg += 'The wallet rejected the transaction.\n\n';
        errorMsg += 'Possible reasons:\n';
        errorMsg += '• Insufficient balance for transaction fee\n';
        errorMsg += '• User cancelled the transaction\n';
        errorMsg += '• Wallet security settings blocked it\n\n';
        errorMsg += '💡 If you have insufficient balance:\n';
        errorMsg += '1. Add at least 0.002 ALEO to your wallet\n';
        errorMsg += '2. Click "Submit Commitment" again to retry Step 2\n';
        errorMsg += '3. Your transferred credits are safe in the contract';
      } else if (errorStr.toLowerCase().includes('already exists in the ledger') ||
                 errorStr.toLowerCase().includes('input id')) {
        errorMsg = '⚠️ Bid Nonce Collision Detected\n\n';
        errorMsg += 'The wallet rejected this commitment because its input ID already exists on-chain.\n\n';
        errorMsg += 'This is safe to retry. Submit the commitment again to use a fresh nonce.';
      } else if (errorStr.includes('insufficient balance') || errorStr.includes('Fee verification failed')) {
        errorMsg = '❌ Insufficient Balance for Fee\n\n';
        errorMsg += 'Your bid amount was already transferred in Step 1,\n';
        errorMsg += 'but you don\'t have enough balance for Step 2 fee.\n\n';
        errorMsg += '💡 Solution:\n';
        errorMsg += '1. Add at least 0.002 ALEO to your wallet\n';
        errorMsg += '2. Click "Submit Commitment" again to retry Step 2\n';
        errorMsg += '3. Your transferred credits are safe in the contract\n\n';
        errorMsg += 'Required: ~0.001 ALEO for transaction fee';
      } else {
        errorMsg += errorStr;
      }
      
      alert(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // NEW V2.18: Private Bid Handler
  const handlePrivateBid = async () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }

    if (auction.status !== 'open') {
      alert('Private bidding is only available while the contract state is OPEN.');
      return;
    }
    
    if (!bidAmount) {
      alert('Please enter bid amount first');
      return;
    }
    
    if (parseFloat(bidAmount) < parseFloat(auction.minBid)) {
      alert(`Bid amount must be at least ${auction.minBid} ${auction.token}`);
      return;
    }
    
    // Check if user already has a bid - BLOCK duplicate bids
    const existingBid = activeCommitmentData;
    if (existingBid) {
      const bidStateLabel = existingBid.status === 'pending-confirmation'
        ? 'still awaiting confirmation'
        : 'already confirmed';
      alert(`You already have a private bid that is ${bidStateLabel}.`);
      return;
    }
    
    // No confirmation dialog - user already toggled privacy ON
    // That's sufficient confirmation of intent
    
    setIsSubmitting(true);
    let selectedRecordIdentity = null;
    let keepRecordLocked = false;
    
    try {
      const bidAmountMicro = Math.floor(parseFloat(bidAmount) * 1_000_000);
      
      // Generate nonce and commitment
      const nonce = generateNonce();
      const commitment = generateCommitment(bidAmountMicro, nonce, address, auctionId);

      const recordResponse = await requestRecords(PRIVATE_CREDITS_PROGRAM_ID, true);
      const walletRecords = Array.isArray(recordResponse)
        ? recordResponse
        : Array.isArray(recordResponse?.records)
          ? recordResponse.records
          : [];

      if (walletRecords.length === 0) {
        throw new Error('No private ALEO credits found');
      }

      const enrichedRecords = await Promise.all(
        walletRecords.map((record) => enrichPrivateRecord(record, decrypt))
      );

      const lockedRecordIds = getLockedPrivateRecordIds(address);

      const validRecords = enrichedRecords
        .map((record) => ({
          record,
          microcredits: extractPrivateRecordMicrocredits(record),
          identity: extractPrivateRecordIdentity(record),
          isSpent: isPrivateRecordMarkedSpent(record),
        }))
        .filter(({ microcredits, identity, isSpent }) =>
          microcredits !== null &&
          microcredits >= bidAmountMicro &&
          !isSpent &&
          (!identity || !lockedRecordIds.includes(identity))
        )
        .sort((a, b) => a.microcredits - b.microcredits);

      if (validRecords.length === 0) {
        const unreadableRecords = enrichedRecords.filter(
          (record) => extractPrivateRecordMicrocredits(record) === null
        );

        const reusableRecords = enrichedRecords.filter((record) => {
          const microcredits = extractPrivateRecordMicrocredits(record);
          const identity = extractPrivateRecordIdentity(record);
          return (
            microcredits !== null &&
            microcredits >= bidAmountMicro &&
            !isPrivateRecordMarkedSpent(record) &&
            identity &&
            lockedRecordIds.includes(identity)
          );
        });

        if (unreadableRecords.length === enrichedRecords.length) {
          throw new Error('Could not read private ALEO record balances from wallet');
        }

        if (reusableRecords.length > 0) {
          throw new Error('Selected private credits were already used recently. Refresh wallet records or wait for the change record before bidding again.');
        }

        throw new Error('Insufficient private credits');
      }

      const selectedRecord = validRecords[0].record;
      selectedRecordIdentity = validRecords[0].identity;
      lockPrivateRecord(address, selectedRecordIdentity);
      
      if (!executeTransaction) {
        throw new Error('Wallet does not support transactions');
      }
      
      const result = await commitBidAleoPrivate(
        executeTransaction,
        parseInt(auctionId, 10),
        commitment,
        selectedRecord,
        bidAmountMicro
      );
      
      // CRITICAL: Verify transaction was actually accepted by wallet
      if (!result) {
        throw new Error('No response from wallet - transaction may have failed');
      }
      
      if (result.status === 'REJECTED') {
        throw new Error('Transaction was rejected by wallet');
      }
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      if (!result.transactionId) {
        throw new Error('No transaction ID returned - transaction was not submitted');
      }
      
      const bidStatus = await persistBidSubmission({
        commitment,
        nonce,
        amount: bidAmountMicro,
        currency: 'aleo',
        privacy: 'private',
        transactionId: result.transactionId,
        privateRecordId: selectedRecordIdentity,
      });
      
      if (bidStatus !== 'confirmed') {
        alert(`⏳ Private bid submitted.\n\nShield accepted the request and the bid panel will update after confirmation.`);
      }
      
      // Reset form
      setBidAmount('');
      setShowBidForm(false);
      setUsePrivateBid(false);
      
      // Reload auction data
      await loadAuctionData();
      
    } catch (error) {
      console.error('❌ Private bid error:', error);
      
      // IMPORTANT: Don't save to localStorage if there's an error!
      // This prevents showing success UI when transaction actually failed
      
      let errorMsg = '❌ Private Bid Failed\n\n';
      const errorStr = error.message || error.toString();
      
      if (errorStr.toLowerCase().includes('invalid transaction payload') || 
          errorStr.toLowerCase().includes('invalid payload')) {
        errorMsg = '⚠️ Shield could not build the private transaction.\n\n';
        errorMsg += 'Try again with a fresh private record, or switch off `Use Private Credits` and use the public ALEO flow.';
      } else if (errorStr.toLowerCase().includes('decryption') ||
                 errorStr.toLowerCase().includes('not allowed')) {
        errorMsg += 'This wallet session was connected without private record access.\n\n';
        errorMsg += 'Disconnect Shield, connect again, approve the private-record request, then retry.\n\n';
        errorMsg += 'If it still fails, use the public ALEO flow.';
      } else if (errorStr.toLowerCase().includes('could not read private aleo record balances')) {
        errorMsg += 'Shield returned private records, but their balances could not be read.\n\n';
        errorMsg += 'Refresh the wallet records or use the public ALEO flow.';
      } else if (errorStr.toLowerCase().includes('user rejected') || 
          errorStr.toLowerCase().includes('user denied') || 
          errorStr.toLowerCase().includes('cancelled')) {
        errorMsg += 'Transaction was cancelled in Shield.';
      } else if (errorStr.toLowerCase().includes('requestrecords') ||
                 errorStr.toLowerCase().includes('method not implemented')) {
        errorMsg += 'This wallet session does not expose private records to the app.\n\n';
        errorMsg += 'Use the public ALEO flow or reconnect Shield.';
      } else if (errorStr.toLowerCase().includes('insufficient')) {
        errorMsg += `You need at least ${bidAmount} ALEO in fresh private credits.\n\n`;
        errorMsg += 'Create or refresh a private record in Shield, then try again.';
      } else if (errorStr.toLowerCase().includes('already exists in the ledger') ||
                 errorStr.toLowerCase().includes('input id')) {
        keepRecordLocked = true;
        lockPrivateRecord(address, selectedRecordIdentity);
        errorMsg += 'The selected private credits record was already used.\n\n';
        errorMsg += 'Refresh wallet records or create a fresh private record before trying again.';
      } else if (errorStr.toLowerCase().includes('already used recently')) {
        errorMsg += 'No fresh private record is available yet.\n\n';
        errorMsg += 'Wait for the change record to appear in Shield, then try again.';
      } else if (errorStr.toLowerCase().includes('no private')) {
        errorMsg += 'No private ALEO credits were found.\n\n';
        errorMsg += 'Create a private record in Shield or switch to the public ALEO flow.';
      } else if (errorStr.toLowerCase().includes('no response') || 
                 errorStr.toLowerCase().includes('no transaction id')) {
        errorMsg += 'Shield did not submit the transaction.\n\n';
        errorMsg += 'Please try again, then switch to the public ALEO flow if it keeps happening.';
      } else if (errorStr.toLowerCase().includes('rejected')) {
        errorMsg += `${errorStr}\n\n`;
        errorMsg += 'Check your Shield balance, private records, and network connection.';
      } else {
        errorMsg += errorStr;
        errorMsg += '\n\nTry disconnecting and reconnecting Shield, then use the public ALEO flow if needed.';
      }
      
      console.error('❌ Private bid failed:', errorMsg);
      alert(errorMsg);
      
    } finally {
      if (selectedRecordIdentity && !keepRecordLocked && !getCommitmentData(auctionId, address)) {
        unlockPrivateRecord(address, selectedRecordIdentity);
      }
      setIsSubmitting(false);
    }
  };

  const handlePlaceBid = async () => {
    if (auction.status !== 'open') {
      alert('Bidding is only available while the contract state is OPEN.');
      return;
    }

    if (auction.currencyType === 0 || auction.currencyType === 2) {
      if (!connected) {
        alert('Please connect your wallet first');
        return;
      }
      
      if (!bidAmount || parseFloat(bidAmount) < parseFloat(auction.minBid)) {
        alert(`Bid amount must be at least ${auction.minBid} ${auction.token}`);
        return;
      }
      
      // Check if user already has a bid
      const existingBid = activeCommitmentData;
      if (existingBid) {
        const bidStateLabel = existingBid.status === 'pending-confirmation'
          ? 'is still awaiting confirmation'
          : 'has already been confirmed';
        alert(
          '❌ You Already Have a Bid!\n\n' +
          `Your bid: ${(existingBid.amount / 1_000_000).toFixed(2)} ${auction.token}\n\n` +
          `Current status: ${bidStateLabel}.\n\n` +
          '⚠️ Bids are final and cannot be changed or canceled.'
        );
        return;
      }
      
      const tokenLabel = auction.currencyType === 2 ? 'USAD' : 'USDCx';
      const proceed = window.confirm(
        `🔒 Place Bid with ${tokenLabel}\n\n` +
        `Bid Amount: ${bidAmount} ${tokenLabel}\n` +
        `Estimated Fee: ~0.001 ALEO\n\n` +
        `This is a single-step process:\n` +
        `• Transfer ${tokenLabel} + Submit commitment in one transaction\n\n` +
        `Continue?`
      );
      
      if (!proceed) {
        return;
      }
      
      setIsSubmitting(true);
      
      try {
        const bidAmountMicro = Math.floor(parseFloat(bidAmount) * 1_000_000);
        const nonce = generateNonce();
        const commitment = generateCommitment(bidAmountMicro, nonce, address, auctionId);
        const isUsadBid = auction.currencyType === 2;
        
        if (!executeTransaction) {
          throw new Error('Wallet does not support transactions');
        }
        
        const result = isUsadBid
          ? await commitBidUSAD(executeTransaction, parseInt(auctionId, 10), commitment, bidAmountMicro)
          : await commitBid(executeTransaction, parseInt(auctionId, 10), commitment, bidAmountMicro);
        
        // Verify transaction was accepted
        if (!result || result.status === 'REJECTED' || !result.transactionId) {
          throw new Error('Transaction was rejected by wallet or failed');
        }
        
        const bidStatus = await persistBidSubmission({
          commitment,
          nonce,
          amount: bidAmountMicro,
          currency: isUsadBid ? 'usad' : 'usdcx',
          privacy: 'public',
          transactionId: result.transactionId,
        });

        if (bidStatus === 'confirmed') {
          alert(`✅ Bid Placed Successfully!\n\nYour ${tokenLabel} bid has been committed to the blockchain.`);
        } else {
          alert(`⏳ Bid Submitted to Network\n\nTransaction ID: ${result.transactionId}\n\nExplorer confirmation is still pending, so the bid panel will stay in pending state until it is confirmed.`);
        }
        setBidAmount('');
        await loadAuctionData();
        
      } catch (error) {
        console.error('❌ Error placing USDCx bid:', error);
        
        // Better error handling for duplicate bids
        const errorStr = error.message || error.toString();
        if (errorStr.includes('already exists') || errorStr.includes('duplicate') || errorStr.includes('Mapping::set')) {
          alert(
            '❌ Duplicate Bid Detected!\n\n' +
            'You already have a bid for this auction on the blockchain.\n\n' +
            '⚠️ If you just placed a bid and got a localStorage error,\n' +
            'please refresh the page. Your bid is safe on-chain.'
          );
        } else if (errorStr.toLowerCase().includes('already exists in the ledger') ||
                   errorStr.toLowerCase().includes('input id')) {
          alert(
            '⚠️ Bid Nonce Collision Detected\n\n' +
            'The wallet rejected this bid because its input ID already exists on-chain.\n\n' +
            'Please submit again to use a fresh nonce.'
          );
        } else {
          alert(`❌ Failed to place bid:\n\n${errorStr}`);
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleRevealBid = async (options = {}) => {
    const { auto = false } = options;
    if (!connected) {
      showLifecycleNotice('Please connect your wallet first', { auto, tone: 'error' });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Get saved nonce and commitment
      const nonce = getNonce(auctionId, address);
      const commitmentData = submittedCommitmentData;
      
      if (!nonce || !commitmentData) {
        showLifecycleNotice('❌ No bid found for this auction.\n\nYou need to place a bid first before revealing.', { auto, tone: 'error' });
        return;
      }
      
      if (!executeTransaction) {
        throw new Error('Wallet does not support transactions');
      }
      
      const result = await revealBid(
        executeTransaction,
        parseInt(auctionId),
        commitmentData.amount,
        nonce
      );

      await waitForLifecycleTransaction(
        result,
        '✅ Bid Revealed Successfully!\n\nYour bid is now visible on-chain.',
        '⏳ Reveal submitted, but explorer confirmation is still pending. Refresh the auction after the transaction is confirmed to unlock the next state.',
        { auto }
      );
      
    } catch (error) {
      console.error('❌ Error revealing bid:', error);
      showLifecycleNotice(`❌ Failed to reveal bid:\n\n${error.message || error}`, { auto, tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseAuction = async (options = {}) => {
    const { auto = false } = options;
    if (!connected) {
      showLifecycleNotice('Please connect your wallet first', { auto, tone: 'error' });
      return;
    }

    if (auction?.status !== 'open') {
      showLifecycleNotice('❌ Auction is no longer open.\n\nRefresh the page to load the latest on-chain state.', { auto, tone: 'error' });
      return;
    }
    
    if (auction.seller.toLowerCase() !== address?.toLowerCase()) {
      showLifecycleNotice(`❌ Only the seller can close the auction\n\nSeller: ${auction.seller}\nYour address: ${address}`, { auto, tone: 'error' });
      return;
    }

    if (isClosePending) {
      showLifecycleNotice('⏳ Close Auction already submitted.\n\nWait for the contract state to update to CLOSED before trying again.', { auto, tone: 'info' });
      return;
    }

    if (!auctionCountdownEnded) {
      showLifecycleNotice(
        `⏳ Auction is still running.\n\n` +
        `Close Auction becomes available after ${formatUnixTimestamp(auction?.endTimestamp)}.`,
        { auto, tone: 'info' }
      );
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (!executeTransaction) {
        throw new Error('Wallet does not support transactions');
      }
      
      const result = await closeAuction(executeTransaction, parseInt(auctionId));
      const transactionId = result?.transactionId;
      const explorerTransactionId = looksLikeOnChainTransactionId(result?.explorerTransactionId)
        ? result.explorerTransactionId
        : looksLikeOnChainTransactionId(transactionId)
          ? transactionId
          : null;

      if (transactionId && address) {
        savePendingCloseAuction(auctionId, address, {
          transactionId,
          walletTransactionId: transactionId,
          explorerTransactionId,
          status: 'pending',
          createdAt: Date.now(),
        });
        setIsClosePending(true);
      }

      const stateReached = await waitForLifecycleState({
        result,
        expectedStatus: 'closed',
        successMessage: '✅ Auction Closed Successfully!\n\nBidders can now reveal their bids.',
        pendingMessage: '⏳ Close auction submitted, but explorer confirmation is still pending. The contract may still appear OPEN until the network confirms the transaction.',
        statePendingMessage: '⏳ Close transaction is confirmed, but the auction mapping still has not updated to CLOSED yet. Use Refresh in a few seconds and check the On-Chain State card again.',
        auto,
      });

      if (stateReached && address) {
        clearPendingCloseAuction(auctionId, address);
        setIsClosePending(false);
      }
      
    } catch (error) {
      if (address) {
        clearPendingCloseAuction(auctionId, address);
      }
      setIsClosePending(false);
      console.error('❌ Error closing auction:', error);
      showLifecycleNotice(`❌ Failed to close auction:\n\n${error.message || error}`, { auto, tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimRefund = async (options = {}) => {
    const { auto = false } = options;
    if (!connected) {
      showLifecycleNotice('Please connect your wallet first', { auto, tone: 'error' });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const commitmentData = submittedCommitmentData;
      
      if (!commitmentData) {
        showLifecycleNotice('❌ No bid found for this auction', { auto, tone: 'error' });
        return;
      }
      
      if (!executeTransaction) {
        throw new Error('Wallet does not support transactions');
      }
      
      // Call appropriate refund function based on currency type
      if (auction.currencyType === 0) {
        // USDCx refund
        await claimRefund(
          executeTransaction,
          parseInt(auctionId),
          commitmentData.amount
        );
        showLifecycleNotice('✅ Refund Claimed Successfully!\n\nYour USDCx has been returned.', { auto, tone: 'success' });
      } else if (auction.currencyType === 2) {
        // USAD refund
        await claimRefundUSAD(
          executeTransaction,
          parseInt(auctionId),
          commitmentData.amount
        );
        showLifecycleNotice('✅ Refund Claimed Successfully!\n\nYour USAD has been returned.', { auto, tone: 'success' });
      } else {
        const isPrivateRefund = isPrivateCommitment(commitmentData);
        if (isPrivateRefund) {
          await claimRefundAleoPrivate(
              executeTransaction,
              parseInt(auctionId, 10),
              commitmentData.amount
            );
        } else {
          await claimRefundAleo(
              executeTransaction,
              parseInt(auctionId, 10),
              commitmentData.amount
            );
        }
        showLifecycleNotice(
          isPrivateRefund
            ? '✅ Refund Claimed Successfully!\n\nYour Aleo credits were returned as a private record.'
            : '✅ Refund Claimed Successfully!\n\nYour Aleo credits have been returned.',
          { auto, tone: 'success' }
        );
      }
      
      await loadAuctionData();
      
    } catch (error) {
      console.error('❌ Error claiming refund:', error);
      showLifecycleNotice(`❌ Failed to claim refund:\n\n${error.message || error}`, { auto, tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSettleAfterRevealTimeout = async (options = {}) => {
    const { auto = false } = options;
    if (!connected) {
      showLifecycleNotice('Please connect your wallet first', { auto, tone: 'error' });
      return;
    }

    if (auction?.status !== 'closed') {
      showLifecycleNotice('❌ Timeout settlement is only available after the auction is closed.', { auto, tone: 'error' });
      return;
    }

    if (!revealTimeoutWindowEnded) {
      showLifecycleNotice(
        `⏳ Reveal window is still active.\n\n` +
        `Settle After Reveal Timeout becomes available after ${revealWindowEndsAtLabel}.`,
        { auto, tone: 'info' }
      );
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (!executeTransaction) {
        throw new Error('Wallet does not support transactions');
      }
      
      const result = await settleAfterRevealTimeout(executeTransaction, parseInt(auctionId, 10), getCurrentTimestamp());

      await waitForLifecycleState({
        result,
        expectedStatuses: ['challenge', 'cancelled'],
        successMessage: '✅ Reveal Timeout Settled!\n\nThe contract will now move to CHALLENGE if reserve is met, otherwise to CANCELLED.',
        pendingMessage: '⏳ Reveal-timeout settlement submitted, but explorer confirmation is still pending. Refresh again in a few seconds.',
        statePendingMessage: '⏳ Reveal-timeout settlement is confirmed, but the auction mapping has not updated yet. Refresh again in a few seconds.',
        auto,
      });
      
    } catch (error) {
      console.error('❌ Error settling after reveal timeout:', error);
      showLifecycleNotice(`❌ Failed to settle after reveal timeout:\n\n${error.message || error}`, { auto, tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizeWinner = async (options = {}) => {
    const { auto = false } = options;
    if (!connected) {
      showLifecycleNotice('Please connect your wallet first', { auto, tone: 'error' });
      return;
    }

    if (auction?.status !== 'challenge') {
      showLifecycleNotice('❌ Finalize Winner is only available during the challenge phase.', { auto, tone: 'error' });
      return;
    }

    if (!disputeWindowEnded) {
      showLifecycleNotice(
        `⏳ Dispute window is still active.\n\n` +
        `Finalize Winner becomes available after ${challengeWindowEndsAtLabel}.`,
        { auto, tone: 'info' }
      );
      return;
    }

    if (hasActiveOnChainDispute) {
      showLifecycleNotice(
        '❌ Finalize Winner is blocked while an on-chain dispute is open.\n\n' +
        'Resolve the dispute before finalizing the auction.',
        { auto, tone: 'error' }
      );
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (!executeTransaction) {
        throw new Error('Wallet does not support transactions');
      }

      if (auction.reserveMet === false) {
        throw new Error('Reserve price is not met. Cancel the auction instead of finalizing the winner.');
      }

      const result = await finalizeWinner(executeTransaction, parseInt(auctionId, 10), getCurrentTimestamp());

      await waitForLifecycleState({
        result,
        expectedStatus: 'settled',
        successMessage: '✅ Winner Finalized!\n\nThe auction is now in SETTLED state. Winner and seller actions are available according to the contract.',
        pendingMessage: '⏳ Finalize winner submitted, but explorer confirmation is still pending. Settlement actions will appear after the contract reaches SETTLED.',
        statePendingMessage: '⏳ Finalize Winner transaction is confirmed, but the auction mapping still has not updated to SETTLED yet. Refresh again in a few seconds.',
        auto,
      });
      
    } catch (error) {
      console.error('❌ Error finalizing winner:', error);
      showLifecycleNotice(`❌ Failed to finalize winner:\n\n${error.message || error}`, { auto, tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReceipt = async () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }
    
    // Check if user is winner
    if (auction.winner?.toLowerCase() !== address?.toLowerCase()) {
      alert('❌ Only the winner can confirm receipt');
      return;
    }
    
    const confirmDialog = window.confirm(
      '✅ Confirm Item Receipt?\n\n' +
      'By confirming, you acknowledge that:\n' +
      '• You have received the item\n' +
      '• The item matches the description\n' +
      '• The item is in acceptable condition\n\n' +
      'After confirmation, the seller can claim payment.\n\n' +
      'Continue?'
    );
    
    if (!confirmDialog) return;
    
    setIsSubmitting(true);
    
    try {
      if (!executeTransaction) {
        throw new Error('Wallet does not support transactions');
      }
      
      await confirmReceipt(executeTransaction, parseInt(auctionId, 10));
      
      alert('✅ Receipt Confirmed!\n\nThank you. The seller can now claim payment.');
      
      await loadAuctionData();
      
    } catch (error) {
      console.error('❌ Error confirming receipt:', error);
      alert(`❌ Failed to confirm receipt:\n\n${error.message || error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimWinning = async (options = {}) => {
    const { auto = false } = options;
    if (!connected) {
      showLifecycleNotice('Please connect your wallet first', { auto, tone: 'error' });
      return;
    }
    
    // Check if user is seller
    if (auction.seller?.toLowerCase() !== address?.toLowerCase()) {
      showLifecycleNotice('❌ Only the seller can claim winning bid', { auto, tone: 'error' });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (!executeTransaction) {
        throw new Error('Wallet does not support transactions');
      }

      const sellerNetAmountMicro = auction.sellerNetAmountMicro || auction.winningAmountMicro;
      if (!sellerNetAmountMicro) {
        throw new Error('Seller net amount is not available yet. Refresh the auction and try again.');
      }

      const timestamp = getCurrentTimestamp();
      if (!auction.itemReceived && auction.claimableAt && timestamp < auction.claimableAt) {
        throw new Error(`Seller claim is available after ${formatUnixTimestamp(auction.claimableAt)} unless the winner confirms receipt earlier.`);
      }
      
      if (auction.currencyType === 1) {
        await claimWinningAleo(executeTransaction, parseInt(auctionId, 10), sellerNetAmountMicro, auction.seller, timestamp);
      } else if (auction.currencyType === 2) {
        await claimWinningUSAD(executeTransaction, parseInt(auctionId, 10), sellerNetAmountMicro, auction.seller, timestamp);
      } else {
        await claimWinningUSDCx(executeTransaction, parseInt(auctionId, 10), sellerNetAmountMicro, auction.seller, timestamp);
      }
      
      showLifecycleNotice(`✅ Payment Claimed Successfully!\n\nYou received ${auction.sellerNetAmount || auction.winningBid || auction.minBid} ${auction.token}`, { auto, tone: 'success' });
      
      await loadAuctionData();
      
    } catch (error) {
      console.error('❌ Error claiming winning bid:', error);
      showLifecycleNotice(`❌ Failed to claim payment:\n\n${error.message || error}`, { auto, tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAuction = async () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }

    if (auction?.status !== 'open') {
      alert('❌ Auction can only be canceled while it is still open.');
      return;
    }
    
    if (auction.seller.toLowerCase() !== address?.toLowerCase()) {
      alert(`❌ Only the seller can cancel the auction\n\nSeller: ${auction.seller}\nYour address: ${address}`);
      return;
    }

    if (isClosePending) {
      alert('⏳ Close Auction already submitted.\n\nWait for that transaction to finish before attempting another seller action.');
      return;
    }
    
    if (auction.hasEscrow) {
      alert(
        '❌ Cancel Unavailable\n\n' +
        'Contract V2.21 only allows canceling an auction while total escrow is still 0.'
      );
      return;
    }

    const confirmCancel = window.confirm(
      'Cancel this auction?\n\n' +
      'This action follows the V2.21 contract and is only available before any escrowed bids exist.'
    );
    if (!confirmCancel) return;
    
    setIsSubmitting(true);
    
    try {
      if (!executeTransaction) {
        throw new Error('Wallet does not support transactions');
      }

      await cancelAuction(executeTransaction, parseInt(auctionId, 10));
      
      alert('✅ Auction Canceled Successfully!\n\nAll bidders will be automatically refunded.');
      
      // Remove from localStorage
      const myAuctions = JSON.parse(localStorage.getItem('myAuctions') || '[]');
      const updatedAuctions = myAuctions.filter(a => a.id !== parseInt(auctionId));
      localStorage.setItem('myAuctions', JSON.stringify(updatedAuctions));
      
      // Navigate back to auction list
      navigate('/premium-auctions');
      
    } catch (error) {
      console.error('❌ Error canceling auction:', error);
      alert(`❌ Failed to cancel auction:\n\n${error.message || error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimPlatformFee = async (options = {}) => {
    const { auto = false } = options;
    if (!connected) {
      showLifecycleNotice('Please connect your wallet first', { auto, tone: 'error' });
      return;
    }

    if (!isPlatformOwner(address)) {
      showLifecycleNotice('❌ Only the platform owner can claim platform fees', { auto, tone: 'error' });
      return;
    }

    if (!auction.platformFeeMicro) {
      showLifecycleNotice('❌ Platform fee amount is not available yet', { auto, tone: 'error' });
      return;
    }

    setIsClaimingFee(true);

    try {
      if (!executeTransaction) {
        throw new Error('Wallet does not support transactions');
      }

      if (auction.currencyType === 1) {
        await claimPlatformFeeAleo(executeTransaction, parseInt(auctionId, 10), auction.platformFeeMicro);
      } else if (auction.currencyType === 2) {
        await claimPlatformFeeUsad(executeTransaction, parseInt(auctionId, 10), auction.platformFeeMicro);
      } else {
        await claimPlatformFeeUsdcx(executeTransaction, parseInt(auctionId, 10), auction.platformFeeMicro);
      }

      showLifecycleNotice(`✅ Platform Fee Claimed!\n\nReceived ${auction.platformFee || 0} ${auction.token}.`, { auto, tone: 'success' });
      await loadAuctionData();
    } catch (error) {
      console.error('❌ Error claiming platform fee:', error);
      showLifecycleNotice(`❌ Failed to claim platform fee:\n\n${error.message || error}`, { auto, tone: 'error' });
    } finally {
      setIsClaimingFee(false);
    }
  };

  const handleCancelReserveNotMet = async (options = {}) => {
    const { auto = false } = options;
    showLifecycleNotice(
      'ℹ️ In V2.21, reserve-miss handling is part of Settle After Reveal Timeout.\n\nUse the closed-state settlement action after the reveal deadline passes.',
      { auto, tone: 'info' }
    );
  };

  const handleToggleWatchlist = async () => {
    if (!address) {
      alert('Connect your wallet first to save this auction.');
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

  const handleShareAuction = async () => {
    const targetUrl = `${window.location.origin}/premium-auction/${auctionId}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: auction?.title || `Auction #${auctionId}`,
          text: 'Check this ShadowBid auction',
          url: targetUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(targetUrl);
      alert(`🔗 Auction link copied:\n\n${targetUrl}`);
    } catch (error) {
      console.error('Failed to share auction:', error);
      alert(`Unable to share automatically.\n\nOpen this URL manually:\n${targetUrl}`);
    }
  };

  const handleSubmitOffer = async () => {
    if (!address) {
      alert('Connect your wallet first to submit a private offer.');
      return;
    }

    if (!offerForm.amount || Number(offerForm.amount) <= 0) {
      alert('Enter a valid offer amount first.');
      return;
    }

    const createdOffer = await createOffer({
      auctionId,
      wallet: address,
      amount: Number(offerForm.amount),
      currency: auction?.token || 'ALEO',
      note: offerForm.note,
      disclosureMode: offerForm.disclosureMode,
      proofOfFundsStatus: offerForm.proofOfFundsStatus,
      type: 'make_offer',
    });

    if (!createdOffer) {
      alert('Failed to save the offer.');
      return;
    }

    setOffers((current) => [createdOffer, ...current]);
    setOfferForm({
      amount: '',
      note: '',
      disclosureMode: 'selective',
      proofOfFundsStatus: 'self-attested',
    });
    alert('✅ Offer saved successfully.');
  };

  const handleSubmitDispute = async () => {
    if (!address) {
      alert('Connect your wallet first to open a dispute.');
      return;
    }

    if (!disputeForm.title || !disputeForm.description) {
      alert('Please add a dispute title and description.');
      return;
    }

    const evidence = disputeForm.evidence
      ? disputeForm.evidence.split('\n').map((line) => line.trim()).filter(Boolean)
      : [];
    const disputeRole =
      auction?.winner && address && auction.winner.toLowerCase() === address.toLowerCase()
        ? 'winner'
        : auction?.seller && address && auction.seller.toLowerCase() === address.toLowerCase()
          ? 'seller'
          : 'bidder';

    const createdDispute = await createDispute({
      auctionId,
      wallet: address,
      seller: auction?.seller || null,
      role: disputeRole,
      title: disputeForm.title,
      description: disputeForm.description,
      evidence,
    });

    if (!createdDispute) {
      alert('Failed to save the dispute.');
      return;
    }

    let persistedDispute = createdDispute;
    let onChainResultMessage = 'Saved to the app data layer only.';

    if (canOpenOnChainDispute && executeTransaction) {
      try {
        const disputeRoot = await hashJsonToField({
          auctionId,
          wallet: address,
          seller: auction?.seller || null,
          role: disputeRole,
          title: disputeForm.title,
          description: disputeForm.description,
          evidence,
          createdAt: createdDispute.createdAt,
        });

        const result = await openDisputeOnChain(
          executeTransaction,
          Number.parseInt(auctionId, 10),
          disputeRoot,
          getCurrentTimestamp()
        );

        const timelineEntry = {
          at: new Date().toISOString(),
          label: 'Anchored on-chain',
          note: result?.transactionId
            ? `Transaction submitted: ${result.transactionId}`
            : 'Dispute root submitted to the V2.21 contract.',
        };

        const updatedDispute = await updateDispute(createdDispute.id, {
          onChainDisputeRoot: disputeRoot,
          onChainTransactionId: result?.transactionId || null,
          timelineEntry,
        });

        persistedDispute = updatedDispute || {
          ...createdDispute,
          onChainDisputeRoot: disputeRoot,
          onChainTransactionId: result?.transactionId || null,
          timeline: [...(createdDispute.timeline || []), timelineEntry],
        };
        setOnChainDisputeRoot(disputeRoot);
        await loadAuctionData();
        onChainResultMessage = result?.transactionId
          ? `Local case saved and dispute root submitted on-chain.\n\nTransaction ID: ${result.transactionId}`
          : 'Local case saved and dispute root submitted on-chain.';
      } catch (error) {
        console.error('⚠️ Failed to open dispute on-chain:', error);
        onChainResultMessage = `Saved locally, but V2.21 dispute anchoring failed.\n\n${error.message || error}`;
      }
    } else if (!canOpenOnChainDispute) {
      onChainResultMessage = 'Saved locally. V2.21 dispute opening is only available once the auction reaches challenge or settled state.';
    } else if (!executeTransaction) {
      onChainResultMessage = 'Saved locally. Reconnect a wallet with transaction support to also open the dispute on-chain.';
    }

    setDisputes((current) => [persistedDispute, ...current]);
    setDisputeForm({
      title: '',
      description: '',
      evidence: '',
    });
    alert(`✅ ${onChainResultMessage}`);
  };

  const normalizedAddress = address?.toLowerCase() || '';
  const isSellerView = Boolean(
    auction?.seller &&
    normalizedAddress &&
    auction.seller.toLowerCase() === normalizedAddress
  );
  const isReserveFailureFlow = Boolean(
    auction &&
    auction.reserveMet === false &&
    (auction.status === 'challenge' || auction.status === 'cancelled')
  );
  const isPlatformOwnerView = Boolean(address && isPlatformOwner(address));
  const isWinnerView = Boolean(
    auction?.winner &&
    normalizedAddress &&
    auction.winner.toLowerCase() === normalizedAddress &&
    !isReserveFailureFlow
  );
  const isBidderParticipantView = Boolean(
    normalizedAddress &&
    !isSellerView &&
    !isPlatformOwnerView &&
    (submittedCommitmentData || pendingCommitmentData || storedCommitmentData)
  );
  const auctionCountdownEnded = Boolean(
    auction?.endTimestamp &&
    Math.floor(Date.now() / 1000) >= auction.endTimestamp
  );
  const revealTimeoutWindowEnded = Boolean(
    auction?.status === 'closed' &&
    auction?.revealDeadline &&
    Math.floor(Date.now() / 1000) >= auction.revealDeadline
  );
  const disputeWindowEnded = Boolean(
    auction?.status === 'challenge' &&
    auction?.disputeDeadline &&
    Math.floor(Date.now() / 1000) >= auction.disputeDeadline
  );
  const hasRevealedBidCandidate = Boolean(
    auction?.winningAmountMicro &&
    auction.winningAmountMicro !== '0'
  );
  const storedNonce = getNonce(auctionId, address);
  const canRevealBid = Boolean(
    auction?.status === 'closed' &&
    (!auction?.revealDeadline || Math.floor(Date.now() / 1000) <= auction.revealDeadline) &&
    submittedCommitmentData &&
    storedNonce
  );
  const canClaimRefund = Boolean(
    submittedCommitmentData &&
    (
      auction?.status === 'cancelled' ||
      (auction?.status === 'settled' && !isWinnerView)
    )
  );
  const receiptConfirmedAtLabel = formatUnixTimestamp(auction?.itemReceivedAt);
  const paymentClaimedAtLabel = formatUnixTimestamp(auction?.paymentClaimedAt);
  const settledAtLabel = formatUnixTimestamp(auction?.settledAt);
  const claimableAtLabel = formatUnixTimestamp(auction?.claimableAt);
  const revealWindowEndsAtLabel = formatUnixTimestamp(auction?.revealDeadline);
  const challengeWindowEndsAtLabel = formatUnixTimestamp(auction?.disputeDeadline);
  const platformFeeClaimedAtLabel = formatUnixTimestamp(auction?.platformFeeClaimedAt);
  const settlementOutcomeSummary = auction?.winner
    ? isWinnerView
      ? `You are the winning bidder${auction?.winningBid ? ` with a final bid of ${auction.winningBid} ${auction.token}.` : '.'}`
      : isBidderParticipantView
        ? 'Thank you for participating. Another bidder has been confirmed as the winner of this auction.'
        : 'A winning bidder has been confirmed for this auction.'
    : null;
  const resolvedSellerVerification = sellerVerification || auction?.sellerVerification || null;
  const resolvedProofBundle = auctionProofBundle || auction?.assetProof || null;
  const proofFiles = Array.isArray(resolvedProofBundle?.proofFiles)
    ? resolvedProofBundle.proofFiles
    : Array.isArray(auction?.proofFiles)
      ? auction.proofFiles
      : [];
  const itemPhotos = Array.isArray(auction?.itemPhotos) ? auction.itemPhotos : [];
  const sellerDisplayName = auction?.sellerDisplayName || resolvedSellerVerification?.sellerDisplayName || null;
  const sellerAddressPreview = formatAddressPreview(auction?.seller);
  const verificationStatus = resolvedSellerVerification?.status || 'pending';
  const verificationTone = verificationStatus === 'verified'
    ? 'text-green-300 border-green-500/30 bg-green-500/10'
    : verificationStatus === 'submitted'
      ? 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10'
      : 'text-amber-200 border-amber-500/30 bg-amber-500/10';
  const isWatched = watchlist.auctionIds.includes(String(auctionId));
  const onChainProfileValue = formatOnChainValue(onChainSellerProfile);
  const onChainProofValue = formatOnChainValue(onChainProofRoot);
  const onChainDisputeValue = formatOnChainValue(onChainDisputeRoot);
  const hasActiveOnChainDispute = Boolean(
    onChainDisputeValue &&
    onChainDisputeValue !== 'Not anchored' &&
    onChainDisputeValue !== '0field'
  );
  const canOpenOnChainDispute = auction?.status === 'challenge' || auction?.status === 'settled';
  const canClaimPlatformFeeAction = Boolean(
    isPlatformOwnerView &&
    auction?.status === 'settled' &&
    auction?.paymentClaimed &&
    !auction?.platformFeeClaimed
  );
  const canAutoSellerClaim = Boolean(
    isSellerView &&
    auction?.status === 'settled' &&
    !auction?.paymentClaimed &&
    (
      auction?.itemReceived ||
      auction?.claimableAtReached
    )
  );

  const runAutoLifecycleAction = async (actionKey, actionRunner) => {
    const now = Date.now();
    const lastRunAt = autoLifecycleRef.current.lastRunAt.get(actionKey) || 0;

    if (autoLifecycleRef.current.inFlight || now - lastRunAt < 15000) {
      return;
    }

    autoLifecycleRef.current.inFlight = true;
    autoLifecycleRef.current.lastRunAt.set(actionKey, now);

    try {
      await actionRunner();
    } finally {
      autoLifecycleRef.current.inFlight = false;
    }
  };

  useEffect(() => {
    if (
      !auction ||
      loading ||
      !connected ||
      !address ||
      !executeTransaction ||
      isSubmitting ||
      isClaimingFee ||
      isCancellingReserve
    ) {
      return undefined;
    }

    const lifecycleAction =
      isSellerView && auction.status === 'open' && auctionCountdownEnded && !isClosePending
        ? {
            key: `close_${auction.id}_${address}`,
            run: () => handleCloseAuction({ auto: true }),
          }
        : canRevealBid
          ? {
              key: `reveal_${auction.id}_${address}`,
              run: () => handleRevealBid({ auto: true }),
            }
          : isSellerView && auction.status === 'closed' && revealTimeoutWindowEnded
            ? {
                key: `settle_reveal_timeout_${auction.id}_${address}`,
                run: () => handleSettleAfterRevealTimeout({ auto: true }),
              }
            : isSellerView && auction.status === 'challenge' && disputeWindowEnded && !hasActiveOnChainDispute
                ? {
                    key: `finalize_${auction.id}_${address}`,
                    run: () => handleFinalizeWinner({ auto: true }),
                  }
                : canClaimRefund
                  ? {
                      key: `refund_${auction.id}_${address}`,
                      run: () => handleClaimRefund({ auto: true }),
                    }
                  : canAutoSellerClaim
                    ? {
                        key: `seller_claim_${auction.id}_${address}`,
                        run: () => handleClaimWinning({ auto: true }),
                      }
                    : canClaimPlatformFeeAction
                      ? {
                          key: `platform_fee_${auction.id}_${address}`,
                          run: () => handleClaimPlatformFee({ auto: true }),
                        }
                      : null;

    if (!lifecycleAction) {
      return undefined;
    }

    const timer = setTimeout(() => {
      void runAutoLifecycleAction(lifecycleAction.key, lifecycleAction.run);
    }, 800);

    return () => clearTimeout(timer);
  }, [
    address,
    auction,
    auctionCountdownEnded,
    canAutoSellerClaim,
    canClaimPlatformFeeAction,
    canClaimRefund,
    canRevealBid,
    connected,
    disputeWindowEnded,
    executeTransaction,
    hasActiveOnChainDispute,
    isCancellingReserve,
    isClaimingFee,
    isClosePending,
    isSellerView,
    isSubmitting,
    loading,
    revealTimeoutWindowEnded,
  ]);

  return (
    <div className="min-h-screen bg-void-900 text-white">
      {/* Header */}
      <PremiumNav />
      
      <div className="border-b border-white/5 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-8 py-6">
          <button
            onClick={() => navigate('/premium-auctions')}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-mono text-sm">Back to Auctions</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-8 py-12">
        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-void-800 rounded-xl border border-white/10">
              <div className="w-4 h-4 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
              <span className="font-mono text-white/60">Loading auction...</span>
            </div>
          </div>
        )}

        {/* Not Found State */}
        {!loading && !auction && (
          <div className="text-center py-12">
            <GlassCard className="p-12 max-w-md mx-auto">
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-display font-bold mb-2">Auction Not Found</h3>
              <p className="text-white/60 mb-6">
                The auction you're looking for doesn't exist or has been removed.
              </p>
              <PremiumButton onClick={() => navigate('/premium-auctions')}>
                Back to Auctions
              </PremiumButton>
            </GlassCard>
          </div>
        )}

        {/* Auction Content */}
        {!loading && auction && (
        <div className="grid grid-cols-12 gap-8">
          {/* Left Column - Main Info */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Hero Card */}
            <GlassCard className="p-8 relative overflow-hidden">
              {/* Animated Glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-gold-500/5 via-transparent to-cyan-500/5 animate-pulse" />
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <StatusBadge status={auction.status} />
                      <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
                        {auction.format}
                      </span>
                      <span className="text-xs font-mono text-white/40">
                        #{auction.id}
                      </span>
                      {verificationStatus === 'verified' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-mono uppercase tracking-wider text-green-300">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          Verified Seller
                        </span>
                      )}
                      {proofFiles.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-mono uppercase tracking-wider text-cyan-300">
                          <FileText className="h-3.5 w-3.5" />
                          {proofFiles.length} Proof Files
                        </span>
                      )}
                    </div>
                    <h1 className="text-5xl font-display font-bold mb-4 leading-tight">
                      {auction.title}
                    </h1>
                    {sellerDisplayName && (
                      <div className="mb-3 text-sm font-mono uppercase tracking-[0.18em] text-cyan-300">
                        Curated by {sellerDisplayName}
                      </div>
                    )}
                    <p className="text-white/60 leading-relaxed max-w-2xl">
                      {auction.description}
                    </p>
                  </div>
                  <div className="ml-6 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleToggleWatchlist}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors ${
                        isWatched
                          ? 'border-gold-500/40 bg-gold-500/10 text-gold-300'
                          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {isWatched ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                      {isWatched ? 'Watching' : 'Watch'}
                    </button>
                    <button
                      type="button"
                      onClick={handleShareAuction}
                      className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-mono uppercase tracking-wider text-cyan-300 transition-colors hover:bg-cyan-500/20"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share
                    </button>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-6 pt-6 border-t border-white/5">
                  <div>
                    <div className="text-xs font-mono text-white/40 uppercase tracking-wider mb-2">
                      Current Bid
                    </div>
                    <div className="text-3xl font-display font-bold text-gold-500">
                      {auction.currentBid}
                    </div>
                    <div className="text-sm font-mono text-cyan-400">{auction.token}</div>
                  </div>
                  <div>
                    <div className="text-xs font-mono text-white/40 uppercase tracking-wider mb-2">
                      Min Bid
                    </div>
                    <div className="text-3xl font-display font-bold">
                      {auction.minBid}
                    </div>
                    <div className="text-sm font-mono text-cyan-400">{auction.token}</div>
                  </div>
                  <div>
                    <div className="text-xs font-mono text-white/40 uppercase tracking-wider mb-2">
                      Ends In
                    </div>
                    <div className="text-3xl font-display font-bold flex items-center gap-2">
                      <Clock className="w-6 h-6 text-gold-500" />
                      {auction.endTime}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-mono text-white/40 uppercase tracking-wider mb-2">
                      Escrowed
                    </div>
                    <div className="text-3xl font-display font-bold">
                      {auction.totalEscrowed.toFixed(2)}
                    </div>
                    <div className="text-sm font-mono text-cyan-400">{auction.token}</div>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Auction Details */}
            <GlassCard className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-bold">Auction Details</h2>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/20 border border-green-500/40 rounded-full text-xs font-mono text-green-400 uppercase tracking-wider">
                  <CheckCircle className="w-3 h-3" />
                  {auction.contractVersion}
                </span>
              </div>
                <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">Seller Profile</span>
                  <div className="max-w-sm text-right">
                    <div className="text-xs font-mono uppercase tracking-[0.18em] text-cyan-300">
                      {sellerDisplayName || 'Masked seller ID'}
                    </div>
                    <div className="mt-1 font-mono text-cyan-400">{sellerAddressPreview}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-white/40">
                      Marketplace view masks the full seller wallet by default. Settlement still resolves against the on-chain seller account.
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">Auction Format</span>
                  <span className="font-mono">{auction.format}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">Asset Category</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getAssetTypeIcon(auction.assetType)}</span>
                    <span className="font-mono text-gold-500">{getAssetTypeName(auction.assetType)}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 border border-green-500/40 rounded text-xs font-mono text-green-400">
                      V2.21
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">On-Chain State</span>
                  <span className="font-mono text-cyan-400">{auction.contractState}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">Reveal Period</span>
                  <span className="font-mono text-cyan-400">{Math.max(1, Math.round((auction.revealPeriod || 0) / 3600))} hours</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">Dispute Period</span>
                  <span className="font-mono text-cyan-400">{Math.max(1, Math.round((auction.disputePeriod || 0) / 3600))} hours</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">Confirmation Timeout</span>
                  <span className="font-mono text-cyan-400">{auction.confirmationTimeoutDays} days</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">Reserve Price</span>
                  <span className="font-mono text-gold-500">{auction.reservePrice.toFixed(2)} {auction.token}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">Reserve Status</span>
                  <span className={`font-mono ${
                    auction.reserveMet === null
                      ? 'text-white/40'
                      : auction.reserveMet
                        ? 'text-green-400'
                        : 'text-amber-400'
                  }`}>
                    {auction.reserveMet === null ? 'PENDING' : auction.reserveMet ? 'MET' : 'NOT MET'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">Total Escrowed</span>
                  <span className="font-mono text-gold-500">{auction.totalEscrowed.toFixed(2)} {auction.token}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">Settled At</span>
                  <span className={`font-mono text-right ${auction.settledAt > 0 ? 'text-cyan-400' : 'text-white/40'}`}>
                    {settledAtLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">Seller Claimable At</span>
                  <span className={`font-mono text-right ${auction.claimableAt > 0 ? 'text-cyan-400' : 'text-white/40'}`}>
                    {claimableAtLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">Platform Fee</span>
                  <span className="font-mono text-gold-400">
                    {auction.platformFee !== null ? `${auction.platformFee} ${auction.token}` : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">Seller Net</span>
                  <span className="font-mono text-cyan-400">
                    {auction.sellerNetAmount !== null ? `${auction.sellerNetAmount} ${auction.token}` : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">Receipt Confirmed</span>
                  <span className={`font-mono ${auction.itemReceived ? 'text-green-400' : 'text-white/40'}`}>
                    {auction.itemReceived ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">Receipt Confirmed At</span>
                  <span className={`font-mono text-right ${auction.itemReceivedAt > 0 ? 'text-cyan-400' : 'text-white/40'}`}>
                    {receiptConfirmedAtLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-white/60 font-mono text-sm">Payment Claimed</span>
                  <span className={`font-mono ${auction.paymentClaimed ? 'text-green-400' : 'text-white/40'}`}>
                    {auction.paymentClaimed ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-white/60 font-mono text-sm">Payment Claimed At</span>
                  <span className={`font-mono text-right ${auction.paymentClaimedAt > 0 ? 'text-cyan-400' : 'text-white/40'}`}>
                    {paymentClaimedAtLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-t border-white/5">
                  <span className="text-white/60 font-mono text-sm">Platform Fee Claimed</span>
                  <span className={`font-mono ${auction.platformFeeClaimed ? 'text-green-400' : 'text-white/40'}`}>
                    {auction.platformFeeClaimed ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-white/60 font-mono text-sm">Platform Fee Claimed At</span>
                  <span className={`font-mono text-right ${auction.platformFeeClaimedAt > 0 ? 'text-cyan-400' : 'text-white/40'}`}>
                    {platformFeeClaimedAtLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-t border-white/5">
                  <span className="text-white/60 font-mono text-sm">Payment Token</span>
                  <span className="font-mono text-cyan-400">{auction.token}</span>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-8">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-display font-bold">Seller Verification & Asset Proof</h2>
                  <p className="mt-2 text-sm text-white/60">
                    Seller trust metadata, ownership evidence, and dispute-ready proof bundles tied into the live auction flow.
                  </p>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-wider ${verificationTone}`}>
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {verificationStatus}
                </span>
              </div>

              <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-mono uppercase tracking-[0.18em] text-white/40">Seller Trust Profile</div>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/55">Display name</span>
                        <span className="font-mono text-cyan-300">{sellerDisplayName || 'Not provided'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/55">Verification tier</span>
                        <span className="font-mono text-white">{resolvedSellerVerification?.tier || 'standard'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/55">Issuing authority</span>
                        <span className="font-mono text-white">{resolvedSellerVerification?.issuingAuthority || 'Pending review'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/55">Certificate ID</span>
                        <span className="font-mono text-white">{resolvedSellerVerification?.certificateId || 'Not attached'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                    <div className="text-xs font-mono uppercase tracking-[0.18em] text-cyan-300">Proof Summary</div>
                    <div className="mt-3 text-sm leading-relaxed text-white/70">
                      {resolvedProofBundle?.summary || 'No proof summary has been attached to this auction yet.'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-gold-500/20 bg-gold-500/10 p-4">
                    <div className="text-xs font-mono uppercase tracking-[0.18em] text-gold-300">Authenticity Guarantee</div>
                    <div className="mt-3 text-sm leading-relaxed text-white/70">
                      {resolvedProofBundle?.authenticityGuarantee || resolvedSellerVerification?.authenticityGuarantee || 'Seller has not added a guarantee note yet.'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                    <div className="text-xs font-mono uppercase tracking-[0.18em] text-cyan-300">V2.21 On-Chain Anchors</div>
                    <div className="mt-4 space-y-3 text-sm">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Seller profile</div>
                        <div className="mt-1 break-all rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-[11px] text-cyan-100">
                          {onChainProfileValue}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Auction proof root</div>
                        <div className="mt-1 break-all rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-[11px] text-cyan-100">
                          {onChainProofValue}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Dispute root</div>
                        <div className="mt-1 break-all rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-[11px] text-cyan-100">
                          {onChainDisputeValue}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-mono uppercase tracking-[0.18em] text-white/40">Proof Bundle</div>
                      <span className="text-xs font-mono text-cyan-300">{proofFiles.length} files</span>
                    </div>

                    {proofFiles.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/50">
                        No external proof files synced yet. Add them during auction creation to simulate deeds, certificates, appraisals, and chain-of-custody documents.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {proofFiles.map((proof, index) => (
                          <div
                            key={`${proof.name || 'proof'}-${index}`}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-mono text-sm text-white">{proof.name || `Proof ${index + 1}`}</div>
                              <div className="mt-1 text-xs text-white/45">
                                {proof.type || 'application/octet-stream'}
                              </div>
                            </div>
                            <FileText className="h-4 w-4 flex-shrink-0 text-cyan-300" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-mono uppercase tracking-[0.18em] text-white/40">Provenance Notes</div>
                    <div className="mt-3 text-sm leading-relaxed text-white/70">
                      {resolvedProofBundle?.provenanceNote || resolvedSellerVerification?.provenanceNote || 'No provenance note has been supplied yet.'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-mono uppercase tracking-[0.18em] text-white/40">Visual Proof</div>
                      <span className="text-xs font-mono text-cyan-300">{itemPhotos.length} images</span>
                    </div>

                    {itemPhotos.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/50">
                        This auction has no synced photo bundle yet.
                      </div>
                    ) : (
                      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                        {itemPhotos.slice(0, 6).map((photo, index) => (
                          <div key={`${photo.name || 'photo'}-${index}`} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                            {photo.data ? (
                              <img
                                src={photo.data}
                                alt={photo.name || `Auction proof ${index + 1}`}
                                className="h-28 w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-28 items-center justify-center">
                                <ImageIcon className="h-8 w-8 text-white/25" />
                              </div>
                            )}
                            <div className="truncate px-3 py-2 text-xs font-mono text-white/60">
                              {photo.name || `Photo ${index + 1}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-8">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-display font-bold">Reputation & Private Offers</h2>
                  <p className="mt-2 text-sm text-white/60">
                    App-layer reputation scoring, hybrid offers, and selective disclosure preferences.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs font-mono uppercase tracking-wider text-gold-300">
                  <UserRoundCheck className="h-3.5 w-3.5" />
                  {reputation?.trustScore ?? 0}/100 trust
                </span>
              </div>

              <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-mono uppercase tracking-[0.18em] text-white/40">Seller Reputation</div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs text-white/45">Success rate</div>
                        <div className="mt-2 text-2xl font-display font-bold text-white">
                          {reputation ? `${(reputation.seller.successRate * 100).toFixed(0)}%` : '0%'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs text-white/45">Avg. settlement</div>
                        <div className="mt-2 text-2xl font-display font-bold text-white">
                          {reputation?.seller.averageSettlementHours != null
                            ? `${reputation.seller.averageSettlementHours.toFixed(1)}h`
                            : 'N/A'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs text-white/45">Dispute ratio</div>
                        <div className="mt-2 text-2xl font-display font-bold text-white">
                          {reputation ? `${(reputation.seller.disputeRatio * 100).toFixed(0)}%` : '0%'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs text-white/45">Bidder wins</div>
                        <div className="mt-2 text-2xl font-display font-bold text-white">
                          {reputation?.bidder.wins ?? 0}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                    <div className="text-xs font-mono uppercase tracking-[0.18em] text-cyan-300">Selective Disclosure</div>
                    <div className="mt-3 text-sm leading-relaxed text-white/70">
                      Private offers can carry a disclosure mode and proof-of-funds status without exposing the full bidder profile.
                      This gives us a demo path toward Aleo-native buyer verification and privacy-preserving trust signals.
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="text-xs font-mono uppercase tracking-[0.18em] text-white/40">Make Offer / Buy Now Hybrid</div>
                      <span className="text-xs font-mono text-cyan-300">{offers.length} offers</span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <PremiumInput
                        label="Offer Amount"
                        value={offerForm.amount}
                        onChange={(event) => setOfferForm((current) => ({ ...current, amount: event.target.value }))}
                        placeholder="0.00"
                        suffix={auction.token}
                        type="number"
                      />

                      <div>
                        <label className="mb-3 block text-sm font-mono uppercase tracking-wider text-white/60">
                          Disclosure Mode
                        </label>
                        <select
                          value={offerForm.disclosureMode}
                          onChange={(event) => setOfferForm((current) => ({ ...current, disclosureMode: event.target.value }))}
                          className="w-full rounded-xl border border-white/10 bg-void-800 px-6 py-4 font-mono text-white focus:border-gold-500/50 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                        >
                          <option value="selective">Selective disclosure</option>
                          <option value="anonymous">Anonymous intent</option>
                          <option value="full">Full identity reveal</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                      <div>
                        <label className="mb-3 block text-sm font-mono uppercase tracking-wider text-white/60">
                          Proof of Funds
                        </label>
                        <select
                          value={offerForm.proofOfFundsStatus}
                          onChange={(event) => setOfferForm((current) => ({ ...current, proofOfFundsStatus: event.target.value }))}
                          className="w-full rounded-xl border border-white/10 bg-void-800 px-6 py-4 font-mono text-white focus:border-gold-500/50 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                        >
                          <option value="self-attested">Self-attested</option>
                          <option value="zk-proof-ready">ZK proof ready</option>
                          <option value="custodian-confirmed">Custodian confirmed</option>
                        </select>
                      </div>
                      <div className="flex items-end">
                        <PremiumButton onClick={handleSubmitOffer}>
                          Submit Offer
                        </PremiumButton>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="mb-3 block text-sm font-mono uppercase tracking-wider text-white/60">
                        Buyer Note
                      </label>
                      <textarea
                        value={offerForm.note}
                        onChange={(event) => setOfferForm((current) => ({ ...current, note: event.target.value }))}
                        placeholder="Settlement preference, timing, or private buy-now note."
                        rows={3}
                        className="w-full resize-none rounded-xl border border-white/10 bg-void-800 px-6 py-4 font-mono text-white placeholder:text-white/30 focus:border-gold-500/50 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                        style={{
                          backgroundColor: '#12141A',
                          color: '#ffffff',
                          backgroundImage: 'none',
                        }}
                      />
                    </div>

                    <div className="mt-4 space-y-3">
                      {offers.length === 0 && (
                        <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/50">
                          No private offers submitted yet.
                        </div>
                      )}
                      {offers.slice(0, 4).map((offer) => (
                        <div key={offer.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-mono text-sm text-white">
                              {offer.amount.toFixed(2)} {offer.currency}
                            </div>
                            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-cyan-300">
                              {offer.disclosureMode}
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-white/55">
                            Proof of funds: {offer.proofOfFundsStatus}
                          </div>
                          {offer.note && (
                            <div className="mt-2 text-sm text-white/70">{offer.note}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-8">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-display font-bold">Dispute Center</h2>
                  <p className="mt-2 text-sm text-white/60">
                    Evidence intake, case timeline, and resolution workspace for RWA settlement issues.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-mono uppercase tracking-wider text-red-200">
                  <Gavel className="h-3.5 w-3.5" />
                  {disputes.length} cases
                </span>
              </div>

              <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-4">
                  <PremiumInput
                    label="Dispute Title"
                    value={disputeForm.title}
                    onChange={(event) => setDisputeForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="e.g., Asset condition mismatch"
                  />

                  <div>
                    <label className="mb-3 block text-sm font-mono uppercase tracking-wider text-white/60">
                      Dispute Description
                    </label>
                    <textarea
                      value={disputeForm.description}
                      onChange={(event) => setDisputeForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Describe what happened, what evidence exists, and what resolution is requested."
                      rows={4}
                      className="w-full resize-none rounded-xl border border-white/10 bg-void-800 px-6 py-4 font-mono text-white placeholder:text-white/30 focus:border-gold-500/50 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                      style={{
                        backgroundColor: '#12141A',
                        color: '#ffffff',
                        backgroundImage: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-mono uppercase tracking-wider text-white/60">
                      Evidence References
                    </label>
                    <textarea
                      value={disputeForm.evidence}
                      onChange={(event) => setDisputeForm((current) => ({ ...current, evidence: event.target.value }))}
                      placeholder="One file or reference per line, e.g. shipping receipt, inspection photo, appraisal PDF."
                      rows={3}
                      className="w-full resize-none rounded-xl border border-white/10 bg-void-800 px-6 py-4 font-mono text-white placeholder:text-white/30 focus:border-gold-500/50 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                      style={{
                        backgroundColor: '#12141A',
                        color: '#ffffff',
                        backgroundImage: 'none',
                      }}
                    />
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                    <div className="text-xs font-mono uppercase tracking-[0.18em] text-white/40">On-Chain Dispute Status</div>
                    <div className="mt-3 break-all font-mono text-xs text-cyan-200">
                      {onChainDisputeValue}
                    </div>
                    <div className="mt-2 text-xs text-white/45">
                      {canOpenOnChainDispute
                        ? 'This auction can anchor a dispute directly to the V2.21 contract from this page.'
                        : 'Dispute anchoring becomes available after the auction reaches challenge or settled state.'}
                    </div>
                  </div>

                  <PremiumButton onClick={handleSubmitDispute}>
                    {canOpenOnChainDispute ? 'Open Case On-Chain' : 'Open Case'}
                  </PremiumButton>
                </div>

                <div className="space-y-3">
                  {disputes.length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/50">
                      No disputes opened for this auction yet.
                    </div>
                  )}

                  {disputes.slice(0, 5).map((dispute) => (
                    <div key={dispute.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">{dispute.title}</div>
                          <div className="mt-1 text-xs font-mono uppercase tracking-[0.18em] text-red-200">
                            {dispute.role} • {dispute.status}
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-white/45">{dispute.createdAt}</span>
                      </div>
                      <div className="mt-3 text-sm leading-relaxed text-white/70">{dispute.description}</div>
                      {Array.isArray(dispute.evidence) && dispute.evidence.length > 0 && (
                        <div className="mt-3 text-xs text-cyan-200">
                          Evidence: {dispute.evidence.join(' • ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>

            {/* On-Chain Bid Visibility */}
            <GlassCard className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-bold">On-Chain Visibility</h2>
                <span className="font-mono text-sm text-white/60">Contract-aligned</span>
              </div>
              
              {/* Privacy Notice */}
              <div className="mb-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-cyan-400 mt-0.5" />
                  <div>
                    <div className="font-mono text-sm text-cyan-400 mb-1">
                      Private Sealed-Bid Auction
                    </div>
                    <div className="text-xs text-white/60">
                      Contract V2.21 stores sealed commitments, escrow, reserve checks, dispute state, and fee accounting, but it does not expose a public per-bid history list in this UI.
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-void-800 rounded-xl border border-white/5">
                  <div className="text-xs font-mono text-white/40 mb-2">Visible From Contract</div>
                  <div className="space-y-2 text-sm text-white/60">
                    <div>• Auction state: {auction.contractState}</div>
                    <div>• Seller settlement account exists on-chain, even when the marketplace masks it in the main UI</div>
                    <div>• Escrowed total: {auction.totalEscrowed.toFixed(2)} {auction.token}</div>
                    <div>• Winner address and winning amount after settlement steps</div>
                    <div>• Receipt confirmation and payment claimed flags</div>
                  </div>
                </div>
                <div className="p-4 bg-void-800 rounded-xl border border-white/5">
                  <div className="text-xs font-mono text-white/40 mb-2">Hidden Until Reveal</div>
                  <div className="space-y-2 text-sm text-white/60">
                    <div>• Individual bid amounts during commit phase</div>
                    <div>• Private ALEO transfer details when private credits are used</div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Right Column - Floating Bid Panel */}
          <div className="col-span-12 lg:col-span-4">
            <div className="sticky top-24 space-y-6">
              {/* Place Bid Card - Only for non-sellers */}
              {auction.seller?.toLowerCase() !== address?.toLowerCase() && (
              <GlassCard className="p-6 relative overflow-hidden">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-gold-500/10 to-cyan-500/10 opacity-50" />
                
                <div className="relative z-10">
                  <h3 className="text-xl font-display font-bold mb-6">Place Your Bid</h3>
                  
                  {/* Check if user already has a bid */}
                  {submittedCommitmentData && !showBidForm ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                          <div className="font-mono text-sm text-green-400">Bid Placed Successfully</div>
                          {isPrivateCommitment(submittedCommitmentData) && (
                            <span className="px-2 py-0.5 bg-gold-500/20 border border-gold-500/40 rounded text-xs font-mono text-gold-400">
                              🔒 PRIVATE
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/60 mb-3">
                          Your bid has been committed to the blockchain.
                          {isPrivateCommitment(submittedCommitmentData) && (
                            <span className="text-gold-400"> Transfer amount is hidden on-chain (private transaction).</span>
                          )}
                        </div>
                        <div className="p-3 bg-void-800 rounded-lg">
                          <div className="text-xs text-white/40 mb-1">Your Bid Amount</div>
                          <div className="text-xl font-display font-bold text-gold-500">
                            {(submittedCommitmentData.amount / 1_000_000).toFixed(2)} <span className="text-sm text-cyan-400">{auction.token}</span>
                          </div>
                          {isPrivateCommitment(submittedCommitmentData) && (
                            <div className="mt-2 text-xs text-gold-400">
                              Private transfer enabled
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Bid is Final Notice */}
                      <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                        <div className="flex items-start gap-3">
                          <Shield className="w-5 h-5 text-cyan-400 mt-0.5" />
                          <div>
                            <div className="font-mono text-sm text-cyan-400 mb-2">
                              Bid is Final
                            </div>
                            <div className="text-xs text-white/60 leading-relaxed">
                              Sealed-bid auctions require final commitments. Your bid cannot be changed or canceled once placed.
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {auction.status !== 'open' && (
                        <div className="p-3 bg-gold-500/10 border border-gold-500/30 rounded-lg">
                          <div className="text-xs text-gold-400">
                            Auction closed. Reveal your bid in the actions below.
                          </div>
                        </div>
                      )}
                    </div>
                  ) : pendingCommitmentData && !showBidForm ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-5 h-5 text-cyan-400" />
                          <div className="font-mono text-sm text-cyan-400">Bid Awaiting Confirmation</div>
                          {isPrivateCommitment(pendingCommitmentData) && (
                            <span className="px-2 py-0.5 bg-gold-500/20 border border-gold-500/40 rounded text-xs font-mono text-gold-400">
                              🔒 PRIVATE
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/60 mb-3">
                          Wallet already returned a transaction ID, but the explorer has not confirmed this bid yet.
                        </div>
                        <div className="p-3 bg-void-800 rounded-lg space-y-2">
                          <div>
                            <div className="text-xs text-white/40 mb-1">Bid Amount</div>
                            <div className="text-xl font-display font-bold text-cyan-400">
                              {(pendingCommitmentData.amount / 1_000_000).toFixed(2)} <span className="text-sm text-gold-500">{auction.token}</span>
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-white/40 mb-1">Transaction ID</div>
                            <div className="text-xs font-mono text-white/70 break-all">
                              {pendingCommitmentData.transactionId}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-void-800 rounded-xl border border-white/5">
                        <div className="font-mono text-sm text-white mb-2">Sync Status</div>
                        <div className="text-xs text-white/60 leading-relaxed">
                          {bidSyncState === 'checking'
                            ? 'Checking explorer confirmation now.'
                            : 'We will keep this bid in pending state until the chain confirms it. If the transaction is rejected, this card will disappear so you can bid again.'}
                        </div>
                      </div>
                    </div>
                  ) : hasStaleLocalBid && !showBidForm ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-5 h-5 text-amber-400" />
                          <div className="font-mono text-sm text-amber-400">Previous Bid Was Not Submitted</div>
                        </div>
                        <div className="text-xs text-white/60">
                          We found a local bid draft without a confirmed transaction ID. It will not be treated as a successful bid, and you can safely submit again.
                        </div>
                      </div>
                      
                      {auction.status === 'open' ? (
                        <PremiumButton 
                          className="w-full"
                          onClick={() => setShowBidForm(true)}
                          disabled={!connected}
                        >
                          {connected ? 'Place Bid Again' : 'Connect Wallet'}
                        </PremiumButton>
                      ) : (
                        <div className="p-3 bg-void-800 rounded-lg border border-white/5 text-xs text-white/60">
                          Contract state is <span className="text-cyan-400">{auction.contractState}</span>, so this draft cannot be retried from the bid form.
                        </div>
                      )}
                    </div>
                  ) : !showBidForm ? (
                    auction.status !== 'open' ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-5 h-5 text-amber-400" />
                            <div className="font-mono text-sm text-amber-400">Bidding Unavailable</div>
                          </div>
                          <div className="text-xs text-white/60">
                            Contract state is currently <span className="text-cyan-400">{auction.contractState}</span>, so new bids cannot be submitted from this UI.
                          </div>
                        </div>
                      </div>
                    ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-void-800 rounded-xl border border-white/5">
                        <div className="text-xs font-mono text-white/40 uppercase tracking-wider mb-2">
                          Minimum Bid
                        </div>
                        <div className="text-2xl font-display font-bold text-gold-500">
                          {auction.minBid} <span className="text-sm text-cyan-400">{auction.token}</span>
                        </div>
                      </div>
                      
                      <PremiumButton 
                        className="w-full"
                        onClick={() => setShowBidForm(true)}
                        disabled={!connected}
                      >
                        {connected ? 'Place Bid' : 'Connect Wallet'}
                      </PremiumButton>
                    </div>
                    )
                  ) : (
                    <div className="space-y-4">
                      {/* V2.19: Privacy Toggle for ALEO */}
                      {auction.currencyType === 1 && (
                        <div className="p-4 bg-void-800/50 rounded-xl border border-white/10">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-gold-500" />
                              <span className="text-sm font-mono text-white">Use Private Credits</span>
                              <span className="px-2 py-0.5 bg-gold-500/20 border border-gold-500/40 rounded text-xs font-mono text-gold-400">
                                V2.21
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setUsePrivateBid(!usePrivateBid)}
                              className={`relative w-12 h-6 rounded-full transition-colors ${
                                usePrivateBid ? 'bg-gold-500' : 'bg-white/20'
                              }`}
                            >
                              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                usePrivateBid ? 'translate-x-6' : ''
                              }`} />
                            </button>
                          </div>
                          <div className="text-xs text-white/60">
                            {usePrivateBid 
                              ? 'Hidden on-chain. Paid from a private ALEO record.'
                              : 'Visible on-chain. Usually faster and simpler for testing.'
                            }
                          </div>
                          {usePrivateBid && (
                            <div className="mt-3 space-y-2">
                              <div className="p-2 bg-gold-500/10 border border-gold-500/30 rounded text-xs text-gold-400">
                                Requires a fresh private ALEO record. Fee: ~0.002 ALEO
                              </div>
                              <div className="p-3 bg-void-900/70 border border-white/10 rounded-lg space-y-2">
                                <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">
                                  Prepare Private Credits
                                </div>
                                <div className="text-xs text-white/60">
                                  1. Open Shield.
                                </div>
                                <div className="text-xs text-white/60">
                                  2. Tap `SHIELD` to convert public ALEO into a private record.
                                </div>
                                <div className="text-xs text-white/60">
                                  3. Come back and submit the private bid.
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <PremiumInput
                        label="Bid Amount"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder="0.00"
                        suffix={auction.token}
                        type="number"
                      />
                      
                      {/* Two-Step Process for Aleo (Public Bid) */}
                      {auction.currencyType === 1 && !usePrivateBid && (
                        <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl space-y-3">
                          <div className="flex items-start gap-3">
                            <Zap className="w-5 h-5 text-cyan-400 mt-0.5" />
                            <div>
                              <div className="font-mono text-sm text-cyan-400 mb-1">
                                Two-Step Process for Aleo Credits
                              </div>
                              <div className="text-xs text-white/60 mb-3">
                                Contract V2.21 public ALEO flow uses transfer first, then commitment
                              </div>
                            </div>
                          </div>
                          
                          {/* Step 1 */}
                          <div className={`p-3 rounded-lg border ${
                            aleoStep === 1 
                              ? 'bg-gold-500/10 border-gold-500/50' 
                              : 'bg-void-800 border-white/5'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-mono text-sm">Step 1: Transfer Credits</div>
                              {aleoStep > 1 && <CheckCircle className="w-4 h-4 text-green-400" />}
                            </div>
                            <div className="text-xs text-white/60 mb-2">
                              Transfer {bidAmount || '0.00'} ALEO to contract
                            </div>
                            {aleoStep === 1 && (
                              <PremiumButton 
                                size="sm" 
                                className="w-full"
                                onClick={handleStartTransfer}
                                disabled={isSubmitting || !bidAmount}
                              >
                                {isSubmitting ? 'Transferring...' : 'Transfer Credits'}
                              </PremiumButton>
                            )}
                          </div>
                          
                          {/* Step 2 */}
                          <div className={`p-3 rounded-lg border ${
                            aleoStep === 2 
                              ? 'bg-gold-500/10 border-gold-500/50' 
                              : 'bg-void-800 border-white/5 opacity-50'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-mono text-sm">Step 2: Submit Commitment</div>
                            </div>
                            <div className="text-xs text-white/60 mb-2">
                              After transfer completes, submit bid commitment
                            </div>
                            {aleoStep === 2 && (
                              <PremiumButton 
                                size="sm" 
                                className="w-full"
                                onClick={handleSubmitCommitment}
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? 'Submitting...' : 'Submit Commitment'}
                              </PremiumButton>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Single-Step for USDCx / USAD */}
                      {(auction.currencyType === 0 || auction.currencyType === 2) && (
                        <div className="p-4 bg-void-800 rounded-xl border border-white/5">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-white/60">Contract Flow</span>
                            <span className="font-mono text-green-400">Single Transaction</span>
                          </div>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-white/60">Asset</span>
                            <span className="font-mono text-cyan-400">{auction.token}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-white/5">
                            <span>Total</span>
                            <span className="font-mono text-gold-500">
                              {parseFloat(bidAmount || 0).toFixed(2)} {auction.token}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* V2.18: Single-Step Private Bid for ALEO */}
                      {auction.currencyType === 1 && usePrivateBid && (
                        <div className="p-4 bg-gold-500/10 border border-gold-500/30 rounded-xl">
                          <div className="flex items-start gap-3 mb-3">
                            <Shield className="w-5 h-5 text-gold-500 mt-0.5" />
                            <div>
                              <div className="font-mono text-sm text-gold-500 mb-1">
                                🔒 Bid with Private Credits
                              </div>
                              <div className="text-xs text-white/60">
                                Uses one private wallet record so your bid transfer stays hidden on-chain
                              </div>
                            </div>
                          </div>
                          <PremiumButton 
                            className="w-full"
                            onClick={handlePrivateBid}
                            disabled={!bidAmount || parseFloat(bidAmount) < parseFloat(auction.minBid) || isSubmitting}
                          >
                            {isSubmitting ? 'Submitting Private Credit Bid...' : '🔒 Commit with Private Credits'}
                          </PremiumButton>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <PremiumButton 
                          variant="ghost"
                          className="flex-1"
                          onClick={() => {
                            setShowBidForm(false);
                            setAleoStep(1);
                          }}
                        >
                          Cancel
                        </PremiumButton>
                        {(auction.currencyType === 0 || auction.currencyType === 2) && (
                          <PremiumButton 
                            className="flex-1"
                            onClick={handlePlaceBid}
                            disabled={!bidAmount || parseFloat(bidAmount) < parseFloat(auction.minBid) || isSubmitting}
                          >
                            {isSubmitting ? 'Submitting...' : 'Confirm Bid'}
                          </PremiumButton>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </GlassCard>
              )}

              {/* Seller Info Card - Only for sellers */}
              {isSellerView && (
              <GlassCard className="p-6 relative overflow-hidden">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-gold-500/10 to-cyan-500/10 opacity-50" />
                
                <div className="relative z-10">
                  <h3 className="text-xl font-display font-bold mb-6">Your Auction</h3>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-void-800 rounded-xl border border-white/5">
                      <div className="text-xs font-mono text-white/40 uppercase tracking-wider mb-2">
                        Minimum Bid
                      </div>
                      <div className="text-2xl font-display font-bold text-gold-500">
                        {auction.minBid} <span className="text-sm text-cyan-400">{auction.token}</span>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-gold-500/10 border border-gold-500/30 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-5 h-5 text-gold-400" />
                        <div className="font-mono text-sm text-gold-400">You are the Seller</div>
                      </div>
                      <div className="text-xs text-white/60">
                        You cannot bid on your own auction. Use the controls below to manage your auction.
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
              )}

              {/* Auction Actions */}
              <GlassCard className="p-6">
                <h3 className="text-xl font-display font-bold mb-4">Auction Actions</h3>
                
                {/* On-Chain Sync Summary */}
                {connected && (
                  <div className="mb-4 p-4 bg-void-800 rounded-lg border border-white/10 text-xs font-mono space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-white/40 uppercase tracking-wider">On-Chain Sync</div>
                      <button
                        onClick={() => loadAuctionData()}
                        className="px-2 py-1 rounded text-xs font-bold bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                      >
                        Refresh
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">State</span>
                      <span className="text-cyan-400">{auction.contractState}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Escrowed</span>
                      <span className="text-gold-400">{auction.totalEscrowed.toFixed(2)} {auction.token}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Receipt</span>
                      <span className={auction.itemReceived ? 'text-green-400' : 'text-white/40'}>
                        {auction.itemReceived ? 'CONFIRMED' : 'PENDING'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Payment</span>
                      <span className={auction.paymentClaimed ? 'text-green-400' : 'text-white/40'}>
                        {auction.paymentClaimed ? 'CLAIMED' : 'UNCLAIMED'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Reserve</span>
                      <span className={
                        auction.reserveMet === null
                          ? 'text-white/40'
                          : auction.reserveMet
                            ? 'text-green-400'
                            : 'text-amber-400'
                      }>
                        {auction.reserveMet === null ? 'PENDING' : auction.reserveMet ? 'MET' : 'NOT MET'}
                      </span>
                    </div>
                    {(auction.winningBid || auction.sellerNetAmount !== null) && (
                      <div className="mt-2 pt-2 border-t border-gold-500/30">
                        {settlementOutcomeSummary && (
                          <div className={`mb-2 rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${
                            isWinnerView
                              ? 'border-green-500/20 bg-green-500/10 text-green-200'
                              : isBidderParticipantView
                                ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-100'
                                : 'border-white/10 bg-black/20 text-white/65'
                          }`}>
                            {settlementOutcomeSummary}
                          </div>
                        )}
                        {auction.winningBid && (
                          <div className="text-cyan-400 mt-1">{isWinnerView ? 'Your Winning Bid' : 'Winning Bid'}: {auction.winningBid} {auction.token}</div>
                        )}
                        {auction.sellerNetAmount !== null && (
                          <div className="text-green-400 mt-1">Seller Net: {auction.sellerNetAmount} {auction.token}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="space-y-3">
                  {auctionCountdownEnded && auction.status === 'open' && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-amber-400" />
                        <div className="font-mono text-sm text-amber-400">Countdown Ended, Contract Still OPEN</div>
                      </div>
                      <div className="text-xs text-white/60">
                        Auction time has passed, but the contract will stay in <span className="text-cyan-400">OPEN</span> until the seller clicks <span className="text-gold-400">Close Auction</span>. Reveal, timeout settlement, and finalization buttons only appear after the on-chain state moves forward.
                      </div>
                    </div>
                  )}

                  {/* SELLER ACTIONS */}
                  {isSellerView && (
                    <div className="space-y-3">
                      <div className="p-3 bg-gold-500/10 border border-gold-500/30 rounded-lg">
                        <div className="text-xs font-mono text-gold-400 mb-1">👑 Seller Controls</div>
                        <div className="text-xs text-white/60">You created this auction</div>
                      </div>

                      {auction.winningBid && auction.platformFee !== null && auction.sellerNetAmount !== null && (
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                          <div className="text-sm text-white/60 mb-3">Payment Breakdown</div>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/70">Winning Bid</span>
                              <span className="text-white">{auction.winningBid} {auction.token}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/70">Platform Fee ({auction.platformFeePercent}%)</span>
                              <span className="text-gold-400">{auction.platformFee} {auction.token}</span>
                            </div>
                            <div className="h-px bg-white/10" />
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white font-medium">Seller Receives</span>
                              <span className="text-cyan-400 font-bold">{auction.sellerNetAmount} {auction.token}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {auction.paymentClaimed ? (
                        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-5 h-5 text-green-400" />
                            <div className="font-mono text-sm text-green-400">Settlement Status: Payment Claimed</div>
                          </div>
                          <div className="text-xs text-white/60 mb-3">
                            The contract has already released the winning payment to the seller wallet.
                          </div>
                          <div className="p-3 bg-void-800 rounded-lg space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40">Winning Bid</span>
                              <span className="text-cyan-400">{auction.winningBid ? `${auction.winningBid} ${auction.token}` : 'Not recorded'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40">Seller Net</span>
                              <span className="text-green-400">{auction.sellerNetAmount !== null ? `${auction.sellerNetAmount} ${auction.token}` : 'Not recorded'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40">Platform Fee Status</span>
                              <span className={auction.platformFeeClaimed ? 'text-green-400' : 'text-white/70'}>
                                {auction.platformFeeClaimed ? 'CLAIMED' : 'UNCLAIMED'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40">Receipt Confirmed At</span>
                              <span className="text-white/70 text-right">{receiptConfirmedAtLabel}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40">Payment Claimed At</span>
                              <span className="text-white/70 text-right">{paymentClaimedAtLabel}</span>
                            </div>
                          </div>
                        </div>
                      ) : auction.status === 'settled' && auction.itemReceived ? (
                        <div className="p-4 bg-gold-500/10 border border-gold-500/30 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-5 h-5 text-gold-400" />
                            <div className="font-mono text-sm text-gold-400">Settlement Status: Receipt Confirmed</div>
                          </div>
                          <div className="text-xs text-white/60 mb-3">
                            Winner confirmation is already recorded on-chain. You can proceed with the payment claim step.
                          </div>
                          <div className="p-3 bg-void-800 rounded-lg space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40">Winning Bid</span>
                              <span className="text-cyan-400">{auction.winningBid ? `${auction.winningBid} ${auction.token}` : 'Not recorded'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40">Receipt Confirmed At</span>
                              <span className="text-white/70 text-right">{receiptConfirmedAtLabel}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40">Seller Receives</span>
                              <span className="text-green-400">{auction.sellerNetAmount !== null ? `${auction.sellerNetAmount} ${auction.token}` : 'Pending'}</span>
                            </div>
                          </div>
                        </div>
                      ) : auction.status === 'settled' ? (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-5 h-5 text-amber-400" />
                            <div className="font-mono text-sm text-amber-400">Settlement Status: Waiting for Winner Confirmation</div>
                          </div>
                          <div className="text-xs text-white/60 mb-3">
                            The auction is settled, but receipt confirmation has not been recorded on-chain yet.
                          </div>
                          <div className="p-3 bg-void-800 rounded-lg space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40">Winning Bid</span>
                              <span className="text-cyan-400">{auction.winningBid ? `${auction.winningBid} ${auction.token}` : 'Not recorded'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40">Seller Net</span>
                              <span className="text-green-400">{auction.sellerNetAmount !== null ? `${auction.sellerNetAmount} ${auction.token}` : 'Not recorded'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40">Receipt Confirmed At</span>
                              <span className="text-white/70 text-right">{receiptConfirmedAtLabel}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40">Confirmation Window</span>
                              <span className="text-white/70 text-right">{auction.confirmationTimeoutDays} days</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40">Seller Claimable At</span>
                              <span className="text-white/70 text-right">{claimableAtLabel}</span>
                            </div>
                          </div>
                        </div>
                      ) : auction.status === 'challenge' && auction.reserveMet === false ? (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-5 h-5 text-amber-400" />
                            <div className="font-mono text-sm text-amber-400">Settlement Status: Reserve Not Met</div>
                          </div>
                          <div className="text-xs text-white/60 mb-3">
                            The highest revealed bid did not reach the reserve price. Cancel the auction so bidders can claim refunds.
                          </div>
                          <div className="p-3 bg-void-800 rounded-lg space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40">Highest Bid</span>
                              <span className="text-cyan-400">{auction.winningBid ? `${auction.winningBid} ${auction.token}` : 'Not recorded'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40">Reserve Price</span>
                              <span className="text-gold-400">{auction.reservePrice.toFixed(2)} {auction.token}</span>
                            </div>
                          </div>
                        </div>
                      ) : auction.status === 'challenge' ? (
                        <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-5 h-5 text-cyan-400" />
                            <div className="font-mono text-sm text-cyan-400">Settlement Status: Waiting for Finalization</div>
                          </div>
                          <div className="text-xs text-white/60">
                            {hasActiveOnChainDispute
                              ? 'An on-chain dispute is open. Resolve it before finalizing the winner.'
                              : disputeWindowEnded
                                ? 'The dispute window is over. The seller can now finalize the winner.'
                                : `A winner is selected, but finalization unlocks after ${challengeWindowEndsAtLabel}.`}
                          </div>
                        </div>
                      ) : auction.status === 'closed' ? (
                        <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-5 h-5 text-cyan-400" />
                            <div className="font-mono text-sm text-cyan-400">Settlement Status: Waiting for Reveal Timeout Settlement</div>
                          </div>
                          <div className="text-xs text-white/60">
                            {revealTimeoutWindowEnded
                              ? hasRevealedBidCandidate
                                ? 'The reveal window is over. Settle the auction to move into challenge if the reserve is met.'
                                : 'The reveal window is over. Settle the auction and the contract will cancel it if no valid reveal is recorded.'
                              : `Bids can still be revealed until ${revealWindowEndsAtLabel}. Settlement unlocks after that deadline.`}
                          </div>
                        </div>
                      ) : null}

                      {auction.status === 'open' && isClosePending && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-5 h-5 text-amber-400" />
                            <div className="font-mono text-sm text-amber-400">Close Auction Already Submitted</div>
                          </div>
                          <div className="text-xs text-white/60">
                            The seller close transaction is still pending confirmation or waiting for the on-chain mapping to update. This action is locked to prevent duplicate closes.
                          </div>
                        </div>
                      )}
                      
                      {/* Cancel Auction - Only when OPEN and no escrow */}
                      {auction.status === 'open' && !auction.hasEscrow && (
                        <PremiumButton 
                          className="w-full"
                          onClick={handleCancelAuction}
                          disabled={isSubmitting || isClosePending}
                          variant="ghost"
                        >
                          {isSubmitting ? 'Canceling...' : '🚫 Cancel Auction'}
                        </PremiumButton>
                      )}
                      
                      {/* Step 1: Close Auction */}
                      {auction.status === 'open' && (
                        <PremiumButton 
                          className="w-full"
                          onClick={handleCloseAuction}
                          disabled={isSubmitting || isClosePending || !auctionCountdownEnded}
                          variant="cyan"
                        >
                          {isSubmitting ? 'Closing...' : isClosePending ? 'Close Pending...' : auctionCountdownEnded ? '1️⃣ Close Auction Now' : '1️⃣ Close Auction After End'}
                        </PremiumButton>
                      )}
                      
                      {/* Step 2: Settle After Reveal Timeout */}
                      {auction.status === 'closed' && (
                        <PremiumButton 
                          className="w-full"
                          onClick={handleSettleAfterRevealTimeout}
                          disabled={isSubmitting || !revealTimeoutWindowEnded}
                        >
                          {isSubmitting
                            ? 'Processing...'
                            : !revealTimeoutWindowEnded
                              ? '2️⃣ Waiting for Reveal Window'
                              : hasRevealedBidCandidate
                                ? '2️⃣ Settle After Reveal Timeout'
                                : '2️⃣ Settle and Cancel if Needed'}
                        </PremiumButton>
                      )}
                      
                      {/* Step 3: Finalize Winner */}
                      {auction.status === 'challenge' && (
                        <PremiumButton 
                          className="w-full"
                          onClick={handleFinalizeWinner}
                          disabled={isSubmitting || !disputeWindowEnded || hasActiveOnChainDispute}
                          variant="secondary"
                        >
                          {isSubmitting
                            ? 'Finalizing...'
                            : hasActiveOnChainDispute
                              ? '3️⃣ Resolve Dispute First'
                              : !disputeWindowEnded
                                ? '3️⃣ Waiting for Dispute Window'
                                : '3️⃣ Finalize Winner'}
                        </PremiumButton>
                      )}
                      
                      {/* Step 4: Claim Winning Bid */}
                      {auction.status === 'settled' && !auction.paymentClaimed && (
                        <PremiumButton 
                          className="w-full"
                          onClick={handleClaimWinning}
                          disabled={isSubmitting}
                          variant="gold"
                        >
                          {isSubmitting ? 'Claiming...' : `4️⃣ 💰 Claim Seller Net${auction.sellerNetAmount ? ` (${auction.sellerNetAmount} ${auction.token})` : ''}`}
                        </PremiumButton>
                      )}

                      {/* Workflow guide */}
                      <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                        <div className="text-xs text-white/60">
                          <div className="font-mono text-cyan-400 mb-2">Seller Workflow (V2.21):</div>
                          <div className="space-y-1">
                            <div className={auction.status === 'open' && !auction.hasEscrow ? 'text-gold-400' : 'text-white/40'}>
                              🚫 Cancel auction while escrow is still 0
                            </div>
                            <div className={auction.status === 'open' ? 'text-gold-400' : 'text-white/40'}>
                              1️⃣ Close auction
                            </div>
                            <div className={auction.status === 'closed' ? 'text-gold-400' : 'text-white/40'}>
                              2️⃣ Settle after reveal timeout
                            </div>
                            <div className={auction.status === 'challenge' ? 'text-gold-400' : 'text-white/40'}>
                              3️⃣ Finalize winner after dispute window
                            </div>
                            <div className={auction.status === 'settled' && !auction.paymentClaimed ? 'text-gold-400' : 'text-white/40'}>
                              4️⃣ Claim seller net after receipt or timeout
                            </div>
                            <div className={isPlatformOwnerView && auction.paymentClaimed && !auction.platformFeeClaimed ? 'text-gold-400' : 'text-white/40'}>
                              5️⃣ Platform owner claims fee after seller payout
                            </div>
                            <div className={auction.paymentClaimed ? 'text-green-400' : 'text-white/40'}>
                              ✅ Complete
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-cyan-500/30">
                            <div className="text-cyan-400 mb-1">
                              {getAssetTypeIcon(auction.assetType)} {getAssetTypeName(auction.assetType)}
                            </div>
                            <div className="text-white/40">
                              Timeout: {getAssetTypeTimeout(auction.assetType)} days
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isPlatformOwnerView && (
                    <div className="space-y-3">
                      <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                        <div className="text-xs font-mono text-cyan-400 mb-1">🏛️ Platform Owner Controls</div>
                        <div className="text-xs text-white/60">Fee collection uses the platform owner wallet only</div>
                      </div>

                      <div className="p-4 bg-void-800 rounded-xl border border-white/5 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white/40">Auction Status</span>
                          <span className="text-cyan-400">{auction.contractState}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white/40">Seller Payment</span>
                          <span className={auction.paymentClaimed ? 'text-green-400' : 'text-white/60'}>
                            {auction.paymentClaimed ? 'CLAIMED' : 'PENDING'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white/40">Platform Fee</span>
                          <span className="text-gold-400">
                            {auction.platformFee !== null ? `${auction.platformFee} ${auction.token}` : 'Not recorded'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white/40">Fee Claim Status</span>
                          <span className={auction.platformFeeClaimed ? 'text-green-400' : 'text-white/60'}>
                            {auction.platformFeeClaimed ? 'CLAIMED' : 'UNCLAIMED'}
                          </span>
                        </div>
                      </div>

                      {canClaimPlatformFeeAction ? (
                        <PremiumButton
                          className="w-full"
                          onClick={handleClaimPlatformFee}
                          disabled={isClaimingFee || !auction.platformFeeMicro}
                          variant="gold"
                        >
                          {isClaimingFee ? 'Claiming Fee...' : `5️⃣ Claim Platform Fee${auction.platformFee ? ` (${auction.platformFee} ${auction.token})` : ''}`}
                        </PremiumButton>
                      ) : (
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-xs text-white/60">
                          {auction.platformFeeClaimed
                            ? 'Platform fee is already claimed on-chain.'
                            : auction.status !== 'settled'
                              ? 'Platform fee becomes available after the auction reaches SETTLED.'
                              : !auction.paymentClaimed
                                ? 'Platform fee unlocks after the seller payout is claimed on-chain.'
                                : 'Refresh the auction state if the fee should already be available.'}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* BIDDER ACTIONS */}
                  {auction.seller?.toLowerCase() !== address?.toLowerCase() && (
                    <div className="space-y-3">
                      <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <div className="text-xs font-mono text-purple-400 mb-1">🎯 Bidder Actions</div>
                        <div className="text-xs text-white/60">
                          {submittedCommitmentData
                            ? 'You have a confirmed bid on-chain'
                            : pendingCommitmentData
                              ? 'Your bid is awaiting chain confirmation'
                          : 'You have not bid yet'}
                        </div>
                      </div>

                      {auctionCountdownEnded && auction.status === 'open' && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-5 h-5 text-amber-400" />
                            <div className="font-mono text-sm text-amber-400">Waiting for Seller to Close Auction</div>
                          </div>
                          <div className="text-xs text-white/60">
                            The countdown already ended, but reveal is not available yet because the seller still needs to move the contract from <span className="text-cyan-400">OPEN</span> to <span className="text-cyan-400">CLOSED</span>.
                          </div>
                        </div>
                      )}

                      {auction.status === 'cancelled' && submittedCommitmentData && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-5 h-5 text-amber-400" />
                            <div className="font-mono text-sm text-amber-400">Auction Status: Cancelled</div>
                          </div>
                          <div className="text-xs text-white/60">
                            This auction was cancelled because the reserve price was not met. All bidders, including the highest bidder, can now claim refunds.
                          </div>
                        </div>
                      )}

                      {isWinnerView && (
                        auction.paymentClaimed ? (
                          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle className="w-5 h-5 text-green-400" />
                              <div className="font-mono text-sm text-green-400">Winner Status: Payment Released</div>
                            </div>
                            <div className="text-xs text-white/60 mb-3">
                              Receipt and payment claim are both recorded on-chain. This settlement is complete.
                            </div>
                            <div className="p-3 bg-void-800 rounded-lg space-y-2 text-xs">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-white/40">Winning Bid</span>
                                <span className="text-gold-400">{auction.winningBid ? `${auction.winningBid} ${auction.token}` : 'Not recorded'}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-white/40">Receipt Confirmed At</span>
                                <span className="text-white/70 text-right">{receiptConfirmedAtLabel}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-white/40">Payment Claimed At</span>
                                <span className="text-white/70 text-right">{paymentClaimedAtLabel}</span>
                              </div>
                            </div>
                          </div>
                        ) : auction.itemReceived ? (
                          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle className="w-5 h-5 text-green-400" />
                              <div className="font-mono text-sm text-green-400">Winner Status: Receipt Confirmed</div>
                            </div>
                            <div className="text-xs text-white/60 mb-3">
                              Your receipt confirmation is already on-chain. The seller can now proceed with the payment claim step.
                            </div>
                            <div className="p-3 bg-void-800 rounded-lg space-y-2 text-xs">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-white/40">Winning Bid</span>
                                <span className="text-gold-400">{auction.winningBid ? `${auction.winningBid} ${auction.token}` : 'Not recorded'}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-white/40">Receipt Confirmed At</span>
                                <span className="text-white/70 text-right">{receiptConfirmedAtLabel}</span>
                              </div>
                            </div>
                          </div>
                        ) : auction.status === 'settled' ? (
                          <div className="p-4 bg-gold-500/10 border border-gold-500/30 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertCircle className="w-5 h-5 text-gold-400" />
                              <div className="font-mono text-sm text-gold-400">Winner Status: Action Required</div>
                            </div>
                            <div className="text-xs text-white/60 mb-3">
                              You won this auction. Confirm receipt only after you have received and inspected the item or service.
                            </div>
                            <div className="p-3 bg-void-800 rounded-lg space-y-2 text-xs">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-white/40">Winning Bid</span>
                                <span className="text-gold-400">{auction.winningBid ? `${auction.winningBid} ${auction.token}` : 'Not recorded'}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-white/40">Asset Category</span>
                                <span className="text-cyan-400">{getAssetTypeIcon(auction.assetType)} {getAssetTypeName(auction.assetType)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-white/40">Confirmation Window</span>
                                <span className="text-white/70 text-right">{auction.confirmationTimeoutDays} days</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-white/40">Receipt Confirmed At</span>
                                <span className="text-white/70 text-right">{receiptConfirmedAtLabel}</span>
                              </div>
                            </div>
                          </div>
                        ) : auction.status === 'challenge' ? (
                          <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                              <Shield className="w-5 h-5 text-cyan-400" />
                              <div className="font-mono text-sm text-cyan-400">Winner Status: Awaiting Finalization</div>
                            </div>
                            <div className="text-xs text-white/60">
                              The winning bidder is selected, but the seller still needs to finalize the auction before receipt confirmation can happen.
                            </div>
                          </div>
                        ) : null
                      )}
                      
                      {/* Reveal Bid */}
                      {canRevealBid && (
                        <PremiumButton 
                          className="w-full"
                          onClick={handleRevealBid}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Revealing...' : '🔓 Reveal My Bid'}
                        </PremiumButton>
                      )}

                      {auction.status === 'closed' && !canRevealBid && (
                        <div className="p-4 bg-void-800 rounded-xl border border-white/10">
                          <div className="font-mono text-sm text-white mb-2">Reveal Availability</div>
                          <div className="text-xs text-white/60 leading-relaxed">
                            {!submittedCommitmentData
                              ? 'Reveal only appears for wallets that already have a confirmed bid on-chain.'
                              : !storedNonce
                                ? 'Reveal needs the saved nonce for this wallet. If the bid was placed from another browser or the local data was cleared, the reveal button will stay hidden.'
                                : 'Reveal will appear once the contract is ready.'}
                          </div>
                        </div>
                      )}
                      
                      {/* Confirm Receipt - NEW V2.18 (Winner only) */}
                      {isWinnerView &&
                       auction.status === 'settled' &&
                       !auction.itemReceived && (
                        <div className="space-y-3">
                          <PremiumButton 
                            className="w-full"
                            onClick={handleConfirmReceipt}
                            disabled={isSubmitting}
                            variant="gold"
                          >
                            {isSubmitting ? 'Confirming...' : '✅ Confirm Item Received'}
                          </PremiumButton>
                          
                          {/* Winner Instructions */}
                          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                            <div className="text-xs text-white/60">
                              <div className="font-mono text-cyan-400 mb-2">Before Confirming:</div>
                              <div className="space-y-1">
                                {getCategoryInstructions(auction.assetType, 'winner').map((instruction, i) => (
                                  <div key={i} className="flex items-start gap-2">
                                    <div className="w-1 h-1 bg-cyan-400 rounded-full mt-1.5 flex-shrink-0" />
                                    <span>{instruction}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Claim Refund - ONLY for losers */}
                      {canClaimRefund && (
                        <PremiumButton 
                          className="w-full"
                          onClick={handleClaimRefund}
                          disabled={isSubmitting}
                          variant="secondary"
                        >
                          {isSubmitting ? 'Claiming...' : '💰 Claim Refund'}
                        </PremiumButton>
                      )}
                      
                      {/* Bidder workflow guide */}
                      {submittedCommitmentData && (
                        <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                          <div className="text-xs text-white/60">
                            <div className="font-mono text-cyan-400 mb-2">Bidder Workflow (V2.21):</div>
                            <div className="space-y-1">
                              <div className={auction.status === 'open' ? 'text-gold-400' : 'text-white/40'}>
                                ⏳ Wait for auction to close
                              </div>
                              <div className={auction.status === 'closed' ? 'text-gold-400' : 'text-white/40'}>
                                🔓 Reveal your bid
                              </div>
                              <div className={auction.status === 'challenge' ? 'text-gold-400' : 'text-white/40'}>
                                ⏳ Wait while challenge state is active
                              </div>
                              <div className={auction.winner?.toLowerCase() === address?.toLowerCase() && auction.status === 'settled' && !auction.itemReceived ? 'text-gold-400' : 'text-white/40'}>
                                ✅ Confirm receipt if you won
                              </div>
                              <div className={canClaimRefund ? 'text-gold-400' : 'text-white/40'}>
                                💰 Claim refund if you lost or reserve was not met
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </GlassCard>

              {/* Info Cards */}
              <GlassCard className="p-6">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-cyan-400 mt-1" />
                  <div>
                    <div className="font-mono text-sm text-white mb-2">
                      Zero-Knowledge Privacy
                    </div>
                    <div className="text-xs text-white/60 leading-relaxed">
                      Your bid amount is encrypted and hidden from all participants until the reveal phase.
                    </div>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-gold-500 mt-1" />
                  <div>
                    <div className="font-mono text-sm text-white mb-2">
                      Fair Competition
                    </div>
                    <div className="text-xs text-white/60 leading-relaxed">
                      Sealed-bid format ensures no information leakage and prevents bid manipulation.
                    </div>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-cyan-400 mt-1" />
                  <div>
                    <div className="font-mono text-sm text-white mb-2">
                      Refund Policy
                    </div>
                    <div className="text-xs text-white/60 leading-relaxed">
                      All losing bidders can claim full refunds once the contract reaches the settled state. Winner pays their bid amount to seller.
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
