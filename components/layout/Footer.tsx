import { ExternalLink } from "lucide-react";
import { CopyAddress } from "@/components/ui/CopyAddress";
import { RedbellyMark } from "@/components/ui/RedbellyMark";
import { collection, officialLinks } from "@/lib/collection";
import { accessRegistryAddress, nftContractAddress } from "@/lib/addresses";
import { activeChain, explorerAddressUrl } from "@/lib/chains";

export function Footer() {
  return (
    <footer className="border-t border-rb-border py-12">
      <div className="rb-container">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Identity */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <RedbellyMark className="h-9 w-auto" />
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-rb-muted">
              {collection.maxSupply} pieces, minted natively on {activeChain.name} with
              identity verification enforced on-chain.
            </p>
          </div>

          {/* Contracts */}
          <div>
            <h3 className="rb-eyebrow">Contracts</h3>
            <ul className="mt-3 space-y-2.5">
              <li>
                <p className="text-xs text-rb-muted">Collection</p>
                {nftContractAddress ? (
                  <CopyAddress
                    address={nftContractAddress}
                    label="collection contract"
                    className="mt-1"
                  />
                ) : (
                  <p className="mt-1 text-sm text-rb-muted">Pending deployment</p>
                )}
              </li>
              <li>
                <p className="text-xs text-rb-muted">Redbelly identity registry</p>
                <CopyAddress
                  address={accessRegistryAddress}
                  label="identity registry"
                  className="mt-1"
                />
              </li>
            </ul>
          </div>

          {/* Official links — Redbelly's own, none invented. */}
          <div>
            <h3 className="rb-eyebrow">Official links</h3>
            <ul className="mt-3 space-y-2">
              {officialLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-rb-muted transition-colors hover:text-rb-red"
                  >
                    {link.label}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </li>
              ))}
              {nftContractAddress && (
                <li>
                  <a
                    href={explorerAddressUrl(nftContractAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-rb-muted transition-colors hover:text-rb-red"
                  >
                    View contract on Routescan
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-rb-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-rb-muted">
            Built on {activeChain.name} · Chain ID {activeChain.id}
          </p>
          <p className="text-xs text-rb-muted">
            Not affiliated with or endorsed by Redbelly Network.
          </p>
        </div>
      </div>
    </footer>
  );
}
