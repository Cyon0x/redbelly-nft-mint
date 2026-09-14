"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn, truncateAddress } from "@/lib/utils";

/**
 * Copyable address chip.
 *
 * Status is announced to screen readers, not conveyed by colour alone.
 */
export function CopyAddress({
  address,
  truncate = true,
  className,
  label = "address",
}: {
  address: string;
  truncate?: boolean;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the address stays selectable as a fallback.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "group inline-flex items-center gap-2 rounded-lg border border-rb-border",
        "bg-rb-bg-alt px-3 py-1.5 font-mono text-xs text-rb-ink-soft",
        "transition-colors hover:border-rb-red hover:text-rb-ink",
        className,
      )}
      aria-label={copied ? `${label} copied to clipboard` : `Copy ${label}: ${address}`}
    >
      <span className="truncate">{truncate ? truncateAddress(address) : address}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-rb-success" aria-hidden="true" />
      ) : (
        <Copy
          className="h-3.5 w-3.5 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
