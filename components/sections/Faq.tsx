"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SectionHeading } from "./Gallery";
import { useCollectionState } from "@/lib/hooks/useCollection";
import { collection, KYC_VERIFICATION_URL } from "@/lib/collection";
import { activeChain } from "@/lib/chains";
import { nftContractAddress } from "@/lib/addresses";
import { cn, formatNumber, formatRbnt, truncateAddress } from "@/lib/utils";

export function Faq() {
  const { mintPrice, maxPerWallet, maxSupply } = useCollectionState();

  const items: Array<{ q: string; a: React.ReactNode }> = [
    {
      q: "What is this NFT collection?",
      a: `${collection.name} is a ${formatNumber(maxSupply)}-piece ERC-721 collection minted natively on ${activeChain.name}. Every holder completed Redbelly identity verification before minting — enforced by the contract, not just checked by this website.`,
    },
    {
      q: "What network is it on?",
      a: `${activeChain.name}, chain ID ${activeChain.id}. The native token is RBNT. The collection is not deployed on any other chain and is not bridged.`,
    },
    {
      q: "What is the mint price?",
      a:
        mintPrice === 0n
          ? "Minting is free. You pay only Redbelly network gas, which is roughly 23 RBNT for a single mint. Minting several at once costs significantly less gas per NFT — about 7 RBNT each when minting five."
          : `${formatRbnt(mintPrice)} RBNT per NFT, plus network gas.`,
    },
    {
      q: "How many NFTs can I mint?",
      a: `Up to ${formatNumber(maxPerWallet)} per wallet. The limit is enforced by the contract and counts everything a wallet has ever minted — transferring tokens away does not reset it.`,
    },
    {
      q: "Why is KYC required?",
      a: (
        <>
          Redbelly is an identity-verified network: it enforces at the protocol level that an
          address must be verified before the network will accept its transactions. This
          collection also enforces the check inside the contract itself, so a mint from an
          unverified wallet reverts on-chain. You can complete verification at{" "}
          <a
            href={KYC_VERIFICATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-rb-red hover:underline"
          >
            Redbelly&apos;s official access portal
          </a>
          . Verification is done once for your wallet, not per application.
        </>
      ),
    },
    {
      q: "Which wallets are supported?",
      a: "MetaMask and any EVM-compatible browser wallet that supports adding a custom network. If your wallet does not know Redbelly yet, the Switch to Redbelly button will offer to add it for you.",
    },
    {
      q: "What happens after I mint?",
      a: "The NFT is sent to the wallet that minted it as part of the same transaction. The success screen shows your token ids and links the transaction on Routescan. It can take a short while to appear in your wallet's NFT view.",
    },
    {
      q: "Where can I view my NFT?",
      a: nftContractAddress
        ? `In any wallet or marketplace that supports Redbelly Network, or directly on Routescan under the collection contract ${truncateAddress(nftContractAddress)}.`
        : "Once the contract is deployed, your NFT will be viewable on Routescan and in any wallet that supports Redbelly Network.",
    },
    {
      q: "What happens if my transaction fails?",
      a: "Nothing is minted and no mint payment is taken — though the network still charges gas for the failed attempt, as it does on any EVM chain. This site translates the failure into a plain-language explanation and lets you retry. If a transaction is submitted but we lose track of it, we tell you to check the explorer before minting again rather than risk minting twice.",
    },
    {
      q: "Where is the contract?",
      a: nftContractAddress
        ? `The collection contract is deployed at ${nftContractAddress} on ${activeChain.name}, and is linked from the collection details section above and the footer.`
        : "The contract has not been deployed to mainnet yet. Once it is, its address will be shown in the collection details section and linked to Routescan.",
    },
    {
      q: "What happens when the collection sells out?",
      a: `Minting closes permanently once all ${formatNumber(maxSupply)} are minted. Supply is fixed in the contract and cannot be increased afterwards. After that, the only way to obtain one is on the secondary market.`,
    },
  ];

  return (
    <section id="faq" className="scroll-mt-20 bg-rb-bg-alt py-16 sm:py-20">
      <div className="rb-container">
        <SectionHeading eyebrow="Questions" title="Frequently asked" />

        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {items.map((item, i) => (
            <FaqItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ question, answer }: { question: string; answer: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rb-card overflow-hidden">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-rb-bg-alt"
          aria-expanded={open}
        >
          <span className="font-semibold text-rb-ink">{question}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-rb-muted transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      </h3>
      {open && (
        <div className="border-t border-rb-border px-5 py-4">
          <div className="leading-relaxed text-rb-muted">{answer}</div>
        </div>
      )}
    </div>
  );
}
