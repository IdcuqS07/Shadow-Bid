# Wallet Integration Guide - Premium UI

## ✅ Implementation Complete

### What Was Fixed

The "Connect Wallet" button in Premium UI now properly integrates with Aleo Wallet Adaptor.

### Changes Made

#### 1. Updated `PremiumNav.jsx`
- Replaced custom `PremiumButton` with `WalletMultiButton` from `@provablehq/aleo-wallet-adaptor-react-ui`
- Added proper wallet state management using `useWallet()` hook
- Applied premium styling to match design system

**Before:**
```jsx
<PremiumButton 
  size="sm"
  onClick={() => !connected && navigate('/premium-create')}
>
  {connected ? 'Connected' : 'Connect Wallet'}
</PremiumButton>
```

**After:**
```jsx
<div className="wallet-button-premium">
  <WalletMultiButton 
    style={{ 
      whiteSpace: 'nowrap', 
      flexShrink: 0,
      background: 'linear-gradient(135deg, #D4AF37 0%, #E5C158 100%)',
      // ... premium styling
    }} 
  />
</div>
```

#### 2. Added Premium Wallet Styling to `index.css`

Custom CSS classes for premium wallet button:
- `.wallet-button-premium` - Container styling
- `.wallet-adapter-modal-wrapper` - Modal backdrop
- `.wallet-adapter-modal` - Modal container
- `.wallet-adapter-modal-title` - Modal title
- `.wallet-adapter-modal-list-item` - Wallet options

**Design Features:**
- Gold gradient background (#D4AF37 → #E5C158)
- Glow effect on hover
- Dark glass modal with backdrop blur
- Smooth transitions
- Premium typography (JetBrains Mono)

### How It Works

#### 1. Wallet Provider Setup (Already Configured in `App.jsx`)

```jsx
<AleoWalletProvider
  wallets={[
    new ShieldWalletAdapter(),
    new PuzzleWalletAdapter(),
    new LeoWalletAdapter(),
    new FoxWalletAdapter(),
    new SoterWalletAdapter(),
  ]}
  autoConnect={true}
  network={Network.TESTNET}
  decryptPermission={DecryptPermission.OnChainHistory}
  programs={["shadowbid_marketplace_v2_17.aleo", "test_usdcx_stablecoin.aleo", "credits.aleo"]}
>
  <WalletModalProvider>
    {/* App routes */}
  </WalletModalProvider>
</AleoWalletProvider>
```

#### 2. Using Wallet in Components

```jsx
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';

function MyComponent() {
  const { connected, address, publicKey, wallet } = useWallet();
  
  if (!connected) {
    return <div>Please connect wallet</div>;
  }
  
  return <div>Connected: {address}</div>;
}
```

#### 3. Wallet Button Features

- **Not Connected**: Shows "Select Wallet" button
- **Connected**: Shows truncated address (e.g., "aleo1abc...xyz")
- **Click When Connected**: Opens dropdown with:
  - Copy Address
  - Change Wallet
  - Disconnect

### Supported Wallets

1. **Shield Wallet** (Recommended)
2. **Puzzle Wallet**
3. **Leo Wallet**
4. **Fox Wallet**
5. **Soter Wallet**

### Testing Wallet Connection

#### Step 1: Install a Wallet
- Install Shield Wallet extension from Chrome Web Store
- Or use any other supported Aleo wallet

#### Step 2: Create/Import Account
- Create new account or import existing one
- Make sure you're on Testnet

#### Step 3: Connect to App
1. Open http://localhost:3000
2. Click "Connect Wallet" button in navigation
3. Select your wallet from modal
4. Approve connection in wallet extension
5. Button should now show your address

#### Step 4: Verify Connection
```jsx
// In browser console
window.localStorage.getItem('walletName') // Should show wallet name
```

### Wallet State Management

The wallet state is managed globally by `AleoWalletProvider` and accessible via `useWallet()` hook:

```jsx
const {
  connected,      // boolean - is wallet connected?
  address,        // string - user's Aleo address
  publicKey,      // string - user's public key
  wallet,         // object - wallet adapter instance
  connect,        // function - connect wallet
  disconnect,     // function - disconnect wallet
  signMessage,    // function - sign message
  decrypt,        // function - decrypt records
  requestRecords, // function - request records
} = useWallet();
```

### Next Steps for Full Integration

#### 1. Create Auction with Wallet
```jsx
// In PremiumCreateAuction.jsx
const handleCreateAuction = async () => {
  if (!connected) {
    alert('Please connect wallet first');
    return;
  }
  
  const inputs = [
    itemName,
    startingBid,
    reservePrice,
    duration,
    // ...
  ];
  
  const txId = await wallet.requestTransaction({
    program: 'shadowbid_marketplace_v2_17.aleo',
    function: 'create_auction',
    inputs,
    fee: 1000000, // 0.001 Aleo
  });
  
  console.log('Transaction ID:', txId);
};
```

#### 2. Place Bid with Wallet
```jsx
// In PremiumAuctionDetail.jsx
const handlePlaceBid = async () => {
  if (!connected) {
    alert('Please connect wallet first');
    return;
  }
  
  const inputs = [
    auctionId,
    bidAmount,
    nonce,
  ];
  
  const txId = await wallet.requestTransaction({
    program: 'shadowbid_marketplace_v2_17.aleo',
    function: 'commit_bid',
    inputs,
    fee: 1000000,
  });
  
  console.log('Bid committed:', txId);
};
```

#### 3. Display User's Auctions
```jsx
// Fetch user's records
const records = await wallet.requestRecords({
  program: 'shadowbid_marketplace_v2_17.aleo',
});

// Filter auctions created by user
const myAuctions = records.filter(r => 
  r.data.seller === address
);
```

### Styling Customization

To customize wallet button appearance, edit `.wallet-button-premium` in `index.css`:

```css
.wallet-button-premium button {
  background: linear-gradient(135deg, #D4AF37 0%, #E5C158 100%) !important;
  /* Change colors, padding, etc. */
}
```

### Troubleshooting

#### Button Not Showing
- Check that `WalletModalProvider` wraps your app
- Verify wallet adapters are installed: `npm list @provablehq/aleo-wallet-adaptor-*`

#### Connection Fails
- Make sure wallet extension is installed
- Check that you're on correct network (Testnet)
- Try refreshing the page

#### Styling Not Applied
- Clear browser cache
- Check that `index.css` is imported in `main.jsx`
- Verify CSS classes are not overridden

### Resources

- [Aleo Wallet Adaptor Docs](https://github.com/demox-labs/aleo-wallet-adapter)
- [Shield Wallet](https://shieldwallet.io/)
- [Aleo Testnet Faucet](https://faucet.aleo.org/)

---

**Status**: ✅ Wallet Integration Complete
**Last Updated**: Wallet Fix Session
