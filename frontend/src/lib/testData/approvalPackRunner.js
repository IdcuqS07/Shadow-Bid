import { createAuction } from '@/services/aleoServiceV2';
import {
  syncAuctionRole,
  syncAuctionSnapshot,
  upsertAuctionProofBundle,
  upsertSellerVerification,
} from '@/services/localOpsService';
import {
  APPROVAL_PACK_PROGRAM_ID,
  APPROVAL_PACK_SCENARIOS,
  buildApprovalPackAuctionRecord,
  buildApprovalPackSellerVerification,
} from '@/lib/testData/onChainApprovalPack';

function loadStoredAuctions() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const parsed = JSON.parse(localStorage.getItem('myAuctions') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredAuctions(auctions) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem('myAuctions', JSON.stringify(auctions));
}

function countSyncWarnings(results) {
  return results.filter((entry) => (
    entry.status === 'rejected'
    || entry.value === null
  )).length;
}

export function buildApprovalPackProgress(scenarios = APPROVAL_PACK_SCENARIOS) {
  return scenarios.map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    status: 'pending',
    detail: scenario.detail,
    auctionId: null,
    txId: null,
    error: null,
    syncWarningCount: 0,
  }));
}

export async function createRepresentativeApprovalPack({
  address,
  executeTransaction,
  scenarios = APPROVAL_PACK_SCENARIOS,
  onScenarioUpdate,
}) {
  const sellerVerification = buildApprovalPackSellerVerification(address);
  const storedAuctions = loadStoredAuctions();
  const createdRecords = [];
  let syncWarningTotal = 0;

  try {
    await upsertSellerVerification(address, sellerVerification);
  } catch {
    syncWarningTotal += 1;
  }

  const baseAuctionId = (Date.now() * 100) + Math.floor(Math.random() * 10);

  for (const [index, scenario] of scenarios.entries()) {
    const auctionId = baseAuctionId + index + 1;
    const createdAt = Date.now();
    const endTime = Math.floor(Date.now() / 1000) + scenario.endOffsetSeconds;

    onScenarioUpdate?.(scenario, {
      status: 'awaiting-approval',
      auctionId,
      txId: null,
      error: null,
      syncWarningCount: 0,
    });

    const draftRecord = buildApprovalPackAuctionRecord({
      scenario,
      seller: address,
      sellerVerification,
      auctionId,
      endTime,
      createdAt,
      txId: null,
    });

    try {
      const result = await createAuction(
        executeTransaction,
        auctionId,
        draftRecord.inputs.minBidMicro,
        draftRecord.inputs.reservePriceMicro,
        draftRecord.inputs.currencyType,
        draftRecord.inputs.assetType,
        endTime,
        draftRecord.inputs.revealPeriod,
        draftRecord.inputs.disputePeriod,
        { programId: APPROVAL_PACK_PROGRAM_ID }
      );

      const txId = result?.transactionId || result || null;
      const finalizedRecord = buildApprovalPackAuctionRecord({
        scenario,
        seller: address,
        sellerVerification,
        auctionId,
        endTime,
        createdAt,
        txId,
      });

      let syncWarningCount = 0;

      try {
        saveStoredAuctions([...storedAuctions, finalizedRecord.metadata]);
        storedAuctions.push(finalizedRecord.metadata);
      } catch {
        syncWarningCount += 1;
      }

      const syncResults = await Promise.allSettled([
        upsertAuctionProofBundle(auctionId, finalizedRecord.proofBundle),
        syncAuctionSnapshot(finalizedRecord.snapshot),
        syncAuctionRole({
          auctionId,
          wallet: address,
          roles: ['seller'],
        }),
      ]);

      syncWarningCount += countSyncWarnings(syncResults);
      syncWarningTotal += syncWarningCount;

      createdRecords.push({
        scenarioId: scenario.id,
        auctionId,
        txId,
      });

      onScenarioUpdate?.(scenario, {
        status: 'created',
        auctionId,
        txId,
        error: null,
        syncWarningCount,
      });
    } catch (error) {
      const message = error?.message || String(error);

      onScenarioUpdate?.(scenario, {
        status: 'failed',
        auctionId,
        txId: null,
        error: message,
        syncWarningCount: 0,
      });

      return {
        createdCount: createdRecords.length,
        syncWarningTotal,
        failedScenarioTitle: scenario.title,
        error: message,
        createdRecords,
      };
    }
  }

  return {
    createdCount: createdRecords.length,
    syncWarningTotal,
    failedScenarioTitle: null,
    error: null,
    createdRecords,
  };
}
