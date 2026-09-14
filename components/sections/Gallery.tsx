"use client";

import { useState } from "react";
import { collection } from "@/lib/collection";
import { placeholderDataUri } from "@/lib/placeholderArt";
import { cn } from "@/lib/utils";

const PREVIEW_COUNT = 8;

export function Gallery() {
  const [showAll, setShowAll] = useState(false);
  const count = showAll ? 16 : PREVIEW_COUNT;
  const ids = Array.from({ length: count }, (_, i) => i + 1);

  return (
    <section id="collection" className="scroll-mt-20 py-16 sm:py-20">
      <div className="rb-container">
        <SectionHeading
          eyebrow="The collection"
          title="Every piece, generated and distinct"
          description={
            collection.artworkFinal
              ? "Each piece in the collection, rendered from its on-chain token id."
              : "Final artwork is still in production. These generated placeholders show how the collection is laid out — each one derived from its token id, so the structure and variation are real even though the art is not final."
          }
        />

        {!collection.artworkFinal && (
          <div
            className="mx-auto mt-6 max-w-2xl rounded-xl border border-rb-border-strong bg-rb-warning-bg p-4 text-center"
            role="note"
          >
            <p className="text-sm font-semibold text-rb-ink">Placeholder artwork</p>
            <p className="mt-1 text-sm text-rb-ink-soft">
              These are generated placeholders, not the final collection art. No third-party
              or stock imagery is used anywhere on this site.
            </p>
          </div>
        )}

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {ids.map((id, i) => (
            <figure
              key={id}
              className={cn(
                "group overflow-hidden rounded-xl border border-rb-border",
                "bg-rb-bg-alt transition-shadow hover:shadow-md",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={placeholderDataUri(id, 400)}
                alt={`Placeholder artwork for piece ${id}`}
                className="aspect-square w-full transition-transform duration-300 group-hover:scale-[1.02]"
                loading={i < 4 ? "eager" : "lazy"}
              />
              <figcaption className="flex items-center justify-between border-t border-rb-border px-3 py-2">
                <span className="font-mono text-xs text-rb-muted">
                  #{String(id).padStart(3, "0")}
                </span>
                <span className="rb-eyebrow">{collection.symbol}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        {!showAll && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex h-11 items-center rounded-xl border border-rb-border-strong px-5 text-sm font-semibold text-rb-ink transition-colors hover:border-rb-red hover:text-rb-red"
            >
              Show more pieces
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p className="rb-eyebrow">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-rb-ink sm:text-4xl">
        {title}
      </h2>
      {description && <p className="mt-4 leading-relaxed text-rb-muted">{description}</p>}
    </div>
  );
}
