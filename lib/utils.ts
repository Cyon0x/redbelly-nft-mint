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
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toString();
  const fixed = n.toFixed(maxDecimals);
  return fixed.replace(/\.?0+$/, "");
}

/** Percentage complete, clamped to 0-100. */
export function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

export function formatNumber(n: number | bigint): string {
  return new Intl.NumberFormat("en-US").format(n);
}
