/**
 * Geometric mark for the collection.
 *
 * A cube lattice rendered in Redbelly's red — a neutral, structural mark that
 * evokes the network without reproducing Redbelly's own logo, which belongs to
 * Redbelly and should not be presented as this collection's identity.
 */
export function RedbellyMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="Collection mark"
    >
      <path
        d="M16 3 L27 9.5 V22.5 L16 29 L5 22.5 V9.5 Z"
        stroke="var(--color-rb-red)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M16 3 V16 M16 16 L27 9.5 M16 16 L5 9.5"
        stroke="var(--color-rb-red)"
        strokeWidth="1.5"
        opacity="0.45"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="2.75" fill="var(--color-rb-red)" />
    </svg>
  );
}
