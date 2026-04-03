# Historical V2.20 Manual Deployment Instructions

This file is retained for archived `v2.20` deployment reference. The active repo target is now `v2.22`.

Active remediated testnet program:

- <https://testnet.explorer.provable.com/program/shadowbid_marketplace_v2_22.aleo>
- Program ID: `shadowbid_marketplace_v2_22.aleo`

## Prerequisites

- Leo CLI `4.0.0`
- Private key or wallet access for deployment
- Enough Aleo credits to pay deployment fees

## Option 1: Use an environment variable

```bash
cd contracts
export PRIVATE_KEY="your_private_key_here"
leo deploy --network testnet
```

To deploy to mainnet, replace `testnet` with `mainnet`.

## Option 2: Use a local `.env` file

Create `contracts/.env` with your local values:

```bash
PRIVATE_KEY=your_private_key_here
NETWORK=testnet
```

Then load the values in your shell and deploy:

```bash
cd contracts
source .env
leo deploy --network "${NETWORK}"
```

## Option 3: Use Leo Studio

1. Open Leo Studio.
2. Load the `contracts` project.
3. Connect the deployer wallet.
4. Choose the target network.
5. Confirm the deployment transaction.

## After Deployment

### Save the program ID

Expected program:

```text
shadowbid_marketplace_v2_22.aleo
```

### Verify on an explorer

- Testnet: <https://explorer.provable.com/testnet>
- Mainnet: <https://explorer.provable.com/>
- Active remediated program: <https://testnet.explorer.provable.com/program/shadowbid_marketplace_v2_22.aleo>
- Confirmed deployment transaction: `at1puerrl94esarswkfgc0f97glpy6h03ke2zf2yzn5qtdme5rcqgysf85m38`

### Run a local smoke test

```bash
cd contracts
leo run create_auction \
  "123456field" \
  "1000000u128" \
  "1000000u128" \
  "1u8" \
  "0u8" \
  "1234567890i64" \
  "86400i64"
```
