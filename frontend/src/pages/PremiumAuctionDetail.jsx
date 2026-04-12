import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  getCategoryInstructions,
  PROGRAM_ID,
  buildPrivateBidAleoSubmissionPreview,
  buildBidRecoveryBundle,
  restoreBidRecoveryBundle,
  serializeBidRecoveryBundle,
} from '@/services/aleoServiceV2';
import {
  createDispute,
  createOffer,
  getAuctionEngagement,
  getSharedAuctionReadModelEntry,
  getOpsApiDebugInfo,
  getAuctionProofBundle,
  getDisputes,
  getOffers,
  getReputation,
  getSellerVerification,
  getWatchlist,
  saveWatchlist,
  syncAuctionRole,
  syncSharedAuctionReadModelEntry,
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
  Info,
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
const ACTIVE_PROGRAM_ID = PROGRAM_ID;
const ACTIVE_CONTRACT_VERSION = inferVersionFromProgramId(ACTIVE_PROGRAM_ID) || 'v2.24';
const ACTIVE_CONTRACT_VERSION_LABEL = ACTIVE_CONTRACT_VERSION.toUpperCase();
const LOCAL_ONLY_AUCTION_GRACE_MS = 30 * 60 * 1000;

function getSharedReadModelSourceLabel(isLocalTarget = false) {
  return isLocalTarget ? 'Local Read Model API' : 'Shared Read Model';
}

const CONTRACT_STATUS_BY_STATE = {
  0: 'open',
  1: 'closed',
  2: 'challenge',
  3: 'settled',
  4: 'cancelled',
  5: 'disputed',
};
const CANCEL_REASON_INFO = {
  0: {
    key: 'none',
    label: 'Not specified',
    sellerSummary: 'Cancellation reason was not recorded on-chain.',
    bidderSummary: 'Cancellation reason was not recorded on-chain.',
  },
  1: {
    key: 'seller_cancel_prebid',
    label: 'Seller Cancelled Before Bids',
    sellerSummary: 'Seller cancelled the auction before any bid was committed.',
    bidderSummary: 'Seller cancelled the auction before any bid was committed.',
  },
  2: {
    key: 'no_bid',
    label: 'No Bid',
    sellerSummary: 'No bids were committed before the auction closed, so the contract cancelled it directly.',
    bidderSummary: 'No bids were committed before the auction closed, so the contract cancelled it directly.',
  },
  3: {
    key: 'no_reveal',
    label: 'No Reveal',
    sellerSummary: 'Bids were committed, but no bidder revealed before the deadline.',
    bidderSummary: 'Bids were committed, but no bidder revealed before the deadline. Refunds remain available.',
  },
  4: {
    key: 'reserve_not_met',
    label: 'Reserve Not Met',
    sellerSummary: 'At least one bid was revealed, but the highest valid reveal did not meet the reserve price.',
    bidderSummary: 'At least one bid was revealed, but the highest valid reveal did not meet the reserve price. Refunds remain available.',
  },
  5: {
    key: 'dispute_refund',
    label: 'Dispute Refund',
    sellerSummary: 'The platform resolved the dispute by cancelling the auction and refunding the winner path.',
    bidderSummary: 'The platform resolved the dispute by cancelling the auction and refunding the winner path.',
  },
};

function normalizeProgramId(programId) {
  return typeof programId === 'string' && programId.trim()
    ? programId.trim()
    : null;
}

function parseContractVersionParts(version) {
  if (typeof version !== 'string') {
    return null;
  }

  const versionMatch = version.trim().toLowerCase().match(/^v(\d+)\.(\d+)$/);
  if (!versionMatch) {
    return null;
  }

  return {
    major: Number(versionMatch[1]),
    minor: Number(versionMatch[2]),
  };
}

function isVersionAtLeast(version, minimumVersion) {
  const parsedVersion = parseContractVersionParts(version);
  const parsedMinimum = parseContractVersionParts(minimumVersion);

  if (!parsedVersion || !parsedMinimum) {
    return false;
  }

  if (parsedVersion.major !== parsedMinimum.major) {
    return parsedVersion.major > parsedMinimum.major;
  }

  return parsedVersion.minor >= parsedMinimum.minor;
}

function resolveCancelReasonInfo(reasonCode) {
  return CANCEL_REASON_INFO[reasonCode] || CANCEL_REASON_INFO[0];
}

function normalizeAuctionVersionLabel(version) {
  if (typeof version !== 'string' || !version.trim()) {
    return null;
  }

  const normalizedVersion = version.trim().toLowerCase();

  if (normalizedVersion === 'current') {
    return ACTIVE_CONTRACT_VERSION;
  }

  const explicitVersionMatch = normalizedVersion.match(/\bv2\.\d+\b/);
  if (explicitVersionMatch) {
    return explicitVersionMatch[0];
  }

  return normalizedVersion;
}

function inferProgramIdFromVersion(version) {
  const normalizedVersion = normalizeAuctionVersionLabel(version);
  const versionMatch = normalizedVersion?.match(/^v(\d+)\.(\d+)$/i);

  if (!versionMatch) {
    return null;
  }

  return `shadowbid_marketplace_v${versionMatch[1]}_${versionMatch[2]}.aleo`;
}

function inferVersionFromProgramId(programId) {
  if (typeof programId !== 'string') {
    return null;
  }

  const versionMatch = programId.match(/shadowbid_marketplace_v(\d+)_(\d+)\.aleo/i);
  if (versionMatch) {
    return `v${versionMatch[1]}.${versionMatch[2]}`;
  }

  return null;
}

function resolveAuctionProgramId(...sources) {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    if (typeof source === 'string') {
      const directProgramId = normalizeProgramId(source);
      if (directProgramId) {
        return directProgramId;
      }

      const versionProgramId = inferProgramIdFromVersion(source.toLowerCase());
      if (versionProgramId) {
        return versionProgramId;
      }

      continue;
    }

    if (typeof source !== 'object') {
      continue;
    }

    const directProgramId = normalizeProgramId(
      source.programId
        || source.contractProgramId
        || source.onChainProgramId
    );
    if (directProgramId) {
      return directProgramId;
    }

    const versionProgramId = inferProgramIdFromVersion(
      getExplicitAuctionVersion(source)
    );
    if (versionProgramId) {
      return versionProgramId;
    }
  }

  return ACTIVE_PROGRAM_ID;
}

function resolveAuctionVersion(programId, ...sources) {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    if (typeof source === 'string') {
      const normalizedVersion = normalizeAuctionVersionLabel(source);
      if (normalizedVersion) {
        return normalizedVersion;
      }
    }

    if (typeof source === 'object') {
      const normalizedVersion = getExplicitAuctionVersion(source);
      if (normalizedVersion) {
        return normalizedVersion;
      }
    }
  }

  return normalizeAuctionVersionLabel(inferVersionFromProgramId(programId))
    || ACTIVE_CONTRACT_VERSION;
}

function parseAuctionTimestampMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value > 1_000_000_000 ? value * 1000 : null;
  }

  if (typeof value === 'string') {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return parseAuctionTimestampMs(numericValue);
    }

    const parsedDate = Date.parse(value);
    return Number.isFinite(parsedDate) ? parsedDate : null;
  }

  return null;
}

function detectLegacyVersionInText(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return null;
  }

  const versionMatch = text.toLowerCase().match(/\bv2\.\d+\b/);
  if (!versionMatch) {
    return null;
  }

  return versionMatch[0] === ACTIVE_CONTRACT_VERSION ? null : versionMatch[0];
}

function getExplicitAuctionVersion(metadata) {
  return normalizeAuctionVersionLabel(metadata?.explicitVersion)
    || normalizeAuctionVersionLabel(metadata?.contractVersion)
    || detectLegacyVersionInText(metadata?.title)
    || detectLegacyVersionInText(metadata?.description)
    || normalizeAuctionVersionLabel(metadata?.version);
}

function isLegacyAuctionMetadata(metadata) {
  const explicitProgramId = normalizeProgramId(
    metadata?.programId
      || metadata?.contractProgramId
      || metadata?.onChainProgramId
  );

  if (
    explicitProgramId
    && explicitProgramId.includes('shadowbid_marketplace_v2_')
    && explicitProgramId !== ACTIVE_PROGRAM_ID
  ) {
    return true;
  }

  const explicitVersion = getExplicitAuctionVersion(metadata);
  return Boolean(
    explicitVersion
    && explicitVersion !== ACTIVE_CONTRACT_VERSION
    && /^v2\.\d+$/i.test(explicitVersion)
  );
}

function isRecentAuctionMetadata(metadata) {
  const newestTimestampMs = Math.max(
    parseAuctionTimestampMs(metadata?.createdAtMs) ?? 0,
    parseAuctionTimestampMs(metadata?.updatedAtMs) ?? 0,
    parseAuctionTimestampMs(metadata?.createdAt) ?? 0,
    parseAuctionTimestampMs(metadata?.updatedAt) ?? 0
  );

  return newestTimestampMs >= Date.now() - LOCAL_ONLY_AUCTION_GRACE_MS;
}

function shouldRetainLocalOnlyAuction(metadata, { isLocalTarget = false } = {}) {
  if (!metadata) {
    return false;
  }

  if (isLegacyAuctionMetadata(metadata)) {
    return false;
  }

  if (isLocalTarget && Boolean(metadata.isFixture || metadata.mockOnChain)) {
    return true;
  }

  if (isLocalTarget && Boolean(metadata.hasSharedReadModel || metadata.hasSharedSnapshot)) {
    return true;
  }

  return Boolean(metadata.hasLocalMetadata && isRecentAuctionMetadata(metadata));
}

function isSupportedAuctionMetadata(metadata, programId = null) {
  const resolvedProgramId = resolveAuctionProgramId(programId, metadata);
  const resolvedVersion = resolveAuctionVersion(resolvedProgramId, metadata);

  if (resolvedProgramId !== ACTIVE_PROGRAM_ID) {
    return false;
  }

  if (resolvedVersion !== ACTIVE_CONTRACT_VERSION) {
    return false;
  }

  return !isLegacyAuctionMetadata(metadata);
}

function buildAuctionDetailUrl(origin, auctionId, programId) {
  const searchParams = new URLSearchParams();
  const normalizedProgramId = normalizeProgramId(programId);

  if (normalizedProgramId) {
    searchParams.set('programId', normalizedProgramId);
  }

  const search = searchParams.toString();
  return `${origin}/premium-auction/${auctionId}${search ? `?${search}` : ''}`;
}

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

function getLegacyCloseAuctionLockStorageKey(auctionId, walletAddress) {
  if (!auctionId || !walletAddress) {
    return null;
  }

  return `close_auction_lock_${auctionId}_${walletAddress.toLowerCase()}`;
}

function getCloseAuctionLockStorageKey(auctionId, walletAddress, programId) {
  if (!auctionId || !walletAddress) {
    return null;
  }

  return `close_auction_lock_${resolveAuctionProgramId(programId)}_${auctionId}_${walletAddress.toLowerCase()}`;
}

function getRecoveryBundleAckStorageKey(auctionId, walletAddress) {
  if (!auctionId || !walletAddress) {
    return null;
  }

  return `recovery_bundle_ack_${auctionId}_${walletAddress.toLowerCase()}`;
}

