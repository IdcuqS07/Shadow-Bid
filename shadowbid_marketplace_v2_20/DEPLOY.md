# V2.20 Deployment Guide

## Contract Information

- Program: `shadowbid_marketplace_v2_20.aleo`
- Leo version: `3.5.0`
- Platform address: `aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8`
- Status: deployed to testnet and ready for continued validation

## V2.20 Feature Set

1. Secure payout assertions for seller and platform fee claims
2. Keeper-friendly lifecycle timestamps for close, reveal, and winner determination
3. On-chain dispute handling with seller-release and winner-refund resolution paths
4. Seller profile, proof root, disclosure root, and dispute root anchors
5. Multi-currency support for Aleo credits, USDCx, and USAD

## Deployment Steps

### 1. Build the program

```bash
cd shadowbid_marketplace_v2_20
leo build
```

### 2. Deploy to testnet

```bash
cd shadowbid_marketplace_v2_20
leo deploy --network testnet
```

### 3. Verify after deployment

- Confirm the deployed program ID is `shadowbid_marketplace_v2_20.aleo`
- Check that the deployment transaction is finalized
- Inspect the generated artifacts in `build/`

## Recommended Validation Checklist

- Create an auction with a reserve price
- Commit and reveal bids in each supported currency
- Finalize the winner after the challenge window
- Confirm seller claim and platform fee claim assertions
- Exercise dispute open and resolution flows
- Validate proof-root and seller-profile updates

## Operational Notes

- `PLATFORM_FEE_RATE` is set to `250`, which equals `2.5%`
- The platform fee is claimed separately from seller proceeds
- Seller claims are gated by receipt confirmation or `claimable_at`
- Refund paths support settled and cancelled auctions where applicable

## Recovery Guidance

- Test fixes on testnet before any mainnet deployment
- If behavior is unexpected, pause new auction usage and inspect contract state
- Rebuild the contract locally before retrying deployment or migration
