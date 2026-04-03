# ShadowBid V2.23 USDCx Visibility Report

## Status

Generated from the Provable transaction API on `testnet`.

Last generated: `2026-04-03T16:56:41.053Z`

## Primary Transaction

- Tx id: `at1yez8a5zetyfzjf0pfh43zef0zjndk4hjwa9z32mza8t4q6qj8s8sz86uj6`
- Verdict: `public-amount-visible`
- Stablecoin transition count: 1
- Leak detected: `true`
- Hidden-amount-compatible shape: `false`
- Exact expected amount exposed: `true`

## Stablecoin Transition Matrix

| Transition | Public u128 inputs | Exposes public amount | Hidden-amount candidate | Output types |
| --- | --- | --- | --- | --- |
| `test_usdcx_stablecoin.aleo/transfer_public_to_private` | `4500000u128` | `true` | `false` | `record, record, future` |

## Interpretation

- This transaction visibly exposes amount data through the public path and should be treated as a leaky control or bootstrap transaction.

- Expected amount checked: `4500000u128`

## Comparison

- No comparison transaction supplied.

