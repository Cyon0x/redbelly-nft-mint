import { SectionHeading } from "./Gallery";

const STEPS = [
  {
    n: "01",
    title: "Connect wallet",
    body: "Connect MetaMask or any EVM browser wallet. Nothing is signed and no transaction is sent at this stage.",
  },
  {
    n: "02",
    title: "Switch to Redbelly",
    body: "The site detects your network. If you are on a different chain, one click switches you — and adds Redbelly to your wallet if it isn't there yet.",
  },
  {
    n: "03",
    title: "Verification check",
    body: "Your wallet is checked against Redbelly's on-chain identity registry. If you have already completed Redbelly verification, this is instant and nothing further is needed.",
  },
  {
    n: "04",
    title: "Choose quantity",
    body: "Pick how many to mint, up to the per-wallet limit. The exact total is shown before you commit to anything.",
  },
  {
    n: "05",
    title: "Mint",
    body: "Confirm in your wallet. You'll see the transaction move from submitted to confirmed, with a link to the explorer throughout.",
  },
  {
    n: "06",
    title: "Receive your NFT",
    body: "The NFT lands in the wallet that minted it. Token ids are shown on the success screen and the transaction is linked on Routescan.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-16 sm:py-20">
      <div className="rb-container">
        <SectionHeading
          eyebrow="Process"
          title="How minting works"
          description="Six steps from arriving here to holding the NFT. If you're already verified on Redbelly, steps 2 and 3 take a few seconds."
        />

        <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="relative">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm font-bold text-rb-red" aria-hidden="true">
                  {step.n}
                </span>
                <h3 className="font-display text-lg font-bold text-rb-ink">{step.title}</h3>
              </div>
              <p className="mt-2 pl-9 leading-relaxed text-rb-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
