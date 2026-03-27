# ShadowBid Premium UI - Visual Guide

## 🎯 Current Status: V2.17 Production + V3.0 Preview

### Navigation Structure

```
/ (root)                    → Premium Landing Page
/premium-auctions           → Browse Auctions (Premium UI)
/premium-auction/:id        → Auction Detail (Premium UI)
/premium-create             → Create Auction (Premium UI)
/feature-comparison         → V2.17 vs V3.0 Comparison
/standard/*                 → Standard UI (legacy)
```

### Badge System

#### ✅ Available Now (V2.17)
- Green badge with checkmark
- Indicates fully functional features
- Example: Sealed-Bid Auctions, Dual Currency, Commit-Reveal

#### 🔮 Coming Soon (V3.0)
- Purple badge
- Indicates features in development
- Example: Vickrey, Dutch, English auctions, Dispute Resolution

### Key Pages Overview

#### 1. Premium Landing (`/`)
- Hero section with animated background
- Feature grid showing V2.17 (available) vs V3.0 (coming soon)
- Stats: 40% lower gas, 4 formats, 100% privacy
- CTA buttons: "Launch App" and "View Features"

#### 2. Premium Auction List (`/premium-auctions`)
- Version notice banner at top
- Asymmetric grid layout
- "View V3.0 →" button links to feature comparison
- Shows only V2.17 sealed-bid auctions

#### 3. Premium Auction Detail (`/premium-auction/:id`)
- V2.17 badge on auction card
- Two-step Aleo process explanation (Commit → Reveal)
- V3.0 features preview card with "Coming Soon" badges
- "View V3.0 Features →" button

#### 4. Premium Create Auction (`/premium-create`)
- Format selector: 1 available (Sealed-Bid), 3 coming soon
- Dual currency support (Aleo Credits + USDCx)
- Fee summary showing 0% current fee (V2.17)
- Platform fee (2%) marked as "Coming Soon"

#### 5. Feature Comparison (`/feature-comparison`)
- Side-by-side comparison table
- V2.17: 15 features (all available)
- V3.0: 22 features (7 additional coming soon)
- Visual badges for each feature

### Design System

#### Colors
- Base: Void Dark (#0A0B0F, #0D0E14, #12131A)
- Accent: Gold (#D4AF37, #E5C158)
- Highlight: Cyan (#00E5FF, #00B8D4)
- Success: Green (#10B981)
- Coming Soon: Purple (#A855F7, #C084FC)

#### Typography
- Display: Space Grotesk (headings)
- Body: Inter (paragraphs)
- Mono: JetBrains Mono (code, data)

#### Components
- GlassCard: Glass morphism with backdrop blur
- PremiumButton: Gold gradient with shine effect
- ComingSoonBadge: Purple badge for V3.0 features
- StatusBadge: Animated status indicators

### User Flow

1. **Landing** → User sees premium design + feature overview
2. **Browse** → User views available V2.17 auctions
3. **Create** → User creates sealed-bid auction (V2.17)
4. **Bid** → Two-step process: Commit → Reveal
5. **Compare** → User can view V3.0 roadmap

### V2.17 Features (Available Now)

✅ Sealed-Bid Auctions
✅ Zero-Knowledge Proofs
✅ Dual Currency (Aleo + USDCx)
✅ Commit-Reveal Mechanism
✅ Private Bidding
✅ Escrow System
✅ Automatic Settlement
✅ Refund System
✅ Cancel Auction
✅ Bid Tracking
✅ Auction Status
✅ Time-Based Expiry
✅ Winner Selection
✅ Gas Optimization
✅ On-Chain Verification

### V3.0 Features (Coming Soon)

🔮 Vickrey Auctions (Second-Price)
🔮 Dutch Auctions (Descending Price)
🔮 English Auctions (Ascending Price)
🔮 Anti-Sniping Mechanism
🔮 Dispute Resolution
🔮 Selective Disclosure (ZK Social Proof)
🔮 Platform Fee System

### Technical Notes

- Port: 3000
- Framework: React + Vite
- Styling: Tailwind CSS + Custom Design Tokens
- Wallet: Aleo Wallet Adaptor
- Network: Testnet
- Contract: shadowbid_marketplace_v2_17.aleo

### Development Commands

```bash
cd shadowbid-marketplace
npm run dev          # Start dev server (port 3000)
npm run build        # Build for production
npm run preview      # Preview production build
```

### Important Rules

1. ❌ No "Demo" badges - use "Coming Soon" instead
2. ❌ No "Demo" links in navigation
3. ✅ All features are either V2.17 (available) or V3.0 (coming soon)
4. ✅ Premium UI is default (root `/` route)
5. ✅ Standard UI moved to `/standard/*`

### Next Steps

1. Connect wallet integration
2. Implement V2.17 contract calls
3. Add real auction data from blockchain
4. Test commit-reveal flow
5. Deploy to production
6. Begin V3.0 development

---

**Last Updated**: Context Transfer Session
**Status**: Production-Ready UI with V2.17 + V3.0 Preview
