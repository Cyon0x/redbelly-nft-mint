// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { RedbellyGenesis } from "../src/RedbellyGenesis.sol";
import { IRedbellyAccess } from "../src/interfaces/IRedbellyAccess.sol";

/// @title Deploy
/// @notice Deploys {RedbellyGenesis}.
///
/// @dev ## Secure signing — no private key in a file
///
///      Import your deployer key once into Foundry's encrypted keystore:
///
///          cast wallet import redbelly-deployer --interactive
///
///      (Paste the key at the prompt; it is encrypted with a password you choose
///      and stored in ~/.foundry/keystores. It never touches the repo or a .env.)
///
///      Dry run (no broadcast, no funds spent):
///
///          forge script script/Deploy.s.sol:Deploy \
///            --rpc-url redbelly_mainnet --account redbelly-deployer
///
///      Real deployment:
///
///          forge script script/Deploy.s.sol:Deploy \
///            --rpc-url redbelly_mainnet --account redbelly-deployer --broadcast
///
///      ## Configuration
///
///      Every parameter is env-overridable so no code edit is needed to change the
///      collection. Defaults match the agreed launch configuration.
contract Deploy is Script {
    /// @notice Redbelly's live identity registry on mainnet (chain 151).
    address internal constant REDBELLY_MAINNET_ACCESS = 0xcb385cD90ca6b219798F57B4a7958897e91A9163;
    /// @notice Redbelly's identity registry on testnet (chain 153).
    address internal constant REDBELLY_TESTNET_ACCESS = 0x519ba1b48D571FD92FAF6FE4D20fe74Ca435B690;

    function run() external returns (RedbellyGenesis nft) {
        address deployer = msg.sender;

        // --- Resolve configuration ---------------------------------------
        string memory name_ = vm.envOr("COLLECTION_NAME", string("Redbelly Genesis"));
        string memory symbol_ = vm.envOr("COLLECTION_SYMBOL", string("RBGEN"));
        uint256 maxSupply = vm.envOr("MAX_SUPPLY", uint256(500));
        uint256 mintPrice = vm.envOr("MINT_PRICE_WEI", uint256(0));
        uint256 maxPerWallet = vm.envOr("MAX_PER_WALLET", uint256(5));
        uint96 royaltyBps = uint96(vm.envOr("ROYALTY_BPS", uint256(500)));
        string memory unrevealedURI =
            vm.envOr("UNREVEALED_URI", string("ipfs://placeholder/prereveal.json"));

        address accessRegistry = vm.envOr("ACCESS_REGISTRY", _defaultRegistry());
        address owner = vm.envOr("OWNER_ADDRESS", deployer);
        address royaltyReceiver = vm.envOr("ROYALTY_RECEIVER", owner);

        // --- Preflight safety checks --------------------------------------
        _preflight(accessRegistry, deployer);

        // --- Report --------------------------------------------------------
        console2.log("=====================================================");
        console2.log("  RedbellyGenesis deployment");
        console2.log("=====================================================");
        console2.log("Chain ID:          ", block.chainid);
        console2.log("Deployer:          ", deployer);
        console2.log("Deployer balance:  ", deployer.balance);
        console2.log("-----------------------------------------------------");
        console2.log("Collection:        ", name_);
        console2.log("Symbol:            ", symbol_);
        console2.log("Max supply:        ", maxSupply);
        console2.log("Mint price (wei):  ", mintPrice);
        console2.log("Max per wallet:    ", maxPerWallet);
        console2.log("Royalty (bps):     ", royaltyBps);
        console2.log("Royalty receiver:  ", royaltyReceiver);
        console2.log("Owner:             ", owner);
        console2.log("Access registry:   ", accessRegistry);
        console2.log("Unrevealed URI:    ", unrevealedURI);
        console2.log("=====================================================");

        // --- Deploy ---------------------------------------------------------
        vm.startBroadcast();

        nft = new RedbellyGenesis(
            name_,
            symbol_,
            maxSupply,
            mintPrice,
            maxPerWallet,
            accessRegistry,
            owner,
            royaltyReceiver,
            royaltyBps,
            unrevealedURI
        );

        vm.stopBroadcast();

        console2.log("");
        console2.log("Deployed RedbellyGenesis at:", address(nft));
        console2.log("");
        console2.log("The contract is deployed PAUSED. Next steps:");
        console2.log("  1. Verify on Routescan:      npm run verify");
        console2.log("  2. Confirm config on-chain (reads below should match the table above).");
        console2.log("  3. Set NEXT_PUBLIC_NFT_CONTRACT_ADDRESS in the frontend env.");
        console2.log("  4. When ready to open minting:  cast send <addr> 'unpause()'");
    }

    /// @dev Picks the correct registry for the current chain.
    function _defaultRegistry() internal view returns (address) {
        if (block.chainid == 151) return REDBELLY_MAINNET_ACCESS;
        if (block.chainid == 153) return REDBELLY_TESTNET_ACCESS;
        revert(
            "No default access registry for this chain. Set ACCESS_REGISTRY explicitly."
        );
    }

    /// @dev Fails fast, before spending gas, on the two mistakes that actually happen:
    ///      a registry address with no contract behind it, and an unverified deployer
    ///      (which Redbelly's protocol-level permissioning would reject anyway).
    function _preflight(address accessRegistry, address deployer) internal view {
        if (accessRegistry.code.length == 0) {
            revert("ACCESS_REGISTRY has no bytecode on this chain - wrong address or wrong network");
        }

        try IRedbellyAccess(accessRegistry).isAllowed(deployer) returns (bool allowed) {
            if (!allowed) {
                console2.log("");
                console2.log("!! Deployer is NOT verified on Redbelly:", deployer);
                console2.log("!! Redbelly enforces identity at the protocol level, so this");
                console2.log("!! transaction will be rejected by the network.");
                console2.log("!! Complete verification at https://access.redbelly.network/ first.");
                revert("Deployer not verified on Redbelly");
            }
            console2.log("Preflight: deployer is verified on Redbelly.");
        } catch {
            revert("ACCESS_REGISTRY did not answer isAllowed(address) - is it the right contract?");
        }
    }
}
