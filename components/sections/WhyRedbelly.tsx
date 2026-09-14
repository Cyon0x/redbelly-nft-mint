import { Fingerprint, Layers, ShieldCheck } from "lucide-react";
import { SectionHeading } from "./Gallery";

/**
 * Only claims verified directly against Redbelly's live mainnet during
 * development, or that describe this collection's own contract. No invented
 * statistics, no unsupported performance claims, no fabricated partnerships.
 */
const POINTS = [
  {
    icon: Fingerprint,
    title: "Identity is part of the network",
    body: "Redbelly operates on-chain permissioning: an address must be verified before the network will accept its transactions. That check is not an application feature — it is a property of the chain itself.",
  },
  {
    icon: ShieldCheck,
    title: "Verification enforced in the contract",
    body: "This collection's contract calls Redbelly's identity registry directly at mint time. A mint from an unverified wallet reverts on-chain, not just in the interface. Every holder was verified at the moment they minted.",
  },
  {
    icon: Layers,
    title: "Minted natively, not bridged",
    body: "The contract is deployed on Redbelly Mainnet and the NFT is native to it. There is no bridge, no wrapped representation, and no dependency on another chain for ownership.",
  },
];

export function WhyRedbelly() {
  return (
    <section id="why-redbelly" className="scroll-mt-20 bg-rb-bg-alt py-16 sm:py-20">
      <div className="rb-container">
        <SectionHeading
          eyebrow="Why Redbelly"
          title="A collection where every holder is verified"
          description="Most NFT collections cannot say anything about who holds them. On Redbelly, identity verification is enforced by the network — and, for this collection, by the contract itself."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <div key={point.title} className="rb-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rb-red-tint">
                  <Icon className="h-5 w-5 text-rb-red-solid" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-rb-ink">
                  {point.title}
                </h3>
                <p className="mt-2 leading-relaxed text-rb-muted">{point.body}</p>
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-rb-muted">
          Redbelly&apos;s identity registry and permissioning behaviour described above were
          verified directly against Redbelly Mainnet during development.
        </p>
      </div>
    </section>
  );
}
