import type { Address } from "viem";
import { activeChain } from "./chains";

/**
 * Redbelly's on-chain identity registry ("Redbelly Access").
 *
 * Verified live on mainnet during development:
 *   isPermissionedAccessEnabled()      -> true
 *   isAllowed(unverified wallet)       -> false
 *   isAllowed(real mainnet tx sender)  -> true
 */
export const REDBELLY_ACCESS_ADDRESS: Record<number, Address> = {
  151: "0xcb385cD90ca6b219798F57B4a7958897e91A9163",
  153: "0x519ba1b48D571FD92FAF6FE4D20fe74Ca435B690",
};

export const accessRegistryAddress = REDBELLY_ACCESS_ADDRESS[activeChain.id];

const rawNftAddress = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS?.trim();

/** True once a real NFT contract address is configured for this environment. */
export const isContractConfigured =
  !!rawNftAddress && /^0x[a-fA-F0-9]{40}$/.test(rawNftAddress);

/**
 * The collection contract. Undefined before mainnet deployment — every consumer
 * must handle that, so the site renders a coherent pre-launch state rather than
 * throwing.
 */
export const nftContractAddress = isContractConfigured
  ? (rawNftAddress as Address)
  : undefined;
