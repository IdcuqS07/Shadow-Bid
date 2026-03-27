# ARC-21 Token Registry Solution for V2.5

## Problem Summary

**Current Issue**: Cross-program call dari `shadowbid_marketplace_v2_5.aleo` ke `test_usdcx_stablecoin.aleo` tidak bisa transfer token dari user karena caller context adalah program, bukan user.

**Root Cause**: Aleo tidak support dynamic cross-program calls. Ketika program A memanggil program B, caller di program B adalah program A, bukan user yang execute transaction.

## Solution: Use ARC-21 Token Registry

### What is ARC-21 Token Registry?

**Official Program**: `token_registry.aleo`

ARC-21 adalah standard "hub" untuk semua token di Aleo. Ini menyelesaikan masalah composability dengan cara:

1. **Single Hub**: Semua token register ke `token_registry.aleo`
2. **Unified Interface**: DeFi programs hanya perlu import `token_registry.aleo`, tidak perlu import setiap token program
3. **No Redeployment**: Token baru bisa ditambahkan tanpa redeploy DeFi programs
4. **Privacy Benefits**: Semua transfer via registry, meningkatkan anonymity set

### Key Functions for Our Use Case

#### 1. Transfer Public (User → Contract)
```leo
token_registry.aleo/transfer_public(
    public token_id: field,
    public recipient: address,
    public amount: u128
)
```

#### 2. Transfer Public As Signer (Contract → User)
```leo
token_registry.aleo/transfer_public_as_signer(
    public token_id: field,
    public recipient: address,
    public amount: u128
)
```

**Key Difference**: `transfer_public_as_signer` allows program to transfer on behalf of the transaction signer!

### How It Works

#### Current V2.5 (Broken)
```
User executes commit_bid
  ↓
shadowbid_marketplace_v2_5.aleo calls test_usdcx_stablecoin.aleo/transfer_public
  ↓
Caller = shadowbid_marketplace_v2_5.aleo (program has 0 balance)
  ↓
❌ Transfer fails
```

#### With Token Registry (Working)
```
User executes commit_bid
  ↓
shadowbid_marketplace_v2_5.aleo calls token_registry.aleo/transfer_public_as_signer
  ↓
Registry transfers on behalf of transaction signer (user)
  ↓
✅ Transfer succeeds
```

## Implementation Plan

### Step 1: Check if USDCx is Registered

First, verify if `test_usdcx_stablecoin.aleo` is registered in token registry:

```bash
# Get USDCx token ID
curl "https://api.explorer.provable.com/v1/testnet/program/token_registry.aleo/mapping/registered_tokens/<TOKEN_ID>"
```

If not registered, we need to register it first (or use a different token that's already registered).

### Step 2: Modify Smart Contract

**V2.6 Implementation** (using Token Registry):

```leo
import token_registry.aleo;

program shadowbid_marketplace_v2_6.aleo {
    
    // USDCx token ID in registry
    const USDCX_TOKEN_ID: field = <TOKEN_ID>field;
    
    // Commit Bid with Token Registry
    async transition commit_bid(
        public auction_id: u64,
        public commitment: field,
        public amount_usdx: u128
    ) -> Future {
        // Transfer USDCx from user to contract via registry
        let usdx_transfer: Future = token_registry.aleo/transfer_public_as_signer(
            USDCX_TOKEN_ID,
            self.address,  // receiver: contract address
            amount_usdx
        );
        
        return finalize_commit_bid(
            auction_id,
            commitment,
            self.signer,
            amount_usdx,
            usdx_transfer
        );
    }
    
    // Pay Seller via Token Registry
    async transition pay_seller(
        public auction_id: u64,
        public seller: address,
        public amount: u128
    ) -> Future {
        // Transfer USDCx from contract to seller via registry
        let usdx_payment: Future = token_registry.aleo/transfer_public_as_signer(
            USDCX_TOKEN_ID,
            seller,
            amount
        );
        
        return finalize_pay_seller(usdx_payment);
    }
    
    // Process Refund via Token Registry
    async transition process_refund(
        public bidder: address,
        public amount: u128
    ) -> Future {
        // Transfer USDCx from contract to loser via registry
        let usdx_refund: Future = token_registry.aleo/transfer_public_as_signer(
            USDCX_TOKEN_ID,
            bidder,
            amount
        );
        
        return finalize_process_refund(usdx_refund);
    }
    
    // ... rest of the functions remain the same
}
```

### Step 3: Update Frontend

**No changes needed!** Frontend code remains the same because:
- User still calls `commit_bid`, `pay_seller`, `process_refund`
- Contract handles token registry internally
- User only needs permission for `shadowbid_marketplace_v2_6.aleo`

### Step 4: Testing

1. Deploy V2.6 contract
2. Test commit bid → Should transfer USDCx from user to contract
3. Test pay seller → Should transfer USDCx from contract to seller
4. Test refund → Should transfer USDCx from contract to loser

## Advantages of Token Registry Approach

### 1. Composability ✅
- No need to import specific token programs
- Works with any token registered in registry
- Future tokens work without redeployment

### 2. Privacy ✅
- All transfers via registry improve anonymity set
- Token identity concealed in private transfers

### 3. Standardization ✅
- Official Aleo standard (ARC-21)
- Used by all production DeFi apps
- Community approved

### 4. Flexibility ✅
- Support both public and private transfers
- Can convert between public/private
- Approval mechanism for delegated transfers

## Migration Path

### Option A: Use Token Registry (Recommended)
1. Verify USDCx is registered in token registry
2. Deploy V2.6 with token registry integration
3. Test thoroughly
4. Production ready

### Option B: Stay with V2.4 (Fallback)
1. Use metadata-only approach
2. No real token transfers
3. Simpler but less realistic

## Next Steps

1. **Check USDCx Registration**: Verify if `test_usdcx_stablecoin.aleo` is in token registry
2. **Get Token ID**: Find the token_id for USDCx in registry
3. **Implement V2.6**: Modify contract to use token registry
4. **Deploy & Test**: Deploy V2.6 and test all flows
5. **Production**: Ready for mainnet with official standard

## References

- [ARC-21 Token Registry Documentation](https://developer.aleo.org/guides/standards/token_registry)
- [Token Registry Source Code](https://github.com/AleoHQ/ARCs/tree/master/arc-0021)
- [Aleo Developer Docs - Token Standards](https://developer.aleo.org/guides/solidity-to-leo/token-standard-difference)

---

**Status**: Solution Identified ✅  
**Next**: Verify USDCx registration and implement V2.6  
**Date**: March 20, 2026
