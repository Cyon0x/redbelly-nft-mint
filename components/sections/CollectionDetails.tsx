"use client";

import { ExternalLink } from "lucide-react";
import { SectionHeading } from "./Gallery";
import { CopyAddress } from "@/components/ui/CopyAddress";
import { useCollectionState } from "@/lib/hooks/useCollection";
import { accessRegistryAddress, nftContractAddress } from "@/lib/addresses";
import { activeChain, explorerAddressUrl } from "@/lib/chains";
import { collection, mintPriceNote } from "@/lib/collection";
import { approxUsd, formatNumber, formatRbnt } from "@/lib/utils";

export function CollectionDetails() {
  const { maxSupply, mintPrice, maxPerWallet, soldOut, paused, isLive } = useCollectionState();

  const mintStatus = !isLive
    ? "Not yet deployed"
    : soldOut
      ? "Sold out"
      : paused
        ? "Paused"
        : "Live";

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Blockchain", value: activeChain.name },
    { label: "Chain ID", value: String(activeChain.id) },
    { label: "Token standard", value: "ERC-721" },
    { label: "Collection supply", value: formatNumber(maxSupply) },
    {
      label: "Mint price",
      value:
        mintPrice === 0n
          ? // The owner can set a zero price post-deployment; handled defensively.
            "Free (network gas only)"
          : `${formatRbnt(mintPrice)} RBNT (${approxUsd(mintPrice, mintPriceNote.referenceRate)})`,
    },
    {
      label: "Physical watches",
      value: `${formatNumber(collection.physicalAllocation)} of ${formatNumber(maxSupply)} tokens`,
    },
    { label: "Max per wallet", value: formatNumber(maxPerWallet) },
    { label: "Royalty", value: `${collection.royaltyBps / 100}% (ERC-2981)` },
    { label: "Mint status", value: mintStatus },
  ];

  return (
    <section id="details" className="scroll-mt-20 bg-rb-bg-alt py-16 sm:py-20">
      <div className="rb-container">
        <SectionHeading
          eyebrow="Contract"
          title="Collection details"
          description="Every value below is read live from the contract on Redbelly Network, not hardcoded into this page."
        />

        <div className="mx-auto mt-10 max-w-3xl">
          <dl className="rb-card divide-y divide-rb-border">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <dt className="text-sm text-rb-muted">{row.label}</dt>
                <dd className="font-medium text-rb-ink">{row.value}</dd>
              </div>
            ))}

            {/* Contract addresses */}
            <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="text-sm text-rb-muted">Collection contract</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {nftContractAddress ? (
                  <>
                    <CopyAddress address={nftContractAddress} label="collection contract" />
                    <a
                      href={explorerAddressUrl(nftContractAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-rb-red hover:underline"
                    >
                      View
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </>
                ) : (
                  <span className="text-sm text-rb-muted">Pending deployment</span>
                )}
              </dd>
            </div>

            <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="text-sm text-rb-muted">Redbelly identity registry</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <CopyAddress address={accessRegistryAddress} label="identity registry" />
                <a
                  href={explorerAddressUrl(accessRegistryAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-rb-red hover:underline"
                >
                  View
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
