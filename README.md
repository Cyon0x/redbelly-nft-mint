# VAULT 01 — Genesis Collection NFT Mint

A single-collection ERC-721 mint experience built natively for **Redbelly Network Mainnet**, with Redbelly identity verification enforced **on-chain** rather than merely checked in the interface.

> **Status:** frontend and contract complete and tested. Mainnet deployment pending explicit approval.

---

## What this is

A production mint site for one NFT collection. Not a launchpad, not a marketplace.

The distinguishing property: **every holder is identity-verified**. The contract calls Redbelly's on-chain identity registry at mint time and reverts if the caller is not verified. Tokens are always minted to `msg.sender`, so the verified party and the receiving party are necessarily the same address.

---

## Verified facts about Redbelly

These were measured directly against Redbelly Mainnet during development, not assumed:

| Check | Result |
|---|---|
| `eth_chainId` | `151` |
| RPC `https://governors.mainnet.redbelly.network` | responding |
| Identity registry `0xcb385c…A9163` | live, 2,321 bytes bytecode |
| `isPermissionedAccessEnabled()` | `true` |
| `isAllowed(unverified wallet)` | `false` |
| `isAllowed(real mainnet tx sender)` ×4 | `true` |
| Routescan verification API (chain 151) | HTTP 200 |

**Gas is expensive on Redbelly.** Measured at ~199,410 gwei base fee:

| Action | Gas | Cost at ~199,410 gwei base fee |
|---|---|---|
| Deployment | 3,530,617 | **~704 RBNT** |
| Bind 50 watch allocations (one batch) | 2,390,244 | **~477 RBNT** |
| Bind 50 as 50 separate transactions | 3,397,250 | ~677 RBNT |
| Mint 1 | 116,024 | ~23.1 RBNT |
| Mint 5 | 178,404 | ~35.6 RBNT (**~7.1 each**) |
| Redeem a watch (**paid by the holder**) | 25,455 | ~5.1 RBNT |

**Budget ~1,181 RBNT to launch** (deploy + one batch binding the 50 editions), not the
~600 previously assumed. The deployer must hold all of it up front; redemption gas is
borne by individual holders as they claim.

Minting five at once costs roughly 69% less gas per NFT than minting one at a time. The mint card tells users this rather than letting them overpay silently. Binding in one batch rather than fifty transactions saves a further ~201 RBNT (~30%).

---

## KYC enforcement architecture

Redbelly enforces identity at the **protocol level** — `isPermissionedAccessEnabled()` returns `true`, meaning the network rejects transactions from unverified wallets before any contract runs.

The contract still enforces the check itself, for two reasons:

1. **Defense in depth.** Protocol permissioning is a network configuration, not a property of this contract. If it were relaxed, the verified-holder guarantee would silently vanish. Enforcing in-contract makes the guarantee independently auditable.
2. **Recipient integrity.** Protocol permissioning constrains only the transaction *sender*, saying nothing about the *recipient*. This contract closes that gap by construction: `mint()` has no arbitrary-recipient path, so a verified wallet cannot mint into an unverified one.

The registry address is **owner-updatable but never zero**. Updatable, because a hardcoded registry that Redbelly later migrates would return `false` forever and permanently brick minting. Never zero, because that would be a silent way to disable enforcement — enforcement is always on, only its target can move.

---

## Project structure

```
.
├── app/                    Next.js App Router
│   ├── layout.tsx          Fonts, metadata, theme bootstrap
│   ├── page.tsx            Single-page composition
│   ├── providers.tsx       wagmi + react-query
│   └── globals.css         Design system (Tailwind 4)
├── components/
│   ├── layout/             Navbar, Footer
│   ├── mint/               MintCard, WalletButton, KycStatus
│   ├── sections/           Hero, Gallery, Details, Watches, HowItWorks, WhyRedbelly, About, FAQ
│   └── ui/                 Button, CopyAddress, ThemeToggle, RedbellyMark
├── lib/
│   ├── abis/               Trimmed contract ABIs
│   ├── hooks/              useCollection, useMint, useNetwork
│   ├── chains.ts           Redbelly chain definitions
│   ├── addresses.ts        Contract addresses per chain
│   ├── collection.ts       Single source of truth for collection config
│   ├── errors.ts           Contract revert → human language
│   ├── placeholderArt.ts   Deterministic placeholder generator
│   └── utils.ts
└── contracts/              Foundry project
    ├── src/
    │   ├── Vault01Genesis.sol
    │   └── interfaces/IRedbellyAccess.sol
    ├── test/               94 tests (93 unit + gas bench)
    └── script/             Deploy.s.sol, verify.sh
```

---

## Development

```bash
npm install
npm run dev            # http://localhost:3000

npm run contracts:test # 94 tests (3 suites, count asserted by the runner)
npm run contracts:gas  # gas report
npm run build          # production build
```

The site runs fully without a deployed contract — wallet connection and Redbelly verification work against live mainnet, and the mint card renders an explicit pre-launch state. The watch checker shows the same pre-launch notice until the contract is live.

---

## The watches

50 of the 500 tokens are bound to limited-edition physical mechanical watches. The binding (`assignPhysicalAssetBatch`), the serial derivation (`VAULT01-WATCH-017`), the holder-initiated claim (`redeemPhysicalAsset`), and the secondary-market honesty of a visible `Redeemed` status are all on-chain. The site's **Check a token** tool (in the Watches section) reads any token's binding, serial, and claim status live, and lets the owner claim directly.

