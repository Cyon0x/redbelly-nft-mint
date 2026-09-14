"use client";

import { AlertCircle, ExternalLink, RefreshCw, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Button, Spinner } from "@/components/ui/Button";
import { useKycStatus } from "@/lib/hooks/useCollection";
import { KYC_VERIFICATION_URL } from "@/lib/collection";
import { cn } from "@/lib/utils";

/**
 * Redbelly identity verification status.
 *
 * Four states, per spec: checking, verified, not verified, error.
 * Each pairs an icon and a text label with colour, so status never depends on
 * colour alone.
 */
export function KycStatus({ compact = false }: { compact?: boolean }) {
  const { status, refetch, isChecking } = useKycStatus();

  if (status === "idle") return null;

  // --- Checking -------------------------------------------------------
  if (status === "checking") {
    return (
      <StatusShell tone="neutral" compact={compact}>
        <Spinner className="h-4 w-4 text-rb-muted" />
        <span>Checking Redbelly verification…</span>
      </StatusShell>
    );
  }

  // --- Verified --------------------------------------------------------
  if (status === "verified") {
    return (
      <StatusShell tone="success" compact={compact}>
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="font-semibold">KYC Verified</span>
      </StatusShell>
    );
  }

  // --- Error ------------------------------------------------------------
  if (status === "error") {
    return (
      <div className="rounded-xl border border-rb-border bg-rb-warning-bg p-4" role="alert">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rb-warning" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-rb-ink">
              We couldn&apos;t verify your Redbelly status
            </p>
            <p className="mt-1 text-sm text-rb-ink-soft">
              The verification check did not complete. This is usually a temporary network
              issue.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              loading={isChecking}
              className="mt-3"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Not verified -------------------------------------------------------
  return (
    <div className="rounded-xl border border-rb-border-strong bg-rb-red-tint p-4" role="status">
      <div className="flex items-start gap-3">
        <ShieldQuestion
          className="mt-0.5 h-5 w-5 shrink-0 text-rb-red-solid"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-rb-ink">Verification Required</p>
          <p className="mt-1 text-sm text-rb-ink-soft">
            Your wallet must be verified on Redbelly before you can perform this
            transaction. Verification is completed once, on Redbelly&apos;s official portal.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={KYC_VERIFICATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-xl bg-rb-red px-3.5",
                "text-sm font-semibold text-white transition-colors hover:bg-rb-red-solid",
              )}
            >
              Get verified on Redbelly
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <Button variant="ghost" size="sm" onClick={() => refetch()} loading={isChecking}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Re-check
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusShell({
  tone,
  compact,
  children,
}: {
  tone: "neutral" | "success";
  compact: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 rounded-lg text-sm",
        compact ? "px-2.5 py-1.5" : "px-3 py-2",
        tone === "success" ? "bg-rb-success-bg text-rb-success" : "bg-rb-bg-alt text-rb-muted",
      )}
    >
      {children}
    </div>
  );
}
