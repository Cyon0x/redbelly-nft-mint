"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const PENDING_TX_KEY = "redbelly-genesis:pending-tx";

/**
 * Drives a mint from click to confirmed receipt.
 *
 * Survives a browser refresh: the submitted hash is persisted, so a reload while a
 * transaction is in flight resumes watching it instead of losing the user's mint.
 */
export function useMint() {
  const { address } = useAccount();
  const [phase, setPhase] = useState<MintPhase>("idle");
  const [friendlyError, setFriendlyError] = useState<FriendlyError | null>(null);
  const [txHash, setTxHash] = useState<Hash | undefined>();
  const [mintedTokenIds, setMintedTokenIds] = useState<bigint[]>([]);

  const { writeContractAsync, reset: resetWrite } = useWriteContract();

  // Resume watching a transaction that was in flight before a refresh.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem(PENDING_TX_KEY);
      if (stored && /^0x[a-fA-F0-9]{64}$/.test(stored)) {
        setTxHash(stored as Hash);
        setPhase("pending");
      }
    } catch {
      // sessionStorage can throw in private modes; a lost resume is not fatal.
    }
  }, []);

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: activeChain.id,
    query: { enabled: Boolean(txHash) },
  });

  // Resolve the outcome once a receipt lands.
  useEffect(() => {
    if (!receipt) return;

    clearStoredTx();

    if (receipt.status === "reverted") {
      setPhase("error");
      setFriendlyError({
        title: "Transaction reverted",
        detail:
          "The network accepted the transaction but the contract rejected it. " +
          "No NFT was minted. You were still charged gas.",
        benign: false,
        retryable: true,
      });
      return;
    }

    // Pull the token ids out of the Minted event for the success screen.
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

    setMintedTokenIds(ids);
    setPhase("success");
  }, [receipt]);

  // A receipt that never arrives (dropped/replaced tx) must not hang forever.
  useEffect(() => {
    if (!isReceiptError || !receiptError) return;
    clearStoredTx();
    setPhase("error");
    setFriendlyError({
      title: "Could not confirm transaction",
      detail:
        "We lost track of this transaction. It may still succeed — check the explorer " +
        "before minting again to avoid minting twice.",
      benign: false,
      retryable: false,
    });
  }, [isReceiptError, receiptError]);

  const mint = useCallback(
    async (quantity: number, totalCostWei: bigint) => {
      if (!isContractConfigured || !nftContractAddress) {
        setPhase("error");
        setFriendlyError({
          title: "Minting not open yet",
          detail: "The collection contract has not been deployed yet.",
          benign: false,
          retryable: false,
        });
        return;
      }

      setFriendlyError(null);
      setMintedTokenIds([]);
      setPhase("awaiting-wallet");

      try {
        const hash = await writeContractAsync({
          address: nftContractAddress,
          abi: vault01GenesisAbi,
          functionName: "mint",
          args: [BigInt(quantity)],
          value: totalCostWei,
          chainId: activeChain.id,
        });

        storeTx(hash);
        setTxHash(hash);
        setPhase("pending");
      } catch (err) {
        const friendly = toFriendlyError(err);
        setFriendlyError(friendly);
        setPhase("error");
      }
    },
    [writeContractAsync],
  );

  const reset = useCallback(() => {
    clearStoredTx();
    setPhase("idle");
    setFriendlyError(null);
    setTxHash(undefined);
    setMintedTokenIds([]);
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
    isConfirmed,
    isBusy: phase === "awaiting-wallet" || phase === "pending",
    minterAddress: address,
  };
}

function storeTx(hash: string) {
  try {
    window.sessionStorage.setItem(PENDING_TX_KEY, hash);
  } catch {
    /* non-fatal */
  }
}

function clearStoredTx() {
  try {
    window.sessionStorage.removeItem(PENDING_TX_KEY);
  } catch {
    /* non-fatal */
  }
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
