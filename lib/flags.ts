/**
 * Site-wide mint kill switch.
 *
 * The collection contract's `pause()` is the authoritative control — it stops
 * `mint()` at the contract level. This flag mirrors that intent in the UI so
 * the page never invites a mint while the contract is closed: the mint button
 * is disabled, the status pills read "Mint paused", and `useMint` refuses to
 * build a transaction.
 *
 * Defaults to frozen. Reopening requires an explicit `NEXT_PUBLIC_MINT_FROZEN=false`
 * (plus the on-chain `unpause()`), so an unset or mistyped variable fails closed.
 */
export const MINT_FROZEN = process.env.NEXT_PUBLIC_MINT_FROZEN !== "false";

/** Copy shown while the mint is frozen, shared by every surface that renders it. */
export const MINT_FROZEN_NOTICE =
  "Minting is temporarily closed. The collection contract is locked while launch " +
  "details are finalised — nothing can be minted right now. Check back soon.";
