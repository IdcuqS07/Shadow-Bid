# ShadowBid Marketplace

Private Sealed-Bid Marketplace powered by Zero Knowledge proofs on Aleo blockchain.

## Features

- 🔒 **Private Bidding**: Bid amounts remain completely private using ZK proofs
- 🎯 **Sealed Auctions**: No one can see bid amounts until the auction is settled
- ⚡ **Aleo Blockchain**: Built on Aleo testnet with Leo smart contracts
- 🎨 **Modern UI**: Beautiful, responsive interface with dark mode
- 💼 **Wallet Integration**: Support for multiple Aleo wallet providers

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Aleo wallet (Leo Wallet, Puzzle Wallet, or Fox Wallet)

### Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.local.example .env.local

# Start development server
npm run dev
```

The app will be available at `http://localhost:3007`

### First Time User?

📚 **[Quick Start Guide](./QUICK_START.md)** - Get started in 5 minutes!

📖 **[User Guide](./USER_GUIDE.md)** - Detailed step-by-step instructions:
- Creating auctions
- Submitting sealed bids
- Settling auctions and declaring winners

### Environment Configuration

Create `.env.local` file with:

```env
VITE_ALEO_NETWORK=testnet
VITE_PROGRAM_ID=shadowbid_marketplace.aleo
VITE_AUCTIONEER_ADDRESS=aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8
VITE_API_BASE=https://api.explorer.provable.com/v1/testnet
```

## Smart Contract

The marketplace is powered by the `shadowbid_marketplace.aleo` smart contract deployed on Aleo testnet.

### Contract Functions

1. **create_auction** - Create a new sealed-bid auction
2. **place_bid** - Submit a private bid
3. **close_auction** - Close bidding period
4. **resolve** - Compare bids privately (auctioneer only)
5. **finish** - Declare winner and settle auction

See [INTEGRATION.md](./INTEGRATION.md) for detailed contract documentation.

## Usage

### For Sellers (Auctioneers)

1. Connect your Aleo wallet
2. Navigate to "Create Auction"
3. Fill in auction details (title, minimum bid, closing date)
4. Publish the auction on-chain


### For Bidders

1. Connect your Aleo wallet
2. Navigate to "Submit Bid"
3. Enter auction ID and your bid amount
4. Submit your sealed bid (amount stays private!)
5. Wait for auction to close and winner to be announced

### For Auctioneer (Settlement)

1. After auction closes, navigate to "Settlement"
2. Use the resolve function to compare bids privately
3. Declare the winner using the finish function

## Project Structure

```
shadowbid-marketplace/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/          # Page components
│   ├── services/       # Aleo service integration
│   ├── hooks/          # Custom React hooks
│   ├── contexts/       # React contexts (wallet, theme)
│   └── lib/            # Utility functions
├── public/             # Static assets
└── .env.local          # Environment configuration
```

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Technology Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Blockchain**: Aleo (Leo smart contracts)
- **Wallet**: Aleo Wallet Adaptor
- **Charts**: Recharts
- **Icons**: Lucide React

## Privacy & Security

- Bid amounts are stored in private records on Aleo blockchain
- Only the auctioneer can compare bids using ZK proofs
- Losing bids are never revealed publicly
- Winner is declared without exposing the winning amount

## Development

Built with React + Vite for fast development experience with HMR (Hot Module Replacement).

For production deployment:

```bash
npm run build
npm run preview
```

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
