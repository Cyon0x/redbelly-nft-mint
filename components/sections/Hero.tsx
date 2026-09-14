"use client";

import { MintCard } from "@/components/mint/MintCard";
import { collection } from "@/lib/collection";
import { activeChain } from "@/lib/chains";
import { placeholderDataUri } from "@/lib/placeholderArt";
import { useCollectionState } from "@/lib/hooks/useCollection";
import { formatNumber } from "@/lib/utils";

export function Hero() {
  const { totalMinted, maxSupply, soldOut, paused, isLive } = useCollectionState();

  const statusLabel = !isLive
    ? "Launching soon"
    : soldOut
      ? "Fully minted"
      : paused
        ? "Mint paused"
        : "Mint live";

  const isLiveNow = isLive && !paused && !soldOut;

  return (
    <section id="top" className="relative overflow-hidden pt-8 pb-16 sm:pt-12 lg:pt-16">
      <div className="rb-grid-bg pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

      <div className="rb-container">
        <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          {/* Left: identity */}
          <div className="rb-animate-in">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={
                  isLiveNow
                    ? "inline-flex items-center gap-2 rounded-full bg-rb-success-bg px-3 py-1 text-xs font-semibold text-rb-success"
                    : "inline-flex items-center gap-2 rounded-full bg-rb-bg-alt px-3 py-1 text-xs font-semibold text-rb-muted"
                }
              >
                {isLiveNow && (
                  <span
                    className="rb-pulse h-1.5 w-1.5 rounded-full bg-rb-success"
                    aria-hidden="true"
                  />
                )}
                {statusLabel}
              </span>
              <span className="rounded-full border border-rb-border px-3 py-1 text-xs font-medium text-rb-muted">
                {activeChain.name}
              </span>
            </div>

            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-rb-ink sm:text-5xl lg:text-6xl">
              {collection.name}
            </h1>

            <p className="mt-4 max-w-xl text-lg leading-relaxed text-rb-ink-soft">
              {collection.tagline}
            </p>

            <p className="mt-4 max-w-xl leading-relaxed text-rb-muted">
              {collection.description}
            </p>

            {/* Key facts */}
            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 lg:max-w-lg">
              <Fact label="Supply" value={formatNumber(maxSupply)} />
              <Fact label="Minted" value={formatNumber(totalMinted)} />
              <Fact label="Standard" value="ERC-721" />
              <Fact label="Chain ID" value={String(activeChain.id)} />
            </dl>
          </div>

          {/* Right: artwork + mint */}
          <div className="rb-animate-in space-y-5" style={{ animationDelay: "80ms" }}>
            <HeroArtwork />
            <MintCard />
          </div>
        </div>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="rb-eyebrow">{label}</dt>
      <dd className="mt-1 font-display text-xl font-bold text-rb-ink">{value}</dd>
    </div>
  );
}

function HeroArtwork() {
  // Three representative pieces; the centre one is featured.
  const ids = [7, 1, 23];

  return (
    <div className="relative">
      <div className="flex items-end justify-center gap-3">
        {ids.map((id, i) => {
          const featured = i === 1;
          return (
            <div
              key={id}
              className={
                featured
                  ? "relative w-1/2 overflow-hidden rounded-2xl border border-rb-border-strong shadow-lg"
                  : "relative hidden w-1/4 overflow-hidden rounded-xl border border-rb-border opacity-70 sm:block"
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={placeholderDataUri(id, 400)}
                alt={`Placeholder artwork, piece ${id}`}
                className="aspect-square w-full"
                loading={featured ? "eager" : "lazy"}
              />
            </div>
          );
        })}
      </div>

      {!collection.artworkFinal && (
        <p className="mt-3 text-center text-xs text-rb-muted">
          Placeholder artwork — final collection art pending
        </p>
      )}
    </div>
  );
}