**The claim is the holder's own transaction.** The project cannot claim on a holder's behalf, and cannot erase a claim — `unassignPhysicalAsset` refuses once redeemed. Fulfilment runs against the `PhysicalAssetRedeemed` event, not a private database.

---

## Deployment

### 1. Store the deployer key securely

**Never** put a private key in a file, a `.env`, or a chat window.

```bash
cast wallet import redbelly-deployer --interactive
```

The key is encrypted with a password you choose and stored in `~/.foundry/keystores`, outside the repo.

### 2. Fund the deployer

The deployer needs **~1,200 RBNT**: ~704 for deployment plus ~477 to bind the 50 watch
editions in one batch. It **must itself be Redbelly-verified** — protocol-level
permissioning means an unverified wallet cannot deploy at all. The deploy script checks
both before spending anything.

### 3. Dry run

```bash
cd contracts
forge script script/Deploy.s.sol:Deploy --rpc-url redbelly_mainnet --account redbelly-deployer
```

### 4. Deploy

```bash
forge script script/Deploy.s.sol:Deploy --rpc-url redbelly_mainnet --account redbelly-deployer --broadcast
```

The contract deploys **paused**, so configuration can be confirmed on-chain before the public can mint.

### 5. Verify on Routescan

```bash
NFT_ADDRESS=0x... OWNER_ADDRESS=0x... ./script/verify.sh
```

### 6. Open minting

```bash
cast send <NFT_ADDRESS> "unpause()" --rpc-url redbelly_mainnet --account redbelly-deployer
```

---

## Managing the contract

| Action | Command |
|---|---|
| Open minting | `cast send <addr> "unpause()"` |
| Close minting | `cast send <addr> "pause()"` |
| Set mint price | `cast send <addr> "setMintPrice(uint256)" <wei>` |
| Change wallet limit | `cast send <addr> "setMaxPerWallet(uint256)" <n>` |
| Set placeholder metadata | `cast send <addr> "setUnrevealedURI(string)" "ipfs://…"` |
| Reveal real artwork | `cast send <addr> "reveal(string)" "ipfs://<cid>/"` |
| Withdraw proceeds | `cast send <addr> "withdraw(address)" <to>` |
| Repoint identity registry | `cast send <addr> "setAccessRegistry(address)" <addr>` |
| Bind tokens to watch editions | `cast send <addr> "assignPhysicalAssetBatch(uint256[],uint16[])" "[1,2,3]" "[1,2,3]"` |
| Undo a binding (before redemption) | `cast send <addr> "unassignPhysicalAsset(uint256)" <tokenId>` |

**What the owner cannot do:** raise max supply (immutable), mint without paying, disable
identity enforcement, take tokens from holders, or block transfers.

**What the owner cannot do about watches:** claim a watch on a holder's behalf. Redemption
is callable only by the token's owner, so the on-chain claim record is always the
collector's own transaction. Neither can the owner erase a claim — `unassignPhysicalAsset`
refuses once redeemed.

### Watch edition assignment

The contract stores an arbitrary token-to-edition mapping and takes no position on which
tokens *should* receive a watch. That is deliberate: the obvious rule ("tokens #1–#50")
depends on who transacts first, and with a 500 supply and a 5-per-wallet cap the first ten
wallets to mint would take all fifty watches. Decide and publish the allocation policy
before minting opens, then bind the outcome in one batch:

```bash
cast send <addr> "assignPhysicalAssetBatch(uint256[],uint16[])" \
  "[12,47,83,...]" "[1,2,3,...]" --rpc-url redbelly_mainnet --account redbelly-deployer
```

An unassigned token reports `physicalStatus = Unassigned`; a bound one `Assigned`; a
claimed one `Redeemed`. Serials (`VAULT01-WATCH-017`) are derived from the edition and
never stored. Once assignment is done, **`assignedCount` must equal 50.**

---

## Updating collection metadata

Tokens return a placeholder URI until revealed. When the real artwork is ready:

1. Upload images to IPFS.
2. Generate one metadata JSON per token (`1.json` … `500.json`) with the standard `name` / `description` / `image` fields.
3. Upload the metadata directory to IPFS.
4. `cast send <addr> "reveal(string)" "ipfs://<metadata-cid>/"`

`tokenURI(n)` then returns `ipfs://<cid>/n.json`. `reveal` can be called again to correct a bad CID.

---

## Environment variables

See `.env.example`. Frontend needs only:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS` | Deployed collection contract. Empty before launch. |
| `NEXT_PUBLIC_CHAIN_ID` | `151` mainnet (default), `153` testnet |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata |

No secrets are required to build or run the frontend.

---

## Security

- Solidity 0.8.28, OpenZeppelin 5.7.0
- `ReentrancyGuard` on `mint` and `withdraw`; checks-effects-interactions ordering
- Exact-payment enforcement (over- and underpayment both revert)
- Supply and per-wallet caps enforced on-chain; per-wallet count is cumulative and survives transfers
- `withdraw` uses `call` with an explicit success check
- Security headers set in `next.config.ts`
- No private keys in the repo; deployment uses Foundry's encrypted keystore
