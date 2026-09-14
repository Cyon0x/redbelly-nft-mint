// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IRedbellyAccess } from "../../src/interfaces/IRedbellyAccess.sol";

/// @notice Test double for Redbelly's on-chain identity registry.
contract MockRedbellyAccess is IRedbellyAccess {
    mapping(address => bool) public allowed;
    bool public shouldRevert;

    function setAllowed(address account, bool value) external {
        allowed[account] = value;
    }

    /// @notice Simulate a registry that reverts, e.g. a wrong/retired address.
    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function isAllowed(address account) external view returns (bool) {
        require(!shouldRevert, "registry down");
        return allowed[account];
    }
}

/// @notice Receiver that rejects native transfers, to exercise the withdraw failure path.
contract RejectingReceiver {
    receive() external payable {
        revert("no thanks");
    }
}

/// @notice ERC721 receiver that rejects safeMint callbacks.
contract NonERC721Receiver {
// Deliberately implements no onERC721Received.
}

/// @notice Reentrancy attacker that tries to re-enter mint from the safeMint callback.
contract ReentrantMinter {
    address public target;
    bool private attacked;

    constructor(address target_) {
        target = target_;
    }

    function attack(uint256 quantity) external payable {
        (bool ok, bytes memory data) =
            target.call{ value: msg.value }(abi.encodeWithSignature("mint(uint256)", quantity));
        if (!ok) {
            assembly {
                revert(add(data, 0x20), mload(data))
            }
        }
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        returns (bytes4)
    {
        if (!attacked) {
            attacked = true;
            // Attempt to re-enter. Should fail on the nonReentrant guard.
            (bool ok,) = target.call(abi.encodeWithSignature("mint(uint256)", uint256(1)));
            require(ok, "reentered");
        }
        return this.onERC721Received.selector;
    }
}
