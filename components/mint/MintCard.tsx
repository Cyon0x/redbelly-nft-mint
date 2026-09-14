"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Info,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { Button, Spinner } from "@/components/ui/Button";
import { WalletButton } from "./WalletButton";
import { KycStatus } from "./KycStatus";
import { useCollectionState, useKycStatus, useWalletAllowance } from "@/lib/hooks/useCollection";
import { useMint, useNetwork, useRbntBalance } from "@/lib/hooks/useMint";
import { isContractConfigured, nftContractAddress } from "@/lib/addresses";
import { explorerTxUrl, activeChain } from "@/lib/chains";
import { GAS_ESTIMATES } from "@/lib/collection";
import { cn, formatNumber, formatRbnt, percentOf } from "@/lib/utils";

export function MintCard() {
  const { isConnected } = useAccount();
  const { isWrongNetwork, isSwitching, switchToRedbelly } = useNetwork();
  const { status: kycStatus } = useKycStatus();
  const collectionState = useCollectionState();
  const allowance = useWalletAllowance();
  const balance = useRbntBalance();
  const mintFlow = useMint();

  const [quantity, setQuantity] = useState(1);

  const {
    maxSupply,
    totalMinted,
    remaining,
    mintPrice,
    maxPerWallet,
    soldOut,
    paused,
    isLoading: stateLoading,
    isLive,
    refetch: refetchCollection,
  } = collectionState;

  // Upper bound on the stepper: never offer more than the wallet or supply allows.
  const maxSelectable = useMemo(() => {
    const walletCap = isConnected ? Number(allowance.remaining) : Number(maxPerWallet);
    const supplyCap = Number(remaining);
    return Math.max(1, Math.min(walletCap || 1, supplyCap || 1, 20));
  }, [allowance.remaining, maxPerWallet, remaining, isConnected]);

  // Keep the selection legal when limits change underneath it.
  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), maxSelectable));
  }, [maxSelectable]);

  const totalCost = mintPrice * BigInt(quantity);
  const insufficientFunds = isConnected && balance.value < totalCost;
  const walletLimitReached = isConnected && allowance.remaining === 0n && isLive;

  // Refresh on-chain reads after a confirmed mint.
  useEffect(() => {
    if (mintFlow.phase === "success") {
      refetchCollection();
      allowance.refetch();
      balance.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mintFlow.phase]);

  // --- Success state ----------------------------------------------------
  if (mintFlow.phase === "success") {
    return (
      <MintSuccess
        tokenIds={mintFlow.mintedTokenIds}
        txHash={mintFlow.txHash}
        onMintAgain={() => {
          mintFlow.reset();
          setQuantity(1);
        }}
        canMintAgain={!soldOut && allowance.remaining > 0n}
      />
    );
  }

  return (
    <div className="rb-card overflow-hidden">
      {/* Supply header */}
      <div className="border-b border-rb-border bg-rb-bg-alt p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="rb-eyebrow">Minted</p>
            <p className="mt-1 font-display text-2xl font-bold text-rb-ink sm:text-3xl">
              {stateLoading ? (
                <span className="rb-skeleton inline-block h-8 w-24 rounded" />
              ) : (
                <>
                  {formatNumber(totalMinted)}
                  <span className="text-rb-muted"> / {formatNumber(maxSupply)}</span>
                </>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="rb-eyebrow">Price</p>
            <p className="mt-1 font-display text-2xl font-bold text-rb-ink sm:text-3xl">
              {stateLoading ? (
                <span className="rb-skeleton inline-block h-8 w-20 rounded" />
              ) : mintPrice === 0n ? (
                "Free"
              ) : (
                <>
                  {formatRbnt(mintPrice)}{" "}
                  <span className="text-base font-semibold text-rb-muted">RBNT</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-rb-border"
            role="progressbar"
            aria-valuenow={Number(totalMinted)}
            aria-valuemin={0}
            aria-valuemax={Number(maxSupply)}
            aria-label="Collection mint progress"
          >
            <div
              className="h-full rounded-full bg-rb-red transition-[width] duration-500"
              style={{ width: `${percentOf(Number(totalMinted), Number(maxSupply))}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-rb-muted">
            {soldOut ? "This collection is fully minted." : `${formatNumber(remaining)} remaining`}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-5 p-5 sm:p-6">
        {!isContractConfigured && <PreLaunchNotice />}

        {/* KYC */}
        {isConnected && !isWrongNetwork && <KycStatus />}

        {/* Quantity */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="mint-quantity" className="text-sm font-semibold text-rb-ink">
              Quantity
            </label>
            {isConnected && isLive && (
              <span className="text-xs text-rb-muted">
                {formatNumber(allowance.remaining)} left for this wallet
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center rounded-xl border border-rb-border-strong bg-rb-surface">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1 || mintFlow.isBusy}
                className="flex h-12 w-12 items-center justify-center rounded-l-xl text-rb-ink transition-colors hover:bg-rb-bg-alt disabled:opacity-30"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <input
                id="mint-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={maxSelectable}
                value={quantity}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isNaN(v)) setQuantity(Math.min(Math.max(1, v), maxSelectable));
                }}
                disabled={mintFlow.isBusy}
                className="h-12 w-14 border-x border-rb-border-strong bg-transparent text-center font-display text-lg font-bold text-rb-ink [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-describedby="mint-total"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(maxSelectable, q + 1))}
                disabled={quantity >= maxSelectable || mintFlow.isBusy}
                className="flex h-12 w-12 items-center justify-center rounded-r-xl text-rb-ink transition-colors hover:bg-rb-bg-alt disabled:opacity-30"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div id="mint-total" className="min-w-0 flex-1 text-right">
              <p className="rb-eyebrow">Total</p>
              <p className="font-display text-xl font-bold text-rb-ink">
                {mintPrice === 0n ? (
                  "Free"
                ) : (
                  <>
                    {formatRbnt(totalCost)} <span className="text-sm text-rb-muted">RBNT</span>
                  </>
                )}
              </p>
              {mintPrice > 0n && (
                <p className="text-xs text-rb-muted">
                  {quantity} × {formatRbnt(mintPrice)} RBNT
                </p>
              )}
            </div>
          </div>

          {/* Honest gas guidance — measured on mainnet, not guessed. */}
          <p className="mt-2.5 flex items-start gap-1.5 text-xs text-rb-muted">
            <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              Network gas is paid on top, roughly {GAS_ESTIMATES.mintOneRbnt} RBNT for one.
              Minting several at once costs far less gas per NFT
              {quantity === 1 && maxSelectable > 1 ? " — about 7 RBNT each at five." : "."}
            </span>
          </p>
        </div>

        {/* Action */}
        <MintAction
          isConnected={isConnected}
          isWrongNetwork={isWrongNetwork}
          isSwitching={isSwitching}
          switchToRedbelly={switchToRedbelly}
          kycStatus={kycStatus}
          soldOut={soldOut}
          paused={paused}
          contractReady={isContractConfigured}
          insufficientFunds={insufficientFunds}
          walletLimitReached={walletLimitReached}
          phase={mintFlow.phase}
          onMint={() => mintFlow.mint(quantity, totalCost)}
          quantity={quantity}
        />

        {/* Transaction progress */}
        {(mintFlow.phase === "awaiting-wallet" || mintFlow.phase === "pending") && (
          <TransactionProgress phase={mintFlow.phase} txHash={mintFlow.txHash} />
        )}

        {/* Errors */}
        {mintFlow.phase === "error" && mintFlow.error && (
          <div
            role="alert"
            className={cn(
              "rounded-xl border p-4",
              mintFlow.error.benign
                ? "border-rb-border bg-rb-bg-alt"
                : "border-rb-border-strong bg-rb-danger-bg",
            )}
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  mintFlow.error.benign ? "text-rb-muted" : "text-rb-danger",
                )}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-rb-ink">{mintFlow.error.title}</p>
                <p className="mt-1 text-sm text-rb-ink-soft">{mintFlow.error.detail}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {mintFlow.error.retryable && (
                    <Button variant="secondary" size="sm" onClick={mintFlow.reset}>
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Try again
                    </Button>
                  )}
                  {mintFlow.txHash && (
                    <a
                      href={explorerTxUrl(mintFlow.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-rb-red hover:underline"
                    >
                      View on explorer
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                  {!mintFlow.error.retryable && !mintFlow.txHash && (
                    <Button variant="ghost" size="sm" onClick={mintFlow.reset}>
                      Dismiss
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The mint button. Its label and behaviour are derived from state in a strict
 * priority order, so the user is always told the single most relevant thing.
 */
function MintAction({
  isConnected,
  isWrongNetwork,
  isSwitching,
  switchToRedbelly,
  kycStatus,
  soldOut,
  paused,
  contractReady,
  insufficientFunds,
  walletLimitReached,
  phase,
  onMint,
  quantity,
}: {
  isConnected: boolean;
  isWrongNetwork: boolean;
  isSwitching: boolean;
  switchToRedbelly: () => void;
  kycStatus: string;
  soldOut: boolean;
  paused: boolean;
  contractReady: boolean;
  insufficientFunds: boolean;
  walletLimitReached: boolean;
  phase: string;
  onMint: () => void;
  quantity: number;
}) {
  if (!isConnected) return <WalletButton className="w-full" />;

  if (isWrongNetwork) {
    return (
      <Button
        variant="danger"
        size="lg"
        className="w-full"
        onClick={switchToRedbelly}
        loading={isSwitching}
      >
        {isSwitching ? "Switching…" : `Switch to ${activeChain.name}`}
      </Button>
    );
  }

  if (!contractReady) {
    return (
      <Button size="lg" className="w-full" disabled>
        Minting opens soon
      </Button>
    );
  }

  if (soldOut) {
    return (
      <Button size="lg" className="w-full" disabled>
        Sold Out
      </Button>
    );
  }

  if (paused) {
    return (
      <Button size="lg" className="w-full" disabled>
        Mint Closed
      </Button>
    );
  }

  if (kycStatus === "checking") {
    return (
      <Button size="lg" className="w-full" loading disabled>
        Checking KYC…
      </Button>
    );
  }

  if (kycStatus === "unverified") {
    return (
      <Button size="lg" className="w-full" disabled>
        Verification Required
      </Button>
    );
  }

  if (kycStatus === "error") {
    return (
      <Button size="lg" className="w-full" disabled>
        Verification unavailable
      </Button>
    );
  }

  if (walletLimitReached) {
    return (
      <Button size="lg" className="w-full" disabled>
        Wallet limit reached
      </Button>
    );
  }

  if (insufficientFunds) {
    return (
      <Button size="lg" className="w-full" disabled>
        Insufficient RBNT
      </Button>
    );
  }

  if (phase === "awaiting-wallet") {
    return (
      <Button size="lg" className="w-full" loading disabled>
        Confirm in wallet…
      </Button>
    );
  }

  if (phase === "pending") {
    return (
      <Button size="lg" className="w-full" loading disabled>
        Minting…
      </Button>
    );
  }

  return (
    <Button size="lg" className="w-full" onClick={onMint}>
      Mint {quantity > 1 ? `${quantity} NFTs` : "NFT"}
    </Button>
  );
}

function TransactionProgress({ phase, txHash }: { phase: string; txHash?: string }) {
  const steps = [
    { key: "awaiting-wallet", label: "Confirm in your wallet" },
    { key: "pending", label: "Waiting for confirmation" },
  ];
  const activeIndex = steps.findIndex((s) => s.key === phase);

  return (
    <div
      className="rounded-xl border border-rb-border bg-rb-bg-alt p-4"
      role="status"
      aria-live="polite"
    >
      <ol className="space-y-2.5">
        {steps.map((step, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li key={step.key} className="flex items-center gap-3 text-sm">
              {done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-rb-success" aria-hidden="true" />
              ) : active ? (
                <Spinner className="h-4 w-4 shrink-0 text-rb-red" />
              ) : (
                <span
                  className="h-4 w-4 shrink-0 rounded-full border-2 border-rb-border-strong"
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  active
                    ? "font-semibold text-rb-ink"
                    : done
                      ? "text-rb-muted line-through"
                      : "text-rb-muted",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {txHash && (
        <a
          href={explorerTxUrl(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rb-red hover:underline"
        >
          Track on Routescan
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      )}

      <p className="mt-3 text-xs text-rb-muted">
        Keep this tab open. If you refresh, we&apos;ll pick the transaction back up.
      </p>
    </div>
  );
}

function MintSuccess({
  tokenIds,
  txHash,
  onMintAgain,
  canMintAgain,
}: {
  tokenIds: bigint[];
  txHash?: string;
  onMintAgain: () => void;
  canMintAgain: boolean;
}) {
  return (
    <div className="rb-card overflow-hidden rb-animate-in">
      <div className="border-b border-rb-border bg-rb-success-bg p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-rb-success" aria-hidden="true" />
        <h3 className="mt-3 font-display text-2xl font-bold text-rb-ink">Mint successful</h3>
        <p className="mt-1 text-sm text-rb-ink-soft">
          {tokenIds.length > 0
            ? `You now own ${tokenIds.length} ${tokenIds.length === 1 ? "NFT" : "NFTs"} from this collection.`
            : "Your mint is confirmed on Redbelly Network."}
        </p>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        {tokenIds.length > 0 && (
          <div>
            <p className="rb-eyebrow">Token {tokenIds.length === 1 ? "ID" : "IDs"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {tokenIds.map((id) => (
                <span
                  key={id.toString()}
                  className="rounded-lg bg-rb-red-tint px-2.5 py-1 font-mono text-sm font-semibold text-rb-red-solid"
                >
                  #{id.toString()}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {txHash && (
            <a
              href={explorerTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-rb-border-strong text-sm font-semibold text-rb-ink transition-colors hover:border-rb-red hover:text-rb-red"
            >
              View transaction
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
          {canMintAgain && (
            <Button className="flex-1" onClick={onMintAgain}>
              Mint another
            </Button>
          )}
        </div>

        {nftContractAddress && (
          <p className="text-center text-xs text-rb-muted">
            Your NFT lives at the collection contract on {activeChain.name}. It may take a
            moment to appear in your wallet.
          </p>
        )}
      </div>
    </div>
  );
}

function PreLaunchNotice() {
  return (
    <div className="rounded-xl border border-rb-border-strong bg-rb-warning-bg p-4">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-rb-warning" aria-hidden="true" />
        <div>
          <p className="font-semibold text-rb-ink">Contract not yet deployed</p>
          <p className="mt-1 text-sm text-rb-ink-soft">
            The collection contract has not been deployed to {activeChain.name} yet. Wallet
            connection and Redbelly verification are fully functional and can be tested now.
          </p>
        </div>
      </div>
    </div>
  );
}
