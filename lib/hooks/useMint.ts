"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { decodeEventLog, type Hash } from "viem";
import { vault01GenesisAbi } from "@/lib/abis/vault01Genesis";
import { nftContractAddress, isContractConfigured } from "@/lib/addresses";
import { activeChain, activeChainHexId } from "@/lib/chains";
import { toFriendlyError, type FriendlyError } from "@/lib/errors";

/** Where the mint currently is in its lifecycle. */
export type MintPhase =
  | "idle"
  | "awaiting-wallet" // waiting for the user to confirm in their wallet
  | "pending" // submitted, waiting for inclusion
  | "success"
  | "error";

/**
 * sessionStorage-backed store for a transaction hash in flight.
 *
 * Exposed as an external store (via useSyncExternalStore) rather than read in a
 * mount effect, so a refresh resumes watching the transaction on first paint —
 * with no effect, no cascading render, and no SSR/client mismatch: the server
 * snapshot is simply "no pending tx".
 */
function createPendingTxStore(key: string) {
  const listeners = new Set<() => void>();
  return {
    get(): Hash | undefined {
      try {
        const stored = typeof window === "undefined" ? null : window.sessionStorage.getItem(key);
        return stored && /^0x[a-fA-F0-9]{64}$/.test(stored) ? (stored as Hash) : undefined;
      } catch {
        return undefined;
      }
    },
    set(hash: Hash) {
      try {
        window.sessionStorage.setItem(key, hash);
      } catch {
        /* non-fatal */
      }
      for (const listener of listeners) listener();
    },
    clear() {
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        /* non-fatal */
      }
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const mintTxStore = createPendingTxStore("vault01:pending-mint-tx");
const redeemTxStore = createPendingTxStore("vault01:pending-redeem-tx");

/** Empty-string server snapshot: useSyncExternalStore requires a stable value. */
function getServerSnapshot(): Hash | undefined {
  return undefined;
}

/**
 * Drives a mint from click to confirmed receipt.
 *
 * Phases are derived from state rather than mirrored through effects: the wallet
 * phase is submission state, the pending phase is the receipt query running, and
 * the outcome is the receipt itself. The submitted hash is persisted, so a reload
 * while a transaction is in flight resumes watching it instead of losing the
 * user's mint.
 */
export function useMint() {
  const { address } = useAccount();
  const [submission, setSubmission] = useState<
    | { step: "idle" }
    | { step: "awaiting-wallet" }
    | { step: "failed"; error: FriendlyError }
  >({ step: "idle" });

  const resumedHash = useSyncExternalStore(
    mintTxStore.subscribe.bind(mintTxStore),
    mintTxStore.get.bind(mintTxStore),
    getServerSnapshot,
  );

  // A hash from this session takes precedence over one resumed from storage, so
  // reset() can always clear the view even while the stored value lingers.
  const [explicitHash, setExplicitHash] = useState<Hash | undefined>();
  const txHash = explicitHash ?? resumedHash;

  const { writeContractAsync, reset: resetWrite } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
    isError: isReceiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: activeChain.id,
    query: { enabled: Boolean(txHash) },
  });

  // Minted ids arrive in the receipt logs; decode them where the success screen reads them.
  const mintedTokenIds = useMemo(() => {
    if (!receipt || receipt.status !== "success") return [];
    const ids: bigint[] = [];
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: vault01GenesisAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "Minted") {
          const { quantity, firstTokenId } = decoded.args as unknown as {
            quantity: bigint;
            firstTokenId: bigint;
          };
          for (let i = 0n; i < quantity; i++) ids.push(firstTokenId + i);
        }
      } catch {
        // Logs from other contracts in the same tx are expected; skip them.
      }
    }
    return ids;
  }, [receipt]);

  const phase: MintPhase = (() => {
    if (submission.step === "failed") return "error";
    if (submission.step === "awaiting-wallet") return "awaiting-wallet";
    if (receipt) {
      if (receipt.status === "reverted") return "error";
      return "success";
    }
    if (isReceiptError) return "error";
    if (txHash) return "pending";
    return "idle";
  })();

  const friendlyError: FriendlyError | null = (() => {
    if (submission.step === "failed") return submission.error;
    if (receipt?.status === "reverted") {
      return {
        title: "Transaction reverted",
        detail:
          "The network accepted the transaction but the contract rejected it. " +
          "No NFT was minted. You were still charged gas.",
        benign: false,
        retryable: true,
      };
    }
    if (isReceiptError) {
      return {
        title: "Could not confirm transaction",
        detail:
          "We lost track of this transaction. It may still succeed — check the explorer " +
          "before minting again to avoid minting twice.",
        benign: false,
        retryable: false,
      };
    }
    return null;
  })();

  // Once the outcome is known the persisted hash has done its job; clearing is a
  // side effect on an external system, which is exactly what effects are for.
  const receiptKnown = phase === "success" || phase === "error";
  useEffect(() => {
    if (receiptKnown) mintTxStore.clear();
  }, [receiptKnown]);

  const mint = useCallback(
    async (quantity: number, totalCostWei: bigint) => {
      if (!isContractConfigured || !nftContractAddress) {
        setSubmission({
          step: "failed",
          error: {
            title: "Minting not open yet",
            detail: "The collection contract has not been deployed yet.",
            benign: false,
            retryable: false,
          },
        });
        return;
      }

      setSubmission({ step: "awaiting-wallet" });

      try {
        const hash = await writeContractAsync({
          address: nftContractAddress,
          abi: vault01GenesisAbi,
          functionName: "mint",
          args: [BigInt(quantity)],
          value: totalCostWei,
          chainId: activeChain.id,
        });

        mintTxStore.set(hash);
        setExplicitHash(hash);
      } catch (err) {
        setSubmission({ step: "failed", error: toFriendlyError(err) });
      }
    },
    [writeContractAsync],
  );

  const reset = useCallback(() => {
    mintTxStore.clear();
    setSubmission({ step: "idle" });
    setExplicitHash(undefined);
    resetWrite();
  }, [resetWrite]);

  return {
    mint,
    reset,
    phase,
    error: friendlyError,
    txHash,
    receipt,
    mintedTokenIds,
    isConfirming,
    isBusy: phase === "awaiting-wallet" || phase === "pending",
    minterAddress: address,
  };
}

