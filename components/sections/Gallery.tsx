import Image from "next/image";
import { collection } from "@/lib/collection";
import { galleryArtwork } from "@/lib/artwork";
import { cn } from "@/lib/utils";

export function Gallery() {
  return (
    <section id="collection" className="scroll-mt-20 py-16 sm:py-20">
      <div className="rb-container">
        <SectionHeading
          eyebrow="The collection"
          title="The VAULT 01 watch previews"
          description={
            collection.artworkFinal
              ? "Each piece in the collection, rendered from its on-chain token id."
              : "These approved watch renders preview the VAULT 01 collection. Final on-chain artwork and metadata will be revealed separately."
          }
        />

        {!collection.artworkFinal && (
          <div
            className="mx-auto mt-6 max-w-2xl rounded-xl border border-rb-border-strong bg-rb-warning-bg p-4 text-center"
            role="note"
          >
            <p className="text-sm font-semibold text-rb-ink">Preview artwork</p>
            <p className="mt-1 text-sm text-rb-ink-soft">
              Approved visual previews only. Final on-chain NFT artwork and metadata are
              still pending and will be configured separately.
            </p>
          </div>
        )}

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {galleryArtwork.map((watch, i) => (
            <figure
              key={`${watch.id}-${i}`}
              className={cn(
                "group overflow-hidden rounded-xl border border-rb-border",
                "bg-rb-bg-alt transition-shadow hover:shadow-md",
              )}
            >
              <Image
                src={watch.src}
                alt={watch.alt}
                width={watch.width}
                height={watch.height}
                sizes="(max-width: 640px) 50vw, 25vw"
                className="aspect-square w-full transition-transform duration-300 group-hover:scale-[1.02]"
                priority={i === 0}
              />
              <figcaption className="flex items-center justify-between border-t border-rb-border px-3 py-2">
                <span className="font-mono text-xs text-rb-muted">
                  {watch.id.toUpperCase()}
                </span>
                <span className="rb-eyebrow">{collection.symbol}</span>
              </figcaption>
            </figure>
          ))}
        </div>

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
