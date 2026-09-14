import { defineChain } from "viem";

/**
 * Redbelly Network chain definitions.
 *
 * Verified live during development against the mainnet RPC:
 *   eth_chainId   -> 151
 *   block height  -> responding
 *   native token  -> RBNT, 18 decimals
 */
export const redbellyMainnet = defineChain({
  id: 151,
  name: "Redbelly Network Mainnet",
  nativeCurrency: { name: "Redbelly Native Token", symbol: "RBNT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://governors.mainnet.redbelly.network"] },
  },
  blockExplorers: {
    default: { name: "Routescan", url: "https://redbelly.routescan.io" },
  },
  testnet: false,
});

export const redbellyTestnet = defineChain({
  id: 153,
  name: "Redbelly Network Testnet",
  nativeCurrency: { name: "Redbelly Native Token", symbol: "RBNT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://governors.testnet.redbelly.network"] },
  },
  blockExplorers: {
    default: { name: "Routescan", url: "https://redbelly.testnet.routescan.io" },
  },
  testnet: true,
});

/** The chain this deployment targets. Mainnet unless explicitly overridden. */
export const activeChain =
  process.env.NEXT_PUBLIC_CHAIN_ID === "153" ? redbellyTestnet : redbellyMainnet;

/** Hex chain id, for wallet_switchEthereumChain / wallet_addEthereumChain. */
export const activeChainHexId = `0x${activeChain.id.toString(16)}` as const;

export function explorerAddressUrl(address: string): string {
  return `${activeChain.blockExplorers.default.url}/address/${address}`;
}

export function explorerTxUrl(hash: string): string {
  return `${activeChain.blockExplorers.default.url}/tx/${hash}`;
}

export function explorerTokenUrl(address: string, tokenId: string | number): string {
  return `${activeChain.blockExplorers.default.url}/token/${address}/instance/${tokenId}`;
}
