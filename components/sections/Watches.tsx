"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Info,
  PackageCheck,
  RotateCcw,
  Search,
  Watch as WatchIcon,
} from "lucide-react";
import { SectionHeading } from "./Gallery";
import { Button } from "@/components/ui/Button";
import { useWatchStatus } from "@/lib/hooks/useCollection";
import { useRedeem } from "@/lib/hooks/useMint";
import { isContractConfigured } from "@/lib/addresses";
import { activeChain, explorerTxUrl } from "@/lib/chains";
import { collection, GAS_ESTIMATES } from "@/lib/collection";
import { cn, formatNumber } from "@/lib/utils";

const HOW_IT_WORKS = [
  {
    title: "Binding",
    body: "Before minting opens, the project binds 50 token ids to 50 numbered watch editions in one auditable batch transaction. Which tokens carry a watch is fixed on-chain from day one.",
  },
  {
    title: "Provenance",
    body: "Each binding ties a token to a serial like VAULT01-WATCH-017 — derived from the edition, never stored separately. Ownership history and claim status live beside it, readable by anyone.",
  },
  {
    title: "Claiming",
    body: "The holder claims from their own wallet. There is no form, no waiting list, and no project-side database: the claim transaction itself is the record, and the project fulfils against it.",
  },
];

export function Watches() {
  return (
    <section id="watches" className="scroll-mt-20 py-16 sm:py-20">
      <div className="rb-container">
        <SectionHeading
          eyebrow="Physical"
          title="The watches behind the tokens"
          description={`${collection.physicalAllocation} of the ${formatNumber(collection.maxSupply)} tokens are connected to limited-edition mechanical watches — bound on-chain, claimable by the holder, auditable by anyone.`}
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.title} className="rb-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rb-red-tint">
                <WatchIcon className="h-5 w-5 text-rb-red-solid" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-rb-ink">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-rb-muted">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <TokenChecker />
        </div>
      </div>
    </section>
  );
}

/**
 * Look up any minted token id and see whether it carries a watch, its serial,
 * and its claim status. When the connected wallet owns the token and the watch
 * is unclaimed, the claim button appears right there.
 */
