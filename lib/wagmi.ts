import { http, createConfig, cookieStorage, createStorage } from "wagmi";
import { injected } from "wagmi";
import { redbellyMainnet, redbellyTestnet } from "./chains";

/**
 * wagmi configuration.
 *
 * Deliberately minimal: MetaMask plus generic injected wallets. No WalletConnect,
 * because it requires an external project id and a hosted relay for a chain whose
 * users connect with browser wallets. Adding it would mean a runtime dependency on
 * a third-party service for no gain here.
 */
export const wagmiConfig = createConfig({
  chains: [redbellyMainnet, redbellyTestnet],
  connectors: [injected({ shimDisconnect: true })],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [redbellyMainnet.id]: http(),
    [redbellyTestnet.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
