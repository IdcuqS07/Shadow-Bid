# Local Storage Guide

## Overview

ShadowBid Marketplace uses browser localStorage to store auction and bid data for easy reference. This data is stored locally on your device and is not synced to the blockchain or other devices.

## What's Stored Locally?

### 1. Auctions (`shadowbid_auctions`)

When you create an auction, the following information is saved:

```javascript
{
  id: "1234567890",              // Auction ID
  title: "Enterprise Router",    // Auction title
  category: "IT Infrastructure", // Category
  description: "...",            // Description
  minBid: "10 credits",          // Minimum bid
  endBlock: 5760,                // End block number
  closingDate: "12/31/2024",     // Closing date
  seller: "aleo1...",            // Your address
  txId: "at1...",                // Transaction ID
  status: "active",              // Current status
  bids: 0,                       // Number of bids
  createdAt: 1234567890,         // Timestamp
  location: "On-Chain",          // Location
  image: "https://...",          // Image URL
  highestBid: "Sealed"           // Highest bid (sealed)
}
```

### 2. Bids (`shadowbid_bids`)

When you submit a bid, the following information is saved:

```javascript
{
  auctionId: 1234567890,         // Auction ID
  txId: "at1...",                // Transaction ID
  amount: 15.5,                  // Your bid amount (private!)
  timestamp: 1234567890          // When you submitted
}
```

## Why Local Storage?

### Privacy
- Bid amounts are private on-chain (encrypted in ZK records)
- Local storage allows you to track your own bids
- Only you can see your bid amounts

### Convenience
- Quick access to your auctions
- Track your bidding activity
- No need to query blockchain for every view

### Performance
- Instant loading of your data
- Reduces blockchain queries
- Better user experience

## Important Notes

### ⚠️ Local Storage Limitations

1. **Device-Specific**: Data is only on this device/browser
2. **Not Synced**: Won't appear on other devices
3. **Can Be Cleared**: Browser cache clearing removes data
4. **Not Backup**: Always save transaction IDs separately

### ✅ Blockchain is Source of Truth

- Your auctions exist on-chain regardless of local storage
- Your bids are recorded on-chain in ZK records
- Clearing local storage does NOT affect blockchain
- You can always query blockchain for actual state

## Managing Local Data

### View Your Data

1. **Dashboard**: See "My Bids" card
2. **Auctions Page**: Your auctions appear in the list
3. **Settlement Page**: See data manager card

### Clear Local Data

1. Go to **Settlement Center**
2. Find "Local Data Storage" card
3. Click "Clear All Local Data"
4. Confirm the action

Or manually:
```javascript
// In browser console
localStorage.removeItem('shadowbid_auctions');
localStorage.removeItem('shadowbid_bids');
```

### Export Your Data

To backup your local data:

```javascript
// In browser console
const auctions = localStorage.getItem('shadowbid_auctions');
const bids = localStorage.getItem('shadowbid_bids');
console.log('Auctions:', auctions);
console.log('Bids:', bids);
// Copy and save to a file
```

### Import Data

To restore from backup:

```javascript
// In browser console
localStorage.setItem('shadowbid_auctions', 'YOUR_BACKUP_DATA');
localStorage.setItem('shadowbid_bids', 'YOUR_BACKUP_DATA');
// Refresh the page
```

## Data Flow

### Creating an Auction

1. Fill form on Create Auction page
2. Submit transaction to blockchain
3. Transaction confirmed
4. Auction saved to localStorage
5. Appears in Dashboard and Auctions page

### Submitting a Bid

1. Fill form on Submit Bid page
2. Submit transaction to blockchain
3. Transaction confirmed
4. Bid saved to localStorage
5. Bid count incremented for auction
6. Appears in "My Bids" card

### Closing an Auction

1. Submit close transaction
2. Transaction confirmed
3. Auction status updated to "pending_settlement"
4. Status reflected in UI

### Settling an Auction

1. Resolve bids (compare privately)
2. Finish auction (declare winner)
3. Auction status updated to "settled"
4. Winner recorded on-chain

## Privacy Considerations

### What's Private (Not in localStorage)

- Other users' bid amounts
- Losing bid amounts (even for auctioneer)
- Private keys or wallet data

### What's Public (Can be in localStorage)

- Your auction details
- Your bid amounts (only you see them)
- Transaction IDs
- Auction statuses

### Security Tips

1. Don't share your localStorage data
2. Use private/incognito mode for sensitive auctions
3. Clear data when using shared computers
4. Always verify on blockchain for critical operations

## Troubleshooting

### My auction doesn't appear

**Possible causes:**
- Transaction not confirmed yet
- localStorage was cleared
- Using different browser/device

**Solutions:**
- Wait for transaction confirmation
- Check transaction on Aleo Explorer
- Query blockchain directly using auction ID

### My bid count is wrong

**Possible causes:**
- Bids from other users (not tracked locally)
- localStorage cleared
- Bid submitted from different device

**Solutions:**
- Bid counts are estimates from local data
- Actual bid count is on-chain (private)
- Only auctioneer sees all bids

### Data disappeared

**Possible causes:**
- Browser cache cleared
- Using different browser/device
- Incognito/private mode closed

**Solutions:**
- Check if you have a backup
- Query blockchain using transaction IDs
- Auctions still exist on-chain

## Best Practices

1. **Save Transaction IDs**: Always note your transaction IDs
2. **Regular Backups**: Export your data periodically
3. **Verify On-Chain**: Check important transactions on explorer
4. **Use One Browser**: Stick to one browser for consistency
5. **Don't Rely Solely**: Remember blockchain is source of truth

## Technical Details

### Storage Keys

- `shadowbid_auctions`: Array of auction objects
- `shadowbid_bids`: Array of bid objects

### Data Format

Both use JSON serialization:
```javascript
JSON.parse(localStorage.getItem('shadowbid_auctions'))
```

### Size Limits

- Most browsers: 5-10 MB per domain
- Plenty for hundreds of auctions/bids
- Automatic cleanup not implemented (manual only)

## Future Enhancements

Potential improvements:
- Cloud sync (optional)
- Export/import UI
- Automatic backups
- Data migration tools
- Multi-device sync

## Questions?

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues.
