import { SectionHeading } from "./Gallery";
import { collection } from "@/lib/collection";

export function About() {
  return (
    <section id="about" className="scroll-mt-20 py-16 sm:py-20">
      <div className="rb-container">
        <div className="mx-auto max-w-3xl">
          <SectionHeading eyebrow="About" title={`What ${collection.name} is`} />

          <div className="mt-8 space-y-5 leading-relaxed text-rb-ink-soft">
            <p>
              {collection.name} is a {collection.maxSupply}-piece ERC-721 collection minted
              natively on Redbelly Network. It exists to demonstrate something most chains
              cannot offer: a collection whose every holder completed identity verification
              before they were able to mint.
            </p>
            <p>
              That property is not a claim made in marketing copy. It is enforced in the
              contract. Before any token is minted, the contract calls Redbelly&apos;s
              on-chain identity registry and reverts if the caller is not verified. Tokens
              are always minted to the caller, so the verified party and the receiving party
              are necessarily the same address.
            </p>
            <p>
              The collection launches as a free mint — you pay only Redbelly network gas.
              Supply is fixed permanently at {collection.maxSupply} by the contract and
              cannot be raised later.
            </p>
          </div>

          {/* Deliberate honesty about what this collection does not claim. */}
          <div className="mt-8 rounded-xl border border-rb-border bg-rb-bg-alt p-5">
            <h3 className="font-display text-base font-bold text-rb-ink">
              What this collection does not promise
            </h3>
            <p className="mt-2 leading-relaxed text-rb-muted">
              There is no roadmap of future rewards, no staking programme, no promised
              revenue share, and no claimed partnerships. The collection is what is described
              on this page and encoded in the contract — nothing more is implied.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
