#!/usr/bin/env bash
#
# Verify RedbellyGenesis on Routescan after deployment.
#
# Routescan exposes an Etherscan-compatible verification API per network. The
# mainnet (chain 151) endpoint was confirmed reachable during development.
#
# Usage — from the contracts/ directory:
#
#   NFT_ADDRESS=0x... \
#   COLLECTION_NAME="Redbelly Genesis" \
#   COLLECTION_SYMBOL="RBGEN" \
#   MAX_SUPPLY=500 \
#   MINT_PRICE_WEI=0 \
#   MAX_PER_WALLET=5 \
#   ACCESS_REGISTRY=0xcb385cD90ca6b219798F57B4a7958897e91A9163 \
#   OWNER_ADDRESS=0x... \
#   ROYALTY_RECEIVER=0x... \
#   ROYALTY_BPS=500 \
#   UNREVEALED_URI="ipfs://placeholder/prereveal.json" \
#   ./script/verify.sh
#
# Every constructor argument must match the deployment EXACTLY or verification
# fails — that is the whole point of the check.

set -euo pipefail

: "${NFT_ADDRESS:?Set NFT_ADDRESS to the deployed contract address}"
: "${OWNER_ADDRESS:?Set OWNER_ADDRESS to the owner passed at deployment}"

: "${COLLECTION_NAME:=Redbelly Genesis}"
: "${COLLECTION_SYMBOL:=RBGEN}"
: "${MAX_SUPPLY:=500}"
: "${MINT_PRICE_WEI:=0}"
: "${MAX_PER_WALLET:=5}"
: "${ACCESS_REGISTRY:=0xcb385cD90ca6b219798F57B4a7958897e91A9163}"
: "${ROYALTY_RECEIVER:=$OWNER_ADDRESS}"
: "${ROYALTY_BPS:=500}"
: "${UNREVEALED_URI:=ipfs://placeholder/prereveal.json}"
: "${CHAIN_ID:=151}"
: "${EXPLORER_API_URL:=https://api.routescan.io/v2/network/mainnet/evm/151/etherscan}"
: "${EXPLORER_API_KEY:=verifyContract}"

echo "==> Encoding constructor arguments"
CTOR_ARGS=$(cast abi-encode \
  "constructor(string,string,uint256,uint256,uint256,address,address,address,uint96,string)" \
  "$COLLECTION_NAME" \
  "$COLLECTION_SYMBOL" \
  "$MAX_SUPPLY" \
  "$MINT_PRICE_WEI" \
  "$MAX_PER_WALLET" \
  "$ACCESS_REGISTRY" \
  "$OWNER_ADDRESS" \
  "$ROYALTY_RECEIVER" \
  "$ROYALTY_BPS" \
  "$UNREVEALED_URI")

echo "==> Verifying RedbellyGenesis at ${NFT_ADDRESS} on chain ${CHAIN_ID}"
forge verify-contract "$NFT_ADDRESS" src/RedbellyGenesis.sol:RedbellyGenesis \
  --chain "$CHAIN_ID" \
  --verifier-url "$EXPLORER_API_URL" \
  --etherscan-api-key "$EXPLORER_API_KEY" \
  --constructor-args "$CTOR_ARGS" \
  --watch

echo ""
echo "==> Done. Check the explorer:"
echo "    https://redbelly.routescan.io/address/${NFT_ADDRESS}"
