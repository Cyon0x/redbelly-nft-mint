/**
 * Single source of truth for everything collection-specific.
 *
 * Numbers that exist on-chain (price, supply, per-wallet limit) are ALSO read live
 * from the contract at runtime — the values here are only fallbacks used before a
 * contract is configured, so the site can render a coherent pre-launch state.
 */

export type CollectionLink = {
  label: string;
  href: string;
  /** Official links only. Anything unverified must not ship. */
  verified: boolean;
};

export const collection = {
  /**
   * CONFIRMED — the collection name carried on-chain.
   *
   * ASCII hyphen rather than the em dash the brand uses. This string is immutable and
   * renders in every wallet and marketplace, so portability beats typography here. The
   * em dash still appears in headings and body copy, where it is pure presentation.
   */
  name: "VAULT 01 - Genesis Collection",
  /** CONFIRMED — token symbol. Immutable once deployed. */
  symbol: "VAULT01",

  /** CONFIRMED — 500, immutable once deployed. */
  maxSupply: 500,

  /**
   * INDICATIVE — the contract's `mintPrice`, in wei, at the RBNT rate noted below.
   * The contract value is authoritative and is read live; this is only the pre-launch
   * fallback. Recompute before deploying:
   *
   *     MINT_PRICE_WEI = $50 / RBNT_USD x 1e18
   *
   * At $0.00230609 (2026-09-14) that was 21,681,721,008,286,758,600,704 wei.
   *
   * NOTE: a fixed wei price is not a USD peg. If RBNT moves, the dollar value of a
   * mint moves with it. Read {mintPriceNote} before changing anything here.
   */
  mintPriceWei: 21_681_721_008_286_758_600_704n,

  /** CONFIRMED — the intended price in USD. The wei figure above is derived from it. */
  mintPriceUsd: 50,

  /** DEFAULT — 5 per wallet. Owner-adjustable after deployment. */
  maxPerWallet: 5,

  /** DEFAULT — 5% secondary royalty (ERC-2981). */
  royaltyBps: 500,

  /** CONFIRMED — 50 of the 500 tokens can be bound to a physical watch. */
  physicalAllocation: 50,

  /** CONFIRMED — one line from the brand statement. */
  tagline: "Own the Object. Verify the History.",

  description:
    "VAULT 01 explores the intersection of luxury collectibles and real world asset " +
    "tokenisation. The Genesis collection contains 500 unique tokens on Redbelly " +
    "Network, 50 of which are connected to limited edition physical mechanical " +
    "watches. Each collectible is built around scarcity, authenticity, ownership and " +
    "provenance — a bridge between physical collectibles and digital ownership.",

  /** Artwork is not final. The gallery renders generated placeholders until it is. */
  artworkFinal: false,
} as const;

/**
 * The headline mint price, and the honest caveat attached to it.
 *
 * The contract stores a price in wei, not dollars. Pinning that to a dollar figure
 * requires the owner to call `setMintPrice` when RBNT moves. Until that happens the
 * two drift apart, so the UI states the RBNT amount as authoritative and shows the
 * USD equivalent as an approximation rather than implying a peg the chain cannot keep.
 */
export const mintPriceNote = {
  /** RBNT/USD at the time {collection.mintPriceWei} was computed. */
  referenceRate: 0.00230609,
  referenceDate: "2026-09-14",
  /** True while the price is owner-managed rather than pegged. */
  isManual: true,
} as const;

/**
 * Official Redbelly links. Every entry here was taken from Redbelly's own published
 * material — none are invented. Collection-specific socials are intentionally absent
 * until real handles are supplied.
 */
export const officialLinks: CollectionLink[] = [
  { label: "Redbelly Network", href: "https://www.redbelly.network/", verified: true },
  { label: "Redbelly Access (KYC)", href: "https://access.redbelly.network/", verified: true },
  { label: "Redbelly Explorer", href: "https://redbelly.routescan.io/", verified: true },
  { label: "Redbelly Docs", href: "https://docs.redbelly.network/", verified: true },
];

/**
 * The official Redbelly identity verification portal.
 *
 * Not invented: this URL appears as the access portal in Redbelly's own published
 * material and is the destination used by the unverified-wallet CTA.
 */
export const KYC_VERIFICATION_URL = "https://access.redbelly.network/";

/**
 * Measured on Redbelly mainnet, from real transaction receipts and the gas bench.
 *
 * USD figures use the reference rate in {mintPriceNote}. They are included because a
 * bare RBNT figure is not actionable for a collector: 23 RBNT *sounds* like a lot and
 * is in fact five cents.
 */
export const GAS_ESTIMATES = {
  baseFeeGwei: 199_410,
  mintOneRbnt: 23.1,
  mintFiveRbnt: 35.6,
  perNftWhenMintingFive: 7.1,
  mintOneUsd: 0.05,
  /** Paid by whoever redeems, not by the project. */
  redeemWatchRbnt: 5.1,
  redeemWatchUsd: 0.01,
} as const;