/** Where a watch claim currently is in its lifecycle. */
export type RedeemPhase = "idle" | "awaiting-wallet" | "pending" | "success" | "error";

/**
 * Drives a physical-watch claim (redeemPhysicalAsset) from click to receipt.
 *
 * Follows the same shape as {useMint}: derived phases, friendly error
 * translation, and a persisted hash so a refresh mid-claim resumes watching
 * instead of leaving the user to guess whether it went through.
 */
export function useRedeem() {
  const { address } = useAccount();
  const [submission, setSubmission] = useState<
    | { step: "idle"; tokenId: bigint | null }
    | { step: "awaiting-wallet"; tokenId: bigint | null }
    | { step: "failed"; tokenId: bigint | null; error: FriendlyError }
  >({ step: "idle", tokenId: null });

  const resumedHash = useSyncExternalStore(
    redeemTxStore.subscribe.bind(redeemTxStore),
    redeemTxStore.get.bind(redeemTxStore),
    getServerSnapshot,
  );

  const [explicitHash, setExplicitHash] = useState<Hash | undefined>();
  const txHash = explicitHash ?? resumedHash;

  const { writeContractAsync, reset: resetWrite } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
    isError: isReceiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: activeChain.id,
    query: { enabled: Boolean(txHash) },
  });

  const phase: RedeemPhase = (() => {
    if (submission.step === "failed") return "error";
    if (submission.step === "awaiting-wallet") return "awaiting-wallet";
    if (receipt) {
      if (receipt.status === "reverted") return "error";
      return "success";
    }
    if (isReceiptError) return "error";
    if (txHash) return "pending";
    return "idle";
  })();

  const friendlyError: FriendlyError | null = (() => {
    if (submission.step === "failed") return submission.error;
    if (receipt?.status === "reverted") {
      return {
        title: "Claim failed",
        detail:
          "The network accepted the transaction but the contract rejected it — most " +
          "likely the watch was already claimed. You were still charged gas.",
        benign: false,
        retryable: false,
      };
    }
    if (isReceiptError) {
      return {
        title: "Could not confirm claim",
        detail:
          "We lost track of this transaction. It may still succeed — check the explorer " +
          "before claiming again.",
        benign: false,
        retryable: false,
      };
    }
    return null;
  })();

  const receiptKnown = phase === "success" || phase === "error";
  useEffect(() => {
    if (receiptKnown) redeemTxStore.clear();
  }, [receiptKnown]);

  const redeem = useCallback(
    async (tokenId: bigint) => {
      if (!isContractConfigured || !nftContractAddress) {
        setSubmission({
          step: "failed",
          tokenId,
          error: {
            title: "Contract not deployed",
            detail: "The collection contract has not been deployed yet.",
            benign: false,
            retryable: false,
          },
        });
        return;
      }

      setSubmission({ step: "awaiting-wallet", tokenId });

      try {
        const hash = await writeContractAsync({
          address: nftContractAddress,
          abi: vault01GenesisAbi,
          functionName: "redeemPhysicalAsset",
          args: [tokenId],
          chainId: activeChain.id,
        });

        redeemTxStore.set(hash);
        setExplicitHash(hash);
      } catch (err) {
        setSubmission({ step: "failed", tokenId, error: toFriendlyError(err) });
      }
    },
    [writeContractAsync],
  );

  const reset = useCallback(() => {
    redeemTxStore.clear();
    setSubmission({ step: "idle", tokenId: null });
    setExplicitHash(undefined);
    resetWrite();
  }, [resetWrite]);

  return {
    redeem,
    reset,
    phase,
    error: friendlyError,
    txHash,
    receipt,
    redeemTokenId: submission.tokenId,
    isConfirming,
    isBusy: phase === "awaiting-wallet" || phase === "pending",
    redeemerAddress: address,
  };
}

