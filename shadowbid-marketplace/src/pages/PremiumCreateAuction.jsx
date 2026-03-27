import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { useMultiCurrencyBalance } from '@/hooks/useMultiCurrencyBalance';
import {
  calculatePlatformFee,
  calculateSellerNetAmount,
  createAuction,
  getCurrentTimestamp,
  hashJsonToField,
  setAuctionProofRootOnChain,
  upsertSellerProfileOnChain,
} from '@/services/aleoServiceV2';
import {
  syncAuctionRole,
  syncAuctionSnapshot,
  upsertAuctionProofBundle,
  upsertSellerVerification,
} from '@/services/localOpsService';
import GlassCard from '@/components/premium/GlassCard';
import PremiumButton from '@/components/premium/PremiumButton';
import PremiumInput from '@/components/premium/PremiumInput';
import PremiumSelect from '@/components/premium/PremiumSelect';
import PremiumNav from '@/components/premium/PremiumNav';
import {
  ArrowLeft,
  Shield,
  Info,
  CheckCircle,
  Upload,
  X,
  Image as ImageIcon,
  Zap,
  BadgeCheck,
  FileText,
} from 'lucide-react';

const DURATION_PRESETS = [
  { label: '5m', value: '5', unit: 'minutes' },
  { label: '15m', value: '15', unit: 'minutes' },
  { label: '30m', value: '30', unit: 'minutes' },
  { label: '1h', value: '1', unit: 'hours' },
  { label: '3h', value: '3', unit: 'hours' },
  { label: '6h', value: '6', unit: 'hours' },
  { label: '12h', value: '12', unit: 'hours' },
  { label: '24h', value: '24', unit: 'hours' },
];

const DURATION_UNIT_OPTIONS = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
];

function getDurationSeconds(value, unit) {
  const parsedValue = parseInt(value, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return 0;
  }

  if (unit === 'minutes') {
    return parsedValue * 60;
  }

  if (unit === 'days') {
    return parsedValue * 24 * 3600;
  }

  return parsedValue * 3600;
}

function getDurationLabel(value, unit) {
  const parsedValue = parseInt(value, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return 'Invalid duration';
  }

  const singularUnit = unit === 'days'
    ? 'day'
    : unit === 'minutes'
      ? 'minute'
      : 'hour';

  return `${parsedValue} ${parsedValue === 1 ? singularUnit : `${singularUnit}s`}`;
}

function parseDisplayAmount(value) {
  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
}

function microToDisplayAmount(value) {
  const numericValue = Number.parseInt(String(value || '0'), 10);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return numericValue / 1_000_000;
}

