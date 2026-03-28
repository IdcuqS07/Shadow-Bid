# Troubleshooting Guide

## Wallet And Connection Issues

### Problem: Wallet not available

Solutions:

1. make sure the wallet extension is installed and unlocked
2. reconnect the wallet from the site
3. refresh the page
4. confirm the wallet is using Aleo testnet

### Problem: `Decrypt permission denied`

This usually happens when a private ALEO bid tries to read Shield records without the required wallet permission.

Solutions:

1. disconnect Shield from the site
2. reconnect it
3. retry the private ALEO bid
4. approve the private-record or decrypt request when Shield prompts
5. if needed, fall back to the public ALEO flow

### Problem: `Program not found`

Solutions:

1. verify `VITE_PROGRAM_ID=shadowbid_marketplace_v2_21.aleo`
2. verify `VITE_API_BASE` points to the intended network explorer
3. make sure the wallet and app are both targeting testnet

## Auction Creation Issues

### Problem: Cannot create auction

Solutions:

1. verify all required fields are filled
2. check that minimum bid and reserve are valid numbers
3. ensure the end time is in the future
4. confirm reveal and dispute periods are set
5. make sure the wallet is connected and funded

### Problem: Auction appears in UI but not from explorer reads

Solutions:

1. wait for transaction confirmation
2. refresh the auction page
3. check the transaction on Aleo Explorer
4. verify the correct program ID and auction ID are being used

## Bid And Reveal Issues

### Problem: Cannot place a bid

Solutions:

1. verify the auction is still `OPEN`
2. check the bid amount is above the minimum
3. confirm you have enough balance and fee budget
4. verify the wallet supports the selected currency path

### Problem: Private ALEO bid keeps failing

Solutions:

1. make sure Shield exposes private credits to the app
2. refresh wallet records
3. reconnect Shield if the session was connected without decrypt access
4. verify you actually hold a spendable private ALEO record
5. if the issue persists, use the public ALEO flow

### Problem: Reveal button is missing

Common causes:

- the auction is not yet `CLOSED`
- the reveal deadline already passed
- the bid was placed from another browser or wallet
- local nonce or commitment data was cleared

Solutions:

1. make sure the seller already closed the auction
2. confirm the current wallet matches the wallet that submitted the bid
3. reveal from the same browser session when possible
4. restore the saved nonce and commitment data if you backed them up

### Problem: Bid exists on-chain, but reveal still cannot proceed

Solutions:

1. check local storage for `nonce_<auctionId>_<wallet>`
2. check local storage for `commitment_<auctionId>_<wallet>`
3. avoid clearing browser data before reveal
4. verify the reveal deadline has not expired

## Settlement Issues

### Problem: Cannot close auction

Solutions:

1. verify you are the seller
2. make sure the auction is still `OPEN`
3. make sure the end time has passed
4. confirm the wallet supports transaction execution

### Problem: Cannot settle after reveal timeout

Solutions:

1. verify the auction is `CLOSED`
2. wait until `reveal_deadline`
3. refresh the auction state before retrying

### Problem: Cannot finalize winner

Solutions:

1. verify the auction is in `CHALLENGE`
2. wait until `dispute_deadline`
3. check whether an on-chain dispute is still active
4. refresh the auction detail page and retry

### Problem: Seller cannot claim payment yet

Solutions:

1. verify the auction is `SETTLED`
2. wait for winner receipt confirmation, or
3. wait until `claimable_at`
4. refresh the auction state before retrying

### Problem: Platform fee claim is unavailable

Solutions:

1. verify seller payment was already claimed
2. make sure the platform owner wallet is connected
3. confirm the platform fee has not already been claimed

## Ops Console Issues

### Problem: `/ops` is empty

Common causes:

- no premium auction pages have synced snapshots yet
- the shared Ops API is offline
- the wrong wallet is connected

Solutions:

1. open premium auction pages first so snapshots sync
2. verify the Ops API health endpoint
3. if local, run `npm run dev:api`
4. if production, confirm the app can reach `https://api.shadowbid.xyz`

## Browser And Display Issues

### Problem: The site still shows an old version after deploy

Solutions:

1. hard refresh the page
2. open the site with a cache-busting query string
3. clear the browser cache if needed

### Problem: Balances do not match the wallet right away

Solutions:

1. refresh the wallet connection
2. wait for transaction confirmation
3. reconnect the wallet if the balance source looks stale

## Information To Collect When Reporting A Bug

Include:

- transaction ID, if available
- exact error message
- wallet type
- browser version
- route you were using
- whether the issue happened on premium or standard pages
- whether the same browser session was used for both bid and reveal
