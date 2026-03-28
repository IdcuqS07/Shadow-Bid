# Troubleshooting Guide

## Common Issues and Solutions

### Wallet Connection Issues

#### Problem: "Wallet not available" error
**Solutions:**
1. Ensure wallet extension is installed
2. Unlock your wallet
3. Refresh the page
4. Check wallet is connected to Aleo testnet
5. Try disconnecting and reconnecting

#### Problem: Wallet doesn't show up in connection modal
**Solutions:**
1. Install a supported wallet (Leo, Puzzle, or Fox)
2. Restart your browser
3. Check browser console for errors

### Transaction Errors

#### Problem: "Insufficient balance" error
**Solutions:**
1. Check your wallet balance
2. Get testnet credits from Aleo faucet
3. Ensure you have enough for transaction + fee (~1-2 credits)

#### Problem: Transaction stuck/pending
**Solutions:**
1. Wait 30-60 seconds for confirmation
2. Check transaction on Aleo Explorer
3. If failed, try again with higher fee
4. Ensure network is not congested

#### Problem: "Program not found" error
**Solutions:**
1. Verify `.env.local` has correct VITE_PROGRAM_ID
2. Check program is deployed on testnet
3. Ensure you're connected to testnet (not mainnet)

### Auction Creation Issues

#### Problem: Can't create auction
**Solutions:**
1. Verify all required fields are filled
2. Check minimum bid is a valid number
3. Ensure closing date is in the future
4. Confirm wallet is connected

#### Problem: Auction not showing on-chain
**Solutions:**
1. Wait for transaction confirmation (30-60 seconds)
2. Click refresh button on On-Chain Status card
3. Check transaction status on explorer
4. Verify transaction succeeded

### Bidding Issues

#### Problem: Can't submit bid
**Solutions:**
1. Verify auction is still open (not closed)
2. Check bid amount is above minimum
3. Ensure you have sufficient balance
4. Confirm auction ID is correct

#### Problem: Bid not saved locally
**Solutions:**
1. Check browser localStorage is enabled
2. Don't use private/incognito mode
3. Clear browser cache and try again
4. Transaction must succeed for bid to be saved

#### Problem: Can't see my bid amount
**Solutions:**
This is expected! Bid amounts are private on-chain.
- Your bid is saved locally in "My Bids" card
- Only you can see your bid amount
- Auctioneer sees bid records but amounts are encrypted

### Settlement Issues

#### Problem: Can't close auction
**Solutions:**
1. Verify you're the seller (auction creator)
2. Check auction is not already closed
3. Ensure auction ID is correct
4. Confirm wallet is connected

#### Problem: Can't resolve bids
**Solutions:**
1. Verify you're the auctioneer
2. Check auction is closed first
3. Ensure bid records are in correct format
4. Copy full record from wallet (including all fields)
5. Both records must have same owner (auctioneer)

#### Problem: "Invalid record format" error
**Solutions:**
1. Copy entire record from wallet
2. Don't modify the record manually
3. Ensure no extra spaces or line breaks
4. Record should be valid JSON-like format

#### Problem: Can't finish auction
**Solutions:**
1. Verify auction is closed
2. Check you have the winning bid record
3. Ensure auction is not already settled
4. Confirm auction ID matches the bid record

### Display Issues

#### Problem: On-Chain Status shows "not found"
**Solutions:**
1. Wait for transaction confirmation
2. Click refresh button
3. Verify auction was created successfully
4. Check transaction on explorer

#### Problem: Balance not updating
**Solutions:**
1. Click refresh button
2. Wait for transaction confirmation
3. Check wallet directly
4. Reconnect wallet

#### Problem: Transaction history empty
**Solutions:**
1. Ensure wallet is connected
2. Click refresh button
3. Check you have made transactions
4. Verify wallet address is correct

### Browser Issues

#### Problem: UI not loading correctly
**Solutions:**
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Try different browser
4. Check browser console for errors

#### Problem: Styles look broken
**Solutions:**
1. Ensure JavaScript is enabled
2. Clear browser cache
3. Check network connection
4. Verify all assets loaded (check Network tab)

## Error Messages Explained

### "Wallet not available"
Your wallet extension is not detected or not connected.

### "Please connect your wallet first"
You need to connect a wallet before performing this action.

### "Please fill in all fields"
Required form fields are missing or empty.

### "Insufficient balance"
You don't have enough credits for the transaction + fee.

### "Failed to fetch"
Network error - check your internet connection.

### "Transaction failed"
The blockchain transaction was rejected. Check error details.

### "Auction not found"
The auction ID doesn't exist on-chain or hasn't been created yet.

### "Invalid auction ID"
The auction ID format is incorrect (should be a number).

## Getting Help

### Before Asking for Help

1. Check this troubleshooting guide
2. Review the [User Guide](./user-guide.md)
3. Check transaction on [Aleo Explorer](https://testnet.explorer.provable.com)
4. Look at browser console for errors (F12)

### Information to Provide

When reporting issues, include:
- Transaction ID (if applicable)
- Error message (exact text)
- Steps to reproduce
- Wallet type and version
- Browser and version
- Screenshots (if relevant)

### Resources

- [Aleo Explorer](https://testnet.explorer.provable.com)
- [Aleo Documentation](https://developer.aleo.org)
- [Leo Language Guide](https://developer.aleo.org/leo)
- Project GitHub Issues

## Debug Mode

To enable detailed logging:

1. Open browser console (F12)
2. Look for `[aleoService]` logs
3. Check for error stack traces
4. Note any failed network requests

## Still Having Issues?

If you've tried everything above:

1. Open an issue on GitHub with details
2. Include all relevant information
3. Attach screenshots if helpful
4. Be patient - we'll help you resolve it!
