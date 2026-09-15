import Image from "next/image";

/**
 * Redbelly Network logo lockup.
 */
export function RedbellyMark({ className }: { className?: string }) {
  return (
    <Image
      src="/images/logo/redbelly-logo.png"
      alt="Redbelly Network"
      width={517}
      height={198}
      className={className}
      sizes="96px"
      priority
    />
  );
}
