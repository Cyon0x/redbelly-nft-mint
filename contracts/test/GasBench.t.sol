// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test, console2 } from "forge-std/Test.sol";
import { RedbellyGenesis } from "../src/RedbellyGenesis.sol";
import { MockRedbellyAccess } from "./mocks/MockRedbellyAccess.sol";

/// @notice Measures real mint gas so mint economics can be reasoned about against
///         Redbelly's live base fee (~199,410 gwei measured on mainnet).
contract GasBenchTest is Test {
    RedbellyGenesis internal nft;
    MockRedbellyAccess internal registry;
    address internal owner = makeAddr("owner");
    address internal minter = makeAddr("minter");

    /// @dev Measured from live Redbelly mainnet receipts during discovery.
    uint256 internal constant REDBELLY_BASE_FEE_WEI = 199_409_747_148_440;

    function setUp() public {
        registry = new MockRedbellyAccess();
        nft = new RedbellyGenesis(
            "Redbelly Genesis",
            "RBGEN",
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
