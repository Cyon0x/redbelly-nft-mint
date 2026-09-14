// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IRedbellyAccess
/// @notice Read interface for Redbelly Network's on-chain permission registry.
/// @dev This is the real, deployed registry that backs Redbelly's identity layer.
///      Mainnet: 0xcb385cD90ca6b219798F57B4a7958897e91A9163
///      Testnet: 0x519ba1b48D571FD92FAF6FE4D20fe74Ca435B690
///
///      `isAllowed` is the genuine function name and selector on that contract,
///      confirmed against the live mainnet deployment: unverified wallets return
///      false, wallets that have completed Redbelly KYC return true.
interface IRedbellyAccess {
    /// @notice Returns whether `account` has completed Redbelly identity verification.
    /// @param account The address to check.
    /// @return allowed True if the account is permitted on Redbelly, false otherwise.
    function isAllowed(address account) external view returns (bool allowed);
}
