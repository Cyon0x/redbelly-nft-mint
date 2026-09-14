// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test, console2 } from "forge-std/Test.sol";
import { Vault01Genesis } from "../src/Vault01Genesis.sol";
import { MockRedbellyAccess } from "./mocks/MockRedbellyAccess.sol";

/// @notice Measures real mint gas so mint economics can be reasoned about against
///         Redbelly's live base fee (~199,410 gwei measured on mainnet).
contract GasBenchTest is Test {
    Vault01Genesis internal nft;
    MockRedbellyAccess internal registry;
    address internal owner = makeAddr("owner");
    address internal minter = makeAddr("minter");

    /// @dev Measured from live Redbelly mainnet receipts during discovery.
    uint256 internal constant REDBELLY_BASE_FEE_WEI = 199_409_747_148_440;

    function setUp() public {
        registry = new MockRedbellyAccess();
        nft = new Vault01Genesis(
            "VAULT 01 - Genesis Collection",
            "VAULT01",
            500,
            0,
            5,
            address(registry),
            owner,
            owner,
            500,
            "ipfs://placeholder/prereveal.json"
        );
        vm.prank(owner);
        nft.unpause();
        registry.setAllowed(minter, true);
        vm.deal(minter, 1000 ether);
    }

    function test_GasBench_MintCosts() public {
        console2.log("=== Mint gas, and cost at Redbelly mainnet base fee ===");
        _bench(1);
        _bench(2);
        _bench(3);
        _bench(5);
    }

    /// @notice Measures the physical-asset registry, since assigning the 50 watch
    ///         bindings is a real launch cost rather than a rounding error.
    ///
    ///         Measured like-for-like in this test (gasleft, both paths):
    ///           one batch of 50   2,369,244 + 21,000 intrinsic = 2,390,244
    ///           50 standalone     50 x (46,945 + 21,000)      = 3,397,250
    ///         Batching saves ~1,007,006 gas (~30%, ~201 RBNT at mainnet base fee),
    ///         and is also one transaction, one confirmation and atomic — no
    ///         half-assigned state if something fails partway.
    function test_GasBench_PhysicalAssetRegistry() public {
        console2.log("=== Physical asset registry gas ===");

        // Ten wallets, five tokens each: the per-wallet cap makes this the minimum
        // number of transactions needed to mint 50 tokens.
        uint256 nextTokenId = 1;
        for (uint256 w = 0; w < 10; ++w) {
            address holder = address(uint160(uint256(keccak256(abi.encode("holder", w)))));
            registry.setAllowed(holder, true);
            vm.deal(holder, 100 ether);
            vm.prank(holder);
            nft.mint(5);
            nextTokenId += 5;
        }

        uint256[] memory tokenIds = new uint256[](50);
        uint16[] memory editions = new uint16[](50);
        // Counted in uint16 throughout, so no narrowing cast is needed at all.
        uint16 edition = 1;
        for (uint256 i = 0; i < 50; ++i) {
            tokenIds[i] = i + 1;
            editions[i] = edition++;
        }

        vm.prank(owner);
        uint256 before = gasleft();
        nft.assignPhysicalAssetBatch(tokenIds, editions);
        uint256 batchGas = before - gasleft();

        console2.log("  assign 50 (one batch):");
        console2.log("    gas used:       ", batchGas);
        console2.log("    cost (milliRBNT):", (batchGas * REDBELLY_BASE_FEE_WEI) / 1e15);

        // A single-token transaction, for comparison with the batch. The batch above
        // filled the allocation, so free one slot and edition first.
        vm.prank(owner);
        nft.unassignPhysicalAsset(50);

        address solo = address(uint160(uint256(keccak256("solo"))));
        registry.setAllowed(solo, true);
        vm.deal(solo, 100 ether);
        vm.prank(solo);
        nft.mint(1);
        uint256 soloTokenId = nextTokenId;

        uint256[] memory one = new uint256[](1);
        uint16[] memory oneEdition = new uint16[](1);
        one[0] = soloTokenId;
        oneEdition[0] = 50; // freed by the unassign above

        vm.prank(owner);
        before = gasleft();
        nft.assignPhysicalAssetBatch(one, oneEdition);
        uint256 singleGas = before - gasleft();

        console2.log("  assign 1 (standalone):");
        console2.log("    gas used:       ", singleGas);
        console2.log("    plus 21,000 intrinsic per confirmation");

        // Redemption is paid by the holder, so its cost matters to collectors too.
        address holder0 = address(uint160(uint256(keccak256(abi.encode("holder", uint256(0))))));
        vm.prank(holder0);
        before = gasleft();
        nft.redeemPhysicalAsset(1);
        uint256 redeemGas = before - gasleft();

        console2.log("  redeem 1 (paid by holder):");
        console2.log("    gas used:       ", redeemGas);
        console2.log("    cost (milliRBNT):", (redeemGas * REDBELLY_BASE_FEE_WEI) / 1e15);
    }

    function _bench(uint256 quantity) internal {
        address wallet = address(uint160(uint256(keccak256(abi.encode("bench", quantity)))));
        registry.setAllowed(wallet, true);
        vm.deal(wallet, 100 ether);

        vm.prank(wallet);
        uint256 before = gasleft();
        nft.mint(quantity);
        uint256 used = before - gasleft();

        uint256 costWei = used * REDBELLY_BASE_FEE_WEI;
        console2.log("  quantity:", quantity);
        console2.log("    gas used:      ", used);
        console2.log("    cost (milliRBNT):", costWei / 1e15);
    }
}

