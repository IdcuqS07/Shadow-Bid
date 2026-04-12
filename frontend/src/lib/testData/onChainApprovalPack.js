import { PROGRAM_ID, inferContractVersionFromProgramId } from '@/services/aleoServiceV2';

export const APPROVAL_PACK_PROGRAM_ID = PROGRAM_ID;
export const APPROVAL_PACK_CONTRACT_VERSION = inferContractVersionFromProgramId(APPROVAL_PACK_PROGRAM_ID);
const APPROVAL_PACK_VERSION_SUFFIX = APPROVAL_PACK_CONTRACT_VERSION.replace(/[^a-z0-9]+/gi, '') || 'current';
export const APPROVAL_PACK_VERSION = `shadowbid-${APPROVAL_PACK_VERSION_SUFFIX}-approval-pack-1`;

function createSvgDataUri(label, colorA, colorB) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colorA}" />
          <stop offset="100%" stop-color="${colorB}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="900" fill="url(#g)" rx="48" />
      <circle cx="980" cy="200" r="148" fill="rgba(255,255,255,0.14)" />
      <circle cx="220" cy="700" r="180" fill="rgba(255,255,255,0.1)" />
      <text x="92" y="390" fill="white" font-family="Space Grotesk, Arial, sans-serif" font-size="70" font-weight="700">
        ${label}
      </text>
      <text x="92" y="472" fill="rgba(255,255,255,0.78)" font-family="JetBrains Mono, monospace" font-size="28">
        ShadowBid ${APPROVAL_PACK_CONTRACT_VERSION.toUpperCase()} approval pack
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createPhoto(name, label, colorA, colorB) {
  return {
    name,
    type: 'image/svg+xml',
    size: 24_576,
    data: createSvgDataUri(label, colorA, colorB),
  };
}

function createProofFile(name, type = 'application/pdf') {
  return {
    name,
    type,
    size: 98_304,
  };
}

function toMicro(amount) {
  return Math.round(amount * 1_000_000);
}

function formatDurationLabel(seconds) {
  if (seconds <= 0) {
    return 'Immediate close candidate';
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  const hours = Math.round((seconds / 60 / 60) * 10) / 10;
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

function buildAssetProof(summary, provenanceNote, authenticityGuarantee, certificateId, proofFiles) {
  return {
    summary,
    provenanceNote,
    authenticityGuarantee,
    certificateId,
    proofFiles,
  };
}

export const APPROVAL_PACK_SCENARIOS = [
  {
    id: 'example-collectibles',
    title: 'Example 01 • Rare Card Vault',
    detail: 'Sample collectible auction with proof bundle, insured handling, and USDCx pricing.',
    currency: 'USDCx',
    currencyType: 0,
    assetType: 1,
    assetLabel: 'Collectibles',
    minBid: 18,
    reservePrice: 24,
    endOffsetSeconds: 18 * 60,
    revealPeriod: 600,
    disputePeriod: 600,
    proofSummary: 'Serialized trading card bundle stored in an insured vault with grade references and serial checklist.',
    provenanceNote: 'Example auction item prepared to demonstrate collectible provenance, vault storage, and custody notes.',
    authenticityGuarantee: 'Seller guarantees the graded cards match the listed serial sheet and insured handoff process.',
    certificateId: 'EX-01-CARD',
    itemPhotos: [
      createPhoto('example-card-hero.svg', 'Rare Card Vault', '#1E293B', '#7C3AED'),
      createPhoto('example-card-detail.svg', 'Serialized Lot', '#0F172A', '#F59E0B'),
    ],
    proofFiles: [
      createProofFile('example-card-certificate.pdf'),
      createProofFile('example-card-custody.pdf'),
    ],
  },
  {
    id: 'example-digital',
    title: 'Example 02 • Genesis Access Pass',
    detail: 'Sample digital-asset listing for metadata-driven previews and ALEO pricing.',
    currency: 'ALEO',
    currencyType: 1,
    assetType: 3,
    assetLabel: 'Digital Assets',
    minBid: 7,
    reservePrice: 10,
    endOffsetSeconds: 12 * 60,
    revealPeriod: 420,
    disputePeriod: 420,
    proofSummary: 'Genesis membership pass with entitlement manifest, wallet delivery note, and metadata hash reference.',
    provenanceNote: 'Example digital asset used to show metadata-first listings without physical delivery requirements.',
    authenticityGuarantee: 'Seller guarantees the token transfer and access entitlement immediately after settlement.',
    certificateId: 'EX-02-DIGITAL',
    itemPhotos: [],
    proofFiles: [
      createProofFile('example-digital-manifest.txt', 'text/plain'),
      createProofFile('example-digital-policy.pdf'),
    ],
  },
  {
    id: 'example-physical',
    title: 'Example 03 • Limited Streetwear Crate',
    detail: 'Sample physical-goods listing with shipping notes, condition photos, and USDCx pricing.',
    currency: 'USDCx',
    currencyType: 0,
    assetType: 0,
    assetLabel: 'Physical Goods',
    minBid: 22,
    reservePrice: 30,
    endOffsetSeconds: 24 * 60,
    revealPeriod: 720,
    disputePeriod: 720,
    proofSummary: 'Factory-sealed apparel crate with packing slip, condition report, and insured courier handling.',
    provenanceNote: 'Example physical-goods auction showing photo requirements and delivery-focused proof notes.',
    authenticityGuarantee: 'Seller guarantees unopened packaging and reimbursement if the shipment arrives mismatched.',
    certificateId: 'EX-03-PHYSICAL',
    itemPhotos: [
      createPhoto('example-physical-hero.svg', 'Streetwear Crate', '#1F2937', '#F97316'),
      createPhoto('example-physical-label.svg', 'Condition Check', '#111827', '#38BDF8'),
    ],
    proofFiles: [
      createProofFile('example-physical-packing-slip.pdf'),
      createProofFile('example-physical-insurance.pdf'),
    ],
  },
  {
    id: 'example-real-estate',
    title: 'Example 04 • Coastal Land Parcel',
    detail: 'Sample real-estate auction with deed references, appraisal notes, and USAD pricing.',
    currency: 'USAD',
    currencyType: 2,
    assetType: 2,
    assetLabel: 'Real Estate',
    minBid: 250,
    reservePrice: 325,
    endOffsetSeconds: 45 * 60,
    revealPeriod: 900,
    disputePeriod: 900,
    proofSummary: 'Parcel listing with appraisal summary, zoning note, and ownership transfer checklist.',
    provenanceNote: 'Example real-estate scenario covering deed references, survey notes, and legal transfer preparation.',
    authenticityGuarantee: 'Seller guarantees the deed packet and escrow-backed support for the transfer process.',
    certificateId: 'EX-04-LAND',
    itemPhotos: [
      createPhoto('example-land-overview.svg', 'Land Parcel', '#0F172A', '#14B8A6'),
      createPhoto('example-land-map.svg', 'Survey Map', '#164E63', '#A3E635'),
    ],
    proofFiles: [
      createProofFile('example-land-appraisal.pdf'),
      createProofFile('example-land-deed.pdf'),
    ],
  },
  {
    id: 'example-services',
    title: 'Example 05 • Brand Sprint Retainer',
    detail: 'Sample services auction for milestone delivery, revisions, and payout timing guidance.',
    currency: 'USDCx',
    currencyType: 0,
    assetType: 4,
    assetLabel: 'Services',
    minBid: 35,
    reservePrice: 48,
    endOffsetSeconds: 30 * 60,
    revealPeriod: 900,
    disputePeriod: 900,
    proofSummary: 'Four-week brand sprint with scope outline, milestone calendar, and review cadence.',
    provenanceNote: 'Example service listing prepared to show non-physical delivery evidence and milestone tracking.',
    authenticityGuarantee: 'Seller guarantees source files, revision notes, and milestone handoff documentation.',
    certificateId: 'EX-05-SERVICE',
    itemPhotos: [
      createPhoto('example-service-board.svg', 'Brand Sprint', '#082F49', '#06B6D4'),
    ],
    proofFiles: [
      createProofFile('example-service-scope.pdf'),
      createProofFile('example-service-milestones.csv', 'text/csv'),
    ],
  },
  {
    id: 'example-tickets',
    title: 'Example 06 • VIP Festival Package',
    detail: 'Sample tickets and events listing with fast timing, QR transfer notes, and USAD pricing.',
    currency: 'USAD',
    currencyType: 2,
    assetType: 5,
    assetLabel: 'Tickets & Events',
    minBid: 20,
    reservePrice: 28,
    endOffsetSeconds: 16 * 60,
    revealPeriod: 480,
    disputePeriod: 480,
    proofSummary: 'VIP hospitality bundle with seat map, transfer timing, and attendee rules summary.',
    provenanceNote: 'Example event listing intended to show time-sensitive buyer messaging and proof panels.',
    authenticityGuarantee: 'Seller guarantees QR delivery before the event and escrow-backed reimbursement if invalid.',
    certificateId: 'EX-06-TICKET',
    itemPhotos: [
      createPhoto('example-ticket-stage.svg', 'VIP Access', '#172554', '#818CF8'),
      createPhoto('example-ticket-lounge.svg', 'Festival Lounge', '#581C87', '#F472B6'),
    ],
    proofFiles: [
      createProofFile('example-ticket-seatmap.pdf'),
      createProofFile('example-ticket-terms.pdf'),
    ],
  },
  {
    id: 'example-vehicles',
    title: 'Example 07 • Restored Coupe',
    detail: 'Sample vehicle auction with inspection proof, title packet, and USDCx pricing.',
    currency: 'USDCx',
    currencyType: 0,
    assetType: 6,
    assetLabel: 'Vehicles',
    minBid: 95,
    reservePrice: 125,
    endOffsetSeconds: 36 * 60,
    revealPeriod: 900,
    disputePeriod: 900,
    proofSummary: 'Restored coupe with chassis inspection, maintenance log, and handover checklist.',
    provenanceNote: 'Example vehicle listing built to show inspection evidence, title transfer steps, and delivery notes.',
    authenticityGuarantee: 'Seller guarantees title packet availability and restoration records at settlement.',
    certificateId: 'EX-07-VEHICLE',
    itemPhotos: [
      createPhoto('example-vehicle-hero.svg', 'Restored Coupe', '#422006', '#DC2626'),
      createPhoto('example-vehicle-detail.svg', 'Inspection Pack', '#111827', '#F59E0B'),
    ],
    proofFiles: [
      createProofFile('example-vehicle-inspection.pdf'),
      createProofFile('example-vehicle-title.pdf'),
    ],
  },
  {
    id: 'example-ip',
    title: 'Example 08 • Trademark License Bundle',
    detail: 'Sample intellectual-property auction with licensing docs, transfer notes, and ALEO pricing.',
    currency: 'ALEO',
    currencyType: 1,
    assetType: 7,
    assetLabel: 'Intellectual Property',
    minBid: 60,
    reservePrice: 85,
    endOffsetSeconds: 40 * 60,
    revealPeriod: 900,
    disputePeriod: 900,
    proofSummary: 'Trademark license bundle with registration references, usage scope, and assignment checklist.',
    provenanceNote: 'Example IP listing demonstrating document-heavy proof bundles and long-tail transfer guidance.',
    authenticityGuarantee: 'Seller guarantees licensing records, assignment paperwork, and escrow-backed remediation if challenged.',
    certificateId: 'EX-08-IP',
    itemPhotos: [
      createPhoto('example-ip-mark.svg', 'IP Bundle', '#312E81', '#22D3EE'),
    ],
    proofFiles: [
      createProofFile('example-ip-license.pdf'),
      createProofFile('example-ip-assignment.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ],
  },
];

export function buildApprovalPackSellerVerification(wallet) {
  const walletSuffix = typeof wallet === 'string' ? wallet.slice(-6) : 'sample';

  return {
    sellerDisplayName: `Example Seller ${walletSuffix}`,
    status: 'verified',
    tier: 'enhanced',
    issuingAuthority: 'ShadowBid Example Desk',
    certificateId: `EX-${walletSuffix.toUpperCase()}`,
    provenanceNote: `Sample ${APPROVAL_PACK_CONTRACT_VERSION.toUpperCase()} seller profile bundled with the example auction pack for guided premium-create flows.`,
    authenticityGuarantee: 'Sample seller identity and provenance notes are prefilled for demonstration purposes.',
    submittedAt: new Date().toISOString(),
  };
}

export function buildApprovalPackAuctionRecord({
  scenario,
  seller,
  sellerVerification,
  auctionId,
  endTime,
  createdAt,
  txId,
}) {
  const proofFiles = scenario.proofFiles.map((proof) => ({ ...proof }));
  const itemPhotos = scenario.itemPhotos.map((photo) => ({ ...photo }));
  const assetProof = buildAssetProof(
    scenario.proofSummary,
    scenario.provenanceNote,
    scenario.authenticityGuarantee,
    scenario.certificateId,
    proofFiles
  );
  const durationSeconds = Math.max(0, scenario.endOffsetSeconds);

  const metadata = {
    id: auctionId,
    programId: APPROVAL_PACK_PROGRAM_ID,
    version: APPROVAL_PACK_CONTRACT_VERSION,
    title: scenario.title,
    description: scenario.detail,
    minBid: String(scenario.minBid),
    reservePrice: String(scenario.reservePrice),
    currency: scenario.currency,
    assetType: scenario.assetType,
    itemPhotos,
    sellerDisplayName: sellerVerification.sellerDisplayName,
    sellerVerification,
    assetProof,
    proofFiles,
    durationValue: String(Math.max(1, Math.round(durationSeconds / 60))),
    durationUnit: 'minutes',
    durationSeconds,
    durationLabel: formatDurationLabel(scenario.endOffsetSeconds),
    creator: seller,
    createdAt,
    txId,
    isApprovalPack: true,
    approvalPackVersion: APPROVAL_PACK_VERSION,
    approvalScenarioId: scenario.id,
  };

  const snapshot = {
    id: auctionId,
    programId: APPROVAL_PACK_PROGRAM_ID,
    version: APPROVAL_PACK_CONTRACT_VERSION,
    title: scenario.title,
    description: scenario.detail,
    status: 'open',
    contractState: 'OPEN',
    seller,
    creator: seller,
    sellerDisplayName: sellerVerification.sellerDisplayName,
    winner: null,
    token: scenario.currency,
    endTimestamp: endTime,
    reservePrice: scenario.reservePrice,
    reserveMet: null,
    settledAt: 0,
    claimableAt: 0,
    itemReceived: false,
    paymentClaimed: false,
    platformFeeClaimed: false,
    winningBid: 0,
    winningAmountMicro: null,
    platformFee: 0,
    platformFeeMicro: null,
    sellerNetAmount: 0,
    sellerNetAmountMicro: null,
    totalEscrowed: 0,
    totalEscrowedMicro: 0,
    assetType: scenario.assetType,
    currencyType: scenario.currencyType,
    sellerVerification,
    assetProof: {
      summary: assetProof.summary,
      provenanceNote: assetProof.provenanceNote,
      authenticityGuarantee: assetProof.authenticityGuarantee,
      certificateId: assetProof.certificateId,
    },
    itemPhotosCount: itemPhotos.length,
    proofFilesCount: proofFiles.length,
    verificationStatus: sellerVerification.status,
    txId,
    isApprovalPack: true,
    approvalPackVersion: APPROVAL_PACK_VERSION,
    approvalScenarioId: scenario.id,
  };

  return {
    metadata,
    snapshot,
    proofBundle: {
      ...assetProof,
      seller,
      token: scenario.currency,
      assetType: scenario.assetType,
      itemPhotos,
      proofFiles,
      approvalPackVersion: APPROVAL_PACK_VERSION,
      approvalScenarioId: scenario.id,
    },
    inputs: {
      minBidMicro: toMicro(scenario.minBid),
      reservePriceMicro: toMicro(scenario.reservePrice),
      currencyType: scenario.currencyType,
      assetType: scenario.assetType,
      revealPeriod: scenario.revealPeriod,
      disputePeriod: scenario.disputePeriod,
    },
  };
}
