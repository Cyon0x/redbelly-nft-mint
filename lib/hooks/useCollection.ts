"use client";

import { useAccount, useChainId, useReadContract, useReadContracts } from "wagmi";
import { redbellyGenesisAbi } from "@/lib/abis/redbellyGenesis";
import { redbellyAccessAbi } from "@/lib/abis/redbellyAccess";
import { accessRegistryAddress, nftContractAddress, isContractConfigured } from "@/lib/addresses";
import { activeChain } from "@/lib/chains";
import { collection } from "@/lib/collection";

/**
 * Live collection state read from the contract.
 *
 * Values fall back to the configured defaults only while no contract is deployed,
 * so the pre-launch site still renders real numbers rather than zeroes.
 */
export function useCollectionState() {
  const enabled = isContractConfigured;

  const { data, isLoading, isError, refetch } = useReadContracts({
    allowFailure: false,
    contracts: enabled
      ? [
          { address: nftContractAddress!, abi: redbellyGenesisAbi, functionName: "MAX_SUPPLY", chainId: activeChain.id },
          { address: nftContractAddress!, abi: redbellyGenesisAbi, functionName: "totalMinted", chainId: activeChain.id },
          { address: nftContractAddress!, abi: redbellyGenesisAbi, functionName: "mintPrice", chainId: activeChain.id },
          { address: nftContractAddress!, abi: redbellyGenesisAbi, functionName: "maxPerWallet", chainId: activeChain.id },
          { address: nftContractAddress!, abi: redbellyGenesisAbi, functionName: "mintOpen", chainId: activeChain.id },
          { address: nftContractAddress!, abi: redbellyGenesisAbi, functionName: "paused", chainId: activeChain.id },
        ]
      : [],
    query: {
      enabled,
      // Supply moves as other people mint; keep it fresh without hammering the RPC.
      refetchInterval: 15_000,
      staleTime: 5_000,
    },
  });

  if (!enabled || !data) {
    return {
      maxSupply: BigInt(collection.maxSupply),
      totalMinted: 0n,
      remaining: BigInt(collection.maxSupply),
      mintPrice: collection.mintPriceWei,
      maxPerWallet: BigInt(collection.maxPerWallet),
      mintOpen: false,
      paused: true,
      soldOut: false,
      isLoading: enabled ? isLoading : false,
      isError: enabled ? isError : false,
      isLive: false,
      refetch,
    };
  }

  const [maxSupply, totalMinted, mintPrice, maxPerWallet, mintOpen, paused] = data as [
    bigint, bigint, bigint, bigint, boolean, boolean,
  ];

  return {
    maxSupply,
    totalMinted,
    remaining: maxSupply - totalMinted,
    mintPrice,
    maxPerWallet,
    mintOpen,
    paused,
    soldOut: totalMinted >= maxSupply,
    isLoading,
    isError,
    isLive: true,
    refetch,
  };
}

/**
 * Redbelly identity verification status for the connected wallet.
 *
 * Reads Redbelly's registry directly rather than going through the NFT contract,
 * so verification status is available before the collection is even deployed.
 */
export function useKycStatus() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onCorrectChain = chainId === activeChain.id;
  const enabled = Boolean(isConnected && address && onCorrectChain && accessRegistryAddress);

  const { data, isLoading, isError, error, refetch, isFetching } = useReadContract({
    address: accessRegistryAddress,
    abi: redbellyAccessAbi,
    functionName: "isAllowed",
    args: address ? [address] : undefined,
    chainId: activeChain.id,
    query: {
      enabled,
      retry: 2,
      staleTime: 30_000,
    },
  });

  /** One of: idle | checking | verified | unverified | error */
  const status = !enabled
    ? ("idle" as const)
    : isLoading
      ? ("checking" as const)
      : isError
        ? ("error" as const)
        : data === true
          ? ("verified" as const)
          : ("unverified" as const);

  return {
    status,
    isVerified: data === true,
    isChecking: isLoading || isFetching,
    isError,
    error,
    refetch,
  };
}

/** How many more tokens the connected wallet may mint. */
export function useWalletAllowance() {
  const { address, isConnected } = useAccount();
  const enabled = Boolean(isContractConfigured && isConnected && address);

  const { data, isLoading, refetch } = useReadContract({
    address: nftContractAddress,
    abi: redbellyGenesisAbi,
    functionName: "remainingForWallet",
    args: address ? [address] : undefined,
    chainId: activeChain.id,
    query: { enabled, staleTime: 5_000 },
  });

  const { data: mintedByWallet, refetch: refetchMinted } = useReadContract({
    address: nftContractAddress,
    abi: redbellyGenesisAbi,
    functionName: "mintedBy",
    args: address ? [address] : undefined,
    chainId: activeChain.id,
    query: { enabled, staleTime: 5_000 },
  });

  return {
    remaining: (data as bigint | undefined) ?? BigInt(collection.maxPerWallet),
    alreadyMinted: (mintedByWallet as bigint | undefined) ?? 0n,
    isLoading,
    refetch: () => {
      refetch();
      refetchMinted();
    },
  };
}

/** Number of tokens from this collection held by the connected wallet. */
export function useOwnedCount() {
  const { address, isConnected } = useAccount();
  const enabled = Boolean(isContractConfigured && isConnected && address);

  const { data, refetch } = useReadContract({
    address: nftContractAddress,
    abi: redbellyGenesisAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: activeChain.id,
    query: { enabled, staleTime: 5_000 },
  });

  return { count: (data as bigint | undefined) ?? 0n, refetch };
}
