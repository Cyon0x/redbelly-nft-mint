"use client";

import { useAccount, useChainId, useReadContract, useReadContracts } from "wagmi";
import { vault01GenesisAbi } from "@/lib/abis/vault01Genesis";
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
          { address: nftContractAddress!, abi: vault01GenesisAbi, functionName: "MAX_SUPPLY", chainId: activeChain.id },
          { address: nftContractAddress!, abi: vault01GenesisAbi, functionName: "totalMinted", chainId: activeChain.id },
          { address: nftContractAddress!, abi: vault01GenesisAbi, functionName: "mintPrice", chainId: activeChain.id },
          { address: nftContractAddress!, abi: vault01GenesisAbi, functionName: "maxPerWallet", chainId: activeChain.id },
          { address: nftContractAddress!, abi: vault01GenesisAbi, functionName: "mintOpen", chainId: activeChain.id },
          { address: nftContractAddress!, abi: vault01GenesisAbi, functionName: "paused", chainId: activeChain.id },
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
    abi: vault01GenesisAbi,
    functionName: "remainingForWallet",
    args: address ? [address] : undefined,
    chainId: activeChain.id,
    query: { enabled, staleTime: 5_000 },
  });

  const { data: mintedByWallet, refetch: refetchMinted } = useReadContract({
    address: nftContractAddress,
    abi: vault01GenesisAbi,
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
    abi: vault01GenesisAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: activeChain.id,
    query: { enabled, staleTime: 5_000 },
  });

  return { count: (data as bigint | undefined) ?? 0n, refetch };
}

/**
 * Physical-watch state for one token id: edition, serial, status, and — when the
 * token exists — whether the connected wallet owns it.
 *
 * Every read is optional: `tokenId` is user-supplied, and tokens above
 * `totalMinted` legitimately do not exist. Invalid ids resolve to `notFound`
 * rather than throwing, so the checker UI can guide rather than alarm.
 */
export function useWatchStatus(tokenId: bigint | null) {
  const { address, isConnected } = useAccount();
  const enabled = Boolean(isContractConfigured && tokenId !== null && tokenId > 0n);

  const {
    data: edition,
    isError: editionError,
    refetch: refetchEdition,
  } = useReadContract({
    address: nftContractAddress,
    abi: vault01GenesisAbi,
    functionName: "physicalEdition",
    args: tokenId ? [tokenId] : undefined,
    chainId: activeChain.id,
    query: { enabled, retry: false },
  });

  const {
    data: redeemed,
    isError: redeemedError,
    refetch: refetchRedeemed,
  } = useReadContract({
    address: nftContractAddress,
    abi: vault01GenesisAbi,
    functionName: "physicalRedeemed",
    args: tokenId ? [tokenId] : undefined,
    chainId: activeChain.id,
    query: { enabled, retry: false },
  });

  // ownerOf reverts for tokens that were never minted; that is a state to surface,
  // not an error to hide.
  const {
    data: owner,
    isError: ownerError,
    refetch: refetchOwner,
  } = useReadContract({
    address: nftContractAddress,
    abi: vault01GenesisAbi,
    functionName: "ownerOf",
    args: tokenId ? [tokenId] : undefined,
    chainId: activeChain.id,
    query: { enabled, retry: false },
  });

  // physicalEdition returns 0 for both "not minted" and "minted but unassigned" —
  // ownerOf is what distinguishes them.
  const notFound =
    tokenId !== null &&
    (ownerError || (editionError && redeemedError && owner === undefined));

  const editionValue = (edition as bigint | undefined) ?? 0n;

  return {
    /** Raw enum: 0 Unassigned, 1 Assigned, 2 Redeemed. */
    edition: editionValue,
    /** e.g. "VAULT01-WATCH-017". Empty when no watch is bound. */
    serial:
      editionValue > 0n
        ? `VAULT01-WATCH-${editionValue.toString().padStart(3, "0")}`
        : "",
    status:
      notFound
        ? ("notFound" as const)
        : !isContractConfigured
          ? ("noContract" as const)
          : editionValue === 0n
            ? ("unassigned" as const)
            : redeemed
              ? ("redeemed" as const)
              : ("assigned" as const),
    /** True when the connected wallet owns this token. */
    isOwned: isConnected && owner !== undefined && owner === address,
    /** True when this token can be redeemed right now by this wallet. */
    canRedeem:
      isConnected &&
      !notFound &&
      editionValue > 0n &&
      redeemed === false &&
      owner !== undefined &&
      owner === address,
    /** Re-read all three values — call after a claim changes on-chain state. */
    refetch: () => {
      refetchEdition();
      refetchRedeemed();
      refetchOwner();
    },
  };
}
