import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatUnits } from "viem";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** `0x12Ab...89Ef` */
export function truncateAddress(address?: string): string {
  if (!address || address.length < 10) return address ?? "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format a wei amount as RBNT.
 * Trims trailing zeros so "0.10" reads as "0.1" and whole numbers stay clean.
 */
export function formatRbnt(wei: bigint, maxDecimals = 4): string {
  const raw = formatUnits(wei, 18);
  const n = Number(raw);
  if (n === 0) return "0";
  if (Number.isInteger(n) && Math.abs(n) < 1e15) {
    return new Intl.NumberFormat("en-US").format(n);
  }
  const fixed = n.toFixed(maxDecimals);
  // Group the integer part with separators: 21681.721 -> 21,681.721
  const [int, dec] = fixed.split(".");
  const grouped = new Intl.NumberFormat("en-US").format(Number(int));
  return dec && !/^0+$/.test(dec) ? `${grouped}.${dec.replace(/0+$/, "")}` : grouped;
}

/** Percentage complete, clamped to 0-100. */
export function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

export function formatNumber(n: number | bigint): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/**
 * Approximate USD value of a wei amount, using the RBNT rate {collection.mintPriceWei}
 * was computed at. An approximation by construction — the chain stores wei, not
 * dollars — so callers must present it as "~$" and never as a peg.
 */
export function approxUsd(wei: bigint, rate: number): string {
  const rbnt = Number(formatUnits(wei, 18));
  const usd = rbnt * rate;
  if (usd === 0) return "$0";
  if (usd < 0.01) return "<$0.01";
  if (usd < 1) return `~$${usd.toFixed(2)}`;
  // Trim trailing zeros so a round target reads "~$50", not "~$50.00".
  const fixed = usd.toFixed(usd < 100 ? 2 : 0);
  return `~$${fixed.replace(/\.?0+$/, "")}`;
}
