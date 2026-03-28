# ShadowBid Marketplace - User Guide

## Getting Started

### 1. Connect Your Wallet

Before using the marketplace, you need to connect an Aleo wallet:

- **Shield Wallet** (Recommended)
- **Puzzle Wallet**
- **Leo Wallet**
- **Fox Wallet**

Click the "Connect Wallet" button in the top right corner and select your wallet provider.

## For Sellers (Creating Auctions)

### Step 1: Create an Auction

1. Navigate to **Create Auction** page
2. Fill in the auction details:
   - **Auction Title**: Name of your auction
   - **Category**: Type of item/service
   - **Minimum Bid**: Lowest acceptable bid in credits
   - **Closing Date**: When bidding ends
   - **Description**: Details about the item/service

3. Click **Publish Auction**
4. Approve the transaction in your wallet
5. Wait for confirmation (you'll receive an AuctionRecord in your wallet)

### Step 2: Monitor Bids

- Go to **Auctions** page to see all active auctions
- Click on your auction to view details
- Check the **On-Chain Status** card for real-time blockchain data
- Note: Bid amounts are private - you won't see them until settlement

### Step 3: Close the Auction

When the bidding period ends:

1. Go to **Settlement Center**
2. In **Step 1: Close Auction**, enter your auction ID
3. Click **Close Auction**
4. Approve the transaction

## For Bidders

### Step 1: Browse Auctions

1. Go to **Auctions** page
2. Use filters to find auctions by status or search
3. Click **View Detail** to see auction information

### Step 2: Submit a Sealed Bid

1. Navigate to **Submit Bid** page
2. Enter:
   - **Auction ID**: The auction you want to bid on
   - **Bid Amount**: Your bid in credits (this stays private!)

3. Click **Commit Bid**
4. Approve the transaction in your wallet
5. Your bid is now sealed on-chain - no one can see the amount!

### Important Notes for Bidders

- ✅ Your bid amount is completely private
- ✅ Only the auctioneer can compare bids using ZK proofs
- ✅ Losing bids are never revealed
- ✅ Your bid is saved locally in your browser for reference

## For Auctioneers (Settlement)

The auctioneer is responsible for determining the winner using zero-knowledge proofs.

### Step 1: Close the Auction

(Same as seller - see above)

### Step 2: Resolve Bids (Find the Winner)

1. Go to **Settlement Center**
2. In **Step 2: Resolve Bids**:
   - Get bid records from your wallet (you own all bid records)
   - Paste two bid records into the form
   - Click **Compare Bids**
   - The higher bid will be returned to your wallet

3. Repeat this process:
   - Use the winning bid from the previous comparison
   - Compare it with the next bid
   - Continue until you've compared all bids

### Step 3: Declare the Winner

1. In **Step 3: Finish Auction**:
   - Enter the auction ID
   - Paste the final winning bid record
   - Click **Declare Winner**

2. The winner's address will be recorded on-chain
3. The winner receives a bid record with `is_winner: true`

## Privacy Features

### What's Private?

- ✅ Bid amounts (never revealed on-chain)
- ✅ Losing bids (only auctioneer sees them)
- ✅ Bid comparisons (done with ZK proofs)

### What's Public?

- ✅ Auction details (title, min bid, end date)
- ✅ Auction status (open, closed, settled)
- ✅ Winner's address (after settlement)
- ❌ Winner's bid amount (stays private!)

## Troubleshooting

### "Wallet not available" error

- Make sure your wallet extension is installed and unlocked
- Try refreshing the page
- Check that you're connected to Aleo testnet

### Transaction failed

- Ensure you have enough credits for the transaction + fee
- Check that the auction is in the correct state (open for bids, closed for settlement)
- Verify all input formats are correct

### Can't see my auction on-chain

- Wait a few moments for the transaction to be confirmed
- Click the refresh button on the On-Chain Status card
- Check the transaction on Aleo Explorer

## Tips

💡 **For Sellers**: Set a realistic minimum bid and closing date

💡 **For Bidders**: Your bid is final - make sure you're comfortable with the amount

💡 **For Auctioneers**: Keep track of all bid records in your wallet for the resolve process

💡 **Everyone**: Save transaction IDs for your records

## Support

For issues or questions:
- Check the transaction on [Aleo Explorer](https://testnet.explorer.provable.com)
- Review the [Integration Guide](./integration.md) for technical details
- Open an issue on GitHub