function formatAmount(value) {
  if (!Number.isFinite(value)) {
    return '0.00';
  }

  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function mapVerificationStatusToU8(status) {
  switch (status) {
    case 'verified':
      return 2;
    case 'submitted':
      return 1;
    default:
      return 0;
  }
}

function mapVerificationTierToU8(tier) {
  switch (tier) {
    case 'institutional':
      return 2;
    case 'enhanced':
      return 1;
    default:
      return 0;
  }
}

export default function PremiumCreateAuction() {
  const navigate = useNavigate();
  const { connected, address, executeTransaction } = useWallet();
  const { balances, loading: balancesLoading, formatBalance } = useMultiCurrencyBalance();
  
  // V2.18 is now default - no need to set version
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    format: 'sealed',
    minBid: '',
    reservePrice: '',
    durationValue: '24',
    durationUnit: 'hours',
    currency: 'ALEO',
    assetType: '0', // NEW: Asset category (0-7)
    sellerDisplayName: '',
    verificationStatus: 'pending',
    verificationTier: 'standard',
    issuingAuthority: '',
    certificateId: '',
    provenanceNote: '',
    proofSummary: '',
    authenticityGuarantee: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemPhotos, setItemPhotos] = useState([]); // NEW: Item photos for RWA
  const [supportingProofs, setSupportingProofs] = useState([]);

  const minimumBidAmount = parseDisplayAmount(formData.minBid);
  const reserveBasisAmount = formData.reservePrice
    ? parseDisplayAmount(formData.reservePrice)
    : minimumBidAmount;
  const referenceSettlementAmount = reserveBasisAmount > 0 ? reserveBasisAmount : minimumBidAmount;
  const referenceWinningAmountMicro = Math.round(referenceSettlementAmount * 1_000_000);
  const projectedPlatformFee = referenceWinningAmountMicro > 0
    ? microToDisplayAmount(calculatePlatformFee(referenceWinningAmountMicro))
    : 0;
  const projectedSellerNet = referenceWinningAmountMicro > 0
    ? microToDisplayAmount(calculateSellerNetAmount(referenceWinningAmountMicro))
    : 0;
  const durationLabel = getDurationLabel(formData.durationValue, formData.durationUnit);
  const reserveVisibilityLabel = formData.reservePrice
    ? `${formatAmount(reserveBasisAmount)} ${formData.currency}`
    : minimumBidAmount > 0
      ? `Falls back to min bid (${formatAmount(minimumBidAmount)} ${formData.currency})`
      : 'Uses min bid if reserve is left blank';

  const auctionFormats = [
    {
      id: 'sealed',
      name: 'Sealed-Bid',
      description: 'All bids hidden until reveal. Most private.',
      icon: Shield,
      color: 'gold',
      available: true,
      version: 'V2.20',
    },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🔥 FORM SUBMIT TRIGGERED');
    
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }
    
    if (!formData.title || !formData.minBid) {
      alert('Please fill in all required fields');
      return;
    }

    const durationSeconds = getDurationSeconds(formData.durationValue, formData.durationUnit);
    if (durationSeconds < 60) {
      alert('Please choose a duration of at least 1 minute.');
      return;
    }

    if (durationSeconds > 30 * 24 * 3600) {
      alert('Please choose a duration shorter than 30 days.');
      return;
    }
    
    // Check if photos required for RWA (not Digital Assets)
    const assetType = parseInt(formData.assetType);
    if (assetType !== 3 && itemPhotos.length === 0) {
      alert('⚠️ Photo Required\n\nPlease upload at least one photo of the item for RWA verification.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Generate auction ID from timestamp
      const auctionId = Date.now();
      
      // Convert currency to type: 0=USDCx, 1=Aleo, 2=USAD
      const currencyType = formData.currency === 'ALEO' ? 1 : formData.currency === 'USDCx' ? 0 : 2;
      
      // Convert min bid to micro units (multiply by 1,000,000)
      const minBidMicro = Math.floor(parseFloat(formData.minBid) * 1_000_000);
      
      // Calculate end time using flexible units for easier testing.
      const endTime = Math.floor(Date.now() / 1000) + durationSeconds;
      
      // V2.20 now enforces lifecycle windows on-chain.
      // Keep the default shorter on testnet so close -> reveal -> determine -> finalize remains demo-friendly.
      const challengePeriod = Number.parseInt(import.meta.env.VITE_CHALLENGE_PERIOD_SECONDS || '900', 10);
      
      console.log('📝 Creating auction with params:', {
        auctionId,
        minBidMicro,
        currencyType,
        currency: formData.currency,
        endTime,
        challengePeriod,
        title: formData.title,
      });
      
      // Check if executeTransaction is available
      if (!executeTransaction) {
        throw new Error('Wallet does not support transactions. Please try reconnecting your wallet.');
      }
      
      console.log('✅ executeTransaction available, calling createAuction...');
      
      // V2.19: Calculate reserve price in micro units
      const reservePriceMicro = formData.reservePrice 
        ? Math.round(parseFloat(formData.reservePrice) * 1_000_000)
        : minBidMicro; // Default to minBid if not set
      
      // Call smart contract
      const result = await createAuction(
        executeTransaction,
        auctionId,
        minBidMicro,
        reservePriceMicro,                    // V2.19 NEW: Reserve price
        currencyType,
        parseInt(formData.assetType),         // Asset type
        endTime,
        challengePeriod
      );
      
      console.log('✅ Auction created successfully:', result);

      const sellerVerification = {
        sellerDisplayName: formData.sellerDisplayName || null,
        status: formData.verificationStatus || 'pending',
        tier: formData.verificationTier || 'standard',
        issuingAuthority: formData.issuingAuthority || null,
        certificateId: formData.certificateId || null,
        provenanceNote: formData.provenanceNote || null,
        authenticityGuarantee: formData.authenticityGuarantee || null,
        submittedAt: new Date().toISOString(),
      };

      const assetProof = {
        summary: formData.proofSummary || null,
        provenanceNote: formData.provenanceNote || null,
        authenticityGuarantee: formData.authenticityGuarantee || null,
        certificateId: formData.certificateId || null,
        proofFiles: supportingProofs,
      };
      
      // Save auction metadata to localStorage
      const auctionMetadata = {
        id: auctionId,
        title: formData.title,
        description: formData.description,
        minBid: formData.minBid,
        reservePrice: formData.reservePrice,
        currency: formData.currency,
        assetType: parseInt(formData.assetType), // NEW: Save asset type
        itemPhotos: itemPhotos, // NEW: Save item photos
        sellerDisplayName: formData.sellerDisplayName,
        sellerVerification,
        assetProof,
        proofFiles: supportingProofs,
        duration: formData.durationValue,
        durationValue: formData.durationValue,
        durationUnit: formData.durationUnit,
        durationSeconds,
        durationLabel: getDurationLabel(formData.durationValue, formData.durationUnit),
        creator: address,
        createdAt: Date.now(),
        txId: result?.transactionId || result,
      };
      
      const existingAuctions = JSON.parse(localStorage.getItem('myAuctions') || '[]');
      existingAuctions.push(auctionMetadata);
      localStorage.setItem('myAuctions', JSON.stringify(existingAuctions));

      const anchorWarnings = [];
      try {
        const profileRoot = await hashJsonToField({
          seller: address,
          sellerDisplayName: sellerVerification.sellerDisplayName,
          issuingAuthority: sellerVerification.issuingAuthority,
          certificateId: sellerVerification.certificateId,
          provenanceNote: sellerVerification.provenanceNote,
          authenticityGuarantee: sellerVerification.authenticityGuarantee,
        });
        const proofRoot = await hashJsonToField({
          auctionId,
          summary: assetProof.summary,
          provenanceNote: assetProof.provenanceNote,
          authenticityGuarantee: assetProof.authenticityGuarantee,
          certificateId: assetProof.certificateId,
          proofFileNames: supportingProofs.map((proof) => proof.name),
          itemPhotoNames: itemPhotos.map((photo) => photo.name),
        });
        const disclosureRoot = await hashJsonToField({
          auctionId,
          token: formData.currency,
          assetType: parseInt(formData.assetType, 10),
          reservePrice: formData.reservePrice || formData.minBid,
          proofSummary: formData.proofSummary,
        });

        auctionMetadata.onChainProfileRoot = profileRoot;
        auctionMetadata.onChainProofRoot = proofRoot;
        auctionMetadata.onChainDisclosureRoot = disclosureRoot;

        await upsertSellerProfileOnChain(
          executeTransaction,
          mapVerificationStatusToU8(formData.verificationStatus),
          mapVerificationTierToU8(formData.verificationTier),
          profileRoot,
          getCurrentTimestamp() + (90 * 24 * 3600),
          getCurrentTimestamp()
        );

        await setAuctionProofRootOnChain(
          executeTransaction,
          auctionId,
          proofRoot,
          disclosureRoot
        );
      } catch (anchorError) {
        console.error('⚠️ Failed to anchor V2.20 proof metadata on-chain:', anchorError);
        anchorWarnings.push(anchorError.message || String(anchorError));
      }

      await Promise.allSettled([
        upsertSellerVerification(address, sellerVerification),
        upsertAuctionProofBundle(auctionId, {
          ...assetProof,
          itemPhotos,
          seller: address,
          token: formData.currency,
          assetType: parseInt(formData.assetType, 10),
        }),
        syncAuctionSnapshot({
          id: auctionId,
          title: formData.title,
          status: 'open',
          contractState: 'OPEN',
          seller: address,
          winner: null,
          token: formData.currency,
          endTimestamp: endTime,
          reservePrice: parseFloat(formData.reservePrice || formData.minBid || '0'),
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
          assetType: parseInt(formData.assetType, 10),
          currencyType,
          itemPhotosCount: itemPhotos.length,
          proofFilesCount: supportingProofs.length,
          verificationStatus: sellerVerification.status,
        }),
        syncAuctionRole({
          auctionId,
          wallet: address,
          roles: ['seller'],
        }),
      ]);

      localStorage.setItem('myAuctions', JSON.stringify(existingAuctions));
      
      alert(
        `✅ Auction Created Successfully!\n\nAuction ID: ${auctionId}\nTransaction submitted to blockchain.` +
        (anchorWarnings.length > 0
          ? `\n\n⚠️ V2.20 proof anchoring was skipped:\n${anchorWarnings.join('\n')}`
          : `\n\nV2.20 seller profile and proof roots were also anchored on-chain.`)
      );
      
      // Navigate to auction list
      navigate('/premium-auctions');
      
    } catch (error) {
      console.error('❌ Error creating auction:', error);
      alert(`❌ Failed to create auction:\n\n${error.message || error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleButtonClick = (e) => {
    console.log('🔥 BUTTON CLICKED', e);
    console.log('Connected:', connected);
    console.log('Title:', formData.title);
    console.log('MinBid:', formData.minBid);
    console.log('Is Submitting:', isSubmitting);
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const selectDurationPreset = (value, unit) => {
    setFormData((prev) => ({
      ...prev,
      durationValue: value,
      durationUnit: unit,
    }));
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    
    // Limit to 5 photos
    if (itemPhotos.length + files.length > 5) {
      alert('⚠️ Maximum 5 photos allowed');
      return;
    }
    
    // Convert to base64 for localStorage
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        alert(`⚠️ ${file.name} is too large. Maximum 5MB per photo.`);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setItemPhotos(prev => [...prev, {
          name: file.name,
          data: event.target.result,
          size: file.size,
          type: file.type
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index) => {
    setItemPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleProofUpload = (e) => {
    const files = Array.from(e.target.files || []);

    if (supportingProofs.length + files.length > 5) {
      alert('⚠️ Maximum 5 proof files allowed');
      return;
    }

    files.forEach((file) => {
      if (file.size > 8 * 1024 * 1024) {
        alert(`⚠️ ${file.name} is too large. Maximum 8MB per proof file.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setSupportingProofs((prev) => [...prev, {
          name: file.name,
          data: event.target.result,
          size: file.size,
          type: file.type,
        }]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const removeProof = (index) => {
    setSupportingProofs((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-void-900 text-white">
      {/* Header */}
      <PremiumNav />
      
      <div className="border-b border-white/5 backdrop-blur-xl">
        <div className="max-w-[1200px] mx-auto px-8 py-6">
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
      <div className="max-w-[1200px] mx-auto px-8 py-12">
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-5xl font-display font-bold">Create Auction</h1>
            {/* Version Badge */}
            <div className="px-3 py-1 bg-gold-500/10 border border-gold-500/30 rounded-lg">
              <span className="text-xs font-mono text-gold-400">
                V2.20 • Security • Dispute • RWA
              </span>
            </div>
          </div>
          <p className="text-white/60 text-lg">
            Launch a private sealed-bid auction with zero-knowledge proofs
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-12 gap-8">
            {/* Left Column - Main Form */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              {/* Basic Info */}
              <GlassCard className="p-8">
                <h2 className="text-2xl font-display font-bold mb-6">Basic Information</h2>
                
                <div className="space-y-6">
                  <PremiumInput
                    label="Auction Title"
                    value={formData.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    placeholder="e.g., Rare Digital Asset #001"
                    required
                  />

                  <div>
                    <label className="block text-sm font-mono text-white/60 uppercase tracking-wider mb-3">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      placeholder="Describe your item..."
                      rows={4}
                      className="w-full px-6 py-4 bg-void-800 !bg-void-800 border border-white/10 rounded-xl text-white !text-white font-mono placeholder:text-white/30 focus:border-gold-500/50 focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:bg-void-800 transition-all resize-none"
                      style={{
                        backgroundColor: '#12141A',
                        color: '#ffffff',
                        backgroundImage: 'none',
                      }}
                      required
                    />
                  </div>

                  {/* Asset Category Selector - NEW for V2.19 */}
                  <div>
                    <label className="block text-sm font-mono text-white/60 uppercase tracking-wider mb-3">
                      Asset Category
                      <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 border border-green-500/40 rounded text-xs font-mono text-green-400">
                        <CheckCircle className="w-3 h-3" />
                        V2.20
                      </span>
                    </label>
                    <select
                      value={formData.assetType}
                      onChange={(e) => updateField('assetType', e.target.value)}
                      className="w-full px-6 py-4 bg-void-800 border border-white/10 rounded-xl text-white font-mono focus:border-gold-500/50 focus:outline-none focus:ring-2 focus:ring-gold-500/20 transition-all appearance-none cursor-pointer"
                      style={{
                        backgroundColor: '#12141A',
                        backgroundImage: 'none',
                      }}
                    >
                      <option value="0">📦 Physical Goods (14 days timeout)</option>
                      <option value="1">🎨 Collectibles (21 days timeout)</option>
                      <option value="2">🏠 Real Estate (90 days timeout)</option>
                      <option value="3">💎 Digital Assets (3 days timeout)</option>
                      <option value="4">💼 Services (30 days timeout)</option>
                      <option value="5">🎫 Tickets & Events (7 days timeout)</option>
                      <option value="6">🚗 Vehicles (30 days timeout)</option>
                      <option value="7">📜 Intellectual Property (90 days timeout)</option>
                    </select>
                    
                    {/* Category Description */}
                    <div className="mt-3 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-white/60 leading-relaxed">
                          {formData.assetType === '0' && 'Physical goods require shipping and delivery confirmation. Winner has 14 days to confirm receipt after delivery.'}
                          {formData.assetType === '1' && 'Collectibles may require authentication. Winner has 21 days to confirm receipt and verify authenticity.'}
                          {formData.assetType === '2' && 'Real estate requires legal documentation and title transfer. Winner has 90 days for legal process completion.'}
                          {formData.assetType === '3' && 'Digital assets can be transferred instantly on-chain. Winner has 3 days to confirm receipt and verify.'}
                          {formData.assetType === '4' && 'Services are delivered over time with milestones. Winner has 30 days to confirm completion.'}
                          {formData.assetType === '5' && 'Tickets are time-sensitive. Winner has 7 days to confirm receipt before event date.'}
                          {formData.assetType === '6' && 'Vehicles require inspection and title transfer. Winner has 30 days for inspection and registration.'}
                          {formData.assetType === '7' && 'Intellectual property requires legal transfer and IP registration. Winner has 90 days for legal process.'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Item Photos Upload - Required for RWA (except Digital Assets) */}
                  {formData.assetType !== '3' && (
                    <div>
                      <label className="block text-sm font-mono text-white/60 uppercase tracking-wider mb-3">
                        Item Photos
                        <span className="ml-2 text-red-400">*</span>
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 border border-green-500/40 rounded text-xs font-mono text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          V2.20
                        </span>
                      </label>
                      
                      {/* Upload Button */}
                      <div className="mb-4">
                        <label className="block cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                          <div className="p-6 bg-void-800 border-2 border-dashed border-white/10 rounded-xl hover:border-gold-500/50 transition-all text-center">
                            <Upload className="w-8 h-8 text-white/40 mx-auto mb-3" />
                            <div className="font-mono text-sm text-white/60 mb-1">
                              Click to upload photos
                            </div>
                            <div className="text-xs text-white/40">
                              Max 5 photos, 5MB each (JPG, PNG, WebP)
                            </div>
                          </div>
                        </label>
                      </div>
                      
                      {/* Photo Preview Grid */}
                      {itemPhotos.length > 0 && (
                        <div className="grid grid-cols-3 gap-3">
                          {itemPhotos.map((photo, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={photo.data}
                                alt={photo.name}
                                className="w-full h-32 object-cover rounded-lg border border-white/10"
                              />
                              <button
                                type="button"
                                onClick={() => removePhoto(index)}
                                className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-4 h-4 text-white" />
                              </button>
                              <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm rounded px-2 py-1">
                                <div className="text-xs text-white/80 truncate">{photo.name}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Photo Count */}
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-white/40 font-mono">
                          {itemPhotos.length} / 5 photos uploaded
                        </span>
                        {itemPhotos.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setItemPhotos([])}
                            className="text-red-400 hover:text-red-300 font-mono transition-colors"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                      
                      {/* Info Notice */}
                      <div className="mt-3 p-4 bg-gold-500/10 border border-gold-500/30 rounded-xl">
                        <div className="flex items-start gap-3">
                          <ImageIcon className="w-5 h-5 text-gold-400 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-white/60 leading-relaxed">
                            <span className="text-gold-400 font-mono">RWA Verification:</span> Photos help bidders verify the item's condition and authenticity. Clear photos increase bidder confidence.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Digital Assets - No Photos Required */}
                  {formData.assetType === '3' && (
                    <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-white/60 leading-relaxed">
                          <span className="text-cyan-400 font-mono">Digital Assets:</span> Photos not required. Digital assets are verified on-chain through token records.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </GlassCard>

              <GlassCard className="p-8">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-display font-bold">Seller Verification & Asset Proof</h2>
                    <p className="mt-2 text-sm text-white/60">
                      Integrated seller trust and proof fields for RWA ownership evidence, verification, and dispute readiness.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-mono uppercase tracking-wider text-cyan-300">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    UI Integrated
                  </span>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <PremiumInput
                      label="Seller Display Name"
                      value={formData.sellerDisplayName}
                      onChange={(e) => updateField('sellerDisplayName', e.target.value)}
                      placeholder="e.g., Nusantara Heritage Vault"
                    />

                    <PremiumSelect
                      label="Verification Status"
                      value={formData.verificationStatus}
                      onChange={(e) => updateField('verificationStatus', e.target.value)}
                      options={[
                        { value: 'pending', label: 'Pending review' },
                        { value: 'submitted', label: 'Submitted evidence' },
                        { value: 'verified', label: 'Verified seller' },
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <PremiumSelect
                      label="Verification Tier"
                      value={formData.verificationTier}
                      onChange={(e) => updateField('verificationTier', e.target.value)}
                      options={[
                        { value: 'standard', label: 'Standard' },
                        { value: 'enhanced', label: 'Enhanced KYB' },
                        { value: 'institutional', label: 'Institutional' },
                      ]}
                    />

                    <PremiumInput
                      label="Issuing Authority"
                      value={formData.issuingAuthority}
                      onChange={(e) => updateField('issuingAuthority', e.target.value)}
                      placeholder="e.g., Local notary / appraisal office"
                    />

                    <PremiumInput
                      label="Certificate / Deed ID"
                      value={formData.certificateId}
                      onChange={(e) => updateField('certificateId', e.target.value)}
                      placeholder="DOC-2026-001"
                    />
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-mono uppercase tracking-wider text-white/60">
                      Proof Summary
                    </label>
                    <textarea
                      value={formData.proofSummary}
                      onChange={(e) => updateField('proofSummary', e.target.value)}
                      placeholder="Summarize the ownership proof, item condition, provenance, and any third-party verification."
                      rows={3}
                      className="w-full resize-none rounded-xl border border-white/10 bg-void-800 px-6 py-4 font-mono text-white placeholder:text-white/30 focus:border-gold-500/50 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                      style={{
                        backgroundColor: '#12141A',
                        color: '#ffffff',
                        backgroundImage: 'none',
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label className="mb-3 block text-sm font-mono uppercase tracking-wider text-white/60">
                        Provenance Note
                      </label>
                      <textarea
                        value={formData.provenanceNote}
                        onChange={(e) => updateField('provenanceNote', e.target.value)}
                        placeholder="Chain of custody, ownership history, or off-chain registration trail."
                        rows={3}
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
                        Authenticity Guarantee
                      </label>
                      <textarea
                        value={formData.authenticityGuarantee}
                        onChange={(e) => updateField('authenticityGuarantee', e.target.value)}
                        placeholder="Return policy, guarantee period, or legal commitment for authenticity."
                        rows={3}
                        className="w-full resize-none rounded-xl border border-white/10 bg-void-800 px-6 py-4 font-mono text-white placeholder:text-white/30 focus:border-gold-500/50 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                        style={{
                          backgroundColor: '#12141A',
                          color: '#ffffff',
                          backgroundImage: 'none',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-mono uppercase tracking-wider text-white/60">
                      Supporting Proof Files
                    </label>

                    <label className="block cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf,image/*,.doc,.docx,.txt"
                        multiple
                        onChange={handleProofUpload}
                        className="hidden"
                      />
                      <div className="rounded-xl border-2 border-dashed border-white/10 bg-void-800 p-6 text-center transition-all hover:border-cyan-500/50">
                        <FileText className="mx-auto mb-3 h-8 w-8 text-white/40" />
                        <div className="font-mono text-sm text-white/60">Upload deed, certificate, appraisal, or custody proof</div>
                        <div className="mt-1 text-xs text-white/40">Max 5 files, 8MB each</div>
                      </div>
                    </label>

                    {supportingProofs.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {supportingProofs.map((proof, index) => (
                          <div
                            key={`${proof.name}-${index}`}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-void-800 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-mono text-sm text-white">{proof.name}</div>
                              <div className="mt-1 text-xs text-white/40">
                                {(proof.size / (1024 * 1024)).toFixed(2)} MB
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeProof(index)}
                              className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/20"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <Info className="mt-0.5 h-5 w-5 text-cyan-400" />
                      <div className="text-xs leading-relaxed text-white/65">
                        Seller profile roots and proof roots are anchored to V2.20. Full documents, supporting files,
                        and evidence references are kept in the app data layer for richer UI panels and ops workflows.
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Auction Format */}
              <GlassCard className="p-8">
                <h2 className="text-2xl font-display font-bold mb-6">Auction Format</h2>
                
                <div className="grid grid-cols-2 gap-4">
                  {auctionFormats.length === 1 && (
                    <div className="col-span-2 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-xs text-white/60">
                      Contract V2.20 currently supports sealed-bid auctions only.
                    </div>
                  )}
                  {auctionFormats.map((format) => (
                    <button
                      key={format.id}
                      type="button"
                      onClick={() => format.available && updateField('format', format.id)}
                      disabled={!format.available}
                      className={`p-6 rounded-xl border-2 transition-all text-left relative ${
                        formData.format === format.id
                          ? 'border-gold-500 bg-gold-500/10'
                          : format.available
                          ? 'border-white/10 bg-void-800 hover:border-white/20'
                          : 'border-white/5 bg-void-800/50 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {!format.available && (
                        <div className="absolute top-3 right-3">
                          <span className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-mono uppercase tracking-wider text-white/50">
                            Not Live
                          </span>
                        </div>
                      )}
                      
                      {/* Available Badge */}
                      {format.available && (
                        <div className="absolute top-3 right-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 border border-green-500/40 rounded text-xs font-mono text-green-400 uppercase tracking-wider">
                            <CheckCircle className="w-3 h-3" />
                            {format.version}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          formData.format === format.id
                            ? 'bg-gold-500/20'
                            : format.available
                            ? 'bg-white/5'
                            : 'bg-white/5 opacity-50'
                        }`}>
                          <format.icon className={`w-6 h-6 ${
                            formData.format === format.id 
                              ? 'text-gold-500' 
                              : format.available
                              ? 'text-white/40'
                              : 'text-white/20'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="font-display font-bold mb-1">{format.name}</div>
                          <div className="text-xs text-white/60">{format.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                
                {/* Info Notice */}
                <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-cyan-400 mt-0.5" />
                    <div className="text-xs text-white/60">
                      <span className="text-cyan-400 font-mono">Privacy-First:</span> The active V2.20 contract exposes sealed-bid auction creation only, so this UI is locked to the same format.
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Pricing */}
              <GlassCard className="p-8">
                <h2 className="text-2xl font-display font-bold mb-6">Pricing</h2>
                
                {/* Currency Selector */}
                <div className="mb-6">
                  <PremiumSelect
                    label="Currency"
                    value={formData.currency || 'ALEO'}
                    onChange={(e) => updateField('currency', e.target.value)}
                    options={[
                      { value: 'ALEO', label: 'Aleo' },
                      { value: 'USDCx', label: 'USDCx' },
                      { value: 'USAD', label: 'USAD' },
                    ]}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <PremiumInput
                    label="Minimum Bid"
                    value={formData.minBid}
                    onChange={(e) => updateField('minBid', e.target.value)}
                    placeholder="0.00"
                    suffix={formData.currency || 'ALEO'}
                    type="number"
                    required
                  />

                  <PremiumInput
                    label="Reserve Price"
                    value={formData.reservePrice}
                    onChange={(e) => updateField('reservePrice', e.target.value)}
                    placeholder="0.00"
                    suffix={formData.currency || 'ALEO'}
                    type="number"
                    hint="Optional - Enforced on settlement, not hidden on-chain"
                  />
                </div>

                <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-cyan-400 mt-0.5" />
                    <div className="text-xs text-white/60">
                      <span className="text-cyan-400 font-mono">V2.20</span> supports 3 currencies: Aleo Credits, USDCx, and USAD.
                      <span className="text-cyan-400 font-mono"> Reserve Price</span> is enforced during settlement, and platform fees are calculated automatically on the winning bid.
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Duration */}
              <GlassCard className="p-8">
                <h2 className="text-2xl font-display font-bold mb-6">Duration</h2>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {DURATION_PRESETS.map((preset) => (
                    <button
                      key={`${preset.value}-${preset.unit}`}
                      type="button"
                      onClick={() => selectDurationPreset(preset.value, preset.unit)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.durationValue === preset.value && formData.durationUnit === preset.unit
                          ? 'border-gold-500 bg-gold-500/10'
                          : 'border-white/10 bg-void-800 hover:border-white/20'
                      }`}
                    >
                      <div className="text-2xl font-display font-bold mb-1">{preset.label}</div>
                      <div className="text-xs font-mono text-white/60">
                        {preset.unit === 'minutes' ? 'testing' : 'standard'}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
                  <PremiumInput
                    label="Manual Duration"
                    value={formData.durationValue}
                    onChange={(e) => updateField('durationValue', e.target.value)}
                    placeholder="24"
                    type="number"
                    min="1"
                    max="43200"
                  />
                  <PremiumSelect
                    label="Unit"
                    value={formData.durationUnit}
                    onChange={(e) => updateField('durationUnit', e.target.value)}
                    options={DURATION_UNIT_OPTIONS}
                  />
                </div>

                <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                  <div className="font-mono text-sm text-cyan-400 mb-1">Testing-friendly duration</div>
                  <div className="text-xs text-white/60">
                    Use minutes, hours, or days. Current setting: {getDurationLabel(formData.durationValue, formData.durationUnit)}.
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Right Column - Settings & Preview */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              {/* Wallet Balance */}
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-display font-bold">Wallet Balance</h3>
                  {balancesLoading && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                      <span className="text-xs font-mono text-cyan-400">Syncing...</span>
                    </div>
                  )}
                </div>
                
                {connected ? (
                  <div className="space-y-4">
                    {/* Aleo Balance */}
                    <div className="p-4 bg-void-800 rounded-xl border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-mono text-white/60">Aleo</span>
                        <span className="text-xs font-mono text-white/40">Available</span>
                      </div>
                      <div className="text-2xl font-display font-bold text-gold-500">
                        {balancesLoading ? (
                          <span className="text-white/40">Loading...</span>
                        ) : (
                          <>
                            {formatBalance(balances.ALEO)} <span className="text-lg text-white/40">ALEO</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* USDCx Balance */}
                    <div className="p-4 bg-void-800 rounded-xl border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-mono text-white/60">USDCx</span>
                        <span className="text-xs font-mono text-white/40">Available</span>
                      </div>
                      <div className="text-2xl font-display font-bold text-cyan-500">
                        {balancesLoading ? (
                          <span className="text-white/40">Loading...</span>
                        ) : (
                          <>
                            {formatBalance(balances.USDCx)} <span className="text-lg text-white/40">USDCx</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* USAD Balance */}
                    <div className={`p-4 bg-void-800 rounded-xl border border-white/5 ${balances.USAD === null ? 'opacity-50' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-mono text-white/60">USAD</span>
                        {balances.USAD === null ? (
                          <span className="text-xs font-mono text-white/40">Unavailable</span>
                        ) : (
                          <span className="text-xs font-mono text-white/40">Available</span>
                        )}
                      </div>
                      <div className="text-2xl font-display font-bold text-white/40">
                        {balancesLoading ? (
                          <span className="text-white/40">Loading...</span>
                        ) : balances.USAD === null ? (
                          <>--- <span className="text-lg text-white/40">USAD</span></>
                        ) : (
                          <span className="text-blue-500">
                            {formatBalance(balances.USAD)} <span className="text-lg text-white/40">USAD</span>
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-white/5">
                      <div className="text-xs text-white/40 font-mono break-all">
                        {address ? `${address.slice(0, 12)}...${address.slice(-8)}` : 'Not connected'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-full flex items-center justify-center">
                      <Zap className="w-8 h-8 text-white/40" />
                    </div>
                    <p className="text-sm text-white/60 mb-4">
                      Connect your wallet to view balances
                    </p>
                    <p className="text-xs text-white/40 mb-4">
                      Click the "Connect Wallet" button in the navigation bar
                    </p>
                  </div>
                )}
              </GlassCard>
              
              {/* Privacy Settings */}
              <GlassCard className="p-6">
                <h3 className="text-xl font-display font-bold mb-6">Privacy Settings</h3>
                
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/5 bg-void-800 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm">Sealed Commit-Reveal</span>
                          <span className="inline-flex items-center gap-1 rounded border border-green-500/40 bg-green-500/20 px-2 py-0.5 text-xs font-mono text-green-400">
                            <CheckCircle className="h-3 w-3" />
                            V2.20 Live
                          </span>
                        </div>
                        <div className="text-xs text-white/60">
                          Bid commitments stay hidden until reveal. This is the real privacy model enforced by the contract.
                        </div>
                      </div>
                      <span className="font-mono text-sm text-cyan-300">Enabled</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-void-800 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm">Reserve Price Visibility</span>
                          <span className="inline-flex items-center gap-1 rounded border border-green-500/40 bg-green-500/20 px-2 py-0.5 text-xs font-mono text-green-400">
                            <CheckCircle className="h-3 w-3" />
                            Contract-backed
                          </span>
                        </div>
                        <div className="text-xs text-white/60">
                          Reserve protection is active in V2.20, but the reserve itself is not hidden by the contract.
                        </div>
                      </div>
                      <span className="font-mono text-right text-sm text-gold-400">{reserveVisibilityLabel}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-void-800 p-4 opacity-75">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm">Anti-Snipe Extension</span>
                          <span className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-mono uppercase tracking-wider text-white/50">
                            Not Live
                          </span>
                        </div>
                        <div className="text-xs text-white/60">
                          Last-minute bid extension is not part of the V2.20 contract yet. Auction timing follows the duration and close flow shown above.
                        </div>
                      </div>
                      <span className="font-mono text-sm text-white/40">Not available</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-cyan-400 mt-0.5" />
                    <div>
                      <div className="font-mono text-sm text-cyan-400 mb-1">
                        Contract Reality
                      </div>
                      <div className="text-xs text-white/60">
                        V2.20 privacy comes from sealed bid commitments and the reveal window. Reserve hiding and anti-snipe are not configurable on-chain in the current contract.
                      </div>
                    </div>
                  </div>
                </div>
                
              </GlassCard>

              {/* Fee Summary */}
              <GlassCard className="p-6">
                <h3 className="text-xl font-display font-bold mb-6">Fee Summary</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Selected Currency</span>
                    <span className="font-mono text-gold-500">{formData.currency || 'ALEO'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Platform Fee</span>
                    <span className="font-mono text-gold-400">2.5%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Reference Settlement Amount</span>
                    <span className="font-mono text-cyan-300">
                      {referenceSettlementAmount > 0
                        ? `${formatAmount(referenceSettlementAmount)} ${formData.currency}`
                        : 'Enter min bid or reserve'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Projected Platform Fee</span>
                    <span className="font-mono text-gold-400">
                      {referenceWinningAmountMicro > 0
                        ? `${formatAmount(projectedPlatformFee)} ${formData.currency}`
                        : 'Pending input'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Projected Seller Net</span>
                    <span className="font-mono text-green-400">
                      {referenceWinningAmountMicro > 0
                        ? `${formatAmount(projectedSellerNet)} ${formData.currency}`
                        : 'Pending input'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Create Flow</span>
                    <span className="font-mono text-white">Up to 3 tx</span>
                  </div>
                  <div className="pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between font-bold">
                      <span>Wallet Network Fee</span>
                      <span className="font-mono text-gold-500">Estimated at signing</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <div className="text-xs text-white/60">
                    <span className="text-cyan-400 font-mono">Reference basis:</span> the preview uses your reserve price when present, otherwise it falls back to the minimum bid floor.
                  </div>
                </div>
                
                <div className="mt-2 p-3 bg-gold-500/10 border border-gold-500/30 rounded-lg">
                  <div className="text-xs text-white/60">
                    <span className="text-gold-400 font-mono">Settlement model:</span> platform fee is deducted automatically from the final winning bid when the auction settles, not paid upfront during creation.
                  </div>
                </div>

                <div className="mt-2 p-3 bg-white/5 border border-white/10 rounded-lg">
                  <div className="text-xs text-white/60">
                    <span className="text-white font-mono">Submission path:</span> create auction, anchor seller profile, and anchor proof roots. Actual network fees depend on wallet estimation and testnet conditions.
                  </div>
                </div>
              </GlassCard>

            </div>
          </div>

          {/* Submit Button - Outside Grid */}
          <div className="mt-8 relative" style={{ zIndex: 9999, position: 'relative' }}>
            <div 
              className="max-w-[800px] mx-auto"
              style={{ 
                pointerEvents: 'auto',
                position: 'relative',
                zIndex: 9999,
              }}
            >
              <PremiumButton 
                type="submit"
                onClick={handleButtonClick}
                className="w-full"
                style={{ pointerEvents: 'auto', position: 'relative', zIndex: 9999 }}
                disabled={!connected || !formData.title || !formData.minBid || isSubmitting}
              >
                {isSubmitting ? 'Creating...' : connected ? 'Create Auction' : 'Connect Wallet'}
              </PremiumButton>

              {!connected && (
                <div className="text-center text-sm text-white/60 font-mono mt-4">
                  Connect your wallet to create an auction
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
