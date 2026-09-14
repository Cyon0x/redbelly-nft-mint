// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { IRedbellyAccess } from "./interfaces/IRedbellyAccess.sol";

/// @title Vault01Genesis
/// @author Cyon
/// @notice A single-collection ERC-721 for Redbelly Network that enforces Redbelly's
///         on-chain identity verification at mint time.
///
/// @dev ## KYC enforcement rationale
///
///      Redbelly runs protocol-level permissioning: `isPermissionedAccessEnabled()`
///      returns true on mainnet, meaning the network itself rejects transactions from
///      wallets that have not completed identity verification. A direct EOA mint is
///      therefore already gated before this contract executes.
///
///      This contract still enforces the check on-chain for two reasons:
///
///      1. **Defense in depth.** Protocol permissioning is a network configuration,
///         not a property of this contract. If it were ever relaxed, the collection's
///         verified-holder guarantee would silently disappear. Enforcing here makes
///         that guarantee a property of the contract itself, independently auditable.
///
///      2. **Recipient integrity.** Protocol permissioning only constrains the
///         transaction sender. It says nothing about who receives the token. This
///         contract closes that gap by construction: {mint} always mints to
///         `msg.sender`, and `msg.sender` is verified. There is no arbitrary-recipient
///         path, so a verified wallet cannot mint directly into an unverified one.
///
///      The registry address is owner-updatable and can never be set to the zero
///      address. Updatable, because a hardcoded registry that Redbelly later migrates
///      or retires would return false forever and permanently brick minting with no
///      recovery path. Never zero, because that would be a silent way to switch
///      enforcement off — enforcement is always on; only its target can move.
///
///      ## Transferability
///
///      Tokens are freely transferable after mint (standard ERC-721 behaviour), so the
///      collection works with ordinary secondary-market tooling. Note that Redbelly's
///      protocol permissioning still requires whoever *sends* a transfer to be
///      verified. Mint-time verification is enforced; post-mint transfer restriction
///      is deliberately not imposed.
contract Vault01Genesis is ERC721, ERC2981, Ownable, Pausable, ReentrancyGuard {
    using Strings for uint256;

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    /// @notice Thrown when a zero address is supplied where a real address is required.
    error ZeroAddress();
    /// @notice Thrown when a mint is attempted with a quantity of zero.
    error ZeroQuantity();
    /// @notice Thrown when a mint would push the collection past {MAX_SUPPLY}.
    /// @param requested Quantity requested.
    /// @param remaining Quantity still available.
    error ExceedsMaxSupply(uint256 requested, uint256 remaining);
    /// @notice Thrown when a mint would push a wallet past its per-wallet allowance.
    /// @param requested Quantity requested.
    /// @param allowance Quantity the wallet may still mint.
    error ExceedsWalletLimit(uint256 requested, uint256 allowance);
    /// @notice Thrown when msg.value does not exactly equal quantity * mintPrice.
    /// @param required Exact wei required.
    /// @param supplied Wei actually sent.
    error IncorrectPayment(uint256 required, uint256 supplied);
    /// @notice Thrown when an address has not completed Redbelly identity verification.
    /// @param account The unverified address.
    error NotVerifiedOnRedbelly(address account);
    /// @notice Thrown when a withdrawal is attempted with a zero balance.
    error NothingToWithdraw();
    /// @notice Thrown when the native-token transfer in {withdraw} fails.
    error WithdrawFailed();
    /// @notice Thrown when querying a token that does not exist.
    error NonexistentToken(uint256 tokenId);
    /// @notice Thrown when a per-wallet limit of zero is supplied.
    error InvalidWalletLimit();
    /// @notice Thrown when tokenIds and editions differ in length.
    error LengthMismatch(uint256 tokenIdsLength, uint256 editionsLength);
    /// @notice Thrown when an edition falls outside 1..PHYSICAL_ALLOCATION.
    error InvalidEdition(uint16 edition);
    /// @notice Thrown when an edition is already bound to a token.
    error EditionAlreadyAssigned(uint16 edition);
    /// @notice Thrown when a token already carries a physical edition.
    error TokenAlreadyAssigned(uint256 tokenId);
    /// @notice Thrown when an assignment would push past {PHYSICAL_ALLOCATION}.
    error ExceedsPhysicalAllocation(uint256 requested, uint256 remaining);
    /// @notice Thrown when a token carries no physical asset.
    error NoPhysicalAsset(uint256 tokenId);
    /// @notice Thrown when the caller does not own the token being redeemed.
    error NotTokenOwner(uint256 tokenId, address caller);
    /// @notice Thrown when the physical asset behind a token is already redeemed.
    error AlreadyRedeemed(uint256 tokenId);
    /// @notice Thrown when trying to unassign a physical asset that was already redeemed.
    error CannotUnassignRedeemed(uint256 tokenId);

    // ---------------------------------------------------------------------
    // Immutable configuration
    // ---------------------------------------------------------------------

    /// @notice Hard cap on the collection. Immutable: a supply commitment to holders.
    uint256 public immutable MAX_SUPPLY;

    /// @notice Number of physical watches backing the collection. Immutable.
    uint256 public constant PHYSICAL_ALLOCATION = 50;

    /// @dev Prefix for derived physical serials. Never stored per token — the serial
    ///      is a pure function of the edition, so writing it on-chain would be waste.
    string private constant _SERIAL_PREFIX = "VAULT01-WATCH-";

    // ---------------------------------------------------------------------
    // Mutable configuration
    // ---------------------------------------------------------------------

    /// @notice Redbelly's on-chain identity registry. Never zero. Owner-updatable.
    IRedbellyAccess public accessRegistry;

    /// @notice Price per token in wei. Owner-updatable; starts at zero (free mint).
    uint256 public mintPrice;

    /// @notice Maximum tokens a single wallet may mint in total. Owner-updatable.
    uint256 public maxPerWallet;

    /// @notice Number of tokens minted so far. Token ids run 1..totalMinted.
    uint256 public totalMinted;

    /// @notice Tokens minted per wallet, enforced against {maxPerWallet}.
    mapping(address wallet => uint256 minted) public mintedBy;

    /// @notice Base URI for revealed metadata, e.g. "ipfs://<cid>/".
    string private _baseTokenURI;

    /// @notice URI returned for every token while {revealed} is false.
    string private _unrevealedURI;

    /// @notice Whether real metadata is live. While false, all tokens return {_unrevealedURI}.
    bool public revealed;

    // ---------------------------------------------------------------------
    // Physical asset registry
    // ---------------------------------------------------------------------

    /// @notice Lifecycle of the physical asset behind a token.
    /// @dev Unassigned covers both "not eligible" and "not yet allocated". The contract
    ///      deliberately takes no position on which tokens *should* be eligible — see
    ///      {assignPhysicalAssetBatch}.
    enum PhysicalStatus {
        Unassigned,
        Assigned,
        Redeemed
    }

    /// @notice Edition (1..PHYSICAL_ALLOCATION) bound to a token. 0 means unassigned.
    mapping(uint256 tokenId => uint16 edition) public physicalEdition;

    /// @notice Token bound to an edition. Guards against binding one edition twice.
    /// @dev Token ids start at 1, so 0 is an unambiguous empty sentinel.
    mapping(uint16 edition => uint256 tokenId) public editionToken;

    /// @notice Whether the physical asset behind a token has been claimed by its holder.
    mapping(uint256 tokenId => bool) public physicalRedeemed;

    /// @notice How many tokens currently carry a physical edition.
    uint256 public assignedCount;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    /// @notice Emitted once per successful mint call.
    /// @param minter The wallet that minted (and received) the tokens.
    /// @param quantity How many tokens were minted.
    /// @param firstTokenId The id of the first token in the minted range.
    /// @param amountPaid Total wei paid.
    event Minted(
        address indexed minter, uint256 quantity, uint256 firstTokenId, uint256 amountPaid
    );
    /// @notice Emitted when the mint price changes.
    event MintPriceUpdated(uint256 previousPrice, uint256 newPrice);
    /// @notice Emitted when the per-wallet limit changes.
    event MaxPerWalletUpdated(uint256 previousLimit, uint256 newLimit);
    /// @notice Emitted when the Redbelly access registry is repointed.
    event AccessRegistryUpdated(address indexed previousRegistry, address indexed newRegistry);
    /// @notice Emitted when the base URI changes.
    event BaseURIUpdated(string newBaseURI);
    /// @notice Emitted when the unrevealed placeholder URI changes.
    event UnrevealedURIUpdated(string newUnrevealedURI);
    /// @notice Emitted when metadata is revealed.
    event Revealed(string baseURI);
    /// @notice Emitted when proceeds are withdrawn.
    event Withdrawn(address indexed to, uint256 amount);
    /// @notice Emitted when a token is bound to a physical edition.
    event PhysicalAssetAssigned(uint256 indexed tokenId, uint16 indexed edition);
    /// @notice Emitted when a physical edition is unbound from a token.
    event PhysicalAssetUnassigned(uint256 indexed tokenId, uint16 indexed edition);
    /// @notice Emitted when a holder claims the physical asset behind their token.
    event PhysicalAssetRedeemed(
        uint256 indexed tokenId, uint16 indexed edition, address indexed redeemer
    );

    // ---------------------------------------------------------------------
    // Construction
    // ---------------------------------------------------------------------

    /// @param name_ Collection name.
    /// @param symbol_ Collection symbol.
    /// @param maxSupply_ Immutable hard cap.
    /// @param initialMintPrice Starting price per token in wei (may be zero).
    /// @param initialMaxPerWallet Starting per-wallet cap. Must be nonzero.
    /// @param accessRegistry_ Redbelly identity registry address. Must be nonzero.
    /// @param initialOwner Owner/admin address. Must be nonzero.
    /// @param royaltyReceiver Address receiving ERC-2981 royalties. Must be nonzero.
    /// @param royaltyFeeNumerator Royalty in basis points (e.g. 500 = 5%).
    /// @param unrevealedURI_ Placeholder metadata URI used until reveal.
    /// @dev The contract deploys **paused**. The owner must call {unpause} to open
    ///      minting, which allows configuration to be confirmed on-chain first.
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        uint256 initialMintPrice,
        uint256 initialMaxPerWallet,
        address accessRegistry_,
        address initialOwner,
        address royaltyReceiver,
        uint96 royaltyFeeNumerator,
        string memory unrevealedURI_
    ) ERC721(name_, symbol_) Ownable(initialOwner) {
        if (maxSupply_ == 0) revert ZeroQuantity();
        if (initialMaxPerWallet == 0) revert InvalidWalletLimit();
        if (accessRegistry_ == address(0)) revert ZeroAddress();
        if (royaltyReceiver == address(0)) revert ZeroAddress();

        MAX_SUPPLY = maxSupply_;
        mintPrice = initialMintPrice;
        maxPerWallet = initialMaxPerWallet;
        accessRegistry = IRedbellyAccess(accessRegistry_);
        _unrevealedURI = unrevealedURI_;

        _setDefaultRoyalty(royaltyReceiver, royaltyFeeNumerator);

        // Start closed so configuration can be verified before the public can mint.
        _pause();

        emit AccessRegistryUpdated(address(0), accessRegistry_);
        emit MintPriceUpdated(0, initialMintPrice);
        emit MaxPerWalletUpdated(0, initialMaxPerWallet);
    }

    // ---------------------------------------------------------------------
    // Minting
    // ---------------------------------------------------------------------

    /// @notice Mint `quantity` tokens to the caller.
    /// @param quantity How many tokens to mint.
    /// @dev Reverts unless the caller has completed Redbelly identity verification.
    ///      Tokens always go to `msg.sender`; there is no arbitrary-recipient path,
    ///      so the verified-sender check also guarantees a verified recipient.
    ///      Payment must be exact — no refunds path, no overpayment accepted.
    function mint(uint256 quantity) external payable nonReentrant whenNotPaused {
        if (quantity == 0) revert ZeroQuantity();

        // --- Redbelly identity enforcement -------------------------------
        if (!accessRegistry.isAllowed(msg.sender)) revert NotVerifiedOnRedbelly(msg.sender);

        // --- Supply -------------------------------------------------------
        uint256 minted = totalMinted;
        uint256 remaining = MAX_SUPPLY - minted;
        if (quantity > remaining) revert ExceedsMaxSupply(quantity, remaining);

        // --- Per-wallet limit ---------------------------------------------
        uint256 walletMinted = mintedBy[msg.sender];
        uint256 limit = maxPerWallet;
        uint256 allowance = walletMinted >= limit ? 0 : limit - walletMinted;
        if (quantity > allowance) revert ExceedsWalletLimit(quantity, allowance);

        // --- Payment -------------------------------------------------------
        uint256 required = quantity * mintPrice;
        if (msg.value != required) revert IncorrectPayment(required, msg.value);

        // --- Effects (state written before external _safeMint callbacks) ----
        unchecked {
            totalMinted = minted + quantity;
            mintedBy[msg.sender] = walletMinted + quantity;
        }

        uint256 firstTokenId = minted + 1;
        for (uint256 i = 0; i < quantity; ++i) {
            _safeMint(msg.sender, firstTokenId + i);
        }

        emit Minted(msg.sender, quantity, firstTokenId, required);
    }

    // ---------------------------------------------------------------------
    // Physical asset registry
    // ---------------------------------------------------------------------

    /// @notice Bind tokens to physical editions (watch serials).
    /// @param tokenIds Tokens to bind. Must be existing tokens.
    /// @param editions Edition numbers, 1..PHYSICAL_ALLOCATION, parallel to `tokenIds`.
    /// @dev ## Why this is a free-form mapping rather than "token id == edition"
    ///
    ///      The obvious rule is "tokens #1..#50 get the 50 watches". That rule cannot be
    ///      enforced by this contract, because it depends on who mints first — and with a
    ///      500 supply and a per-wallet cap of 5, the first ten wallets to transact would
    ///      take all fifty watches. That is a gas auction, not a collector base.
    ///
    ///      Binding is therefore an explicit owner action over an arbitrary token set, so
    ///      the allocation policy can be decided (and published) before minting opens,
    ///      and can be 1:1 with the first fifty tokens or a fair draw over all holders.
    ///      The contract records the outcome; it does not choose the policy.
    ///
    ///      Batched because fifty individual calls would spend roughly 1M gas in base
    ///      fees alone on Redbelly.
    function assignPhysicalAssetBatch(uint256[] calldata tokenIds, uint16[] calldata editions)
        external
        onlyOwner
    {
        uint256 len = tokenIds.length;
        if (len != editions.length) revert LengthMismatch(len, editions.length);

        uint256 assigned = assignedCount;
        if (assigned + len > PHYSICAL_ALLOCATION) {
            revert ExceedsPhysicalAllocation(len, PHYSICAL_ALLOCATION - assigned);
        }

        for (uint256 i = 0; i < len; ++i) {
            uint256 tokenId = tokenIds[i];
            uint16 edition = editions[i];

            if (edition == 0 || edition > PHYSICAL_ALLOCATION) revert InvalidEdition(edition);
            if (_ownerOf(tokenId) == address(0)) revert NonexistentToken(tokenId);
            if (physicalEdition[tokenId] != 0) revert TokenAlreadyAssigned(tokenId);
            if (editionToken[edition] != 0) revert EditionAlreadyAssigned(edition);

            physicalEdition[tokenId] = edition;
            editionToken[edition] = tokenId;

            emit PhysicalAssetAssigned(tokenId, edition);
        }

        assignedCount = assigned + len;
    }

    /// @notice Unbind a physical edition from a token.
    /// @param tokenId Token whose binding should be removed.
    /// @dev Exists so a mistaken assignment can be corrected before a holder acts on it.
    ///      Refuses once redeemed: the claim already happened and must stay auditable.
    function unassignPhysicalAsset(uint256 tokenId) external onlyOwner {
        uint16 edition = physicalEdition[tokenId];
        if (edition == 0) revert NoPhysicalAsset(tokenId);
        if (physicalRedeemed[tokenId]) revert CannotUnassignRedeemed(tokenId);

        physicalEdition[tokenId] = 0;
        editionToken[edition] = 0;
        unchecked {
            --assignedCount;
        }

        emit PhysicalAssetUnassigned(tokenId, edition);
    }

    /// @notice Claim the physical watch behind `tokenId`.
    /// @param tokenId A token the caller owns that carries a physical edition.
    /// @dev Deliberately callable by the **token holder**, not the project. The holder's
    ///      own transaction is the on-chain record of the claim; the project fulfils
    ///      against the resulting event. A project-side "mark as shipped" flag would be
    ///      exactly the private database this collection exists to avoid.
    ///
    ///      Redemption does NOT restrict transfers. Redeemed tokens keep trading freely,
    ///      and {physicalStatus} reports `Redeemed` so a secondary buyer can see the
    ///      watch has already been claimed before they bid.
    function redeemPhysicalAsset(uint256 tokenId) external {
        uint16 edition = physicalEdition[tokenId];
        if (edition == 0) revert NoPhysicalAsset(tokenId);
        if (_ownerOf(tokenId) != msg.sender) revert NotTokenOwner(tokenId, msg.sender);
        if (physicalRedeemed[tokenId]) revert AlreadyRedeemed(tokenId);

        physicalRedeemed[tokenId] = true;

        emit PhysicalAssetRedeemed(tokenId, edition, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Total tokens in existence. Equal to {totalMinted} (no burn mechanism).
    function totalSupply() external view returns (uint256) {
        return totalMinted;
    }

    /// @notice Tokens still available to mint.
    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalMinted;
    }

    /// @notice How many more tokens `wallet` may mint.
    function remainingForWallet(address wallet) external view returns (uint256) {
        uint256 walletMinted = mintedBy[wallet];
        uint256 limit = maxPerWallet;
        if (walletMinted >= limit) return 0;
        uint256 walletAllowance = limit - walletMinted;
        uint256 supplyLeft = MAX_SUPPLY - totalMinted;
        return walletAllowance < supplyLeft ? walletAllowance : supplyLeft;
    }

    /// @notice Whether `account` has completed Redbelly identity verification.
    /// @dev Convenience passthrough so the frontend can read mint eligibility and the
    ///      registry state from a single contract.
    function isVerified(address account) external view returns (bool) {
        return accessRegistry.isAllowed(account);
    }

    /// @notice Whether minting is currently open.
    function mintOpen() external view returns (bool) {
        return !paused() && totalMinted < MAX_SUPPLY;
    }

    /// @notice The physical watch serial bound to `tokenId`, e.g. "VAULT01-WATCH-017".
    /// @return Empty string when the token carries no physical asset.
    /// @dev Derived, never stored — the serial is a pure function of the edition.
    function physicalSerial(uint256 tokenId) external view returns (string memory) {
        uint16 edition = physicalEdition[tokenId];
        if (edition == 0) return "";
        return string.concat(_SERIAL_PREFIX, _pad3(edition));
    }

    /// @notice Lifecycle state of the physical asset behind `tokenId`.
    function physicalStatus(uint256 tokenId) external view returns (PhysicalStatus) {
        if (physicalEdition[tokenId] == 0) return PhysicalStatus.Unassigned;
        if (physicalRedeemed[tokenId]) return PhysicalStatus.Redeemed;
        return PhysicalStatus.Assigned;
    }

    /// @dev Zero-pads to three digits, so serials sort and read correctly (007, 017, 050).
    function _pad3(uint256 n) private pure returns (string memory) {
        if (n < 10) return string.concat("00", n.toString());
        if (n < 100) return string.concat("0", n.toString());
        return n.toString();
    }

    /// @inheritdoc ERC721
    /// @dev Before reveal every token resolves to the placeholder URI. After reveal,
    ///      metadata is `{baseURI}{tokenId}.json`.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert NonexistentToken(tokenId);
        if (!revealed) return _unrevealedURI;
        return string.concat(_baseTokenURI, tokenId.toString(), ".json");
    }

    /// @notice The current base URI for revealed metadata.
    function baseURI() external view returns (string memory) {
        return _baseTokenURI;
    }

    /// @notice The placeholder URI served before reveal.
    function unrevealedURI() external view returns (string memory) {
        return _unrevealedURI;
    }

    // ---------------------------------------------------------------------
    // Owner controls
    // ---------------------------------------------------------------------

    /// @notice Open minting.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Close minting.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Update the price per token, in wei.
    /// @dev Deliberately mutable: the collection launches as a free mint and pricing
    ///      is expected to be revisited after launch.
    function setMintPrice(uint256 newPrice) external onlyOwner {
        uint256 previous = mintPrice;
        mintPrice = newPrice;
        emit MintPriceUpdated(previous, newPrice);
    }

    /// @notice Update the per-wallet mint cap. Must be nonzero.
    /// @dev Lowering this below what some wallets already minted does not claw tokens
    ///      back; those wallets simply cannot mint further.
    function setMaxPerWallet(uint256 newLimit) external onlyOwner {
        if (newLimit == 0) revert InvalidWalletLimit();
        uint256 previous = maxPerWallet;
        maxPerWallet = newLimit;
        emit MaxPerWalletUpdated(previous, newLimit);
    }

    /// @notice Repoint the Redbelly identity registry. Must be nonzero.
    /// @dev Exists so a Redbelly registry migration cannot permanently brick minting.
    ///      Zero is rejected so enforcement can never be silently disabled.
    function setAccessRegistry(address newRegistry) external onlyOwner {
        if (newRegistry == address(0)) revert ZeroAddress();
        address previous = address(accessRegistry);
        accessRegistry = IRedbellyAccess(newRegistry);
        emit AccessRegistryUpdated(previous, newRegistry);
    }

    /// @notice Set the base URI used for revealed metadata.
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /// @notice Set the placeholder URI served before reveal.
    function setUnrevealedURI(string calldata newUnrevealedURI) external onlyOwner {
        _unrevealedURI = newUnrevealedURI;
        emit UnrevealedURIUpdated(newUnrevealedURI);
    }

    /// @notice Reveal the collection, setting the final base URI in the same call.
    /// @dev One-way by convention but re-callable, so a bad CID can be corrected.
    function reveal(string calldata finalBaseURI) external onlyOwner {
        _baseTokenURI = finalBaseURI;
        revealed = true;
        emit BaseURIUpdated(finalBaseURI);
        emit Revealed(finalBaseURI);
    }

    /// @notice Update the ERC-2981 default royalty.
    /// @param receiver Royalty recipient. Must be nonzero.
    /// @param feeNumerator Royalty in basis points (10000 = 100%).
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        if (receiver == address(0)) revert ZeroAddress();
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    /// @notice Withdraw the full contract balance to `to`.
    /// @param to Destination address. Must be nonzero.
    /// @dev Uses `call` rather than `transfer` so the destination may be a contract or
    ///      multisig with nontrivial receive logic. Guarded against reentrancy and
    ///      follows checks-effects-interactions.
    function withdraw(address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();

        (bool ok,) = payable(to).call{ value: amount }("");
        if (!ok) revert WithdrawFailed();

        emit Withdrawn(to, amount);
    }

    // ---------------------------------------------------------------------
    // Interface support
    // ---------------------------------------------------------------------

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
