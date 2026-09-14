// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test } from "forge-std/Test.sol";

import { Vault01Genesis } from "../src/Vault01Genesis.sol";
import { MockRedbellyAccess } from "./mocks/MockRedbellyAccess.sol";

/// @title PhysicalAssetTest
/// @notice Covers the physical watch registry: binding editions to tokens, unbinding,
///         and holder-initiated redemption.
contract PhysicalAssetTest is Test {
    Vault01Genesis internal nft;
    MockRedbellyAccess internal registry;

    address internal owner = makeAddr("owner");
    address internal royaltyReceiver = makeAddr("royaltyReceiver");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant MAX_SUPPLY = 500;
    uint256 internal constant MAX_PER_WALLET = 5;
    uint256 internal constant PHYSICAL_ALLOCATION = 50;

    event PhysicalAssetAssigned(uint256 indexed tokenId, uint16 indexed edition);
    event PhysicalAssetUnassigned(uint256 indexed tokenId, uint16 indexed edition);
    event PhysicalAssetRedeemed(
        uint256 indexed tokenId, uint16 indexed edition, address indexed redeemer
    );

    function setUp() public {
        registry = new MockRedbellyAccess();

        nft = new Vault01Genesis(
            "VAULT 01 - Genesis Collection",
            "VAULT01",
            MAX_SUPPLY,
            0, // free mint
            MAX_PER_WALLET,
            address(registry),
            owner,
            royaltyReceiver,
            500,
            "ipfs://placeholder/prereveal.json"
        );

        registry.setAllowed(alice, true);
        registry.setAllowed(bob, true);
        registry.setAllowed(carol, true);

        vm.prank(owner);
        nft.unpause();

        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
        vm.deal(carol, 1000 ether);
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    /// @dev Mints `quantity` tokens to `who` (who must be verified).
    function _mint(address who, uint256 quantity) internal {
        vm.prank(who);
        nft.mint(quantity);
    }

    /// @dev Builds parallel assign arrays for a contiguous token range.
    function _range(uint256 firstTokenId, uint16 firstEdition, uint256 len)
        internal
        pure
        returns (uint256[] memory tokenIds, uint16[] memory editions)
    {
        tokenIds = new uint256[](len);
        editions = new uint16[](len);
        // Counted in uint16 throughout, so no narrowing cast is needed at all.
        uint16 edition = firstEdition;
        for (uint256 i = 0; i < len; ++i) {
            tokenIds[i] = firstTokenId + i;
            editions[i] = edition++;
        }
    }

    // -----------------------------------------------------------------
    // Assignment — happy paths
    // -----------------------------------------------------------------

    function test_Assign_SingleToken() public {
        _mint(alice, 1); // token 1

        uint256[] memory tokenIds = new uint256[](1);
        uint16[] memory editions = new uint16[](1);
        tokenIds[0] = 1;
        editions[0] = 1;

        vm.expectEmit(true, true, false, true);
        emit PhysicalAssetAssigned(1, 1);

        vm.prank(owner);
        nft.assignPhysicalAssetBatch(tokenIds, editions);

        assertEq(nft.physicalEdition(1), 1);
        assertEq(nft.editionToken(1), 1);
        assertEq(nft.assignedCount(), 1);
    }

    function test_Assign_BatchOf50AcrossHolders() public {
        // 50 tokens needs ten wallets: the per-wallet cap is 5, so a real allocation
        // is necessarily spread across many holders rather than a few.
        for (uint256 w = 0; w < 10; ++w) {
            address holder = makeAddr(string.concat("holder", vm.toString(w)));
            registry.setAllowed(holder, true);
            vm.deal(holder, 100 ether);
            _mint(holder, 5);
        }

        (uint256[] memory tokenIds, uint16[] memory editions) = _range(1, 1, PHYSICAL_ALLOCATION);

        vm.prank(owner);
        nft.assignPhysicalAssetBatch(tokenIds, editions);

        assertEq(nft.assignedCount(), PHYSICAL_ALLOCATION);
        assertEq(nft.physicalEdition(1), 1);
        assertEq(nft.physicalEdition(50), 50);
    }

    function test_Assign_NonContiguousTokensAndEditions() public {
        _mint(alice, 5); // tokens 1-5

        // Deliberately scrambled and non-monotonic: the registry is a mapping, not a range.
        uint256[] memory tokenIds = new uint256[](3);
        uint16[] memory editions = new uint16[](3);
        tokenIds[0] = 4;
        editions[0] = 17;
        tokenIds[1] = 1;
        editions[1] = 50;
        tokenIds[2] = 3;
        editions[2] = 2;

        vm.prank(owner);
        nft.assignPhysicalAssetBatch(tokenIds, editions);

        assertEq(nft.physicalEdition(4), 17);
        assertEq(nft.physicalEdition(1), 50);
        assertEq(nft.physicalEdition(3), 2);
        assertEq(nft.editionToken(17), 4);
        assertEq(nft.editionToken(50), 1);
        assertEq(nft.assignedCount(), 3);
    }

    function test_Assign_CanTopUpInLaterCalls() public {
        _mint(alice, 5); // tokens 1-5

        (uint256[] memory t1, uint16[] memory e1) = _range(1, 1, 3);
        vm.prank(owner);
        nft.assignPhysicalAssetBatch(t1, e1);
        assertEq(nft.assignedCount(), 3);

        (uint256[] memory t2, uint16[] memory e2) = _range(4, 4, 2);
        vm.prank(owner);
        nft.assignPhysicalAssetBatch(t2, e2);

        assertEq(nft.assignedCount(), 5);
    }

    // -----------------------------------------------------------------
    // Assignment — reverts
    // -----------------------------------------------------------------

    function test_Assign_RevertsOnLengthMismatch() public {
        _mint(alice, 5);

        uint256[] memory tokenIds = new uint256[](2);
        uint16[] memory editions = new uint16[](1);
        tokenIds[0] = 1;
        tokenIds[1] = 2;
        editions[0] = 1;

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.LengthMismatch.selector, 2, 1));
        nft.assignPhysicalAssetBatch(tokenIds, editions);
    }

    function test_Assign_RevertsOnDuplicateEdition() public {
        _mint(alice, 5);

        uint256[] memory tokenIds = new uint256[](2);
        uint16[] memory editions = new uint16[](2);
        tokenIds[0] = 1;
        tokenIds[1] = 2;
        editions[0] = 7;
        editions[1] = 7; // same edition twice

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.EditionAlreadyAssigned.selector, 7));
        nft.assignPhysicalAssetBatch(tokenIds, editions);
    }

    function test_Assign_RevertsOnDuplicateToken() public {
        _mint(alice, 5);

        uint256[] memory tokenIds = new uint256[](2);
        uint16[] memory editions = new uint16[](2);
        tokenIds[0] = 3;
        tokenIds[1] = 3; // same token twice
        editions[0] = 1;
        editions[1] = 2;

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.TokenAlreadyAssigned.selector, 3));
        nft.assignPhysicalAssetBatch(tokenIds, editions);
    }

    function test_Assign_RevertsOnEditionZero() public {
        _mint(alice, 1);

        uint256[] memory tokenIds = new uint256[](1);
        uint16[] memory editions = new uint16[](1);
        tokenIds[0] = 1;
        editions[0] = 0;

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.InvalidEdition.selector, 0));
        nft.assignPhysicalAssetBatch(tokenIds, editions);
    }

    function test_Assign_RevertsOnEditionAboveAllocation() public {
        _mint(alice, 1);

        uint256[] memory tokenIds = new uint256[](1);
        uint16[] memory editions = new uint16[](1);
        tokenIds[0] = 1;
        editions[0] = 51; // one past the allocation

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.InvalidEdition.selector, 51));
        nft.assignPhysicalAssetBatch(tokenIds, editions);
    }

    function test_Assign_RevertsOnNonexistentToken() public {
        _mint(alice, 1); // only token 1 exists

        uint256[] memory tokenIds = new uint256[](1);
        uint16[] memory editions = new uint16[](1);
        tokenIds[0] = 999;
        editions[0] = 1;

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.NonexistentToken.selector, 999));
        nft.assignPhysicalAssetBatch(tokenIds, editions);
    }

    function test_Assign_RevertsOnExceedingAllocation() public {
        _mint(alice, 5);

        // 51 editions in one batch.
        uint256[] memory tokenIds = new uint256[](51);
        uint16[] memory editions = new uint16[](51);
        uint16 edition = 1;
        for (uint256 i = 0; i < 51; ++i) {
            tokenIds[i] = 1;
            editions[i] = edition++;
        }

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(Vault01Genesis.ExceedsPhysicalAllocation.selector, 51, 50)
        );
        nft.assignPhysicalAssetBatch(tokenIds, editions);
    }

    function test_Assign_RevertsForNonOwner() public {
        _mint(alice, 1);

        uint256[] memory tokenIds = new uint256[](1);
        uint16[] memory editions = new uint16[](1);
        tokenIds[0] = 1;
        editions[0] = 1;

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), alice)
        );
        nft.assignPhysicalAssetBatch(tokenIds, editions);
    }

    // -----------------------------------------------------------------
    // Unassign
    // -----------------------------------------------------------------

    function test_Unassign_FreesEditionForReuse() public {
        _mint(alice, 5);

        (uint256[] memory t1, uint16[] memory e1) = _range(1, 1, 3);
        vm.prank(owner);
        nft.assignPhysicalAssetBatch(t1, e1);

        vm.expectEmit(true, true, false, true);
        emit PhysicalAssetUnassigned(2, 2);
        vm.prank(owner);
        nft.unassignPhysicalAsset(2);

        assertEq(nft.physicalEdition(2), 0);
        assertEq(nft.editionToken(2), 0);
        assertEq(nft.assignedCount(), 2);

        // Edition 2 is now bindable to a different token.
        uint256[] memory t2 = new uint256[](1);
        uint16[] memory e2 = new uint16[](1);
        t2[0] = 5;
        e2[0] = 2;
        vm.prank(owner);
        nft.assignPhysicalAssetBatch(t2, e2);

        assertEq(nft.physicalEdition(5), 2);
    }

    function test_Unassign_RevertsWhenNoPhysicalAsset() public {
        _mint(alice, 1);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.NoPhysicalAsset.selector, 1));
        nft.unassignPhysicalAsset(1);
    }

    function test_Unassign_RevertsForNonOwner() public {
        _mint(alice, 1);
        (uint256[] memory t, uint16[] memory e) = _range(1, 1, 1);
        vm.prank(owner);
        nft.assignPhysicalAssetBatch(t, e);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), alice)
        );
        nft.unassignPhysicalAsset(1);
    }

    // -----------------------------------------------------------------
    // Redemption
    // -----------------------------------------------------------------

    function test_Redeem_ByTokenOwnerSucceeds() public {
        _mint(alice, 1);
        (uint256[] memory t, uint16[] memory e) = _range(1, 1, 1);
        vm.prank(owner);
        nft.assignPhysicalAssetBatch(t, e);

        vm.expectEmit(true, true, true, true);
        emit PhysicalAssetRedeemed(1, 1, alice);

        vm.prank(alice);
        nft.redeemPhysicalAsset(1);

        assertTrue(nft.physicalRedeemed(1));
        assertEq(uint256(nft.physicalStatus(1)), uint256(Vault01Genesis.PhysicalStatus.Redeemed));
    }

    function test_Redeem_RevertsForNonOwnerOfToken() public {
        _mint(alice, 1); // alice owns token 1
        (uint256[] memory t, uint16[] memory e) = _range(1, 1, 1);
        vm.prank(owner);
        nft.assignPhysicalAssetBatch(t, e);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.NotTokenOwner.selector, 1, bob));
        nft.redeemPhysicalAsset(1);
    }

    function test_Redeem_RevertsForProjectOwnerWhoDoesNotHoldToken() public {
        _mint(alice, 1);
        (uint256[] memory t, uint16[] memory e) = _range(1, 1, 1);
        vm.prank(owner);
        nft.assignPhysicalAssetBatch(t, e);

        // The project must not be able to mark a holder's watch as claimed.
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.NotTokenOwner.selector, 1, owner));
        nft.redeemPhysicalAsset(1);
    }

    function test_Redeem_RevertsTwice() public {
        _mint(alice, 1);
        (uint256[] memory t, uint16[] memory e) = _range(1, 1, 1);
        vm.prank(owner);
        nft.assignPhysicalAssetBatch(t, e);

        vm.prank(alice);
        nft.redeemPhysicalAsset(1);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.AlreadyRedeemed.selector, 1));
        nft.redeemPhysicalAsset(1);
    }

    function test_Redeem_RevertsWhenNoPhysicalAsset() public {
        _mint(alice, 1);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.NoPhysicalAsset.selector, 1));
        nft.redeemPhysicalAsset(1);
    }

    function test_Unassign_RevertsAfterRedeem() public {
        _mint(alice, 1);
        (uint256[] memory t, uint16[] memory e) = _range(1, 1, 1);
        vm.prank(owner);
        nft.assignPhysicalAssetBatch(t, e);

        vm.prank(alice);
        nft.redeemPhysicalAsset(1);

        // The claim already happened on-chain; erasing it would rewrite provenance.
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.CannotUnassignRedeemed.selector, 1));
        nft.unassignPhysicalAsset(1);
    }

    // -----------------------------------------------------------------
    // Interaction with transfers
    // -----------------------------------------------------------------

    function test_Transfer_CarriesPhysicalAssetToNewOwner() public {
        _mint(alice, 1);
        (uint256[] memory t, uint16[] memory e) = _range(1, 1, 1);
        vm.prank(owner);
        nft.assignPhysicalAssetBatch(t, e);

        vm.prank(alice);
        nft.transferFrom(alice, bob, 1);

        assertEq(nft.ownerOf(1), bob);
        assertEq(nft.physicalEdition(1), 1); // binding travels with the token
        assertEq(nft.physicalSerial(1), "VAULT01-WATCH-001");
    }

    function test_Redeem_IsPossibleByNewOwnerAfterTransfer() public {
        _mint(alice, 1);
        (uint256[] memory t, uint16[] memory e) = _range(1, 1, 1);
        vm.prank(owner);
        nft.assignPhysicalAssetBatch(t, e);

        vm.prank(alice);
        nft.transferFrom(alice, bob, 1);

        vm.prank(bob);
        nft.redeemPhysicalAsset(1);
        assertTrue(nft.physicalRedeemed(1));
    }

    function test_Redeem_TransferredTokenStaysRedeemedAndStillTradable() public {
        _mint(alice, 1);
        (uint256[] memory t, uint16[] memory e) = _range(1, 1, 1);
        vm.prank(owner);
        nft.assignPhysicalAssetBatch(t, e);

        vm.prank(alice);
        nft.redeemPhysicalAsset(1);

        // Redemption must not freeze the token; it only reports status.
        vm.prank(alice);
        nft.transferFrom(alice, carol, 1);

        assertEq(nft.ownerOf(1), carol);
        assertTrue(nft.physicalRedeemed(1));
        assertEq(uint256(nft.physicalStatus(1)), uint256(Vault01Genesis.PhysicalStatus.Redeemed));

        // Carol cannot re-claim an already-claimed watch.
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.AlreadyRedeemed.selector, 1));
        nft.redeemPhysicalAsset(1);
    }

    function test_Redeem_RevertsWhenStrangerHoldsNothing() public {
        _mint(alice, 1);
        (uint256[] memory t, uint16[] memory e) = _range(1, 1, 1);
        vm.prank(owner);
        nft.assignPhysicalAssetBatch(t, e);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Vault01Genesis.NotTokenOwner.selector, 1, stranger));
        nft.redeemPhysicalAsset(1);
    }

    // -----------------------------------------------------------------
    // Serial derivation and status
    // -----------------------------------------------------------------

    function test_Serial_ZeroPadsToThreeDigits() public {
        _mint(alice, 5);

        uint256[] memory tokenIds = new uint256[](3);
        uint16[] memory editions = new uint16[](3);
        tokenIds[0] = 1;
        editions[0] = 7;
        tokenIds[1] = 2;
        editions[1] = 17;
        tokenIds[2] = 3;
        editions[2] = 50;

        vm.prank(owner);
        nft.assignPhysicalAssetBatch(tokenIds, editions);

        assertEq(nft.physicalSerial(1), "VAULT01-WATCH-007");
        assertEq(nft.physicalSerial(2), "VAULT01-WATCH-017");
        assertEq(nft.physicalSerial(3), "VAULT01-WATCH-050");
    }

    function test_Serial_EmptyWhenUnassigned() public {
        _mint(alice, 1);
        assertEq(nft.physicalSerial(1), "");
    }

    function test_Serial_Edition1And100Boundaries() public {
        _mint(alice, 5);

        uint256[] memory tokenIds = new uint256[](2);
        uint16[] memory editions = new uint16[](2);
        tokenIds[0] = 1;
        editions[0] = 1;
        tokenIds[1] = 2;
        editions[1] = 50;

        vm.prank(owner);
        nft.assignPhysicalAssetBatch(tokenIds, editions);

        assertEq(nft.physicalSerial(1), "VAULT01-WATCH-001");
        assertEq(nft.physicalSerial(2), "VAULT01-WATCH-050");
    }

    function test_Status_TransitionsUnassignedAssignedRedeemed() public {
        _mint(alice, 1);

        assertEq(
            uint256(nft.physicalStatus(1)), uint256(Vault01Genesis.PhysicalStatus.Unassigned)
        );

        (uint256[] memory t, uint16[] memory e) = _range(1, 1, 1);
        vm.prank(owner);
        nft.assignPhysicalAssetBatch(t, e);

        assertEq(uint256(nft.physicalStatus(1)), uint256(Vault01Genesis.PhysicalStatus.Assigned));

        vm.prank(alice);
        nft.redeemPhysicalAsset(1);

        assertEq(uint256(nft.physicalStatus(1)), uint256(Vault01Genesis.PhysicalStatus.Redeemed));
    }

    function test_PhysicalAllocation_IsFifty() public view {
        assertEq(nft.PHYSICAL_ALLOCATION(), 50);
    }
}