function TokenChecker() {
  const [input, setInput] = useState("");
  const [submittedId, setSubmittedId] = useState<bigint | null>(null);

  const parsed = useMemo(() => {
    const trimmed = input.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const n = BigInt(trimmed);
    return n >= 1n && n <= BigInt(collection.maxSupply) ? n : null;
  }, [input]);

  const watch = useWatchStatus(submittedId);
  const redeem = useRedeem();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    redeem.reset();
    setSubmittedId(parsed);
  };

  return (
    <div className="rb-card p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <Search className="h-5 w-5 text-rb-red" aria-hidden="true" />
        <h3 className="font-display text-xl font-bold text-rb-ink">Check a token</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-rb-muted">
        Enter a token id to see its watch binding, serial, and claim status — read live from
        the contract on {activeChain.name}.
      </p>

      {!isContractConfigured && (
        <p className="mt-4 rounded-xl border border-rb-border-strong bg-rb-warning-bg p-3 text-sm text-rb-ink-soft" role="note">
          The collection contract has not been deployed yet. The checker will work as soon
          as it is live.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Token id (1–${formatNumber(collection.maxSupply)})`}
          aria-label="Token id"
          className="h-12 flex-1 rounded-xl border border-rb-border-strong bg-rb-surface px-4 font-mono text-rb-ink focus:border-rb-red focus:outline-none"
        />
        <Button type="submit" size="lg" disabled={!parsed}>
          Check
        </Button>
      </form>

      {parsed === null && input.trim() !== "" && (
        <p className="mt-2 text-xs text-rb-muted">
          Token ids are whole numbers from 1 to {formatNumber(collection.maxSupply)}.
        </p>
      )}

      {submittedId !== null && (
        <div className="mt-6">
          <WatchResult
            tokenId={submittedId}
            watch={watch}
            onClaim={() => redeem.redeem(submittedId)}
            redeem={redeem}
          />
        </div>
      )}
    </div>
  );
}

/** The lookup result: status, serial, ownership, and the claim action. */
function WatchResult({
  tokenId,
  watch,
  onClaim,
  redeem,
}: {
  tokenId: bigint;
  watch: ReturnType<typeof useWatchStatus>;
  onClaim: () => void;
  redeem: ReturnType<typeof useRedeem>;
}) {
  // A confirmed claim changes on-chain state; re-read the token's status so the
  // banner reflects it rather than the pre-claim snapshot.
  useEffect(() => {
    if (redeem.phase === "success") watch.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redeem.phase]);

  if (watch.status === "noContract") {
    return <ResultShell tone="neutral">Contract not deployed yet.</ResultShell>;
  }

  if (watch.status === "notFound") {
    return (
      <ResultShell tone="warning">
        Token #{tokenId.toString()} has not been minted yet. Ids only exist once they have
        been minted.
      </ResultShell>
    );
  }

  if (watch.status === "unassigned") {
    return (
      <ResultShell tone="neutral">
        Token #{tokenId.toString()} exists but is not bound to a physical watch. Only{" "}
        {collection.physicalAllocation} of the {formatNumber(collection.maxSupply)} tokens
        carry one.
      </ResultShell>
    );
  }

  if (watch.status === "redeemed") {
    return (
      <ResultShell tone="success">
        Token #{tokenId.toString()} · <span className="font-mono">{watch.serial}</span> —
        the watch has already been claimed. The claim is permanent and visible to any
        future buyer.
      </ResultShell>
    );
  }

  // status === "assigned": there is an unclaimed watch on this token.
  return (
    <div className="space-y-4">
      <ResultShell tone="success">
        <div className="flex flex-wrap items-center gap-x-2">
          <PackageCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Token #{tokenId.toString()} carries watch edition{" "}
            <span className="font-mono font-semibold">{watch.serial}</span> — unclaimed.
          </span>
        </div>
      </ResultShell>

      {/* Claim block */}
      {redeem.phase === "success" ? (
        <div
          className="rounded-xl border border-rb-border bg-rb-success-bg p-4"
          role="status"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-rb-success" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-rb-ink">Claim recorded on-chain</p>
              <p className="mt-1 text-sm text-rb-ink-soft">
                Token #{tokenId.toString()} now shows <span className="font-mono">Redeemed</span>.
                The project fulfils the physical watch against this transaction.
              </p>
              {redeem.txHash && (
                <a
                  href={explorerTxUrl(redeem.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-rb-red hover:underline"
                >
                  View transaction
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </div>
      ) : watch.isOwned ? (
        <div className="rounded-xl border border-rb-border bg-rb-bg-alt p-4">
          <p className="text-sm leading-relaxed text-rb-ink-soft">
            You own this token. Claiming records the watch as yours in your own transaction
            — it does not burn the token or restrict transfers. Network gas for the claim
            is roughly {GAS_ESTIMATES.redeemWatchRbnt} RBNT (~$
            {GAS_ESTIMATES.redeemWatchUsd}), paid by you.
          </p>
          <ClaimButton phase={redeem.phase} onClaim={onClaim} />
          {(redeem.phase === "awaiting-wallet" || redeem.phase === "pending") && redeem.txHash && (
            <a
              href={explorerTxUrl(redeem.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rb-red hover:underline"
            >
              Track on Routescan
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
          {redeem.phase === "error" && redeem.error && (
            <div
              role="alert"
              className={cn(
                "mt-3 rounded-xl border p-4",
                redeem.error.benign
                  ? "border-rb-border bg-rb-bg-alt"
                  : "border-rb-border-strong bg-rb-danger-bg",
              )}
            >
              <div className="flex items-start gap-3">
                <AlertCircle
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0",
                    redeem.error.benign ? "text-rb-muted" : "text-rb-danger",
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-rb-ink">{redeem.error.title}</p>
                  <p className="mt-1 text-sm text-rb-ink-soft">{redeem.error.detail}</p>
                  {redeem.error.retryable && (
                    <Button variant="secondary" size="sm" onClick={redeem.reset} className="mt-3">
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Try again
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-rb-border bg-rb-bg-alt p-4" role="status">
          <p className="text-sm leading-relaxed text-rb-ink-soft">
            This token carries an unclaimed watch, but this wallet does not own it. Only
            the current owner can claim — if you buy the token later, the claim right
            comes with it.
          </p>
        </div>
      )}
    </div>
  );
}

function ClaimButton({ phase, onClaim }: { phase: string; onClaim: () => void }) {
  if (phase === "awaiting-wallet") {
    return (
      <Button size="lg" className="mt-3 w-full" loading disabled>
        Confirm in wallet…
      </Button>
    );
  }
  if (phase === "pending") {
    return (
      <Button size="lg" className="mt-3 w-full" loading disabled>
        Claiming…
      </Button>
    );
  }
  return (
    <Button size="lg" className="mt-3 w-full" onClick={onClaim}>
      Claim this watch
    </Button>
  );
}

/** One-line status banner in the checker. */
function ResultShell({
  tone,
  children,
}: {
  tone: "neutral" | "success" | "warning";
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-sm",
        tone === "success" && "border-rb-border bg-rb-success-bg text-rb-ink-soft",
        tone === "warning" && "border-rb-border-strong bg-rb-warning-bg text-rb-ink-soft",
        tone === "neutral" && "border-rb-border bg-rb-bg-alt text-rb-ink-soft",
      )}
    >
      {tone === "success" ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-rb-success" aria-hidden="true" />
      ) : (
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-rb-muted" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
