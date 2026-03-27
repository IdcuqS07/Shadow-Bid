# V2.19 Manual Deployment Instructions

## Prerequisites

You need:
- Your private key
- Sufficient credits for deployment (~10-20 credits)
- Leo CLI installed

## Option 1: Deploy with Environment Variable (Recommended)

```bash
cd shadowbid_marketplace_v2_19

# Set private key (replace with your actual key)
export PRIVATE_KEY="your_private_key_here"

# Deploy to testnet
leo deploy --network testnet

# Or deploy to mainnet
leo deploy --network mainnet
```

## Option 2: Deploy with .env File

1. Create `.env` file in `shadowbid_marketplace_v2_19/`:

```bash
PRIVATE_KEY=your_private_key_here
NETWORK=testnet
```

2. Deploy:

```bash
cd shadowbid_marketplace_v2_19
leo deploy --network testnet
```

## Option 3: Deploy via Leo Studio / GUI

1. Open Leo Studio
2. Load project: `shadowbid_marketplace_v2_19`
3. Connect wallet
4. Click "Deploy"
5. Select network: testnet
6. Confirm transaction

## After Deployment

### 1. Save Program ID

After successful deployment, you'll see:
```
✅ Successfully deployed 'shadowbid_marketplace_v2_19.aleo'
Program ID: shadowbid_marketplace_v2_19.aleo
```

Save this Program ID for UI integration.

### 2. Verify Deployment

Check on Aleo Explorer:
- Testnet: https://explorer.provable.com/testnet
- Search for: `shadowbid_marketplace_v2_19.aleo`

### 3. Test Functions

Test basic functions:
```bash
# Create auction (example)
leo run create_auction \
  "123456field" \
  "1000000u128" \
  "1000000u128" \
  "1u8" \
  "0u8" \
  "1234567890i64" \
  "86400i64"
```

