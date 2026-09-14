/**
 * Minimal EIP-1193 provider typing.
 *
 * wagmi handles the provider internally; this is only needed for the direct
 * `wallet_addEthereumChain` fallback used when a wallet has never seen Redbelly.
 */
interface EthereumProvider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
  isMetaMask?: boolean;
}

interface Window {
  ethereum?: EthereumProvider;
}