/**
 * Network detection and switching.
 *
 * Falls back to a raw `wallet_addEthereumChain` when the wallet does not yet know
 * Redbelly — otherwise switching fails for anyone who has not manually added it.
 */
export function useNetwork() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const [switchError, setSwitchError] = useState<FriendlyError | null>(null);

  const isCorrectNetwork = chainId === activeChain.id;
  const isWrongNetwork = isConnected && !isCorrectNetwork;

  const switchToRedbelly = useCallback(async () => {
    setSwitchError(null);
    try {
      await switchChainAsync({ chainId: activeChain.id });
    } catch (err) {
      // 4902 = chain unknown to the wallet. Offer to add it.
      const code = (err as { code?: number })?.code;
      const message = (err as { message?: string })?.message ?? "";
      const unknownChain = code === 4902 || /Unrecognized chain|not been added/i.test(message);

      if (unknownChain && typeof window !== "undefined" && window.ethereum) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: activeChainHexId,
                chainName: activeChain.name,
                nativeCurrency: activeChain.nativeCurrency,
                rpcUrls: [activeChain.rpcUrls.default.http[0]],
                blockExplorerUrls: [activeChain.blockExplorers.default.url],
              },
            ],
          });
          return;
        } catch (addErr) {
          setSwitchError(toFriendlyError(addErr));
          return;
        }
      }
      setSwitchError(toFriendlyError(err));
    }
  }, [switchChainAsync]);

  return {
    chainId,
    isCorrectNetwork,
    isWrongNetwork,
    isSwitching,
    switchToRedbelly,
    switchError,
    clearSwitchError: () => setSwitchError(null),
  };
}

/** Native RBNT balance for the connected wallet, on the active chain. */
export function useRbntBalance() {
  const { address, isConnected } = useAccount();
  const { data, isLoading, refetch } = useBalance({
    address,
    chainId: activeChain.id,
    query: { enabled: Boolean(isConnected && address), staleTime: 10_000 },
  });

  return useMemo(
    () => ({
      value: data?.value ?? 0n,
      formatted: data?.formatted ?? "0",
      symbol: data?.symbol ?? "RBNT",
      isLoading,
      refetch,
    }),
    [data, isLoading, refetch],
  );
}
