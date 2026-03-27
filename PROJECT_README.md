# Private Sealed-Bid Marketplace

Aplikasi lelang berbasis zero-knowledge proofs di Aleo blockchain.

## Struktur Proyek

```
Bid Market/
├── frontend/           # Next.js web application
├── smart-contract/     # Leo smart contract
└── backend/           # (Optional) API server
```

## Setup & Installation

### 1. Smart Contract (Leo)

```bash
cd smart-contract
leo build
leo deploy
```

### 2. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Buka browser: http://localhost:3000

## Fitur Utama

### Smart Contract Functions

- **create_auction()** - Membuat lelang baru
- **submit_bid()** - Submit bid dengan commitment
- **reveal_bid()** - Reveal bid setelah auction close
- **close_auction()** - Menutup lelang
- **settle_auction()** - Menentukan pemenang

### Auction Flow

1. **Create Auction**: Seller membuat lelang dengan min_bid dan duration
2. **Submit Commitment**: Bidder submit `hash(bid_amount || secret)`
3. **Close Auction**: Auction ditutup setelah duration habis
4. **Reveal Bid**: Bidder reveal bid dengan secret
5. **Determine Winner**: Smart contract verifikasi dan tentukan pemenang

## Commitment Scheme

```
commitment = BHP256::hash_to_field(bid_amount) + secret
```

Ini memastikan:
- Bid tetap private sampai reveal phase
- Tidak ada yang bisa mengubah bid setelah submit
- Zero-knowledge verification

## Tech Stack

- **Blockchain**: Aleo
- **Smart Contract**: Leo
- **Frontend**: Next.js 14 + React
- **Wallet**: Aleo Wallet Adapter

## Development

```bash
# Install dependencies
cd frontend && npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start
```

## Deployment

### Smart Contract
```bash
leo deploy --network testnet
```

### Frontend
```bash
npm run build
# Deploy ke Vercel/Netlify
```

## Security Features

- ✅ Zero-knowledge proofs
- ✅ Private bids (sealed until reveal)
- ✅ Commitment-reveal scheme
- ✅ On-chain verification
- ✅ Tamper-proof auction

## License

MIT
