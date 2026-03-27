# ShadowBid V2.18 - Contract-Aligned Requirements

## Status Ringkas

V2.18 sekarang sudah berada pada tahap **implemented and partially validated**:
- Contract `shadowbid_marketplace_v2_18` sudah punya settlement flow `confirm_receipt` + `claim_winning_*`
- UI premium sudah menampilkan state dan aksi utama yang memang ada di contract
- Private ALEO bid flow sudah berhasil dites end-to-end dengan Shield

Dokumen ini merapikan requirement agar sinkron dengan kondisi codebase saat ini, bukan lagi desain awal V2.17/V2.18.

---

## Tujuan V2.18

V2.18 fokus pada **sealed-bid auction yang bisa diselesaikan sampai payment release**, khususnya untuk skenario RWA dan asset category.

Scope utama:
- Commit-reveal sealed-bid auction
- Escrow on-chain
- Winner confirmation
- Seller payment claim
- Refund untuk bidder yang kalah
- Asset-category-based confirmation timeout metadata

---

## Scope Contract V2.18

### Auction states

Contract memakai state berikut:
- `OPEN`
- `CLOSED`
- `CHALLENGE`
- `SETTLED`
- `CANCELLED`

### Currencies

V2.18 mendukung:
- `USDCx`
- `ALEO`
- `USAD`

Catatan:
- Private bid saat ini hanya benar-benar dipakai untuk `ALEO`
- Private `USDCx` belum menjadi scope V2.18

### Field on-chain yang sudah ada

`AuctionInfo` di V2.18 sudah memuat:
- `asset_type`
- `item_received`
- `item_received_at`
- `payment_claimed`
- `payment_claimed_at`
- `confirmation_timeout`
- `challenge_period`
- `challenge_end_time`
- `winner`
- `winning_amount`
- `total_escrowed`

### Transition yang sudah ada

Contract V2.18 sudah memiliki:
- `create_auction`
- `cancel_auction`
- `commit_bid_*`
- `reveal_bid`
- `determine_winner`
- `finalize_winner`
- `claim_refund_*`
- `confirm_receipt`
- `claim_winning_aleo`
- `claim_winning_usdcx`
- `claim_winning_usad`

---

## Workflow V2.18

Flow yang didukung contract:

1. Seller membuat auction dengan `asset_type`
2. Bidder melakukan commit bid
3. Seller menutup auction
4. Bidder reveal bid
5. Seller determine winner
6. Seller finalize winner
7. Winner confirm receipt
8. Seller claim winning payment
9. Losing bidders claim refund

Catatan perilaku penting:
- Tie-breaker tetap `first valid reveal wins`
- Single bidder tetap bisa menjadi winner
- `min_bid_amount` bertindak sebagai floor price

---

## UI Premium yang Sudah Sinkron

### Sudah ditampilkan dan sesuai contract

- Asset category selector di create auction
- Challenge period dan confirmation timeout di auction detail
- On-chain state badge dan seller/bidder actions
- Confirm receipt button untuk winner
- Claim winning button untuk seller
- Refund button hanya untuk losing bidders
- Winner/winning amount fallback dari mapping jika struct API belum lengkap
- Timestamp settlement yang berasal dari field contract:
  - `item_received_at`
  - `payment_claimed_at`
- Role-aware settlement status card untuk seller dan winner

### Sudah diperbaiki di service/UI

- Sinkronisasi status transaksi wallet vs explorer
- False positive “Bid Placed Successfully” dari transaksi yang reject
- Private ALEO bid parsing, decrypt, dan record reuse handling
- Winner/loser display
- `highest_bid` mapping fetch

---

## Yang Bukan Scope Contract V2.18

Fitur berikut **tidak boleh dianggap contract-backed** di V2.18:
- Anti-snipe
- Platform fee
- Dispute system
- Public bid history per bidder
- Multiple auction formats selain sealed-bid
- On-chain photo storage / on-chain gallery

Catatan:
- Foto item masih bersifat UI/local metadata, bukan state contract
- Jika dipertahankan di UI, harus diperlakukan sebagai off-chain assistive metadata

---

## Checklist Status Aktual

### Smart Contract

- [x] Add `asset_type` to `AuctionInfo`
- [x] Add `confirmation_timeout` to `AuctionInfo`
- [x] Add asset type constants and timeout mapping
- [x] Add `item_received` and `item_received_at`
- [x] Add `payment_claimed` and `payment_claimed_at`
- [x] Implement `confirm_receipt`
- [x] Implement `claim_winning_aleo`
- [x] Implement `claim_winning_usdcx`
- [x] Implement `claim_winning_usad`
- [x] Carry settlement fields through auction state updates
- [ ] Harden timeout baseline so seller-claim countdown is strictly reliable

### UI

- [x] Display asset category
- [x] Display confirmation timeout
- [x] Show seller settlement actions
- [x] Show winner confirmation action
- [x] Show loser refund action
- [x] Show winner and winning amount
- [x] Show receipt/payment flags from contract
- [x] Show receipt/payment timestamps from contract
- [x] Improve seller and winner settlement status cards
- [x] Remove UI elements that are not in contract V2.18 from the premium flow
- [ ] Finish category-by-category settlement QA

### Services

- [x] `confirmReceipt(executeTransaction, auctionId)`
- [x] `claimWinningAleo(executeTransaction, auctionId, winningAmount, sellerAddress)`
- [x] `claimWinningUSDCx(executeTransaction, auctionId, winningAmount, sellerAddress)`
- [x] `claimWinningUSAD(executeTransaction, auctionId, winningAmount, sellerAddress)`
- [x] Asset-type helpers
- [x] Timeout helper fallback in UI
- [x] Winner/highest bid mapping fallback
- [x] Transaction confirmation sync for wallet + explorer

---

## Known Limitation di V2.18

Ada satu area yang masih perlu disempurnakan di versi berikutnya:

- Contract memakai `item_received_at + confirmation_timeout` untuk validasi fallback timeout seller claim
- Saat winner belum confirm, `item_received_at` bernilai `0`
- Akibatnya, countdown timeout yang benar-benar presisi belum bisa dijadikan sumber kebenaran penuh untuk UI

Artinya:
- Metadata timeout sudah ada
- Workflow confirm/claim sudah ada
- Tetapi **strict timeout-based release semantics** masih perlu dirapikan di V2.19

---

## Rekomendasi Operasional

Untuk V2.18, fokus tetap pada:
- sealed-bid correctness
- escrow correctness
- confirm receipt
- claim payment
- refund correctness
- wallet/UI sync

Yang sebaiknya ditunda ke versi lanjut:
- platform fee
- anti-snipe
- dispute resolution
- reserve price terpisah
- on-chain RWA document tracking

---

## Success Criteria V2.18

V2.18 dianggap berhasil bila:
- Seller bisa menyelesaikan auction sampai payment claim
- Winner bisa confirm receipt
- Losing bidder bisa claim refund
- UI hanya menampilkan flow yang benar-benar didukung contract
- Private ALEO bid flow berjalan tanpa false-success UI
- Settlement flags dan timestamps terbaca dari chain

---

**Last Updated:** 26 Maret 2026  
**Status:** Implemented, synced with current V2.18 contract/UI
