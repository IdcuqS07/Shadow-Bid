# Historical ShadowBid Marketplace V2.20 Deployment Record

This file records the previous `v2.20` deployment. Use it as an archive, not as the active `v2.21` rollout note.

- Program: `shadowbid_marketplace_v2_20.aleo`
- Network: `testnet`
- Deployed at: `2026-03-28`
- Deployment transaction: `at1j52fc7l7j734327re7xnh5kp0jz6ldu0vcp53rc7kcq4s4kdpsxs7504h4`
- Fee transaction: `at1sypwrchsz7j3quxwvuz9j3vlkd7j4p30cvjameffwu52dzk0agzq038hqj`
- Fee ID: `au15lf8ftcyzhkcq2xgevmqsl6edqfvtxw076c67h5njfdgqtlmzvysh907te`
- Program size: `35.25 KB / 97.66 KB`
- Total fee: `47.158673 credits`

## V2.20 Highlights

- Secure payout assertions for seller claim and platform fee claim
- Keeper-friendly lifecycle timestamps for `close_auction`, `reveal_bid`, and `determine_winner`
- On-chain dispute transitions:
  - `open_dispute`
  - `resolve_dispute_release_seller`
  - `resolve_dispute_refund_winner`
- On-chain proof and verification anchors:
  - `upsert_seller_profile`
  - `set_auction_proof_root`

## Local Artifacts

- JSON deployment output: `build/json-outputs/deploy.json`
- ABI: `build/abi.json`
