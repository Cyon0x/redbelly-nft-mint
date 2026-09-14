#!/usr/bin/env bash
#
# Test runner with a suite-count guard.
#
# Why this exists: forge can write ABI-only artifacts ({"abi","id"} — no bytecode)
# for test contracts. `forge test` then trusts that cache, cannot deploy those
# contracts, and skips their suites *silently*, exiting 0 with a green
# "62 passed; 0 failed" that is missing two thirds of the test files.
#
# That was observed repeatedly in this repo on Foundry 1.7.1: the artifacts for
# PhysicalAsset.t.sol and GasBench.t.sol were abi-only, and only Vault01Genesis's
# 62 tests ran. `forge clean` or `forge test --force` restored all 94.
#
# A passing run that quietly omits files is the worst possible failure mode for a
# contract that will hold real funds, so the count is asserted rather than assumed.
# If you add a test file, bump EXPECTED_SUITES.

set -euo pipefail

EXPECTED_SUITES=3
EXPECTED_TESTS=94

cd "$(dirname "$0")/.."

# --force sidesteps the stale-artifact path entirely.
output=$(forge test -vv --force 2>&1) || true
echo "$output"

if ! grep -qE "Ran ${EXPECTED_SUITES} test suites" <<<"$output"; then
    actual=$(grep -oE "Ran [0-9]+ test suites" <<<"$output" | tail -1 || echo "none")
    cat >&2 <<EOF

=====================================================================
TEST SUITE COUNT MISMATCH

  expected : ${EXPECTED_SUITES} suites
  actual   : ${actual}

forge did not run every test file. This is the silent-skip failure mode
described at the top of this script — an ABI-only artifact means a suite
cannot be deployed and is dropped without an error.

Try:  forge clean && npm run contracts:test

Do NOT treat the run above as a pass.
=====================================================================
EOF
    exit 1
fi

if ! grep -qE "${EXPECTED_TESTS} tests passed" <<<"$output"; then
    echo "" >&2
    echo "WARNING: expected ${EXPECTED_TESTS} passing tests, got a different count." >&2
    echo "Tests may have been added or removed. Update EXPECTED_TESTS in this script" >&2
    echo "if that was intentional." >&2
    exit 1
fi

echo ""
echo "Guard OK: ${EXPECTED_SUITES} suites, ${EXPECTED_TESTS} tests."
