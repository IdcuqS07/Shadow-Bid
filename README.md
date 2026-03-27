# ShadowBid Marketplace

A privacy-focused sealed-bid auction marketplace built on Aleo blockchain with support for Real-World Assets (RWA).

## 🎯 Features

### V2.18 (Current Production)
- ✅ Sealed-bid auction with commit-reveal pattern
- ✅ Multi-currency support (Aleo Credits, USDCx, USAD)
- ✅ Asset categorization with custom settlement timeouts
- ✅ Private bid option (experimental)
- ✅ Premium UI with glassmorphism design

### V2.19 (Ready for Deployment)
- ✅ Platform fee system (2.5%)
- ✅ Reserve price protection
- ✅ Settlement timing improvements
- ✅ Enhanced seller/winner confirmation flow

## 📁 Project Structure

```
.
├── shadowbid_marketplace_v2_18/    # Current production contract
├── shadowbid_marketplace_v2_19/    # Next version (ready to deploy)
├── shadowbid-marketplace/          # React frontend
│   ├── src/
│   │   ├── pages/                  # Premium UI pages
│   │   ├── components/             # Reusable components
│   │   └── services/               # Aleo service integration
│   └── ...
└── docs/                           # Documentation (*.md files)
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Leo compiler (for contract development)
- Aleo wallet (Puzzle, Leo, Shield, Fox, or Soter)

### Frontend Setup

```bash
cd shadowbid-marketplace
npm install
npm run dev
```

Visit `http://localhost:5173`

### Contract Deployment

```bash
cd shadowbid_marketplace_v2_19
leo build
leo deploy --network testnet
```

## 🔑 Key Contracts

- **V2.18**: `shadowbid_marketplace_v2_18.aleo` (Production)
- **V2.19**: `shadowbid_marketplace_v2_19.aleo` (Staging)

## 📚 Documentation

- [V2.19 Requirements](V2_19_REQUIREMENTS.md)
- [V2.19 Complete Summary](V2_19_COMPLETE_SUMMARY.md)
- [Testing Guide](TESTING_GUIDE_ALL_FEATURES.md)
- [Asset Categorization](ASSET_CATEGORIZATION_DESIGN.md)
- [Premium UI Guide](PREMIUM_QUICK_START.md)

## 🛣️ Roadmap

### Phase 1: Quick Wins (2 weeks)
- Notification system (in-app + email/Telegram)
- Trust panel with reserve/fee transparency
- Watchlist & saved searches
- Platform analytics dashboard

### Phase 2: Automation (1 month)
- Auto lifecycle executor
- Seller verification system
- Reputation scoring
- Dispute center MVP

### Phase 3: Advanced Features
- Selective disclosure / privacy proofs
- Private offer / Buy Now hybrid
- Proof-backed RWA profiles
- Reputation graph

## 🔐 Security

- All bids are cryptographically sealed until reveal phase
- Zero-knowledge proofs ensure privacy
- On-chain escrow for trustless transactions
- Multi-signature support for high-value items

## 🤝 Contributing

This is a private project. For collaboration inquiries, please contact the maintainer.

## 📄 License

Proprietary - All rights reserved

## 🔗 Links

- [Aleo Documentation](https://developer.aleo.org/)
- [Leo Language Guide](https://developer.aleo.org/leo/)

---

**Current Version**: V2.18 (Production) | V2.19 (Staging)  
**Last Updated**: March 27, 2026