function getRecoveryBundleAck(auctionId, walletAddress) {
  const storageKey = getRecoveryBundleAckStorageKey(auctionId, walletAddress);
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

function saveRecoveryBundleAck(auctionId, walletAddress, options = {}) {
  const storageKey = getRecoveryBundleAckStorageKey(auctionId, walletAddress);
  if (!storageKey) {
    return null;
  }

  const method = typeof options.method === 'string' && options.method.trim()
    ? options.method.trim()
    : 'saved';
  const reference = options.reference != null ? String(options.reference) : null;
  const nextValue = {
    method,
    reference,
    savedAt: Date.now(),
  };

  localStorage.setItem(storageKey, JSON.stringify(nextValue));
  return nextValue;
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

function readPendingCloseAuctionByKey(storageKey) {
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

function getPendingCloseAuction(auctionId, walletAddress, programId) {
  const storageKey = getCloseAuctionLockStorageKey(auctionId, walletAddress, programId);
  const nextValue = readPendingCloseAuctionByKey(storageKey);
  if (nextValue) {
    return nextValue;
  }

  const legacyValue = readPendingCloseAuctionByKey(getLegacyCloseAuctionLockStorageKey(auctionId, walletAddress));
  if (!legacyValue) {
    return null;
  }

  return {
    ...legacyValue,
    programId: legacyValue.programId || resolveAuctionProgramId(programId),
  };
}

function savePendingCloseAuction(auctionId, walletAddress, programId, data) {
  const storageKey = getCloseAuctionLockStorageKey(auctionId, walletAddress, programId);
  if (!storageKey || !data || typeof data !== 'object') {
    return;
  }

  localStorage.setItem(storageKey, JSON.stringify({
    ...data,
    programId: resolveAuctionProgramId(data.programId, programId),
  }));

  const legacyKey = getLegacyCloseAuctionLockStorageKey(auctionId, walletAddress);
  if (legacyKey && legacyKey !== storageKey) {
    localStorage.removeItem(legacyKey);
  }
}

function clearPendingCloseAuction(auctionId, walletAddress, programId = null) {
  const storageKeys = new Set([
    getLegacyCloseAuctionLockStorageKey(auctionId, walletAddress),
    getCloseAuctionLockStorageKey(auctionId, walletAddress, programId),
  ]);

  storageKeys.forEach((storageKey) => {
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  });
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

function inferAuctionCurrency(metadata) {
  if (typeof metadata?.currency === 'string' && metadata.currency.trim()) {
    return metadata.currency.trim();
  }

  if (typeof metadata?.token === 'string' && metadata.token.trim()) {
    return metadata.token.trim();
  }

  switch (Number(metadata?.currencyType)) {
    case 0:
      return 'USDCx';
    case 2:
      return 'USAD';
    case 1:
    default:
      return 'ALEO';
  }
}

function normalizeAuctionMetadata(metadata, source = 'shared') {
  if (!metadata) {
    return null;
  }

  return {
    ...metadata,
    id: metadata.id != null ? Number(metadata.id) : metadata.id,
    programId: resolveAuctionProgramId(metadata),
    version: resolveAuctionVersion(resolveAuctionProgramId(metadata), metadata),
    explicitVersion: getExplicitAuctionVersion(metadata),
    title: metadata.title || null,
    description: metadata.description || null,
    creator: metadata.creator || metadata.seller || null,
    currency: inferAuctionCurrency(metadata),
    hasLocalMetadata: source === 'local',
    hasSharedReadModel: source === 'shared',
    hasSharedSnapshot: source === 'shared',
    sharedReadModelSourceLabel: metadata.sharedReadModelSourceLabel || null,
    createdAtMs: parseAuctionTimestampMs(metadata.createdAt),
    updatedAtMs: parseAuctionTimestampMs(metadata.updatedAt),
    sellerVerification: metadata.sellerVerification || (
      metadata.verificationStatus
        ? { status: metadata.verificationStatus }
        : null
    ),
    proofFiles: Array.isArray(metadata.proofFiles) ? metadata.proofFiles : [],
    itemPhotos: Array.isArray(metadata.itemPhotos) ? metadata.itemPhotos : [],
  };
}

function mergeAuctionMetadata(localMetadata, sharedMetadata) {
  const normalizedLocal = normalizeAuctionMetadata(localMetadata, 'local');
  const normalizedShared = normalizeAuctionMetadata(sharedMetadata, 'shared');

  if (!normalizedLocal) {
    return normalizedShared;
  }

  if (!normalizedShared) {
    return normalizedLocal;
  }

  return {
    ...normalizedShared,
    ...normalizedLocal,
    programId: normalizedLocal.programId || normalizedShared.programId || ACTIVE_PROGRAM_ID,
    version: normalizedLocal.version
      || normalizedShared.version
      || normalizeAuctionVersionLabel(inferVersionFromProgramId(normalizedLocal.programId || normalizedShared.programId))
      || ACTIVE_CONTRACT_VERSION,
    title: normalizedLocal.title || normalizedShared.title || null,
    description: normalizedLocal.description || normalizedShared.description || null,
    creator: normalizedLocal.creator || normalizedShared.creator || normalizedShared.seller || null,
    currency: normalizedLocal.currency || normalizedShared.currency || 'ALEO',
    explicitVersion: normalizedLocal.explicitVersion || normalizedShared.explicitVersion || null,
    hasLocalMetadata: Boolean(normalizedLocal.hasLocalMetadata || normalizedShared.hasLocalMetadata),
    hasSharedReadModel: Boolean(
      normalizedLocal.hasSharedReadModel
      || normalizedLocal.hasSharedSnapshot
      || normalizedShared.hasSharedReadModel
      || normalizedShared.hasSharedSnapshot
    ),
    hasSharedSnapshot: Boolean(
      normalizedLocal.hasSharedReadModel
      || normalizedLocal.hasSharedSnapshot
      || normalizedShared.hasSharedReadModel
      || normalizedShared.hasSharedSnapshot
    ),
    sharedReadModelSourceLabel: normalizedLocal.sharedReadModelSourceLabel
      || normalizedShared.sharedReadModelSourceLabel
      || null,
    createdAtMs: normalizedLocal.createdAtMs || normalizedShared.createdAtMs || null,
    updatedAtMs: normalizedLocal.updatedAtMs || normalizedShared.updatedAtMs || null,
    sellerVerification: normalizedLocal.sellerVerification || normalizedShared.sellerVerification || null,
    proofFiles: normalizedLocal.proofFiles.length > 0 ? normalizedLocal.proofFiles : normalizedShared.proofFiles,
    itemPhotos: normalizedLocal.itemPhotos.length > 0 ? normalizedLocal.itemPhotos : normalizedShared.itemPhotos,
  };
}

function getLayerStatusStyles(tone = 'neutral') {
  switch (tone) {
    case 'success':
      return {
        surface: 'border-green-500/30 bg-green-500/10',
        accent: 'text-green-400',
        badge: 'border-green-500/20 bg-green-500/10 text-green-300',
        body: 'text-green-100/80',
      };
    case 'warning':
      return {
        surface: 'border-amber-500/30 bg-amber-500/10',
        accent: 'text-amber-400',
        badge: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
        body: 'text-amber-100/80',
      };
    case 'info':
      return {
        surface: 'border-cyan-500/30 bg-cyan-500/10',
        accent: 'text-cyan-400',
        badge: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200',
        body: 'text-cyan-100/80',
      };
    default:
      return {
        surface: 'border-white/10 bg-white/5',
        accent: 'text-white/60',
        badge: 'border-white/10 bg-white/5 text-white/70',
        body: 'text-white/60',
      };
  }
}

function getDiagnosticToneClass(tone = 'neutral') {
  switch (tone) {
    case 'success':
      return 'text-green-300';
    case 'warning':
      return 'text-amber-200';
    case 'info':
      return 'text-cyan-300';
    default:
      return 'text-white/70';
  }
}

function mergeSellerVerification(primary, fallback) {
  if (!primary) {
    return fallback || null;
  }

  if (!fallback) {
    return primary;
  }

  return {
    ...fallback,
    ...primary,
    sellerDisplayName: primary.sellerDisplayName || fallback.sellerDisplayName || null,
    status: primary.status || fallback.status || 'pending',
    tier: primary.tier || fallback.tier || 'standard',
    issuingAuthority: primary.issuingAuthority || fallback.issuingAuthority || null,
    certificateId: primary.certificateId || fallback.certificateId || null,
    provenanceNote: primary.provenanceNote || fallback.provenanceNote || null,
    authenticityGuarantee: primary.authenticityGuarantee || fallback.authenticityGuarantee || null,
  };
}

function mergeAuctionProofBundle(primary, fallback) {
  if (!primary) {
    return fallback || null;
  }

  if (!fallback) {
    return primary;
  }

  const primaryProofFiles = Array.isArray(primary.proofFiles) ? primary.proofFiles : [];
  const fallbackProofFiles = Array.isArray(fallback.proofFiles) ? fallback.proofFiles : [];
  const primaryItemPhotos = Array.isArray(primary.itemPhotos) ? primary.itemPhotos : [];
  const fallbackItemPhotos = Array.isArray(fallback.itemPhotos) ? fallback.itemPhotos : [];

  return {
    ...fallback,
    ...primary,
    summary: primary.summary || fallback.summary || null,
    provenanceNote: primary.provenanceNote || fallback.provenanceNote || null,
    authenticityGuarantee: primary.authenticityGuarantee || fallback.authenticityGuarantee || null,
    certificateId: primary.certificateId || fallback.certificateId || null,
    proofFiles: primaryProofFiles.length > 0 ? primaryProofFiles : fallbackProofFiles,
    itemPhotos: primaryItemPhotos.length > 0 ? primaryItemPhotos : fallbackItemPhotos,
    proofFilesCount: primaryProofFiles.length > 0
      ? primaryProofFiles.length
      : Number(fallback.proofFilesCount || fallbackProofFiles.length || 0),
    itemPhotosCount: primaryItemPhotos.length > 0
      ? primaryItemPhotos.length
      : Number(fallback.itemPhotosCount || fallbackItemPhotos.length || 0),
  };
}

function isMeaningfulAuctionTitle(value, auctionId) {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  return value.trim().toLowerCase() !== `auction #${auctionId}`.toLowerCase();
}

function isMeaningfulAuctionDescription(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  return value.trim().toLowerCase() !== 'no description available';
}

function getAttachmentCount(items, explicitCount) {
  if (Array.isArray(items) && items.length > 0) {
    return items.length;
  }

  const parsedCount = Number(explicitCount);
  return Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : 0;
}

function mergeLocalAuctionCacheEntry(existingAuction, incomingAuction) {
  const existingProofFiles = Array.isArray(existingAuction?.proofFiles) ? existingAuction.proofFiles : [];
  const existingItemPhotos = Array.isArray(existingAuction?.itemPhotos) ? existingAuction.itemPhotos : [];
  const incomingProofFiles = Array.isArray(incomingAuction?.proofFiles) ? incomingAuction.proofFiles : [];
  const incomingItemPhotos = Array.isArray(incomingAuction?.itemPhotos) ? incomingAuction.itemPhotos : [];
  const resolvedProgramId = resolveAuctionProgramId(incomingAuction, existingAuction);
  const resolvedVersion = resolveAuctionVersion(resolvedProgramId, incomingAuction, existingAuction);

  return {
    ...(existingAuction || {}),
    ...incomingAuction,
    id: Number(incomingAuction.id),
    programId: resolvedProgramId,
    version: resolvedVersion,
    explicitVersion: getExplicitAuctionVersion(incomingAuction)
      || getExplicitAuctionVersion(existingAuction)
      || resolvedVersion,
    title: isMeaningfulAuctionTitle(incomingAuction.title, incomingAuction.id)
      ? incomingAuction.title
      : existingAuction?.title || incomingAuction.title || null,
    description: isMeaningfulAuctionDescription(incomingAuction.description)
      ? incomingAuction.description
      : existingAuction?.description || incomingAuction.description || null,
    currency: incomingAuction.currency
      || incomingAuction.token
      || existingAuction?.currency
      || existingAuction?.token
      || 'ALEO',
    token: incomingAuction.token
      || incomingAuction.currency
      || existingAuction?.token
      || existingAuction?.currency
      || 'ALEO',
    creator: incomingAuction.creator || existingAuction?.creator || incomingAuction.seller || existingAuction?.seller || null,
    seller: incomingAuction.seller || existingAuction?.seller || incomingAuction.creator || existingAuction?.creator || null,
    sellerDisplayName: incomingAuction.sellerDisplayName || existingAuction?.sellerDisplayName || null,
    sellerVerification: mergeSellerVerification(incomingAuction.sellerVerification, existingAuction?.sellerVerification),
    assetProof: mergeAuctionProofBundle(incomingAuction.assetProof, existingAuction?.assetProof),
    proofFiles: incomingProofFiles.length > 0 ? incomingProofFiles : existingProofFiles,
    itemPhotos: incomingItemPhotos.length > 0 ? incomingItemPhotos : existingItemPhotos,
    proofFilesCount: getAttachmentCount(
      incomingProofFiles.length > 0 ? incomingProofFiles : existingProofFiles,
      incomingAuction.proofFilesCount ?? existingAuction?.proofFilesCount
    ),
    itemPhotosCount: getAttachmentCount(
      incomingItemPhotos.length > 0 ? incomingItemPhotos : existingItemPhotos,
      incomingAuction.itemPhotosCount ?? existingAuction?.itemPhotosCount
    ),
    hasSharedReadModel: Boolean(
      incomingAuction.hasSharedReadModel
      || incomingAuction.hasSharedSnapshot
      || existingAuction?.hasSharedReadModel
      || existingAuction?.hasSharedSnapshot
    ),
    hasSharedSnapshot: Boolean(
      incomingAuction.hasSharedReadModel
      || incomingAuction.hasSharedSnapshot
      || existingAuction?.hasSharedReadModel
      || existingAuction?.hasSharedSnapshot
    ),
    sharedReadModelSourceLabel: incomingAuction.sharedReadModelSourceLabel
      || existingAuction?.sharedReadModelSourceLabel
      || null,
    createdAt: existingAuction?.createdAt ?? incomingAuction.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
}

function persistAuctionLocally(auction, { sellerVerification = null, auctionProofBundle = null } = {}) {
  if (typeof window === 'undefined' || !auction?.id) {
    return;
  }

  try {
    const storedAuctions = JSON.parse(localStorage.getItem('myAuctions') || '[]');
    const nextStoredAuctions = Array.isArray(storedAuctions) ? [...storedAuctions] : [];
    const resolvedProgramId = resolveAuctionProgramId(auction);
    const mergedVerification = mergeSellerVerification(sellerVerification, auction.sellerVerification);
    const mergedProofBundle = mergeAuctionProofBundle(auctionProofBundle, auction.assetProof);
    const proofFiles = Array.isArray(mergedProofBundle?.proofFiles)
      ? mergedProofBundle.proofFiles
      : Array.isArray(auction.proofFiles)
        ? auction.proofFiles
        : [];
    const itemPhotos = Array.isArray(mergedProofBundle?.itemPhotos)
      ? mergedProofBundle.itemPhotos
      : Array.isArray(auction.itemPhotos)
        ? auction.itemPhotos
        : [];
    const cachedAuction = {
      ...auction,
      id: Number(auction.id),
      programId: resolvedProgramId,
      version: resolveAuctionVersion(resolvedProgramId, auction),
      explicitVersion: getExplicitAuctionVersion(auction) || resolveAuctionVersion(resolvedProgramId, auction),
      currency: auction.currency || auction.token || inferAuctionCurrency(auction),
      token: auction.token || auction.currency || inferAuctionCurrency(auction),
      creator: auction.creator || auction.seller || null,
      seller: auction.seller || auction.creator || null,
      sellerDisplayName: mergedVerification?.sellerDisplayName || auction.sellerDisplayName || null,
      sellerVerification: mergedVerification,
      assetProof: mergedProofBundle,
      proofFiles,
      itemPhotos,
      proofFilesCount: getAttachmentCount(proofFiles, mergedProofBundle?.proofFilesCount ?? auction.proofFilesCount),
      itemPhotosCount: getAttachmentCount(itemPhotos, mergedProofBundle?.itemPhotosCount ?? auction.itemPhotosCount),
      hasSharedReadModel: Boolean(auction.hasSharedReadModel || auction.hasSharedSnapshot),
      hasSharedSnapshot: Boolean(auction.hasSharedReadModel || auction.hasSharedSnapshot),
      sharedReadModelSourceLabel: auction.sharedReadModelSourceLabel || null,
      lastSeenOnChainAt: auction.hasOnChainData ? new Date().toISOString() : auction.lastSeenOnChainAt || null,
      createdAt: auction.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    const existingIndex = nextStoredAuctions.findIndex((storedAuction) => (
      Number(storedAuction?.id) === Number(cachedAuction.id)
        && resolveAuctionProgramId(storedAuction) === resolvedProgramId
    ));
    const mergedAuction = mergeLocalAuctionCacheEntry(
      existingIndex >= 0 ? nextStoredAuctions[existingIndex] : null,
      cachedAuction
    );

    if (existingIndex >= 0) {
      nextStoredAuctions[existingIndex] = mergedAuction;
    } else {
      nextStoredAuctions.unshift(mergedAuction);
    }

    localStorage.setItem('myAuctions', JSON.stringify(nextStoredAuctions));
  } catch (error) {
    console.error('[PremiumAuctionDetail] Failed to cache auction locally:', error);
  }
}

function normalizeReputation(reputation) {
  if (!reputation || typeof reputation !== 'object') {
    return null;
  }

  const seller = reputation.seller && typeof reputation.seller === 'object'
    ? reputation.seller
    : {};
  const bidder = reputation.bidder && typeof reputation.bidder === 'object'
    ? reputation.bidder
    : {};

  return {
    ...reputation,
    seller: {
      auctionsCreated: 0,
      auctionsSettled: 0,
      auctionsCancelled: 0,
      successRate: 0,
      averageSettlementHours: null,
      disputeRatio: 0,
      ...seller,
    },
    bidder: {
      participations: 0,
      wins: 0,
      winRate: 0,
      offersSubmitted: 0,
      disputesOpened: 0,
      ...bidder,
    },
  };
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

function getNormalizedRevealStatus(commitmentData) {
  if (!commitmentData || typeof commitmentData !== 'object') {
    return null;
  }

  if (commitmentData.revealed === true) {
    return 'confirmed';
  }

  const revealedAt = Number(commitmentData.revealedAt || commitmentData.revealConfirmedAt || 0);
  if (Number.isFinite(revealedAt) && revealedAt > 0) {
    return 'confirmed';
  }

  const rawStatus = typeof commitmentData.revealStatus === 'string'
    ? commitmentData.revealStatus.trim().toLowerCase()
    : '';

  if (!rawStatus) {
    return null;
  }

  if (rawStatus === 'confirmed' || rawStatus === 'revealed') {
    return 'confirmed';
  }

  if (rawStatus.includes('reject') || rawStatus.includes('fail') || rawStatus.includes('error')) {
    return 'rejected';
  }

  if (rawStatus.includes('pending') || rawStatus.includes('submitted') || rawStatus.includes('checking')) {
    return 'pending-confirmation';
  }

  return rawStatus;
}

function hasConfirmedReveal(commitmentData) {
  return getNormalizedRevealStatus(commitmentData) === 'confirmed';
}

function hasPendingReveal(commitmentData) {
  return getNormalizedRevealStatus(commitmentData) === 'pending-confirmation';
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

function buildBidPathLabel(auction, usePrivateBid) {
  if (auction?.currencyType !== 1) {
    return auction?.token === 'USAD' ? 'commit_bid_usad' : 'commit_bid';
  }

  return usePrivateBid ? 'commit_bid_aleo_private' : 'commit_bid_aleo';
}

function buildBidPreflightMessage({
  auction,
  bidderAddress,
  usePrivateBid,
}) {
  return [
    `Bid path: ${buildBidPathLabel(auction, usePrivateBid)}`,
    `Bid wallet: ${bidderAddress || 'Unavailable'}`,
    `Seller wallet: ${auction?.seller || 'Unavailable'}`,
    `Auction currency: ${auction?.token || 'Unknown'}`,
  ].join('\n');
}

function formatAuctionFieldId(value) {
  if (typeof value === 'string' && value.trim()) {
    return value.endsWith('field') ? value : `${value}field`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}field`;
  }

  return '<auction_id>';
}

function buildPrivateBidDraftPreview({
  programId,
  auctionId,
  amountCredits,
}) {
  const resolvedProgramId = normalizeProgramId(programId) || ACTIVE_PROGRAM_ID;
  const amountLabel = Number.isFinite(amountCredits)
    ? `${amountCredits}u64`
    : '<enter bid amount>';

  return [
    'Submitting private bid transaction.',
    `- Program: ${resolvedProgramId}`,
    '- Function: commit_bid_aleo_private',
    '- Inputs:',
    `1. auction_id: ${formatAuctionFieldId(auctionId)}`,
    '2. nonce: generated-at-submit',
    '3. private_credits: Object',
    `4. amount_credits: ${amountLabel}`,
  ].join('\n');
}

function isWalletUserCancellation(error) {
  const message = String(error?.message || error || '').toLowerCase();

  return [
    'operation was cancelled by the user',
    'operation was canceled by the user',
    'cancelled by the user',
    'canceled by the user',
    'user rejected',
    'rejected by user',
    'transaction was rejected by wallet',
  ].some((pattern) => message.includes(pattern));
}

function normalizeWalletAddress(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export default function PremiumAuctionDetail() {
  const { auctionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    connected,
    address,
    executeTransaction,
    transactionStatus,
    requestRecords,
    decrypt,
  } = useWallet();
  const requestedProgramId = normalizeProgramId(searchParams.get('programId'));
  const [bidAmount, setBidAmount] = useState('');
  const [showBidForm, setShowBidForm] = useState(false);
  const [aleoStep, setAleoStep] = useState(1);
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosePending, setIsClosePending] = useState(false);
  const [currentUnixTime, setCurrentUnixTime] = useState(() => Math.floor(Date.now() / 1000));
  const [isClaimingFee, setIsClaimingFee] = useState(false);
  const [isCancellingReserve, _setIsCancellingReserve] = useState(false);
  const [bidSyncState, setBidSyncState] = useState('idle');
  const [usePrivateBid, setUsePrivateBid] = useState(false); // NEW: Private bid toggle
  const [sellerVerification, setSellerVerification] = useState(null);
  const [auctionProofBundle, setAuctionProofBundle] = useState(null);
  const [onChainSellerProfile, setOnChainSellerProfile] = useState(null);
  const [onChainProofRoot, setOnChainProofRoot] = useState(null);
  const [onChainDisputeRoot, setOnChainDisputeRoot] = useState(null);
  const [auctionEngagement, setAuctionEngagement] = useState(null);
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
  const recoveryBundleReminderRef = useRef(new Set());
  const recoveryBundleInputRef = useRef(null);
  const [, setCommitmentSyncVersion] = useState(0);
  const [, setRecoveryBundleAckVersion] = useState(0);
  const activeAuctionProgramId = resolveAuctionProgramId(requestedProgramId, auction);
  const auctionTxOptions = {
    programId: activeAuctionProgramId,
  };
  const storedCommitmentData = address ? getCommitmentData(auctionId, address) : null;
  const submittedCommitmentData = hasSubmittedTransaction(storedCommitmentData) ? storedCommitmentData : null;
  const pendingCommitmentData = hasPendingTransaction(storedCommitmentData) ? storedCommitmentData : null;
  const activeCommitmentData = submittedCommitmentData || pendingCommitmentData;
  const hasSubmittedCommitment = Boolean(submittedCommitmentData);
  const hasRevealedBid = hasConfirmedReveal(storedCommitmentData);
  const isRevealPending = hasPendingReveal(storedCommitmentData);
  const submittedRevealTransactionId = submittedCommitmentData?.revealTransactionId || null;
  const submittedRevealWalletTransactionId = submittedCommitmentData?.revealWalletTransactionId || null;
  const submittedRevealExplorerTransactionId = submittedCommitmentData?.revealExplorerTransactionId || null;
  const submittedRevealConfirmedAt = submittedCommitmentData?.revealedAt || null;
  const hasStaleLocalBid = Boolean(
    storedCommitmentData &&
    !submittedCommitmentData &&
    !pendingCommitmentData
  );

  const refreshStoredCommitment = () => {
    setCommitmentSyncVersion((value) => value + 1);
  };

  const refreshRecoveryBundleAck = () => {
    setRecoveryBundleAckVersion((value) => value + 1);
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentUnixTime(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

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
  }, [auctionId, requestedProgramId]);

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
    if (
      !address ||
      !hasSubmittedCommitment ||
      !isRevealPending ||
      !submittedRevealTransactionId
    ) {
      return undefined;
    }

    let isCancelled = false;

    const syncPendingReveal = async () => {
      try {
        const txResult = await resolveTransactionStatus(
          submittedRevealWalletTransactionId || submittedRevealTransactionId,
          submittedRevealExplorerTransactionId || submittedRevealTransactionId
        );

        if (isCancelled) {
          return;
        }

        if (txResult.status === 'confirmed') {
          updateCommitmentData(auctionId, address, {
            revealed: true,
            revealStatus: 'confirmed',
            revealedAt: submittedRevealConfirmedAt || Date.now(),
            revealConfirmedAt: Date.now(),
            revealTransactionId: txResult.explorerTransactionId || submittedRevealTransactionId,
            revealExplorerTransactionId: txResult.explorerTransactionId || submittedRevealExplorerTransactionId || null,
            revealLastCheckedAt: Date.now(),
            revealError: null,
          });
          refreshStoredCommitment();
          await loadAuctionData();
          return;
        }

        if (txResult.status === 'rejected') {
          updateCommitmentData(auctionId, address, {
            revealed: false,
            revealStatus: 'rejected',
            revealLastCheckedAt: Date.now(),
            revealError: txResult.error || 'Reveal transaction was rejected after submission.',
          });
          refreshStoredCommitment();
          return;
        }

        updateCommitmentData(auctionId, address, {
          revealStatus: 'pending-confirmation',
          revealLastCheckedAt: Date.now(),
          revealExplorerTransactionId: txResult.explorerTransactionId || submittedRevealExplorerTransactionId || null,
          revealError: null,
        });
        refreshStoredCommitment();
      } catch {
        if (isCancelled) {
          return;
        }

        updateCommitmentData(auctionId, address, {
          revealStatus: 'pending-confirmation',
          revealLastCheckedAt: Date.now(),
        });
        refreshStoredCommitment();
      }
    };

    syncPendingReveal();

    return () => {
      isCancelled = true;
    };
  }, [
    address,
    auctionId,
    hasSubmittedCommitment,
    isRevealPending,
    submittedCommitmentData?.revealStatus,
    submittedRevealConfirmedAt,
    submittedRevealExplorerTransactionId,
    submittedRevealTransactionId,
    submittedRevealWalletTransactionId,
  ]);

  const activeRecoveryBundleReference = activeCommitmentData?.transactionId
    || activeCommitmentData?.walletTransactionId
    || activeCommitmentData?.timestamp
    || null;
  const recoveryBundleAck = address ? getRecoveryBundleAck(auctionId, address) : null;
  const hasAcknowledgedRecoveryBundle = Boolean(
    recoveryBundleAck &&
    activeRecoveryBundleReference &&
    recoveryBundleAck.reference === String(activeRecoveryBundleReference)
  );
  const shouldRecommendRecoveryBundleSave = Boolean(
    address &&
    (submittedCommitmentData || pendingCommitmentData) &&
    !hasAcknowledgedRecoveryBundle
  );
  const shouldRequireRecoveryBundleSave = Boolean(
    address &&
    submittedCommitmentData &&
    !hasAcknowledgedRecoveryBundle
  );
  const recoveryBundleMethodLabel = recoveryBundleAck?.method === 'download'
    ? 'Downloaded'
    : recoveryBundleAck?.method === 'copy'
      ? 'Copied'
      : recoveryBundleAck?.method === 'import'
        ? 'Imported'
        : 'Saved';
  const recoveryBundleSavedAtLabel = Number.isFinite(Number(recoveryBundleAck?.savedAt))
    ? new Date(Number(recoveryBundleAck.savedAt)).toLocaleString()
    : null;

  useEffect(() => {
    if (!shouldRequireRecoveryBundleSave || !activeRecoveryBundleReference) {
      return undefined;
    }

    const reminderKey = `${address || 'wallet'}:${auctionId}:${activeRecoveryBundleReference}`;
    if (recoveryBundleReminderRef.current.has(reminderKey)) {
      return undefined;
    }

    recoveryBundleReminderRef.current.add(reminderKey);
    showLifecycleNotice(
      '⚠️ Save the recovery bundle before leaving this page. It will be needed later for reveal or refund if this browser-local data is lost.',
      { auto: true, tone: 'info' }
    );

    return undefined;
  }, [activeRecoveryBundleReference, address, auctionId, shouldRequireRecoveryBundleSave]);

  useEffect(() => {
    if (!shouldRequireRecoveryBundleSave) {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [shouldRequireRecoveryBundleSave]);

  useEffect(() => {
    setIsClosePending(Boolean(getPendingCloseAuction(auctionId, address, activeAuctionProgramId)));
  }, [activeAuctionProgramId, address, auctionId]);

  const loadAuctionData = async () => {
    setLoading(true);
    try {
      const opsDebugInfo = getOpsApiDebugInfo();
      const storedAuctions = JSON.parse(localStorage.getItem('myAuctions') || '[]');
      const myAuctions = storedAuctions.filter((savedAuction) => !isLegacyAuctionMetadata(savedAuction));
      if (myAuctions.length !== storedAuctions.length) {
        localStorage.setItem('myAuctions', JSON.stringify(myAuctions));
      }
      const localMetadata = myAuctions.find((auction) => (
        Number(auction?.id) === parseInt(auctionId, 10)
          && (!requestedProgramId || resolveAuctionProgramId(auction) === requestedProgramId)
      )) || null;
      const sharedReadModelEntry = await getSharedAuctionReadModelEntry(auctionId);
      const sharedMetadata = requestedProgramId && sharedReadModelEntry && resolveAuctionProgramId(sharedReadModelEntry) !== requestedProgramId
        ? null
        : sharedReadModelEntry;
      const auctionMetadata = mergeAuctionMetadata(localMetadata, sharedMetadata);
      const auctionProgramId = resolveAuctionProgramId(requestedProgramId, auctionMetadata);
      const auctionVersion = resolveAuctionVersion(auctionProgramId, auctionMetadata);

      if (!isSupportedAuctionMetadata(auctionMetadata, requestedProgramId || auctionProgramId)) {
        setAuction(null);
        setLoading(false);
        return;
      }

      // Get on-chain data - try multiple times if needed
      let onChainData = null;
      let retries = 0;
      const maxRetries = 3;
      
      while (!onChainData && retries < maxRetries) {
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        onChainData = await getAuctionInfo(auctionId, auctionProgramId);
        retries++;
      }
      
      if (!auctionMetadata && !onChainData) {
        setAuction(null);
        setLoading(false);
        return;
      }

      if (!onChainData && !shouldRetainLocalOnlyAuction(auctionMetadata, { isLocalTarget: opsDebugInfo.isLocalTarget })) {
        setAuction(null);
        setLoading(false);
        return;
      }
      
      const minBidMicro = parseAleoInteger(onChainData?.min_bid_amount);
      const minBid = minBidMicro !== null
        ? minBidMicro / 1_000_000
        : parseFloat(auctionMetadata?.minBid || 0);

      const fallbackCurrencyType =
        inferAuctionCurrency(auctionMetadata) === 'ALEO'
          ? 1
          : inferAuctionCurrency(auctionMetadata) === 'USAD'
            ? 2
            : 0;

      const currencyType = parseAleoInteger(onChainData?.currency_type) ?? fallbackCurrencyType;
      
      const currency = currencyType === 1 ? 'ALEO' : currencyType === 0 ? 'USDCx' : 'USAD';
      
      const assetType = parseAleoInteger(onChainData?.asset_type) ?? Number(auctionMetadata?.assetType || 0);
      const state = parseAleoInteger(onChainData?.state) ?? 0;
      const status = CONTRACT_STATUS_BY_STATE[state] || 'open';
      const supportsDirectNoBidCancel = isVersionAtLeast(auctionVersion, 'v2.23');
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
      const commitmentCount = parseAleoInteger(onChainData?.commitment_count) ?? (totalEscrowedMicro > 0 ? 1 : 0);
      const revealedCount = parseAleoInteger(onChainData?.revealed_count) ?? 0;
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
        ?? parseAleoInteger(auctionMetadata?.endTimestamp)
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
          const winnerData = await getHighestBidder(auctionId, auctionProgramId);
          if (winnerData && typeof winnerData === 'string' && winnerData.startsWith('aleo1')) {
            winnerAddress = winnerData;
          }
        } catch (error) {
          console.error('Failed to fetch winner mapping:', error);
        }
      }
      
      if (!winningBid) {
        try {
          const bidData = await getHighestBid(auctionId, auctionProgramId);
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
      const cancelReasonCodeFromChain = parseAleoInteger(onChainData?.cancel_reason) ?? 0;
      const cancelReasonCode = cancelReasonCodeFromChain > 0
        ? cancelReasonCodeFromChain
        : status === 'cancelled'
          ? totalEscrowedMicro === 0
            ? supportsDirectNoBidCancel
              ? 2
              : 1
            : revealedCount === 0
              ? 3
              : reserveMet === false
                ? 4
                : 0
          : 0;
      const cancelReasonInfo = resolveCancelReasonInfo(cancelReasonCode);
      const reservePrice = reservePriceMicro / 1_000_000;
      const platformFee = microToDisplayAmount(platformFeeMicro);
      const sellerNetAmount = microToDisplayAmount(sellerNetAmountMicro);
      
      const hours = Math.floor(timeRemaining / 3600);
      const minutes = Math.floor((timeRemaining % 3600) / 60);
      const timeString = timeRemaining > 0 ? `${hours}h ${minutes}m` : 'Ended';
      
      const auctionData = {
        id: auctionId,
        programId: auctionProgramId,
        version: auctionVersion,
        hasOnChainData: Boolean(onChainData),
        hasLocalMetadata: Boolean(auctionMetadata?.hasLocalMetadata),
        hasSharedReadModel: Boolean(auctionMetadata?.hasSharedReadModel || auctionMetadata?.hasSharedSnapshot),
        hasSharedSnapshot: Boolean(auctionMetadata?.hasSharedReadModel || auctionMetadata?.hasSharedSnapshot),
        sharedReadModelSourceLabel: getSharedReadModelSourceLabel(opsDebugInfo.isLocalTarget),
        opsApiSourceLabel: getSharedReadModelSourceLabel(opsDebugInfo.isLocalTarget),
        title: auctionMetadata?.title || `Auction #${auctionId}`,
        description: auctionMetadata?.description || 'No description available',
        format: 'Sealed-Bid',
        currentBid: winningBid ? winningBid.toString() : '0',
        minBid: minBid.toString(),
        endTime: timeString,
        endTimestamp: endTime,
        status,
        contractState: status.toUpperCase(),
        creator: auctionMetadata?.creator || onChainData?.seller || 'Unknown',
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
        hasCommittedBids: commitmentCount > 0 || totalEscrowedMicro > 0,
        commitmentCount,
        revealedCount,
        settledAt,
        claimableAt,
        claimableAtReached: claimableAt > 0 ? now >= claimableAt : false,
        reservePrice,
        reservePriceMicro,
        reserveMet,
        cancelReasonCode,
        cancelReason: cancelReasonInfo.key,
        cancelReasonLabel: cancelReasonInfo.label,
        supportsDirectNoBidCancel,
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
        contractVersion: auctionVersion.toUpperCase(),
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

      setSellerVerification(mergeSellerVerification(verification, auction.sellerVerification));
      setAuctionProofBundle(mergeAuctionProofBundle(proofBundle, auction.assetProof));
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
      setAuctionEngagement(null);
      return undefined;
    }

    let isCancelled = false;

    const loadOpsMarketData = async () => {
      const [reputationResponse, offersResponse, disputesResponse, watchlistResponse, engagementResponse] = await Promise.all([
        getReputation(auction.seller),
        getOffers({ auctionId }),
        getDisputes({ auctionId }),
        address ? getWatchlist(address) : Promise.resolve({
          auctionIds: [],
          sellers: [],
          categories: [],
        }),
        address ? getAuctionEngagement(address, auctionId) : Promise.resolve(null),
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

      setReputation(normalizeReputation(reputationResponse || fallbackReputation));
      setOffers(Array.isArray(offersResponse) && offersResponse.length > 0 ? offersResponse : (auction.offers || []));
      setDisputes(Array.isArray(disputesResponse) && disputesResponse.length > 0 ? disputesResponse : (auction.disputes || []));
      setWatchlist(watchlistResponse);
      setAuctionEngagement(engagementResponse);
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

    persistAuctionLocally(auction, {
      sellerVerification: mergeSellerVerification(sellerVerification, auction.sellerVerification),
      auctionProofBundle: mergeAuctionProofBundle(auctionProofBundle, auction.assetProof),
    });

    const syncSnapshot = async () => {
      const opsDebugInfo = getOpsApiDebugInfo();
      if (auction.isFixture && !opsDebugInfo.isLocalTarget) {
        return;
      }

      await syncSharedAuctionReadModelEntry({
        ...auction,
        creator: auction.creator || auction.seller,
        sellerDisplayName: mergeSellerVerification(sellerVerification, auction.sellerVerification)?.sellerDisplayName
          || auction.sellerDisplayName
          || null,
        sellerVerification: mergeSellerVerification(sellerVerification, auction.sellerVerification),
        assetProof: (() => {
          const resolvedProofBundle = mergeAuctionProofBundle(auctionProofBundle, auction.assetProof);
          if (!resolvedProofBundle) {
            return null;
          }

          return {
            summary: resolvedProofBundle.summary,
            provenanceNote: resolvedProofBundle.provenanceNote,
            authenticityGuarantee: resolvedProofBundle.authenticityGuarantee,
            certificateId: resolvedProofBundle.certificateId,
          };
        })(),
        itemPhotosCount: Array.isArray(mergeAuctionProofBundle(auctionProofBundle, auction.assetProof)?.itemPhotos)
          ? mergeAuctionProofBundle(auctionProofBundle, auction.assetProof).itemPhotos.length
          : Array.isArray(auction.itemPhotos)
            ? auction.itemPhotos.length
            : 0,
        proofFilesCount: Array.isArray(mergeAuctionProofBundle(auctionProofBundle, auction.assetProof)?.proofFiles)
          ? mergeAuctionProofBundle(auctionProofBundle, auction.assetProof).proofFiles.length
          : Array.isArray(auction.proofFiles)
            ? auction.proofFiles.length
            : 0,
        verificationStatus: mergeSellerVerification(sellerVerification, auction.sellerVerification)?.status
          || auction.sellerVerification?.status
          || 'pending',
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
    auctionProofBundle,
    pendingCommitmentData,
    sellerVerification,
    storedCommitmentData,
    submittedCommitmentData,
  ]);

  const waitForAuctionState = async (expectedStatus, options = {}) => {
    const attempts = options.attempts ?? 10;
    const intervalMs = options.intervalMs ?? 2000;
    const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    const programId = resolveAuctionProgramId(options.programId, activeAuctionProgramId);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const onChainData = await getAuctionInfo(auctionId, programId);
      const state = parseAleoInteger(onChainData?.state);
      const currentStatus = state === null ? null : CONTRACT_STATUS_BY_STATE[state];

      if (currentStatus && expectedStatuses.includes(currentStatus)) {
        return currentStatus;
      }

      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    return null;
  };

  const extractLifecycleTransactionIds = (result) => {
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

    return {
      transactionId,
      explorerTransactionId,
    };
  };

  const waitForLifecycleTransaction = async (result, successMessage, pendingMessage, options = {}) => {
    const { auto = false } = options;
    const {
      transactionId,
      explorerTransactionId,
    } = extractLifecycleTransactionIds(result);

    if (!transactionId) {
      showLifecycleNotice(successMessage, { auto, tone: 'success' });
      await loadAuctionData();
      return {
        status: 'confirmed',
        transactionId: null,
        explorerTransactionId: null,
      };
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
    return {
      ...confirmation,
      transactionId,
    };
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
    const expected = expectedStatuses || expectedStatus;
    const {
      transactionId,
      explorerTransactionId,
    } = extractLifecycleTransactionIds(result);
    let confirmation = {
      status: transactionId ? 'pending' : 'unknown',
      explorerTransactionId,
    };

    if (transactionId) {
      confirmation = await resolveTransactionStatus(transactionId, explorerTransactionId);

      if (confirmation.status === 'rejected') {
        throw new Error(confirmation.error || 'Transaction was rejected by the network after submission');
      }
    }

    if (!expected) {
      if (confirmation.status === 'confirmed' || !transactionId) {
        showLifecycleNotice(
          typeof successMessage === 'function' ? successMessage(null) : successMessage,
          { auto, tone: 'success' }
        );
      } else if (pendingMessage) {
        showLifecycleNotice(`${pendingMessage}\n\nTransaction ID: ${transactionId}`, { auto, tone: 'info' });
      }
      return true;
    }

    const stateReached = await waitForAuctionState(expected, {
      attempts: 8,
      intervalMs: 2000,
      programId: activeAuctionProgramId,
    });

    await loadAuctionData();

    if (stateReached) {
      showLifecycleNotice(
        typeof successMessage === 'function' ? successMessage(stateReached) : successMessage,
        { auto, tone: 'success' }
      );
      return stateReached;
    }

    if (confirmation?.status === 'confirmed' && statePendingMessage) {
      showLifecycleNotice(statePendingMessage, { auto, tone: 'info' });
      return false;
    }

    if (pendingMessage) {
      showLifecycleNotice(
        transactionId
          ? `${pendingMessage}\n\nTransaction ID: ${transactionId}`
          : pendingMessage,
        { auto, tone: 'info' }
      );
    }

    return false;
  };

  useEffect(() => {
    if (!address) {
      setIsClosePending(false);
      return undefined;
    }

    if (auction?.status && auction.status !== 'open') {
      clearPendingCloseAuction(auctionId, address, activeAuctionProgramId);
      setIsClosePending(false);
      return undefined;
    }

    const pendingCloseAuction = getPendingCloseAuction(auctionId, address, activeAuctionProgramId);
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
          clearPendingCloseAuction(auctionId, address, pendingCloseAuction.programId || activeAuctionProgramId);
          setIsClosePending(false);
          return;
        }

        const expectedStatuses = Array.isArray(pendingCloseAuction.expectedStatuses) && pendingCloseAuction.expectedStatuses.length > 0
          ? pendingCloseAuction.expectedStatuses
          : ['closed'];
        const stateReached = await waitForAuctionState(expectedStatuses, {
          attempts: 4,
          intervalMs: 2000,
          programId: pendingCloseAuction.programId || activeAuctionProgramId,
        });

        if (isCancelled) {
          return;
        }

        if (stateReached) {
          clearPendingCloseAuction(auctionId, address, pendingCloseAuction.programId || activeAuctionProgramId);
          setIsClosePending(false);
          await loadAuctionData();
          return;
        }

        savePendingCloseAuction(auctionId, address, pendingCloseAuction.programId || activeAuctionProgramId, {
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
  }, [activeAuctionProgramId, address, auction?.status, auctionId]);

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
      commitmentMode: commitment ? 'legacy-client-derived' : 'contract-derived',
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

  const buildCurrentRecoveryBundle = () => {
    const bundle = buildBidRecoveryBundle(auctionId, address, {
      programId: activeAuctionProgramId,
      commitmentData: activeCommitmentData || storedCommitmentData,
      currency: auction?.token?.toLowerCase(),
    });

    if (!bundle) {
      throw new Error('Recovery bundle is not available yet. Make sure this wallet has a saved nonce and confirmed bid data first.');
    }

    return bundle;
  };

  const handleDownloadRecoveryBundle = async () => {
    try {
      const bundle = buildCurrentRecoveryBundle();
      const serializedBundle = serializeBidRecoveryBundle(bundle);
      const blob = new Blob([serializedBundle], { type: 'application/json' });
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `shadowbid-recovery-auction-${auctionId}-${address?.slice(0, 10) || 'wallet'}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
      saveRecoveryBundleAck(auctionId, address, {
        method: 'download',
        reference: bundle.transactionId || bundle.walletTransactionId || bundle.timestamp || null,
      });
      refreshRecoveryBundleAck();

      showLifecycleNotice(
        '✅ Recovery bundle downloaded.\n\nKeep this file safe. It can restore the browser-local nonce and bid data needed for reveal and refund on another browser or device.',
        { tone: 'success' }
      );
    } catch (error) {
      showLifecycleNotice(`❌ Failed to download recovery bundle:\n\n${error.message || error}`, { tone: 'error' });
    }
  };

  const handleCopyRecoveryBundle = async () => {
    try {
      const bundle = buildCurrentRecoveryBundle();
      const serializedBundle = serializeBidRecoveryBundle(bundle);
      await navigator.clipboard.writeText(serializedBundle);
      saveRecoveryBundleAck(auctionId, address, {
        method: 'copy',
        reference: bundle.transactionId || bundle.walletTransactionId || bundle.timestamp || null,
      });
      refreshRecoveryBundleAck();

      showLifecycleNotice(
        '✅ Recovery bundle copied.\n\nStore it somewhere safe so this wallet can recover browser-local reveal and refund access later.',
        { tone: 'success' }
      );
    } catch (error) {
      showLifecycleNotice(`❌ Failed to copy recovery bundle:\n\n${error.message || error}`, { tone: 'error' });
    }
  };

  const handleOpenRecoveryBundlePicker = () => {
    recoveryBundleInputRef.current?.click();
  };

  const handleImportRecoveryBundle = async (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile) {
      return;
    }

    try {
      const bundleText = await selectedFile.text();
      restoreBidRecoveryBundle(bundleText, {
        auctionId,
        walletAddress: address,
      });
      const parsedBundle = JSON.parse(bundleText);
      saveRecoveryBundleAck(auctionId, address, {
        method: 'import',
        reference: parsedBundle?.transactionId || parsedBundle?.walletTransactionId || parsedBundle?.timestamp || null,
      });
      refreshRecoveryBundleAck();
      refreshStoredCommitment();
      await loadAuctionData();
      showLifecycleNotice(
        '✅ Recovery bundle restored.\n\nThis wallet can now use the restored browser-local nonce and bid data for reveal and refund on this auction.',
        { tone: 'success' }
      );
    } catch (error) {
      showLifecycleNotice(`❌ Failed to import recovery bundle:\n\n${error.message || error}`, { tone: 'error' });
    }
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
        'This is a commit-reveal auction - once you place a bid, it is committed to the blockchain and cannot be modified.'
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
      // Program account resolution still depends on current wallet behavior, so we pass the active program ID here.
      
      const programId = activeAuctionProgramId;
      
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

    if (auction.currencyType !== 1) {
      alert(`This auction is denominated in ${auction.token}, so the ALEO commitment path is not available.`);
      return;
    }

    if (auction.seller?.toLowerCase() === address?.toLowerCase()) {
      alert(
        '❌ Seller wallet cannot place a bid on its own auction.\n\n'
        + buildBidPreflightMessage({
          auction,
          bidderAddress: address,
          usePrivateBid: false,
        })
      );
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
      
      // Generate nonce; the contract derives the commitment on-chain.
      const nonce = generateNonce();
      
      const commitResult = await commitBidAleo(
        executeTransaction,
        parseInt(auctionId),
        nonce,
        bidAmountMicro,
        auctionTxOptions
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
        commitment: null,
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

    if (auction.currencyType !== 1) {
      alert(`This auction is denominated in ${auction.token}, so private ALEO bidding is not available.`);
      return;
    }

    if (auction.seller?.toLowerCase() === address?.toLowerCase()) {
      alert(
        '❌ Seller wallet cannot place a bid on its own auction.\n\n'
        + buildBidPreflightMessage({
          auction,
          bidderAddress: address,
          usePrivateBid: true,
        })
      );
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
      
      // Generate nonce; the contract derives the commitment on-chain.
      const nonce = generateNonce();

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

      const submissionPreview = buildPrivateBidAleoSubmissionPreview({
        programId: activeAuctionProgramId,
        auctionId: parseInt(auctionId, 10),
        nonce,
        privateRecord: selectedRecord,
        amountCredits: bidAmountMicro,
      });
      const proceedWithPrivateBid = window.confirm(
        `${submissionPreview}\n\nContinue to Shield?`
      );

      if (!proceedWithPrivateBid) {
        return;
      }
      
      if (!executeTransaction) {
        throw new Error('Wallet does not support transactions');
      }
      
      const result = await commitBidAleoPrivate(
        executeTransaction,
        parseInt(auctionId, 10),
        nonce,
        selectedRecord,
        bidAmountMicro,
        auctionTxOptions
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
        commitment: null,
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
    if (auction.seller?.toLowerCase() === address?.toLowerCase()) {
      alert(
        '❌ Seller wallet cannot place a bid on its own auction.\n\n'
        + buildBidPreflightMessage({
          auction,
          bidderAddress: address,
          usePrivateBid: false,
        })
      );
      return;
    }

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
        const isUsadBid = auction.currencyType === 2;
        
        if (!executeTransaction) {
          throw new Error('Wallet does not support transactions');
        }
        
        const result = isUsadBid
          ? await commitBidUSAD(executeTransaction, parseInt(auctionId, 10), nonce, bidAmountMicro, auctionTxOptions)
          : await commitBid(executeTransaction, parseInt(auctionId, 10), nonce, bidAmountMicro, auctionTxOptions);
        
        // Verify transaction was accepted
        if (!result || result.status === 'REJECTED' || !result.transactionId) {
          throw new Error('Transaction was rejected by wallet or failed');
        }
        
        const bidStatus = await persistBidSubmission({
          commitment: null,
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
            '⚠️ If you just placed a bid and got a browser-local storage error,\n' +
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
      const commitmentData = revealCommitmentData;
      
      if (!nonce || !commitmentData) {
        showLifecycleNotice(
          revealRecoveryRequired
            ? '❌ Reveal window is open for this wallet, but this browser is missing the browser-local recovery data needed to reveal.\n\nImport a recovery bundle from the original browser or device, then try again.'
            : submittedCommitmentData && !nonce
              ? '❌ Reveal needs the saved nonce for this wallet.\n\nImport a recovery bundle from the original browser or device, then try again.'
              : '❌ No eligible bidder record was found for this wallet on this browser.\n\nPlace a bid first or import the correct recovery bundle before revealing.',
          { auto, tone: 'error' }
        );
        return;
      }

      if (hasConfirmedReveal(commitmentData)) {
        showLifecycleNotice(
          'ℹ️ This bid is already revealed on-chain.\n\nThe auction will stay CLOSED until the seller settles it after the reveal deadline.',
          { auto, tone: 'info' }
        );
        await loadAuctionData();
        return;
      }

      if (hasPendingReveal(commitmentData)) {
        showLifecycleNotice(
          '⏳ Reveal already submitted and still waiting for explorer confirmation.\n\nThis page keeps the reveal action locked so it does not resubmit duplicates.',
          { auto, tone: 'info' }
        );
        await loadAuctionData();
        return;
      }
      
      if (!executeTransaction) {
        throw new Error('Wallet does not support transactions');
      }
      
      const result = await revealBid(
        executeTransaction,
        parseInt(auctionId),
        commitmentData.amount,
        nonce,
        null,
        auctionTxOptions
      );

      const revealTransactionId = result?.transactionId;
      const revealExplorerTransactionId = looksLikeOnChainTransactionId(result?.explorerTransactionId)
        ? result.explorerTransactionId
        : looksLikeOnChainTransactionId(revealTransactionId)
          ? revealTransactionId
          : null;

      if (revealTransactionId && address) {
        updateCommitmentData(auctionId, address, {
          revealed: false,
          revealStatus: 'pending-confirmation',
          revealSubmittedAt: Date.now(),
          revealLastCheckedAt: Date.now(),
          revealTransactionId: revealExplorerTransactionId || revealTransactionId,
          revealWalletTransactionId: revealTransactionId,
          revealExplorerTransactionId,
          revealError: null,
        });
        refreshStoredCommitment();
      }

      const confirmation = await waitForLifecycleTransaction(
        result,
        '✅ Bid Revealed Successfully!\n\nYour revealed amount is now visible on-chain.',
        '⏳ Reveal submitted, but explorer confirmation is still pending. This page will keep the reveal action locked until the transaction is confirmed.',
        { auto }
      );

      if (address) {
        if (confirmation?.status === 'confirmed') {
          updateCommitmentData(auctionId, address, {
            revealed: true,
            revealStatus: 'confirmed',
            revealedAt: Date.now(),
            revealConfirmedAt: Date.now(),
            revealTransactionId: confirmation.explorerTransactionId || revealExplorerTransactionId || revealTransactionId || null,
            revealExplorerTransactionId: confirmation.explorerTransactionId || revealExplorerTransactionId || null,
            revealLastCheckedAt: Date.now(),
            revealError: null,
          });
        } else {
          updateCommitmentData(auctionId, address, {
            revealed: false,
            revealStatus: 'pending-confirmation',
            revealTransactionId: revealExplorerTransactionId || revealTransactionId || null,
            revealExplorerTransactionId: confirmation?.explorerTransactionId || revealExplorerTransactionId || null,
            revealLastCheckedAt: Date.now(),
            revealError: null,
          });
        }
        refreshStoredCommitment();
      }
      
    } catch (error) {
      console.error('❌ Error revealing bid:', error);
      const revealErrorMessage = String(error?.message || error || '');
      const normalizedRevealError = revealErrorMessage.toLowerCase();

      if (
        address &&
        storedCommitmentData &&
        (
          normalizedRevealError.includes('already revealed')
          || normalizedRevealError.includes('is_revealed')
          || normalizedRevealError.includes('commitment.is_revealed')
        )
      ) {
        updateCommitmentData(auctionId, address, {
          revealed: true,
          revealStatus: 'confirmed',
          revealedAt: Date.now(),
          revealConfirmedAt: Date.now(),
          revealLastCheckedAt: Date.now(),
          revealError: null,
        });
        refreshStoredCommitment();
        await loadAuctionData();
        showLifecycleNotice(
          'ℹ️ This wallet already revealed its bid on-chain. The page has been updated so reveal stays locked.',
          { auto, tone: 'info' }
        );
        return;
      }

      if (address && storedCommitmentData) {
        updateCommitmentData(auctionId, address, {
          revealed: false,
          revealStatus: 'rejected',
          revealLastCheckedAt: Date.now(),
          revealError: revealErrorMessage,
        });
        refreshStoredCommitment();
      }
      showLifecycleNotice(`❌ Failed to reveal bid:\n\n${revealErrorMessage}`, { auto, tone: 'error' });
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
      showLifecycleNotice(
        `⏳ Close Auction already submitted.\n\nWait for the contract state to update to ${isNoBidAuction && auction?.supportsDirectNoBidCancel ? 'CANCELLED' : 'CLOSED'} before trying again.`,
        { auto, tone: 'info' }
      );
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
      
      const result = await closeAuction(executeTransaction, parseInt(auctionId), null, auctionTxOptions);
      const transactionId = result?.transactionId;
      const explorerTransactionId = looksLikeOnChainTransactionId(result?.explorerTransactionId)
        ? result.explorerTransactionId
        : looksLikeOnChainTransactionId(transactionId)
          ? transactionId
          : null;
      const expectsDirectCancel = Boolean(isNoBidAuction && auction?.supportsDirectNoBidCancel);
      const expectedStatuses = expectsDirectCancel ? ['cancelled'] : ['closed'];

      if (transactionId && address) {
        savePendingCloseAuction(auctionId, address, activeAuctionProgramId, {
          transactionId,
          walletTransactionId: transactionId,
          explorerTransactionId,
          expectedStatuses,
          status: 'pending',
          createdAt: Date.now(),
          programId: activeAuctionProgramId,
        });
        setIsClosePending(true);
      }

      const stateReached = await waitForLifecycleState({
        result,
        expectedStatuses,
        successMessage: (reachedStatus) => (
          reachedStatus === 'cancelled'
            ? '✅ Auction Closed Successfully!\n\nNo bids were committed, so the contract cancelled this auction directly with no winner.'
            : '✅ Auction Closed Successfully!\n\nBidders can now reveal their bids.'
        ),
        pendingMessage: '⏳ Close auction submitted.\n\nTransaction has been sent. Status will update after blockchain confirmation.',
        statePendingMessage: expectsDirectCancel
          ? '⏳ Close transaction is confirmed, but the auction mapping has not updated to CANCELLED yet. Refresh again in a few seconds.'
          : '⏳ Close transaction is confirmed, but the auction mapping has not updated to CLOSED yet. Refresh again in a few seconds.',
        auto,
      });

      if (stateReached && address) {
        clearPendingCloseAuction(auctionId, address, activeAuctionProgramId);
        setIsClosePending(false);
      }
      
    } catch (error) {
      if (address) {
        clearPendingCloseAuction(auctionId, address, activeAuctionProgramId);
      }
      setIsClosePending(false);
      if (isWalletUserCancellation(error)) {
        console.warn('Close auction was cancelled in wallet:', error);
        showLifecycleNotice(
          'Close auction was dismissed in Shield.\n\nNo transaction was submitted, so the auction remains unchanged.',
          { auto, tone: 'info' }
        );
        return;
      }

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
      const commitmentData = refundCommitmentData;
      
      if (!commitmentData) {
        showLifecycleNotice(
          refundRecoveryRequired
            ? '❌ Refund is available for this wallet, but this browser is missing the browser-local recovery data needed to refund.\n\nImport a recovery bundle from the original browser or device before retrying.'
            : '❌ No refundable bidder record was found for this wallet on this browser.',
          { auto, tone: 'error' }
        );
        return;
      }

      if (!storedNonce) {
        showLifecycleNotice(
          '❌ Refund needs the saved nonce for this wallet.\n\nImport a recovery bundle from the original browser or device before retrying.',
          { auto, tone: 'error' }
        );
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
          storedNonce,
          commitmentData.amount,
          auctionTxOptions
        );
        showLifecycleNotice('✅ Refund Claimed Successfully!\n\nYour USDCx has been returned.', { auto, tone: 'success' });
      } else if (auction.currencyType === 2) {
        // USAD refund
        await claimRefundUSAD(
          executeTransaction,
          parseInt(auctionId),
          storedNonce,
          commitmentData.amount,
          auctionTxOptions
        );
        showLifecycleNotice('✅ Refund Claimed Successfully!\n\nYour USAD has been returned.', { auto, tone: 'success' });
      } else {
        const isPrivateRefund = isPrivateCommitment(commitmentData);
        if (isPrivateRefund) {
          await claimRefundAleoPrivate(
              executeTransaction,
              parseInt(auctionId, 10),
              storedNonce,
              commitmentData.amount,
              auctionTxOptions
            );
        } else {
          await claimRefundAleo(
              executeTransaction,
              parseInt(auctionId, 10),
              storedNonce,
              commitmentData.amount,
              auctionTxOptions
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
      
      const result = await settleAfterRevealTimeout(
        executeTransaction,
        parseInt(auctionId, 10),
        getCurrentTimestamp(),
        auctionTxOptions
      );

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

      const result = await finalizeWinner(
        executeTransaction,
        parseInt(auctionId, 10),
        getCurrentTimestamp(),
        auctionTxOptions
      );

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
      
      await confirmReceipt(executeTransaction, parseInt(auctionId, 10), auctionTxOptions);
      
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
        await claimWinningAleo(executeTransaction, parseInt(auctionId, 10), sellerNetAmountMicro, auction.seller, timestamp, auctionTxOptions);
      } else if (auction.currencyType === 2) {
        await claimWinningUSAD(executeTransaction, parseInt(auctionId, 10), sellerNetAmountMicro, auction.seller, timestamp, auctionTxOptions);
      } else {
        await claimWinningUSDCx(executeTransaction, parseInt(auctionId, 10), sellerNetAmountMicro, auction.seller, timestamp, auctionTxOptions);
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
        `Contract ${auctionContractVersionLabel} only allows canceling an auction while total escrow is still 0.`
      );
      return;
    }

    const confirmCancel = window.confirm(
      'Cancel this auction?\n\n' +
      `This action follows the ${auctionContractVersionLabel} contract and is only available before any escrowed bids exist.`
    );
    if (!confirmCancel) return;
    
    setIsSubmitting(true);
    
    try {
      if (!executeTransaction) {
        throw new Error('Wallet does not support transactions');
      }

      await cancelAuction(executeTransaction, parseInt(auctionId, 10), auctionTxOptions);
      
      alert('✅ Auction Canceled Successfully!\n\nThe contract is now cancelled. Any bidder with refundable escrow can claim a refund from their own wallet.');
      
      // Remove from localStorage
      const myAuctions = JSON.parse(localStorage.getItem('myAuctions') || '[]');
      const updatedAuctions = myAuctions.filter((savedAuction) => !(
        Number(savedAuction?.id) === parseInt(auctionId, 10)
          && resolveAuctionProgramId(savedAuction) === activeAuctionProgramId
      ));
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
        await claimPlatformFeeAleo(executeTransaction, parseInt(auctionId, 10), auction.platformFeeMicro, null, auctionTxOptions);
      } else if (auction.currencyType === 2) {
        await claimPlatformFeeUsad(executeTransaction, parseInt(auctionId, 10), auction.platformFeeMicro, null, auctionTxOptions);
      } else {
        await claimPlatformFeeUsdcx(executeTransaction, parseInt(auctionId, 10), auction.platformFeeMicro, null, auctionTxOptions);
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

  const _handleCancelReserveNotMet = async (options = {}) => {
    const { auto = false } = options;
    showLifecycleNotice(
      `ℹ️ In ${auctionContractVersionLabel}, reserve-miss handling is part of Settle After Reveal Timeout.\n\nUse the closed-state settlement action after the reveal deadline passes.`,
      { auto, tone: 'info' }
    );
  };

  const persistWatchlist = async (nextWatchlist) => {
    setWatchlist(nextWatchlist);
    const persistedWatchlist = await saveWatchlist(address, nextWatchlist);

    if (persistedWatchlist) {
      setWatchlist(persistedWatchlist);
    }
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

    await persistWatchlist(nextWatchlist);
  };

  const handleToggleSellerWatch = async () => {
    if (!address) {
      alert('Connect your wallet first to follow this seller.');
      return;
    }

    const normalizedSeller = normalizeWalletAddress(auction?.seller);
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
      alert('Connect your wallet first to follow this category.');
      return;
    }

    const normalizedCategory = String(auction?.assetType ?? '');
    if (!normalizedCategory) {
      return;
    }

    const nextCategories = watchlist.categories.includes(normalizedCategory)
      ? watchlist.categories.filter((value) => value !== normalizedCategory)
      : [...watchlist.categories, normalizedCategory];

    await persistWatchlist({
      ...watchlist,
      categories: nextCategories,
    });
  };

  const handleShareAuction = async () => {
    const targetUrl = buildAuctionDetailUrl(window.location.origin, auctionId, activeAuctionProgramId);

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
      auctionTitle: auction?.title || null,
      auctionStatus: auction?.status || null,
      contractState: auction?.contractState || null,
      wallet: address,
      seller: auction?.seller || null,
      sellerDisplayName: sellerDisplayName || null,
      role: disputeRole,
      token: auction?.token || null,
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
          getCurrentTimestamp(),
          auctionTxOptions
        );

        const timelineEntry = {
          at: new Date().toISOString(),
          label: 'Anchored on-chain',
          note: result?.transactionId
            ? `Transaction submitted: ${result.transactionId}`
            : `Dispute root submitted to the ${auctionContractVersionLabel} contract.`,
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
        onChainResultMessage = `Saved locally, but ${auctionContractVersionLabel} dispute anchoring failed.\n\n${error.message || error}`;
      }
    } else if (!canOpenOnChainDispute) {
      onChainResultMessage = `Saved locally. ${auctionContractVersionLabel} dispute opening is only available once the auction reaches challenge or settled state.`;
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
  const auctionEngagementRoles = new Set(Array.isArray(auctionEngagement?.roles) ? auctionEngagement.roles : []);
  const hasLocallyTrackedBid = Boolean(submittedCommitmentData || pendingCommitmentData);
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
  const isKnownBidderForAuction = Boolean(
    normalizedAddress &&
    !isSellerView &&
    (auctionEngagementRoles.has('bidder') || auctionEngagementRoles.has('winner') || isWinnerView || hasLocallyTrackedBid)
  );
  const isBidderParticipantView = Boolean(
    normalizedAddress &&
    !isSellerView &&
    !isPlatformOwnerView &&
    (submittedCommitmentData || pendingCommitmentData || storedCommitmentData || isKnownBidderForAuction)
  );
  const hasOnChainData = Boolean(auction?.hasOnChainData);
  const auctionCountdownEnded = Boolean(
    auction?.endTimestamp &&
    currentUnixTime >= auction.endTimestamp
  );
  const revealTimeoutWindowEnded = Boolean(
    auction?.status === 'closed' &&
    auction?.revealDeadline &&
    currentUnixTime >= auction.revealDeadline
  );
  const disputeWindowEnded = Boolean(
    auction?.status === 'challenge' &&
    auction?.disputeDeadline &&
    currentUnixTime >= auction.disputeDeadline
  );
  const hasRevealedBidCandidate = Boolean(
    auction?.winningAmountMicro &&
    auction.winningAmountMicro !== '0'
  );
  const hasCommittedBids = Boolean(
    (auction?.commitmentCount ?? 0) > 0 ||
    auction?.hasCommittedBids ||
    auction?.hasEscrow
  );
  const isNoBidAuction = Boolean(auction && !hasCommittedBids);
  const cancelReasonInfo = resolveCancelReasonInfo(auction?.cancelReasonCode ?? 0);
  const auctionContractVersionLabel = auction?.contractVersion || ACTIVE_CONTRACT_VERSION_LABEL;
  const storedNonce = getNonce(auctionId, address);
  const revealCommitmentData = submittedCommitmentData
    || (
      isKnownBidderForAuction
        ? pendingCommitmentData || (storedCommitmentData?.transactionId ? storedCommitmentData : null)
        : null
    );
  const canRevealBid = Boolean(
    hasOnChainData &&
    auction?.status === 'closed' &&
    (!auction?.revealDeadline || currentUnixTime <= auction.revealDeadline) &&
    revealCommitmentData &&
    storedNonce &&
    !hasRevealedBid &&
    !isRevealPending &&
    !isSellerView
  );
  const revealRecoveryRequired = Boolean(
    hasOnChainData &&
    auction?.status === 'closed' &&
    (!auction?.revealDeadline || currentUnixTime <= auction.revealDeadline) &&
    isKnownBidderForAuction &&
    !hasRevealedBid &&
    !isRevealPending &&
    (!revealCommitmentData || !storedNonce)
  );
  const isRefundableAuction = Boolean(
    hasOnChainData &&
    (
      auction?.status === 'cancelled' ||
      (auction?.status === 'settled' && !isWinnerView)
    )
  );
  const refundCommitmentData = submittedCommitmentData
    || (
      isKnownBidderForAuction
        ? pendingCommitmentData || (storedCommitmentData?.transactionId ? storedCommitmentData : null)
        : null
    );
  const refundRecoveryRequired = Boolean(
    isRefundableAuction &&
    isKnownBidderForAuction &&
    (!refundCommitmentData || !storedNonce)
  );
  const canClaimRefund = Boolean(
    isRefundableAuction &&
    refundCommitmentData &&
    storedNonce &&
    !isWinnerView
  );
  const hasAnySavedBidData = Boolean(storedCommitmentData || storedNonce);
  const hasExportableRecoveryBundle = Boolean(
    address &&
    storedNonce &&
    (activeCommitmentData || storedCommitmentData) &&
    Number((activeCommitmentData || storedCommitmentData)?.amount ?? 0) > 0
  );
  const bidderRecordDiagnostic = submittedCommitmentData
    ? {
        label: 'Bid Record',
        value: 'Confirmed in this browser',
        tone: 'success',
      }
    : pendingCommitmentData
      ? {
          label: 'Bid Record',
          value: 'Pending chain confirmation',
          tone: 'info',
        }
      : hasStaleLocalBid
        ? {
            label: 'Bid Record',
            value: 'Local draft only',
            tone: 'warning',
          }
        : isKnownBidderForAuction
          ? {
              label: 'Bid Record',
              value: 'Wallet tracked as bidder',
              tone: 'info',
            }
          : {
              label: 'Bid Record',
              value: 'No local bidder data',
              tone: 'neutral',
            };
  const nonceDiagnostic = storedNonce
    ? {
        label: 'Saved Nonce',
        value: 'Ready in this browser',
        tone: 'success',
      }
    : isKnownBidderForAuction
      ? {
          label: 'Saved Nonce',
          value: 'Missing',
          tone: 'warning',
        }
      : {
          label: 'Saved Nonce',
          value: 'Not needed yet',
          tone: 'neutral',
        };
  const recoveryBundleDiagnostic = hasAcknowledgedRecoveryBundle
    ? {
        label: 'Recovery Bundle',
        value: recoveryBundleSavedAtLabel
          ? `${recoveryBundleMethodLabel} on ${recoveryBundleSavedAtLabel}`
          : recoveryBundleMethodLabel,
        tone: 'success',
      }
    : hasExportableRecoveryBundle
      ? {
          label: 'Recovery Bundle',
          value: shouldRequireRecoveryBundleSave ? 'Export before leaving' : 'Ready to export',
          tone: shouldRequireRecoveryBundleSave ? 'warning' : 'info',
        }
      : hasAnySavedBidData
        ? {
            label: 'Recovery Bundle',
            value: 'Local data incomplete',
            tone: 'warning',
          }
        : {
            label: 'Recovery Bundle',
            value: 'Not available yet',
            tone: 'neutral',
          };
  const revealDiagnostic = !hasOnChainData
    ? {
        label: 'Reveal',
        value: 'Waiting for live contract state',
        tone: 'warning',
      }
    : hasRevealedBid
      ? {
          label: 'Reveal',
          value: 'Already revealed',
          tone: 'success',
        }
      : isRevealPending
        ? {
            label: 'Reveal',
            value: 'Submitted, awaiting confirmation',
            tone: 'info',
          }
        : canRevealBid
          ? {
              label: 'Reveal',
              value: 'Ready now',
              tone: 'success',
            }
          : revealRecoveryRequired
            ? {
                label: 'Reveal',
                value: 'Import recovery bundle first',
                tone: 'warning',
              }
            : auction?.status === 'open' && auctionCountdownEnded
              ? {
                  label: 'Reveal',
                  value: 'Waiting for seller to close',
                  tone: 'info',
                }
              : auction?.status === 'open'
                ? {
                    label: 'Reveal',
                    value: 'Auction still open',
                    tone: 'neutral',
                  }
                : auction?.status === 'closed' && auction?.revealDeadline && currentUnixTime > auction.revealDeadline
                  ? {
                      label: 'Reveal',
                      value: 'Reveal window ended',
                      tone: 'warning',
                    }
                  : isKnownBidderForAuction
                    ? {
                        label: 'Reveal',
                        value: 'Waiting for contract phase',
                        tone: 'neutral',
                      }
                    : {
                        label: 'Reveal',
                        value: 'No bidder path detected',
                        tone: 'neutral',
                      };
  const refundDiagnostic = !hasOnChainData
    ? {
        label: 'Refund',
        value: 'Waiting for live contract state',
        tone: 'warning',
      }
    : isWinnerView
      ? {
          label: 'Refund',
          value: 'Winner path cannot refund',
          tone: 'neutral',
        }
      : canClaimRefund
        ? {
            label: 'Refund',
            value: 'Ready now',
            tone: 'success',
          }
        : refundRecoveryRequired
          ? {
              label: 'Refund',
              value: 'Import recovery bundle first',
              tone: 'warning',
            }
          : isRefundableAuction && isKnownBidderForAuction
            ? {
                label: 'Refund',
                value: 'Waiting for local bid data',
                tone: 'warning',
              }
            : isRefundableAuction
              ? {
                  label: 'Refund',
                  value: 'Not available on this wallet',
                  tone: 'neutral',
                }
              : {
                  label: 'Refund',
                  value: 'Not refundable yet',
                  tone: 'neutral',
                };
  const shouldShowBidderDiagnostics = Boolean(
    !isSellerView &&
    (
      isBidderParticipantView ||
      hasStaleLocalBid ||
      hasAcknowledgedRecoveryBundle ||
      shouldRecommendRecoveryBundleSave ||
      revealRecoveryRequired ||
      refundRecoveryRequired
    )
  );
  const bidderDiagnosticsItems = [
    bidderRecordDiagnostic,
    nonceDiagnostic,
    recoveryBundleDiagnostic,
    revealDiagnostic,
    refundDiagnostic,
  ];
  const bidderDiagnosticsMessage = revealRecoveryRequired || refundRecoveryRequired
    ? 'This wallet should import a recovery bundle on this browser before reveal or refund can proceed.'
    : shouldRequireRecoveryBundleSave
      ? 'Save the recovery bundle before leaving this page so this wallet can recover reveal and refund later.'
      : hasAcknowledgedRecoveryBundle
        ? 'Recovery data has been acknowledged for this wallet. Keep the exported bundle somewhere safe.'
        : null;
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
  const resolvedSellerVerification = mergeSellerVerification(sellerVerification, auction?.sellerVerification);
  const resolvedProofBundle = mergeAuctionProofBundle(auctionProofBundle, auction?.assetProof);
  const normalizedReputation = normalizeReputation(reputation);
  const proofFiles = Array.isArray(resolvedProofBundle?.proofFiles)
    ? resolvedProofBundle.proofFiles
    : Array.isArray(auction?.proofFiles)
      ? auction.proofFiles
      : [];
  const itemPhotos = Array.isArray(resolvedProofBundle?.itemPhotos)
    ? resolvedProofBundle.itemPhotos
    : Array.isArray(auction?.itemPhotos)
      ? auction.itemPhotos
      : [];
  const sellerDisplayName = auction?.sellerDisplayName || resolvedSellerVerification?.sellerDisplayName || null;
  const sellerAddressPreview = formatAddressPreview(auction?.seller);
  const bidderAddressPreview = formatAddressPreview(address);
  const bidPathLabel = buildBidPathLabel(auction, usePrivateBid);
  const privateBidAmountMicroPreview = bidAmount && Number.isFinite(parseFloat(bidAmount))
    ? Math.floor(parseFloat(bidAmount) * 1_000_000)
    : null;
  const privateBidDraftPreview = buildPrivateBidDraftPreview({
    programId: activeAuctionProgramId,
    auctionId,
    amountCredits: privateBidAmountMicroPreview,
  });
  const verificationStatus = resolvedSellerVerification?.status || 'pending';
  const verificationTone = verificationStatus === 'verified'
    ? 'text-green-300 border-green-500/30 bg-green-500/10'
    : verificationStatus === 'submitted'
      ? 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10'
      : 'text-amber-200 border-amber-500/30 bg-amber-500/10';
  const isWatched = watchlist.auctionIds.includes(String(auctionId));
  const isSellerWatched = Boolean(auction?.seller) && watchlist.sellers.includes(normalizeWalletAddress(auction?.seller));
  const isCategoryWatched = watchlist.categories.includes(String(auction?.assetType ?? ''));
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
    hasOnChainData &&
    isPlatformOwnerView &&
    auction?.status === 'settled' &&
    auction?.paymentClaimed &&
    !auction?.platformFeeClaimed
  );
  const sellerClaimReady = Boolean(
    hasOnChainData &&
    isSellerView &&
    auction?.status === 'settled' &&
    !auction?.paymentClaimed &&
    (
      auction?.itemReceived ||
      auction?.claimableAtReached
    ) &&
    (auction?.sellerNetAmountMicro || auction?.winningAmountMicro)
  );
  const canAutoSellerClaim = Boolean(
    sellerClaimReady
  );
  const closeActionLabel = isSubmitting
    ? 'Closing...'
    : isClosePending
      ? 'Close Pending...'
      : auctionCountdownEnded
        ? isNoBidAuction
          ? auction?.supportsDirectNoBidCancel
            ? '1️⃣ Close and Cancel Auction'
            : '1️⃣ Close Auction (No Bids)'
          : '1️⃣ Close Auction Now'
        : '1️⃣ Close Auction After End';
  const noBidOpenStateMessage = auctionCountdownEnded
    ? auction?.supportsDirectNoBidCancel
      ? 'No bids were committed before the end time. One close transaction will move this auction directly from OPEN to CANCELLED.'
      : 'No bids were committed before the end time. One close transaction is still needed to move the contract out of OPEN.'
    : 'No bids are committed yet. If that stays true until the end time, one close transaction will finish the auction with no winner.';
  const noBidAutoCloseMessage = isSellerView && connected && executeTransaction
    ? auction?.supportsDirectNoBidCancel
      ? 'If this seller page stays open with your wallet connected, ShadowBid will also try to trigger that direct cancel automatically once the timer ends.'
      : 'If this seller page stays open with your wallet connected, ShadowBid will also try to trigger that close automatically once the timer ends.'
    : null;
  const sellerPanelStatusMessage = !hasOnChainData
    ? 'Live contract state is unavailable right now, so seller actions stay read-only until the on-chain view loads again.'
    : auction?.status === 'cancelled'
      ? 'This auction is already cancelled. You can still review the outcome and full auction history from this page.'
      : auction?.status === 'settled'
        ? 'This auction is already settled. Review the payout state and post-settlement details from the seller controls below.'
        : auction?.status === 'challenge'
          ? 'A valid winner path exists, but seller-side finalization is still handled from the action panel below.'
          : auction?.status === 'closed'
            ? 'The bidding window is over. Seller-side settlement stays available from the action panel below.'
            : 'You can still review the listing here, then use the seller controls below when the contract state is ready.';
  const bidPanelTitle = isSellerView ? 'Seller View' : 'Place Your Bid';
  const onChainLayerStatus = hasOnChainData
    ? {
        title: 'On-Chain',
        label: 'Live',
        tone: 'success',
        description: `Lifecycle, deadlines, and funds are loaded from the live ${auctionContractVersionLabel} contract state.`,
        icon: CheckCircle,
      }
    : {
        title: 'On-Chain',
        label: 'Unavailable',
        tone: 'warning',
        description: 'Live contract state could not be loaded, so the page is falling back to retained metadata only.',
        icon: AlertCircle,
      };
  const hasSavedBidContext = Boolean(
    storedNonce && (
      revealCommitmentData ||
      refundCommitmentData ||
      submittedCommitmentData ||
      pendingCommitmentData ||
      storedCommitmentData
    )
  );
  const localRecoveryLayerStatus = isSellerView || isPlatformOwnerView
    ? {
        title: 'Local Recovery',
        label: 'Not Required',
        tone: 'neutral',
        description: 'Seller and platform actions use live contract state and do not depend on bidder-local nonce storage.',
        icon: Info,
      }
    : revealRecoveryRequired || refundRecoveryRequired
      ? {
          title: 'Local Recovery',
          label: 'Missing',
          tone: 'warning',
          description: 'This browser is missing the saved nonce or bid bundle needed for reveal or refund.',
          icon: AlertCircle,
        }
      : hasSavedBidContext
        ? {
            title: 'Local Recovery',
            label: 'Ready',
            tone: 'success',
            description: 'Saved nonce and bid bundle are present in this browser for the current bidder flow.',
            icon: CheckCircle,
          }
        : isBidderParticipantView
          ? {
              title: 'Local Recovery',
              label: 'Tracked',
              tone: 'info',
              description: 'This wallet is known as a bidder, but reveal or refund is not unlocked yet.',
              icon: Clock,
            }
          : {
              title: 'Local Recovery',
              label: 'Not Needed Yet',
              tone: 'neutral',
              description: 'Browser-local nonce storage becomes important only after this wallet commits a bid.',
              icon: Info,
            };
  const opsLayerStatus = (auction?.hasSharedReadModel || auction?.hasSharedSnapshot)
    ? {
        title: 'Shared Read Model',
        label: auction?.hasLocalMetadata ? 'Synced + Cached' : 'Synced',
        tone: 'success',
        description: `${auction?.sharedReadModelSourceLabel || 'Shared Read Model'} is available for this auction, so list and detail can share the same chain-mirror state.`,
        icon: CheckCircle,
      }
    : auction?.hasLocalMetadata
      ? {
          title: 'Shared Read Model',
          label: 'Local Cache Only',
          tone: 'info',
          description: `Using browser-local cache only. ${auction?.sharedReadModelSourceLabel || 'Shared Read Model'} has not provided a shared chain mirror for this auction yet.`,
          icon: Clock,
        }
      : {
          title: 'Shared Read Model',
          label: 'Unavailable',
          tone: 'neutral',
          description: `No shared chain mirror is loaded from ${auction?.sharedReadModelSourceLabel || 'Shared Read Model'}, but lifecycle still comes from the contract when on-chain data is available.`,
          icon: Info,
        };
  const dataLayerStatuses = [
    onChainLayerStatus,
    localRecoveryLayerStatus,
    opsLayerStatus,
  ];
  const cancelActionState = {
    visible: Boolean(isSellerView && auction?.status === 'open' && !auction?.hasEscrow),
    disabled: Boolean(isSubmitting || isClosePending || !hasOnChainData),
    label: isSubmitting ? 'Canceling...' : '🚫 Cancel Auction',
    blockedReason: !hasOnChainData
      ? 'Refresh once live contract state is available before submitting seller actions.'
      : isClosePending
        ? 'A close transaction is already pending, so cancel stays locked to avoid conflicting actions.'
        : null,
  };
  const closeActionState = {
    visible: Boolean(isSellerView && auction?.status === 'open'),
    disabled: Boolean(isSubmitting || isClosePending || !auctionCountdownEnded || !hasOnChainData),
    label: closeActionLabel,
    blockedReason: !hasOnChainData
      ? 'Live contract state is unavailable, so close stays locked until the page reloads on-chain data.'
      : isClosePending
        ? 'Close is already pending on-chain. Wait for the state to move to CLOSED or CANCELLED.'
        : !auctionCountdownEnded
          ? `Close unlocks after ${formatUnixTimestamp(auction?.endTimestamp)}.`
          : null,
  };
  const settleActionState = {
    visible: Boolean(isSellerView && auction?.status === 'closed'),
    disabled: Boolean(isSubmitting || !revealTimeoutWindowEnded || !hasOnChainData),
    label: isSubmitting
      ? 'Processing...'
      : !revealTimeoutWindowEnded
        ? '2️⃣ Waiting for Reveal Deadline'
        : hasRevealedBidCandidate
          ? '2️⃣ Settle After Reveal Timeout'
          : '2️⃣ Settle and Cancel if Needed',
    blockedReason: !hasOnChainData
      ? 'Reload the live contract state before running timeout settlement.'
      : !revealTimeoutWindowEnded
        ? `Settlement stays locked until ${revealWindowEndsAtLabel}, even if one or more bidders already revealed.`
        : null,
  };
  const finalizeActionState = {
    visible: Boolean(isSellerView && auction?.status === 'challenge'),
    disabled: Boolean(isSubmitting || !disputeWindowEnded || hasActiveOnChainDispute || auction?.reserveMet === false || !hasOnChainData),
    label: isSubmitting
      ? 'Finalizing...'
      : hasActiveOnChainDispute
        ? '3️⃣ Resolve Dispute First'
        : auction?.reserveMet === false
          ? '3️⃣ Reserve Not Met'
          : !disputeWindowEnded
            ? '3️⃣ Waiting for Dispute Window'
            : '3️⃣ Finalize Winner',
    blockedReason: !hasOnChainData
      ? 'Reload the live contract state before finalizing the winner.'
      : hasActiveOnChainDispute
        ? 'Resolve the active on-chain dispute before finalizing the auction.'
        : auction?.reserveMet === false
          ? 'Reserve is not met, so this path should cancel and refund instead of finalizing a winner.'
          : !disputeWindowEnded
            ? `Finalization unlocks after ${challengeWindowEndsAtLabel}.`
            : null,
  };
  const sellerClaimActionState = {
    visible: Boolean(isSellerView && auction?.status === 'settled' && !auction?.paymentClaimed),
    disabled: Boolean(isSubmitting || !sellerClaimReady),
    label: isSubmitting
      ? 'Claiming...'
      : !auction?.itemReceived && !auction?.claimableAtReached
        ? '4️⃣ Waiting for Receipt or Timeout'
        : `4️⃣ 💰 Claim Seller Net${auction?.sellerNetAmount ? ` (${auction.sellerNetAmount} ${auction.token})` : ''}`,
    blockedReason: !hasOnChainData
      ? 'Live contract state is unavailable, so seller payout stays locked until the page reloads.'
      : !auction?.sellerNetAmountMicro && !auction?.winningAmountMicro
        ? 'Seller net amount is not available yet. Refresh the auction state and try again.'
        : !auction?.itemReceived && !auction?.claimableAtReached
          ? `Seller payout unlocks after ${claimableAtLabel} unless the winner confirms receipt earlier.`
          : null,
  };
  const blockedSellerActionMessage = [
    cancelActionState,
    closeActionState,
    settleActionState,
    finalizeActionState,
    sellerClaimActionState,
  ].find((actionState) => actionState.visible && actionState.disabled && actionState.blockedReason)?.blockedReason || null;

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
      closeActionState.visible && !closeActionState.disabled
        ? {
            key: `close_${auction.id}_${address}`,
            run: () => handleCloseAuction({ auto: true }),
          }
        : settleActionState.visible && !settleActionState.disabled
          ? {
              key: `settle_reveal_timeout_${auction.id}_${address}`,
              run: () => handleSettleAfterRevealTimeout({ auto: true }),
            }
          : finalizeActionState.visible && !finalizeActionState.disabled
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
    closeActionState.disabled,
    closeActionState.visible,
    connected,
    disputeWindowEnded,
    executeTransaction,
    finalizeActionState.disabled,
    finalizeActionState.visible,
    hasActiveOnChainDispute,
    isCancellingReserve,
    isClaimingFee,
    isClosePending,
    isSellerView,
    isSubmitting,
    loading,
    revealTimeoutWindowEnded,
    settleActionState.disabled,
    settleActionState.visible,
  ]);

  return (
    <div className="min-h-screen bg-void-900 text-white">
      {/* Header */}
      <PremiumNav />
      <input
        ref={recoveryBundleInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportRecoveryBundle}
      />
      
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
                This page could not load a live on-chain record or any saved auction metadata for this auction.
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
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleToggleSellerWatch}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors ${
                          isSellerWatched
                            ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
                            : 'border-white/10 bg-white/5 text-white/60 hover:border-cyan-500/25 hover:bg-cyan-500/10 hover:text-cyan-200'
                        }`}
                      >
                        <UserRoundCheck className="h-3.5 w-3.5" />
                        {isSellerWatched ? 'Following Seller' : 'Follow Seller'}
                      </button>
                    </div>
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
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="text-lg">{getAssetTypeIcon(auction.assetType)}</span>
                    <span className="font-mono text-gold-500">{getAssetTypeName(auction.assetType)}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 border border-green-500/40 rounded text-xs font-mono text-green-400">
                      {auctionContractVersionLabel}
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleCategoryWatch}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors ${
                        isCategoryWatched
                          ? 'border-gold-500/35 bg-gold-500/10 text-gold-300'
                          : 'border-white/10 bg-white/5 text-white/60 hover:border-gold-500/25 hover:bg-gold-500/10 hover:text-gold-300'
                      }`}
                    >
                      <BookmarkCheck className="h-3.5 w-3.5" />
                      {isCategoryWatched ? 'Watching Category' : 'Watch Category'}
                    </button>
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
                    <div className="text-xs font-mono uppercase tracking-[0.18em] text-cyan-300">{auctionContractVersionLabel} On-Chain Anchors</div>
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
                          {normalizedReputation ? `${(normalizedReputation.seller.successRate * 100).toFixed(0)}%` : '0%'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs text-white/45">Avg. settlement</div>
                        <div className="mt-2 text-2xl font-display font-bold text-white">
                          {normalizedReputation?.seller.averageSettlementHours != null
                            ? `${normalizedReputation.seller.averageSettlementHours.toFixed(1)}h`
                            : 'N/A'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs text-white/45">Dispute ratio</div>
                        <div className="mt-2 text-2xl font-display font-bold text-white">
                          {normalizedReputation ? `${(normalizedReputation.seller.disputeRatio * 100).toFixed(0)}%` : '0%'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs text-white/45">Bidder wins</div>
                        <div className="mt-2 text-2xl font-display font-bold text-white">
                          {normalizedReputation?.bidder.wins ?? 0}
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
                        ? `This auction can anchor a dispute directly to the ${auctionContractVersionLabel} contract from this page.`
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
                      {(dispute.auctionTitle || dispute.token || dispute.contractState) && (
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-mono uppercase tracking-[0.16em] text-white/45">
                          {dispute.auctionTitle && (
                            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">
                              {dispute.auctionTitle}
                            </span>
                          )}
                          {dispute.token && (
                            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">
                              {dispute.token}
                            </span>
                          )}
                          {dispute.contractState && (
                            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">
                              {dispute.contractState}
                            </span>
                          )}
                        </div>
                      )}
                      {Array.isArray(dispute.evidence) && dispute.evidence.length > 0 && (
                        <div className="mt-3 text-xs text-cyan-200">
                          Evidence: {dispute.evidence.join(' • ')}
                        </div>
                      )}
                      {dispute.onChainDisputeRoot && (
                        <div className="mt-3 break-all rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 font-mono text-[11px] text-cyan-100">
                          Root: {dispute.onChainDisputeRoot}
                        </div>
                      )}
                      {dispute.onChainTransactionId && (
                        <div className="mt-2 break-all text-[11px] font-mono text-cyan-300">
                          Tx: {dispute.onChainTransactionId}
                        </div>
                      )}
                      {Array.isArray(dispute.timeline) && dispute.timeline.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-white/5 pt-3">
                          {dispute.timeline.slice(-3).reverse().map((entry, index) => (
                            <div key={`${dispute.id}-timeline-${index}`} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold text-white">{entry.label || 'Timeline update'}</span>
                                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/35">
                                  {entry.at || 'Unknown'}
                                </span>
                              </div>
                              {entry.note && (
                                <div className="mt-1 text-xs leading-relaxed text-white/55">{entry.note}</div>
                              )}
                            </div>
                          ))}
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
                        Commit-Reveal Auction
                      </div>
                      <div className="text-xs text-white/60">
                        The live {auctionContractVersionLabel} deployment derives commitments in-contract and omits per-bid amounts from escrow mappings, but public funding transactions can still expose bid amounts before reveal.
                      </div>
                    </div>
                  </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-void-800 rounded-xl border border-white/5">
                  <div className="text-xs font-mono text-white/40 mb-2">Visible On-Chain</div>
                  <div className="space-y-2 text-sm text-white/60">
                    <div>• Auction state: {auction.contractState}</div>
                    <div>• Stored commitment roots and aggregate escrow totals in the live {auctionContractVersionLabel} deployment</div>
                    <div>• Seller settlement account exists on-chain, even when the marketplace masks it in the main UI</div>
                    <div>• Escrowed total: {auction.totalEscrowed.toFixed(2)} {auction.token}</div>
                    <div>• Winner address and winning amount after settlement steps</div>
                    <div>• Receipt confirmation and payment claimed flags</div>
                  </div>
                </div>
                <div className="p-4 bg-void-800 rounded-xl border border-white/5">
                  <div className="text-xs font-mono text-white/40 mb-2">Browser-Local Recovery Data</div>
                  <div className="space-y-2 text-sm text-white/60">
                    <div>• Bidder nonce and recovery bundle saved in this browser</div>
                    <div>• Reveal and refund access depends on that browser-local data unless you import a recovery bundle</div>
                    <div>• Private ALEO source record details when private credits are used</div>
                  </div>
                </div>
                <div className="p-4 bg-void-800 rounded-xl border border-white/5">
                  <div className="text-xs font-mono text-white/40 mb-2">Shared Ops Metadata</div>
                  <div className="space-y-2 text-sm text-white/60">
                    <div>• Watchlists, seller verification, disputes, offers, and notifications live outside the contract</div>
                    <div>• This shared Ops layer improves UX, but it is not the source of truth for auction funds or lifecycle state</div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Right Column - Floating Bid Panel */}
          <div className="col-span-12 lg:col-span-4">
            <div className="sticky top-24 space-y-6">
              <GlassCard className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-display font-bold">State Layers</div>
                    <div className="text-[11px] text-white/45">
                      Which data source is currently driving this page
                    </div>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-white/55">
                    {auction.contractState}
                  </span>
                </div>
                <div className="space-y-3">
                  {dataLayerStatuses.map((statusItem) => {
                    const Icon = statusItem.icon;
                    const styles = getLayerStatusStyles(statusItem.tone);

                    return (
                      <div
                        key={statusItem.title}
                        className={`rounded-xl border p-4 ${styles.surface}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${styles.accent}`} />
                            <div className={`text-xs font-mono uppercase tracking-[0.18em] ${styles.accent}`}>
                              {statusItem.title}
                            </div>
                          </div>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em] ${styles.badge}`}>
                            {statusItem.label}
                          </span>
                        </div>
                        <div className={`mt-2 text-xs leading-relaxed ${styles.body}`}>
                          {statusItem.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>

              <GlassCard className="p-6 relative overflow-hidden">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-gold-500/10 to-cyan-500/10 opacity-50" />
                
                <div className="relative z-10">
                  <h3 className="text-xl font-display font-bold mb-6">{bidPanelTitle}</h3>
                  
                  {isSellerView ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-void-800 rounded-xl border border-white/5">
                        <div className="text-xs font-mono text-white/40 uppercase tracking-wider mb-2">
                          Minimum Bid
                        </div>
                        <div className="text-2xl font-display font-bold text-gold-500">
                          {auction.minBid} <span className="text-sm text-cyan-400">{auction.token}</span>
                        </div>
                      </div>

                      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-5 h-5 text-amber-400" />
                          <div className="font-mono text-sm text-amber-400">You Can't Bid As Seller</div>
                        </div>
                        <div className="text-xs text-white/60 leading-relaxed">
                          You are connected with the seller wallet, so bidding is disabled for this account on this auction.
                        </div>
                      </div>

                      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-xs text-white/65">
                        <div className="font-mono text-cyan-400 mb-2">Seller Access</div>
                        <div>
                          {sellerPanelStatusMessage}
                        </div>
                      </div>
                    </div>
                  ) : submittedCommitmentData && !showBidForm ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                          <div className="font-mono text-sm text-green-400">Bid Placed Successfully</div>
                          {isPrivateCommitment(submittedCommitmentData) && (
                            <span className="px-2 py-0.5 bg-gold-500/20 border border-gold-500/40 rounded text-xs font-mono text-gold-400">
                              🔒 PRIVATE FUNDING
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/60 mb-3">
                          Your bid has been committed to the blockchain.
                          {isPrivateCommitment(submittedCommitmentData) && (
                            <span className="text-gold-400"> Funding came from a private ALEO record, and {auctionContractVersionLabel} keeps your per-bid amount out of the escrow mapping.</span>
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
                              Commit-reveal auctions require final commitments. Your bid cannot be changed or canceled once placed.
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

                      {shouldRequireRecoveryBundleSave ? (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
                            <div>
                              <div className="font-mono text-sm text-amber-400 mb-2">
                                Required Before Leaving
                              </div>
                              <div className="text-xs text-white/60 leading-relaxed">
                                Download or copy the recovery bundle now. It will be needed later for reveal or refund if this browser-local data is lost.
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : hasAcknowledgedRecoveryBundle ? (
                        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                          <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                            <div>
                              <div className="font-mono text-sm text-green-400 mb-2">
                                Recovery Bundle {recoveryBundleMethodLabel}
                              </div>
                              <div className="text-xs text-white/60 leading-relaxed">
                                {recoveryBundleSavedAtLabel
                                  ? `Saved on ${recoveryBundleSavedAtLabel}. Keep that bundle somewhere safe for future reveal or refund recovery.`
                                  : 'This wallet already acknowledged the recovery bundle. Keep it somewhere safe for future reveal or refund recovery.'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <PremiumButton
                          className="w-full"
                          onClick={handleDownloadRecoveryBundle}
                          variant="ghost"
                        >
                          {hasAcknowledgedRecoveryBundle ? 'Download Bundle Again' : 'Download Recovery Bundle'}
                        </PremiumButton>
                        <PremiumButton
                          className="w-full"
                          onClick={handleCopyRecoveryBundle}
                          variant="ghost"
                        >
                          {hasAcknowledgedRecoveryBundle ? 'Copy Bundle Again' : 'Copy Recovery Bundle'}
                        </PremiumButton>
                      </div>
                    </div>
                  ) : pendingCommitmentData && !showBidForm ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-5 h-5 text-cyan-400" />
                          <div className="font-mono text-sm text-cyan-400">Bid Awaiting Confirmation</div>
                          {isPrivateCommitment(pendingCommitmentData) && (
                            <span className="px-2 py-0.5 bg-gold-500/20 border border-gold-500/40 rounded text-xs font-mono text-gold-400">
                              🔒 PRIVATE FUNDING
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

                      {shouldRecommendRecoveryBundleSave ? (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
                            <div>
                              <div className="font-mono text-sm text-amber-400 mb-2">
                                Save Recovery Bundle Soon
                              </div>
                              <div className="text-xs text-white/60 leading-relaxed">
                                The wallet already returned a transaction ID. Saving the recovery bundle now is recommended in case this bid confirms and this browser-local data is lost later.
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : hasAcknowledgedRecoveryBundle ? (
                        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                          <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                            <div>
                              <div className="font-mono text-sm text-green-400 mb-2">
                                Recovery Bundle {recoveryBundleMethodLabel}
                              </div>
                              <div className="text-xs text-white/60 leading-relaxed">
                                {recoveryBundleSavedAtLabel
                                  ? `Saved on ${recoveryBundleSavedAtLabel}. Keep that bundle somewhere safe while the bid waits for chain confirmation.`
                                  : 'This wallet already acknowledged the recovery bundle. Keep it somewhere safe while the bid waits for chain confirmation.'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <PremiumButton
                          className="w-full"
                          onClick={handleDownloadRecoveryBundle}
                          variant="ghost"
                        >
                          {hasAcknowledgedRecoveryBundle ? 'Download Bundle Again' : 'Download Recovery Bundle'}
                        </PremiumButton>
                        <PremiumButton
                          className="w-full"
                          onClick={handleCopyRecoveryBundle}
                          variant="ghost"
                        >
                          {hasAcknowledgedRecoveryBundle ? 'Copy Bundle Again' : 'Copy Recovery Bundle'}
                        </PremiumButton>
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
                          We found browser-local bid data without a confirmed transaction ID. It will not be treated as a successful bid, and you can safely submit again.
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
                                {auctionContractVersionLabel}
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
                              ? `Paid from a private ALEO record. The source record stays private, and ${auctionContractVersionLabel} no longer stores a per-bid amount in the escrow mapping.`
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

                      <div className="rounded-xl border border-white/10 bg-void-800/60 p-4">
                        <div className="mb-3 text-xs font-mono uppercase tracking-[0.18em] text-cyan-400">
                          Bid Preflight
                        </div>
                        <div className="space-y-2 text-xs text-white/65">
                          <div className="flex items-center justify-between gap-3">
                            <span>Execution Path</span>
                            <span className="font-mono text-gold-400">{bidPathLabel}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Bid Wallet</span>
                            <span className="font-mono text-cyan-300">{bidderAddressPreview}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Seller Wallet</span>
                            <span className="font-mono text-white">{sellerAddressPreview}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Role Check</span>
                            <span className={`font-mono ${isSellerView ? 'text-amber-300' : 'text-green-300'}`}>
                              {isSellerView ? 'Seller wallet detected' : 'Bidder wallet detected'}
                            </span>
                          </div>
                        </div>
                        {isSellerView && (
                          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                            Switch to a different wallet before bidding. Seller actions and bidder actions should not share the same wallet in this UI.
                          </div>
                        )}
                      </div>
                      
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
                                Contract {auctionContractVersionLabel} public ALEO flow uses transfer first, then commitment
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
                                🔒 Fund With Private Credits
                              </div>
                              <div className="text-xs text-white/60">
                                Uses one private wallet record for funding, while {auctionContractVersionLabel} keeps per-bid amounts out of the escrow mapping
                              </div>
                            </div>
                          </div>
                          <div className="mb-3 rounded-lg border border-white/10 bg-void-900/80 p-3">
                            <div className="mb-2 text-[11px] font-mono uppercase tracking-wider text-cyan-400">
                              Record Code Private Aleo
                            </div>
                            <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-white/75">
                              {privateBidDraftPreview}
                            </pre>
                            <div className="mt-2 text-[11px] text-white/45">
                              Input ke-2 adalah `nonce`. Commitment final dihitung di dalam kontrak `{auction?.version || ACTIVE_CONTRACT_VERSION}`.
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
                                : isNoBidAuction
                                  ? 'No bids were committed. Settle now and the contract will cancel the auction with no winner.'
                                  : 'The reveal window is over. Settle the auction and the contract will cancel it if no valid reveal is recorded.'
                              : isNoBidAuction
                                ? auction.supportsDirectNoBidCancel
                                  ? 'No bids were committed before close. Newer contract versions can cancel this path directly at close, but this auction is already waiting in CLOSED.'
                                  : `No bids were committed before close. The seller can settle this auction into CANCELLED after ${revealWindowEndsAtLabel}.`
                                : `Bids can still be revealed until ${revealWindowEndsAtLabel}. Even if a bidder already revealed, settlement still unlocks only after that deadline.`}
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

                      {auction.status === 'open' && isNoBidAuction && (
                        <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Info className="w-5 h-5 text-cyan-400" />
                            <div className="font-mono text-sm text-cyan-400">No Bid Yet</div>
                          </div>
                          <div className="text-xs text-white/60 space-y-2">
                            <div>{noBidOpenStateMessage}</div>
                            {auction.supportsDirectNoBidCancel ? (
                              <div>
                                After the close transaction confirms, this contract can complete the auction immediately as `CANCELLED`.
                              </div>
                            ) : (
                              <div>
                                After the close transaction confirms, the contract will enter `CLOSED` first. Once the reveal deadline passes, the seller can settle it into `CANCELLED`.
                              </div>
                            )}
                            {noBidAutoCloseMessage ? (
                              <div>{noBidAutoCloseMessage}</div>
                            ) : null}
                          </div>
                        </div>
                      )}
                      
                      {/* Cancel Auction - Only when OPEN and no escrow */}
                      {cancelActionState.visible && (
                        <PremiumButton 
                          className="w-full"
                          onClick={handleCancelAuction}
                          disabled={cancelActionState.disabled}
                          variant="ghost"
                        >
                          {cancelActionState.label}
                        </PremiumButton>
                      )}
                      
                      {/* Step 1: Close Auction */}
                      {closeActionState.visible && (
                        <PremiumButton 
                          className="w-full"
                          onClick={handleCloseAuction}
                          disabled={closeActionState.disabled}
                          variant="cyan"
                        >
                          {closeActionState.label}
                        </PremiumButton>
                      )}
                      
                      {/* Step 2: Settle After Reveal Timeout */}
                      {settleActionState.visible && (
                        <PremiumButton 
                          className="w-full"
                          onClick={handleSettleAfterRevealTimeout}
                          disabled={settleActionState.disabled}
                        >
                          {settleActionState.label}
                        </PremiumButton>
                      )}
                      
                      {/* Step 3: Finalize Winner */}
                      {finalizeActionState.visible && (
                        <PremiumButton 
                          className="w-full"
                          onClick={handleFinalizeWinner}
                          disabled={finalizeActionState.disabled}
                          variant="secondary"
                        >
                          {finalizeActionState.label}
                        </PremiumButton>
                      )}
                      
                      {/* Step 4: Claim Winning Bid */}
                      {sellerClaimActionState.visible && (
                        <PremiumButton 
                          className="w-full"
                          onClick={handleClaimWinning}
                          disabled={sellerClaimActionState.disabled}
                          variant="gold"
                        >
                          {sellerClaimActionState.label}
                        </PremiumButton>
                      )}

                      {blockedSellerActionMessage ? (
                        <div className="rounded-xl border border-white/10 bg-void-800 p-4 text-xs leading-relaxed text-white/60">
                          {blockedSellerActionMessage}
                        </div>
                      ) : null}

                      {/* Workflow guide */}
                      <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                        <div className="text-xs text-white/60">
                          <div className="font-mono text-cyan-400 mb-2">Seller Workflow ({auctionContractVersionLabel}):</div>
                          <div className="space-y-1">
                            <div className={cancelActionState.visible && !cancelActionState.disabled ? 'text-gold-400' : cancelActionState.visible ? 'text-white/70' : 'text-white/40'}>
                              🚫 Cancel auction while escrow is still 0
                            </div>
                            <div className={closeActionState.visible && !closeActionState.disabled ? 'text-gold-400' : closeActionState.visible ? 'text-white/70' : 'text-white/40'}>
                              1️⃣ Close auction
                            </div>
                            <div className={settleActionState.visible && !settleActionState.disabled ? 'text-gold-400' : settleActionState.visible ? 'text-white/70' : 'text-white/40'}>
                              2️⃣ Settle after reveal timeout
                            </div>
                            <div className={finalizeActionState.visible && !finalizeActionState.disabled ? 'text-gold-400' : finalizeActionState.visible ? 'text-white/70' : 'text-white/40'}>
                              3️⃣ Finalize winner after dispute window
                            </div>
                            <div className={sellerClaimActionState.visible && !sellerClaimActionState.disabled ? 'text-gold-400' : sellerClaimActionState.visible ? 'text-white/70' : 'text-white/40'}>
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
                            ? hasRevealedBid
                              ? 'Your bid has already been revealed on-chain'
                              : isRevealPending
                                ? 'Your reveal is awaiting chain confirmation'
                                : 'You have a confirmed bidder record on this browser'
                            : pendingCommitmentData
                              ? 'Your bid is awaiting chain confirmation'
                              : isKnownBidderForAuction
                                ? 'This wallet is recognized as a bidder, but this browser may be missing some browser-local recovery data'
                                : 'You have not bid yet'}
                        </div>
                      </div>

                      {shouldShowBidderDiagnostics && (
                        <div className="rounded-xl border border-white/10 bg-void-800 p-4">
                          <div className="font-mono text-sm text-white mb-3">Bidder Recovery Diagnostics</div>
                          <div className="space-y-2">
                            {bidderDiagnosticsItems.map((item) => (
                              <div key={item.label} className="flex items-start justify-between gap-3 text-xs">
                                <span className="text-white/40">{item.label}</span>
                                <span className={`text-right ${getDiagnosticToneClass(item.tone)}`}>
                                  {item.value}
                                </span>
                              </div>
                            ))}
                          </div>
                          {bidderDiagnosticsMessage ? (
                            <div className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-white/60">
                              {bidderDiagnosticsMessage}
                            </div>
                          ) : null}
                          {(revealRecoveryRequired || refundRecoveryRequired) ? (
                            <div className="mt-3">
                              <PremiumButton
                                className="w-full"
                                onClick={handleOpenRecoveryBundlePicker}
                                variant="ghost"
                              >
                                Import Recovery Bundle
                              </PremiumButton>
                            </div>
                          ) : null}
                        </div>
                      )}

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
                            <div className="font-mono text-sm text-amber-400">Auction Status: Cancelled ({cancelReasonInfo.label})</div>
                          </div>
                          <div className="text-xs text-white/60">
                            {cancelReasonInfo.bidderSummary}
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
                            {!hasOnChainData
                              ? 'Live contract state is unavailable right now. Reload the page before attempting reveal.'
                              : !submittedCommitmentData
                              ? revealRecoveryRequired
                                ? 'Reveal window is already open for this wallet, but this browser is missing the browser-local bid data needed to reveal. Import the recovery bundle from the browser or device that placed the bid.'
                                : 'Reveal only appears for wallets that already have a confirmed bidder path for this auction.'
                              : hasRevealedBid
                                ? 'This wallet already revealed its bid. The auction remains CLOSED until the seller settles it after the reveal deadline.'
                                : isRevealPending
                                  ? `Reveal is already submitted${storedCommitmentData?.revealTransactionId ? ` (${storedCommitmentData.revealTransactionId})` : ''} and still waiting for confirmation.`
                              : revealRecoveryRequired
                                ? 'Reveal is ready for this wallet, but the saved nonce or bid bundle is missing in this browser. Import the recovery bundle to unlock reveal.'
                              : !storedNonce
                                ? 'Reveal needs the saved nonce for this wallet. If the bid was placed from another browser or the local data was cleared, import a recovery bundle to unlock reveal.'
                                : 'Reveal will appear once the contract is ready.'}
                          </div>
                          {revealRecoveryRequired ? (
                            <div className="mt-3">
                              <PremiumButton
                                className="w-full"
                                onClick={handleOpenRecoveryBundlePicker}
                                variant="ghost"
                              >
                                Import Recovery Bundle
                              </PremiumButton>
                            </div>
                          ) : null}
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
                        <div className="space-y-3">
                          <PremiumButton
                            className="w-full"
                            onClick={handleClaimRefund}
                            disabled={isSubmitting}
                            variant="secondary"
                          >
                            {isSubmitting ? 'Claiming...' : '💰 Claim Refund'}
                          </PremiumButton>
                        </div>
                      )}

                      {!canClaimRefund && refundRecoveryRequired && (
                        <div className="space-y-3 rounded-xl border border-white/10 bg-void-800 p-4">
                          <div className="font-mono text-sm text-white">Refund Availability</div>
                          <div className="text-xs leading-relaxed text-white/60">
                            This auction is already refundable for this wallet, but this browser is missing the browser-local nonce or bid bundle needed to submit the refund transaction.
                          </div>
                          <PremiumButton
                            className="w-full"
                            onClick={handleOpenRecoveryBundlePicker}
                            variant="ghost"
                          >
                            Import Recovery Bundle
                          </PremiumButton>
                        </div>
                      )}
                      
                      {/* Bidder workflow guide */}
                      {submittedCommitmentData && (
                        <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                          <div className="text-xs text-white/60">
                            <div className="font-mono text-cyan-400 mb-2">Bidder Workflow ({auctionContractVersionLabel}):</div>
                            <div className="space-y-1">
                              <div className={auction.status === 'open' ? 'text-gold-400' : 'text-white/40'}>
                                ⏳ Wait for auction to close
                              </div>
                              <div className={canRevealBid ? 'text-gold-400' : revealRecoveryRequired || (auction.status === 'closed' && !hasRevealedBid) ? 'text-white/70' : hasRevealedBid ? 'text-green-400' : 'text-white/40'}>
                                {hasRevealedBid ? '✅ Bid revealed on-chain' : '🔓 Reveal your bid'}
                              </div>
                              <div className={auction.status === 'challenge' ? 'text-gold-400' : 'text-white/40'}>
                                ⏳ Wait while challenge state is active
                              </div>
                              <div className={auction.winner?.toLowerCase() === address?.toLowerCase() && auction.status === 'settled' && !auction.itemReceived ? 'text-gold-400' : 'text-white/40'}>
                                ✅ Confirm receipt if you won
                              </div>
                              <div className={canClaimRefund ? 'text-gold-400' : refundRecoveryRequired ? 'text-white/70' : 'text-white/40'}>
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
                      Commit-Reveal Privacy
                    </div>
                    <div className="text-xs text-white/60 leading-relaxed">
                      Commitments stay sealed at the contract level until reveal, but public funding transfers can still expose the amount earlier.
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
                      Bidders cannot inspect each other's committed amounts from contract state during the bidding phase, even though funding transfers may still be public.
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
                      Losing bidders can claim refunds after settlement, and all bidders can refund on cancelled auctions such as no-reveal or reserve-not-met outcomes.
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
