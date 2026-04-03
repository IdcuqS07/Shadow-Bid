# ShadowBid Deployment Record

## Active V2.22 Deployment

- Program: `shadowbid_marketplace_v2_22.aleo`
- Network: `testnet`
- Deployed at: `2026-04-03`
- Deployment transaction: `at1puerrl94esarswkfgc0f97glpy6h03ke2zf2yzn5qtdme5rcqgysf85m38`
- Fee transaction: `at15wnry665ddtac4al2y9nr3z5v992xxz7esvju4kpp7jpxuz2avzqlcvz7n`
- Fee ID: `au1ga3k54a8lhmtts0xyjajv8n4exlh7h0rs4a6ndp9caxtzlumwu8s9cy7qh`
- Program size: `40.18 KB / 500.00 KB`
- Total fee: `53.149864 credits`

### V2.22 Highlights

- live Wave 4 privacy remediation
- closes the original code-level privacy flaws, but not full hidden-amount sealed-bid privacy
- `BHP256`-derived commit/reveal/refund verification
- `Escrow` no longer stores per-bid amounts
- active frontend target moved to `shadowbid_marketplace_v2_22.aleo`

### Local Artifacts

- JSON deployment output: `/tmp/shadowbid-v222-deploy-final.json`
- Deployment artifact: `/tmp/shadowbid-v222-deploy-final/shadowbid_marketplace_v2_22.aleo.deployment.json`
- ABI: `contracts/build/abi.json`

### V2.22 Smoke Test

Executed on `2026-04-03` against the live `v2.22` testnet deployment.

Note: the smoke test used one shared account for seller, bidder, and winner to keep CLI verification simple on testnet. The final platform-fee claim was executed separately by the platform owner wallet.

Auction A: refund path

- Auction ID: `910001001field`
- Create: `at1q6q2563vx2r4d3zjj3z3w69rntppv3x2fssmgyq09wwvh8rc4yrsskfycc`
- Fund public ALEO escrow: `at18zsz6vqy4h9y6q06gwfeqsue6h2ws0nqsfujt63tvsecu3520cqq62tv8c`
- Commit bid: `at1gq7xjjex0r5c5ktapapg7g5ythhugy35ppwppum22a4kw3g23y8s94yfkk`
- Close: `at13u45pqkw9tcny7nmseclcldyfltpvrfa38y780w6y02g7fq0xs9sst59ug`
- Timeout settlement to `CANCELLED`: `at1yekgmnppmcsgxsvjeqmj5ugsexg4j2p3zj62cqw7a5kmkcc50ygsyd6mny`
- Refund claim: `at1t6fq0xu8228pmyh7vltkumgsg3yvvcalpgnd24j5hsrwnd4yfsrss6hqnu`
- Final auction state query: `state = 4u8`, `winning_amount = 0u128`, `reserve_met = false`

Auction B: winner and payout path

- Auction ID: `910001002field`
- Create: `at199myg0fzz06wu9z0rtd3p0q9n84fqunux8cn3f22pyzsxsskssxs0ecn9h`
- Fund public ALEO escrow: `at1vmph6cglnrlj7wymhtq9kkfvdyz0kcjh7wlrl9t06fsnz65tvgqs4c63rm`
- Commit bid: `at12pe7h8wx0sctuwar3v9fwupd0q8uesx2p0j9mlq48yhy04n6syrqywyz3v`
- Close: `at1klfvjqyz9s5t8t92tv6wfq3tyenz705wjkx3q7yxc2q9sx6spsqqfe0wtv`
- Reveal bid: `at1ckhxfx2c6t50amge6mzlwzs748j08zfj2m2wt59jkh592ex2ygrq2hec0c`
- Timeout settlement to `CHALLENGE`: `at1608a968dx32she3nrgreh7nqwknezw6pxs2zdadq485tluv8aqpqp0pld3`
- Finalize winner to `SETTLED`: `at159danvdy3fuvzxjjugd72r0nk7ldk7hsnqkc06lvm73ysnl0pcpsu3gneq`
- Confirm receipt: `at1xwgpucg82zcn9nda94nge2tlqqdu4edxf9m4ecjz9qf66eekv5gsn0fshy`
- Claim seller payout: `at12hpkfnz4fvjh92t0u7wwpcg0qlzajyht67pxxn84jnjdtsxwdgpsyyd9v6`
- Intermediate auction state query after seller payout: `state = 3u8`, `winning_amount = 20000u128`, `seller_net_amount = 19500u128`, `platform_fee_amount = 500u128`, `payment_claimed = true`
- Residual contract public ALEO after seller payout: `500u64` platform fee remained claimable
- Claim platform fee: `at1f872ndnfrytnpq9smjrqd0pnhlem30sefwn4dqh6umy7ft2j558sm0yuae`
- Final auction state query after platform fee claim: `state = 3u8`, `platform_fee_claimed = true`, `platform_fee_claimed_at = 1775227827i64`, `platform_fee_amount = 500u128`, `payment_claimed = true`
- Fee transfer detail: `claim_platform_fee_aleo(910001002field, 500u64, 1775227827i64)` transferred `500u64` to platform address `aleo1lne9r7laz8r9pwmulkseuvfyem7h9f2hcelgm0me4a708h3avv8qz8ggz8`

## Historical V2.20 Deployment Record

This section records the previous `v2.20` deployment as an archive.

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
