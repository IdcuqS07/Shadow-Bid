# ShadowBid Marketplace V2.18

## Private Transactions Support (Hybrid Privacy Model)

V2.18 adds support for private transactions using Aleo's hybrid privacy model.

### What's New in V2.18

**Private Aleo Functions** ✨:
- `commit_bid_aleo_private`: Bid using private credits (Private → Public)
- `claim_refund_aleo_private`: Receive refund as private credits (Public → Private)

**Backward Compatible**:
- All V2.17 public functions still available
- Users can choose private or public flow

### Architecture: Hybrid Privacy Model

```
┌─────────────────────────────────────────────────────────────┐
│                    COMMIT BID (Private)                      │
└─────────────────────────────────────────────────────────────┘

User Private Record (5 Aleo)
         │
         │ transfer_private_to_public
         │ (ZK proof: user owns 5 Aleo)
         ↓
Contract Public Mapping
  escrow[auction_id_user] = 5 Aleo
         │
         │ (visible for settlement logic)
         ↓
    Settlement Process


┌─────────────────────────────────────────────────────────────┐
│                   CLAIM REFUND (Private)                     │
└─────────────────────────────────────────────────────────────┘

Contract Public Mapping
  escrow[auction_id_user] = 5 Aleo
         │
         │ transfer_public_to_private
         │ (ZK proof: user eligible for refund)
         ↓
User Private Record (5 Aleo)
```

### Privacy Benefits

**What's Hidden** ❌:
- User's total balance
- Balance history over time
- Private record details

**What's Visible** ✅:
- Transaction amounts (for settlement)
- Wallet addresses
- Participation in auctions

**Privacy Gain**:
- No one can track your total wealth
- No one can see your balance history
- Better privacy for serious bidders

### Functions Overview

#### Public Functions (V2.17 - Existing)

**Aleo Credits**:
- `commit_bid_aleo`: Two-step manual (user transfers first)
- `claim_refund_aleo`: Refund to public balance

**USDCx Token**:
- `commit_bid`: Single-step with `transfer_public_as_signer`
- `claim_refund`: Refund to public balance

#### Private Functions (V2.18 - New)

**Aleo Credits**:
- `commit_bid_aleo_private`: Single-step with private input
- `claim_refund_aleo_private`: Refund to private record

**USDCx Token**:
- Coming soon (need to verify token contract support)

### Usage Example

#### Commit Bid with Private Credits

```bash
# User has private credits record
leo run commit_bid_aleo_private \
    123field \                    # auction_id
    456field \                    # commitment
    "{owner: aleo1..., amount: 10000000u64, ...}" \  # private_credits record
    5000000u64                    # amount (5 Aleo)

# Returns:
# - Change record (5 Aleo remaining)
# - Escrow updated in contract mapping
```

#### Claim Refund to Private

```bash
# User claims refund
leo run claim_refund_aleo_private \
    123field \                    # auction_id
    5000000u64                    # refund_amount (5 Aleo)

# Returns:
# - Private credits record (5 Aleo)
# - Escrow marked as refunded
```

### Deployment

```bash
# Build
cd shadowbid_marketplace_v2_18
leo build

# Deploy
snarkos developer deploy \
    shadowbid_marketplace_v2_18.aleo \
    --private-key <YOUR_PRIVATE_KEY> \
    --query https://api.explorer.provable.com/v1 \
    --path ./build/ \
    --broadcast https://api.explorer.provable.com/v1/testnet/transaction/broadcast \
    --fee 10000000 \
    --record <FEE_RECORD>
```

### Testing Checklist

- [ ] Commit bid with private credits
- [ ] Verify escrow in public mapping
- [ ] Complete auction flow (close, reveal, determine, finalize)
- [ ] Claim refund to private record
- [ ] Verify private balance updated
- [ ] Test with multiple bidders (mix private/public)
- [ ] Backward compatibility: test public functions still work

### Migration from V2.17

No migration needed! V2.18 is fully backward compatible:
- All V2.17 functions still available
- Frontend can detect and use private functions when available
- Users can choose private or public flow

### Contract Address

**Testnet**: (To be deployed)

### Dependencies

- `credits.aleo` (network)
- `test_usdcx_stablecoin.aleo` (network)

### Version History

- **V2.18**: Private transactions support (Hybrid privacy model)
- **V2.17**: Dual currency support (Aleo + USDCx)
- **V2.16-V2.14**: Single-transaction attempts (failed)
- **V2.13**: Two-step manual process
- **V2.1-V2.12**: Various improvements
- **V2.0**: Initial dual currency implementation

### License

MIT
