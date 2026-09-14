# Vault01Genesis — Contracts

Foundry project for the VAULT 01 Genesis Collection ERC-721 contract deployed on
Redbelly Network Mainnet (chain 151).

## Commands

```bash
forge build                                # compile
npm run contracts:test                     # full suite + suite-count guard (from repo root)
cd .. && npm run contracts:test            # same, if you're already in contracts/
forge test -vv --force                     # what the npm script runs under the hood
npm run contracts:gas                      # gas report (from repo root)
forge fmt                                  # format
```

The npm test script (`script/test.sh`) asserts that all 3 suites / 94 tests actually
ran. That guard exists because forge can write ABI-only artifacts for test contracts
and then silently skip their suites with a green exit code — see the header comment
in `script/test.sh`.

## Layout

```
src/
  Vault01Genesis.sol        The collection contract
  interfaces/IRedbellyAccess.sol
test/
  Vault01Genesis.t.sol      Core mint / config / access tests
  PhysicalAsset.t.sol       Watch binding, serials, redemption
  GasBench.t.sol            Gas measurements behind README cost figures
script/
  Deploy.s.sol              Deploy + preflight (registry check, funding check)
  verify.sh                 Routescan verification
  test.sh                   Test runner with the suite-count guard
```

## Gas (measured on Redbelly mainnet, ~199,410 gwei base fee)

See the root README for the full cost table — the numbers there come from the gas
bench in `test/GasBench.t.sol` and real mainnet receipts.

## Security notes

- Solidity 0.8.28, OpenZeppelin 5.7.0
- Redbelly identity enforcement in-contract (defense in depth under protocol permissioning)
- `ReentrancyGuard` on `mint` and `withdraw`; checks-effects-interactions ordering
- Exact-payment enforcement: `IncorrectPayment` on both over- and underpayment
- Watch redemption is holder-only and irreversible; `unassignPhysicalAsset` refuses
  once redeemed, so the claim record can never be erased
