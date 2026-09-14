// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test, console2 } from "forge-std/Test.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC2981 } from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

import { Vault01Genesis } from "../src/Vault01Genesis.sol";
import {
    MockRedbellyAccess,
    RejectingReceiver,
    NonERC721Receiver,
    ReentrantMinter
} from "./mocks/MockRedbellyAccess.sol";

contract Vault01GenesisTest is Test {
    Vault01Genesis internal nft;
    MockRedbellyAccess internal registry;

    address internal owner = makeAddr("owner");
    address internal royaltyReceiver = makeAddr("royaltyReceiver");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal mallory = makeAddr("mallory"); // never verified

    uint256 internal constant MAX_SUPPLY = 500;
    uint256 internal constant MAX_PER_WALLET = 5;
    uint96 internal constant ROYALTY_BPS = 500; // 5%
    string internal constant UNREVEALED_URI = "ipfs://placeholder/prereveal.json";

    event Minted(
        address indexed minter, uint256 quantity, uint256 firstTokenId, uint256 amountPaid
    );
    event MintPriceUpdated(uint256 previousPrice, uint256 newPrice);
    event AccessRegistryUpdated(address indexed previousRegistry, address indexed newRegistry);
    event Withdrawn(address indexed to, uint256 amount);
    event Revealed(string baseURI);

    function setUp() public {
        registry = new MockRedbellyAccess();

        nft = new Vault01Genesis(
            "Redbelly Genesis",
            "RBGEN",
            MAX_SUPPLY,
            0, // free mint
            MAX_PER_WALLET,
            address(registry),
            owner,
            royaltyReceiver,
            ROYALTY_BPS,
            UNREVEALED_URI
        );

        // Verify alice and bob on the mock registry; mallory stays unverified.
        registry.setAllowed(alice, true);
        registry.setAllowed(bob, true);

        // Contract deploys paused — open minting for the majority of tests.
        vm.prank(owner);
        nft.unpause();

        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
        vm.deal(mallory, 1000 ether);
    }

    // -----------------------------------------------------------------
    // Deployment / configuration
    // -----------------------------------------------------------------

    function test_Deployment_SetsConfiguration() public view {
        assertEq(nft.name(), "Redbelly Genesis");
        assertEq(nft.symbol(), "RBGEN");
        assertEq(nft.MAX_SUPPLY(), MAX_SUPPLY);
        assertEq(nft.mintPrice(), 0);
        assertEq(nft.maxPerWallet(), MAX_PER_WALLET);
        assertEq(address(nft.accessRegistry()), address(registry));
        assertEq(nft.owner(), owner);
        assertEq(nft.totalMinted(), 0);
        assertEq(nft.remainingSupply(), MAX_SUPPLY);
        assertFalse(nft.revealed());
    }

    function test_Deployment_StartsPaused() public {
        // Fresh instance: confirm it deploys paused before setUp's unpause.
        Vault01Genesis fresh = new Vault01Genesis(
            "X", "X", 10, 0, 1, address(registry), owner, royaltyReceiver, 0, UNREVEALED_URI
        );
        assertTrue(fresh.paused());
        assertFalse(fresh.mintOpen());
    }

    function test_Deployment_RevertsOnZeroRegistry() public {
        vm.expectRevert(Vault01Genesis.ZeroAddress.selector);
        new Vault01Genesis(
            "X", "X", 10, 0, 1, address(0), owner, royaltyReceiver, 0, UNREVEALED_URI
        );
    }

    function test_Deployment_RevertsOnZeroRoyaltyReceiver() public {
        vm.expectRevert(Vault01Genesis.ZeroAddress.selector);
        new Vault01Genesis(
            "X", "X", 10, 0, 1, address(registry), owner, address(0), 0, UNREVEALED_URI
        );
    }

    function test_Deployment_RevertsOnZeroSupply() public {
        vm.expectRevert(Vault01Genesis.ZeroQuantity.selector);
        new Vault01Genesis(
            "X", "X", 0, 0, 1, address(registry), owner, royaltyReceiver, 0, UNREVEALED_URI
        );
    }

    function test_Deployment_RevertsOnZeroWalletLimit() public {
        vm.expectRevert(Vault01Genesis.InvalidWalletLimit.selector);
        new Vault01Genesis(
            "X", "X", 10, 0, 0, address(registry), owner, royaltyReceiver, 0, UNREVEALED_URI
        );
    }

    // -----------------------------------------------------------------
    // Normal mint
    // -----------------------------------------------------------------

    function test_Mint_SingleFree() public {
        vm.expectEmit(true, false, false, true);
        emit Minted(alice, 1, 1, 0);

        vm.prank(alice);
        nft.mint(1);

        assertEq(nft.balanceOf(alice), 1);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.totalMinted(), 1);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.remainingSupply(), MAX_SUPPLY - 1);
        assertEq(nft.mintedBy(alice), 1);
    }

    function test_Mint_Multiple() public {
        vm.prank(alice);
        nft.mint(3);

        assertEq(nft.balanceOf(alice), 3);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.ownerOf(2), alice);
        assertEq(nft.ownerOf(3), alice);
        assertEq(nft.totalMinted(), 3);
    }

    function test_Mint_SequentialTokenIdsAcrossWallets() public {
        vm.prank(alice);
        nft.mint(2);
        vm.prank(bob);
        nft.mint(2);

        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.ownerOf(2), alice);
        assertEq(nft.ownerOf(3), bob);
        assertEq(nft.ownerOf(4), bob);
        assertEq(nft.totalMinted(), 4);
    }

    function test_Mint_UpToWalletLimit() public {
        vm.prank(alice);
        nft.mint(MAX_PER_WALLET);
        assertEq(nft.balanceOf(alice), MAX_PER_WALLET);
        assertEq(nft.remainingForWallet(alice), 0);
    }

    function test_Mint_RevertsOnZeroQuantity() public {
        vm.prank(alice);
        vm.expectRevert(Vault01Genesis.ZeroQuantity.selector);
        nft.mint(0);
    }

    // -----------------------------------------------------------------
    // KYC enforcement
    // -----------------------------------------------------------------

    function test_Mint_RevertsWhenNotVerified() public {
        vm.prank(mallory);
        vm.expectRevert(
            abi.encodeWithSelector(Vault01Genesis.NotVerifiedOnRedbelly.selector, mallory)
        );
        nft.mint(1);
    }

    function test_Mint_SucceedsAfterVerificationGranted() public {
        vm.prank(mallory);
        vm.expectRevert(
            abi.encodeWithSelector(Vault01Genesis.NotVerifiedOnRedbelly.selector, mallory)
        );
        nft.mint(1);

        registry.setAllowed(mallory, true);

        vm.prank(mallory);
        nft.mint(1);
        assertEq(nft.balanceOf(mallory), 1);
    }

    function test_Mint_RevertsAfterVerificationRevoked() public {
        vm.prank(alice);
        nft.mint(1);

        registry.setAllowed(alice, false);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Vault01Genesis.NotVerifiedOnRedbelly.selector, alice)
        );
        nft.mint(1);
    }

    function test_IsVerified_ReflectsRegistry() public {
        assertTrue(nft.isVerified(alice));
        assertFalse(nft.isVerified(mallory));

        registry.setAllowed(mallory, true);
        assertTrue(nft.isVerified(mallory));
    }

    function test_Mint_BubblesUpRegistryFailure() public {
        registry.setShouldRevert(true);
        vm.prank(alice);
        vm.expectRevert("registry down");
        nft.mint(1);
    }

    // -----------------------------------------------------------------
    // Supply limits
    // -----------------------------------------------------------------

    function test_Mint_RevertsWhenExceedingMaxSupply() public {
        // Use a small-supply instance to exhaust it cheaply.
        Vault01Genesis small = new Vault01Genesis(
            "S", "S", 3, 0, 10, address(registry), owner, royaltyReceiver, 0, UNREVEALED_URI
        );
        vm.prank(owner);
        small.unpause();

        vm.prank(alice);
        small.mint(3);
        assertEq(small.remainingSupply(), 0);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.ExceedsMaxSupply.selector, 1, 0));
        small.mint(1);
    }

    function test_Mint_RevertsWhenPartiallyExceedingSupply() public {
        Vault01Genesis small = new Vault01Genesis(
            "S", "S", 3, 0, 10, address(registry), owner, royaltyReceiver, 0, UNREVEALED_URI
        );
        vm.prank(owner);
        small.unpause();

        vm.prank(alice);
        small.mint(2);

        // Only 1 left, asking for 2.
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.ExceedsMaxSupply.selector, 2, 1));
        small.mint(2);
    }

    function test_Mint_ExactlyExhaustsSupply() public {
        Vault01Genesis small = new Vault01Genesis(
            "S", "S", 2, 0, 10, address(registry), owner, royaltyReceiver, 0, UNREVEALED_URI
        );
        vm.prank(owner);
        small.unpause();

        vm.prank(alice);
        small.mint(2);

        assertEq(small.totalMinted(), 2);
        assertEq(small.remainingSupply(), 0);
        assertFalse(small.mintOpen(), "mint should read closed when sold out");
    }

    // -----------------------------------------------------------------
    // Per-wallet limit
    // -----------------------------------------------------------------

    function test_Mint_RevertsWhenExceedingWalletLimitInOneCall() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                Vault01Genesis.ExceedsWalletLimit.selector, MAX_PER_WALLET + 1, MAX_PER_WALLET
            )
        );
        nft.mint(MAX_PER_WALLET + 1);
    }

    function test_Mint_RevertsWhenExceedingWalletLimitCumulatively() public {
        vm.startPrank(alice);
        nft.mint(3);
        vm.expectRevert(
            abi.encodeWithSelector(Vault01Genesis.ExceedsWalletLimit.selector, 3, 2)
        );
        nft.mint(3);
        vm.stopPrank();
    }

    function test_Mint_WalletLimitIsPerWallet() public {
        vm.prank(alice);
        nft.mint(MAX_PER_WALLET);

        // Bob is unaffected by alice's exhausted allowance.
        vm.prank(bob);
        nft.mint(MAX_PER_WALLET);

        assertEq(nft.balanceOf(bob), MAX_PER_WALLET);
    }

    function test_RemainingForWallet_CappedBySupply() public {
        Vault01Genesis small = new Vault01Genesis(
            "S", "S", 2, 0, 10, address(registry), owner, royaltyReceiver, 0, UNREVEALED_URI
        );
        // Wallet limit is 10 but only 2 tokens exist.
        assertEq(small.remainingForWallet(alice), 2);
    }

    function test_Mint_TransferringOutDoesNotResetWalletLimit() public {
        vm.startPrank(alice);
        nft.mint(MAX_PER_WALLET);
        // Move everything out; the per-wallet counter must not reset.
        for (uint256 i = 1; i <= MAX_PER_WALLET; ++i) {
            nft.transferFrom(alice, bob, i);
        }
        assertEq(nft.balanceOf(alice), 0);

        vm.expectRevert(
            abi.encodeWithSelector(Vault01Genesis.ExceedsWalletLimit.selector, 1, 0)
        );
        nft.mint(1);
        vm.stopPrank();
    }

    // -----------------------------------------------------------------
    // Payment
    // -----------------------------------------------------------------

    function test_Mint_RevertsOnOverpaymentWhenFree() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Vault01Genesis.IncorrectPayment.selector, 0, 1 ether)
        );
        nft.mint{ value: 1 ether }(1);
    }

    function test_Mint_PaidMintExactPayment() public {
        vm.prank(owner);
        nft.setMintPrice(25 ether);

        vm.prank(alice);
        nft.mint{ value: 50 ether }(2);

        assertEq(nft.balanceOf(alice), 2);
        assertEq(address(nft).balance, 50 ether);
    }

    function test_Mint_RevertsOnUnderpayment() public {
        vm.prank(owner);
        nft.setMintPrice(25 ether);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Vault01Genesis.IncorrectPayment.selector, 50 ether, 49 ether)
        );
        nft.mint{ value: 49 ether }(2);
    }

    function test_Mint_RevertsOnZeroPaymentWhenPriced() public {
        vm.prank(owner);
        nft.setMintPrice(25 ether);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Vault01Genesis.IncorrectPayment.selector, 25 ether, 0)
        );
        nft.mint(1);
    }

    function test_Mint_RevertsOnOverpaymentWhenPriced() public {
        vm.prank(owner);
        nft.setMintPrice(25 ether);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Vault01Genesis.IncorrectPayment.selector, 25 ether, 26 ether)
        );
        nft.mint{ value: 26 ether }(1);
    }

    // -----------------------------------------------------------------
    // Pause
    // -----------------------------------------------------------------

    function test_Mint_RevertsWhenPaused() public {
        vm.prank(owner);
        nft.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        nft.mint(1);
    }

    function test_Pause_Unpause_Cycle() public {
        vm.startPrank(owner);
        nft.pause();
        assertFalse(nft.mintOpen());
        nft.unpause();
        assertTrue(nft.mintOpen());
        vm.stopPrank();

        vm.prank(alice);
        nft.mint(1);
        assertEq(nft.balanceOf(alice), 1);
    }

    function test_Pause_RevertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        nft.pause();
    }

    // -----------------------------------------------------------------
    // Access control
    // -----------------------------------------------------------------

    function test_OnlyOwner_SetMintPrice() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        nft.setMintPrice(1 ether);
    }

    function test_OnlyOwner_SetMaxPerWallet() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        nft.setMaxPerWallet(10);
    }

    function test_OnlyOwner_SetAccessRegistry() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        nft.setAccessRegistry(address(0xdead));
    }

    function test_OnlyOwner_SetBaseURI() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        nft.setBaseURI("ipfs://x/");
    }

    function test_OnlyOwner_Reveal() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        nft.reveal("ipfs://x/");
    }

    function test_OnlyOwner_Withdraw() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        nft.withdraw(alice);
    }

    function test_OnlyOwner_SetDefaultRoyalty() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        nft.setDefaultRoyalty(alice, 1000);
    }

    // -----------------------------------------------------------------
    // Owner configuration behaviour
    // -----------------------------------------------------------------

    function test_SetMintPrice_UpdatesAndEmits() public {
        vm.expectEmit(false, false, false, true);
        emit MintPriceUpdated(0, 42 ether);
        vm.prank(owner);
        nft.setMintPrice(42 ether);
        assertEq(nft.mintPrice(), 42 ether);
    }

    function test_SetMaxPerWallet_RevertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(Vault01Genesis.InvalidWalletLimit.selector);
        nft.setMaxPerWallet(0);
    }

    function test_SetAccessRegistry_RevertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(Vault01Genesis.ZeroAddress.selector);
        nft.setAccessRegistry(address(0));
    }

    function test_SetAccessRegistry_RepointsSuccessfully() public {
        MockRedbellyAccess newRegistry = new MockRedbellyAccess();
        newRegistry.setAllowed(mallory, true);

        vm.expectEmit(true, true, false, false);
        emit AccessRegistryUpdated(address(registry), address(newRegistry));
        vm.prank(owner);
        nft.setAccessRegistry(address(newRegistry));

        // mallory is verified on the new registry, alice is not.
        vm.prank(mallory);
        nft.mint(1);
        assertEq(nft.balanceOf(mallory), 1);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Vault01Genesis.NotVerifiedOnRedbelly.selector, alice)
        );
        nft.mint(1);
    }

    function test_LoweringWalletLimit_DoesNotClawBack() public {
        vm.prank(alice);
        nft.mint(5);

        vm.prank(owner);
        nft.setMaxPerWallet(2);

        assertEq(nft.balanceOf(alice), 5, "already-minted tokens are untouched");
        assertEq(nft.remainingForWallet(alice), 0);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Vault01Genesis.ExceedsWalletLimit.selector, 1, 0)
        );
        nft.mint(1);
    }

    // -----------------------------------------------------------------
    // Metadata
    // -----------------------------------------------------------------

    function test_TokenURI_UnrevealedReturnsPlaceholder() public {
        vm.prank(alice);
        nft.mint(2);

        assertEq(nft.tokenURI(1), UNREVEALED_URI);
        assertEq(nft.tokenURI(2), UNREVEALED_URI);
    }

    function test_TokenURI_RevealedReturnsBasePlusId() public {
        vm.prank(alice);
        nft.mint(2);

        vm.expectEmit(false, false, false, true);
        emit Revealed("ipfs://realcid/");
        vm.prank(owner);
        nft.reveal("ipfs://realcid/");

        assertTrue(nft.revealed());
        assertEq(nft.tokenURI(1), "ipfs://realcid/1.json");
        assertEq(nft.tokenURI(2), "ipfs://realcid/2.json");
    }

    function test_TokenURI_RevertsForNonexistentToken() public {
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.NonexistentToken.selector, 999));
        nft.tokenURI(999);
    }

    function test_SetUnrevealedURI_Updates() public {
        vm.prank(alice);
        nft.mint(1);

        vm.prank(owner);
        nft.setUnrevealedURI("ipfs://newplaceholder.json");
        assertEq(nft.tokenURI(1), "ipfs://newplaceholder.json");
    }

    function test_Reveal_CanBeCorrected() public {
        vm.prank(alice);
        nft.mint(1);

        vm.startPrank(owner);
        nft.reveal("ipfs://wrongcid/");
        assertEq(nft.tokenURI(1), "ipfs://wrongcid/1.json");
        nft.reveal("ipfs://rightcid/");
        assertEq(nft.tokenURI(1), "ipfs://rightcid/1.json");
        vm.stopPrank();
    }

    // -----------------------------------------------------------------
    // Withdrawal
    // -----------------------------------------------------------------

    function test_Withdraw_SendsFullBalance() public {
        vm.prank(owner);
        nft.setMintPrice(10 ether);

        vm.prank(alice);
        nft.mint{ value: 30 ether }(3);
        assertEq(address(nft).balance, 30 ether);

        address payout = makeAddr("payout");
        vm.expectEmit(true, false, false, true);
        emit Withdrawn(payout, 30 ether);

        vm.prank(owner);
        nft.withdraw(payout);

        assertEq(payout.balance, 30 ether);
        assertEq(address(nft).balance, 0);
    }

    function test_Withdraw_RevertsOnZeroBalance() public {
        vm.prank(owner);
        vm.expectRevert(Vault01Genesis.NothingToWithdraw.selector);
        nft.withdraw(owner);
    }

    function test_Withdraw_RevertsOnZeroAddress() public {
        vm.prank(owner);
        nft.setMintPrice(1 ether);
        vm.prank(alice);
        nft.mint{ value: 1 ether }(1);

        vm.prank(owner);
        vm.expectRevert(Vault01Genesis.ZeroAddress.selector);
        nft.withdraw(address(0));
    }

    function test_Withdraw_RevertsWhenReceiverRejects() public {
        vm.prank(owner);
        nft.setMintPrice(1 ether);
        vm.prank(alice);
        nft.mint{ value: 1 ether }(1);

        RejectingReceiver rejecting = new RejectingReceiver();
        vm.prank(owner);
        vm.expectRevert(Vault01Genesis.WithdrawFailed.selector);
        nft.withdraw(address(rejecting));
    }

    // -----------------------------------------------------------------
    // Reentrancy
    // -----------------------------------------------------------------

    function test_Mint_ReentrancyBlocked() public {
        ReentrantMinter attacker = new ReentrantMinter(address(nft));
        registry.setAllowed(address(attacker), true);
        vm.deal(address(attacker), 10 ether);

        // The nested mint attempt inside onERC721Received must fail, which makes
        // _safeMint's callback revert, which reverts the whole outer call.
        vm.expectRevert();
        attacker.attack(1);

        assertEq(nft.totalMinted(), 0, "no tokens minted via reentrancy");
    }

    // -----------------------------------------------------------------
    // Royalties / interfaces
    // -----------------------------------------------------------------

    function test_RoyaltyInfo() public view {
        (address receiver, uint256 amount) = nft.royaltyInfo(1, 1000 ether);
        assertEq(receiver, royaltyReceiver);
        assertEq(amount, 50 ether); // 5%
    }

    function test_SetDefaultRoyalty_Updates() public {
        address newReceiver = makeAddr("newRoyalty");
        vm.prank(owner);
        nft.setDefaultRoyalty(newReceiver, 250);

        (address receiver, uint256 amount) = nft.royaltyInfo(1, 1000 ether);
        assertEq(receiver, newReceiver);
        assertEq(amount, 25 ether); // 2.5%
    }

    function test_SetDefaultRoyalty_RevertsOnZeroReceiver() public {
        vm.prank(owner);
        vm.expectRevert(Vault01Genesis.ZeroAddress.selector);
        nft.setDefaultRoyalty(address(0), 500);
    }

    function test_SupportsInterface() public view {
        assertTrue(nft.supportsInterface(type(IERC165).interfaceId));
        assertTrue(nft.supportsInterface(type(IERC721).interfaceId));
        assertTrue(nft.supportsInterface(type(IERC2981).interfaceId));
        assertFalse(nft.supportsInterface(0xdeadbeef));
    }

    // -----------------------------------------------------------------
    // Ownership
    // -----------------------------------------------------------------

    function test_TransferOwnership() public {
        address newOwner = makeAddr("newOwner");
        vm.prank(owner);
        nft.transferOwnership(newOwner);
        assertEq(nft.owner(), newOwner);

        vm.prank(newOwner);
        nft.setMintPrice(5 ether);
        assertEq(nft.mintPrice(), 5 ether);
    }

    // -----------------------------------------------------------------
    // Fuzz
    // -----------------------------------------------------------------

    function testFuzz_Mint_RespectsWalletLimit(uint256 quantity) public {
        quantity = bound(quantity, 1, 50);

        vm.prank(alice);
        if (quantity > MAX_PER_WALLET) {
            vm.expectRevert(
                abi.encodeWithSelector(
                    Vault01Genesis.ExceedsWalletLimit.selector, quantity, MAX_PER_WALLET
                )
            );
            nft.mint(quantity);
            assertEq(nft.totalMinted(), 0);
        } else {
            nft.mint(quantity);
            assertEq(nft.balanceOf(alice), quantity);
        }
    }

    function testFuzz_Mint_ExactPaymentRequired(uint256 price, uint256 sent) public {
        price = bound(price, 1, 100 ether);
        sent = bound(sent, 0, 200 ether);

        vm.prank(owner);
        nft.setMintPrice(price);

        vm.deal(alice, 500 ether);
        vm.prank(alice);
        if (sent != price) {
            vm.expectRevert(
                abi.encodeWithSelector(Vault01Genesis.IncorrectPayment.selector, price, sent)
            );
            nft.mint{ value: sent }(1);
        } else {
            nft.mint{ value: sent }(1);
            assertEq(nft.balanceOf(alice), 1);
        }
    }

    function testFuzz_NeverExceedsMaxSupply(uint8 walletCount, uint8 perWallet) public {
        uint256 wallets = bound(walletCount, 1, 40);
        uint256 each = bound(perWallet, 1, 5);

        Vault01Genesis small = new Vault01Genesis(
            "S", "S", 20, 0, 5, address(registry), owner, royaltyReceiver, 0, UNREVEALED_URI
        );
        vm.prank(owner);
        small.unpause();

        for (uint256 i = 0; i < wallets; ++i) {
            address minter = address(uint160(uint256(keccak256(abi.encode("w", i)))));
            registry.setAllowed(minter, true);
            vm.prank(minter);
            try small.mint(each) { } catch { }
        }

        assertLe(small.totalMinted(), small.MAX_SUPPLY(), "supply cap must never be exceeded");
    }
}
