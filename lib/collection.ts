/**
 * Single source of truth for everything collection-specific.
 *
 * Values marked PLACEHOLDER are awaiting a decision and are deliberately obvious
 * on screen rather than quietly wrong. Confirmed values are marked CONFIRMED.
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
  /** PLACEHOLDER — awaiting final collection name. */
  name: "Redbelly Genesis",
  /** PLACEHOLDER — awaiting final symbol. */
  symbol: "RBGEN",

  /** CONFIRMED — 500, immutable once deployed. */
  maxSupply: 500,

  /** CONFIRMED — free mint at launch. Price is owner-settable post-launch. */
  mintPriceWei: 0n,

  /** DEFAULT — 5 per wallet. Owner-adjustable after deployment. */
  maxPerWallet: 5,

  /** DEFAULT — 5% secondary royalty (ERC-2981). */
  royaltyBps: 500,

  /** PLACEHOLDER — awaiting final collection description. */
  tagline: "A 500-piece genesis collection, native to Redbelly Network.",

  description:
    "Redbelly Genesis is a 500-piece collection minted natively on Redbelly Network — " +
    "a chain where every participant is identity-verified at the protocol level. " +
    "Every holder completed Redbelly verification before minting, enforced in the " +
    "contract itself, not merely checked in the interface.",

  /** Artwork is not final. The gallery renders generated placeholders until it is. */
  artworkFinal: false,
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
 * Measured on Redbelly mainnet during development, from real transaction receipts.
 * Used to set honest gas expectations in the UI instead of leaving users surprised.
 */
export const GAS_ESTIMATES = {
  baseFeeGwei: 199_410,
  mintOneRbnt: 23.1,
  mintFiveRbnt: 35.6,
  perNftWhenMintingFive: 7.1,
} as const;
