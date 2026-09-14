/**
 * Deterministic placeholder artwork.
 *
 * The real collection art has not been supplied yet. Rather than shipping random
 * copyrighted images or grey boxes, each token id renders a distinct generated
 * composition derived from that id — so the gallery reads as a real collection
 * with visible variation, and layout/typography can be judged honestly.
 *
 * Every placeholder is explicitly labelled in the UI. Swapping in the real artwork
 * means pointing the gallery at real image URLs; no layout change is needed.
 */

/** Small deterministic PRNG so a token id always yields the same artwork. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  { bg: "#FFF2F3", fg: "#FF5050", accent: "#7A1226", ink: "#1A0A0C" },
  { bg: "#1A0A0C", fg: "#FF4646", accent: "#FF9AA2", ink: "#FFF2F3" },
  { bg: "#FFFFFF", fg: "#C81E3A", accent: "#283A46", ink: "#1A0A0C" },
  { bg: "#283A46", fg: "#FF5050", accent: "#FFF2F3", ink: "#FFF2F3" },
  { bg: "#FFE4E6", fg: "#7A1226", accent: "#FF5050", ink: "#1A0A0C" },
];

/**
 * Generate an SVG for a token id.
 * The motif is a rotated concentric lattice — structural and geometric, matching
 * the site's technical tone rather than generic NFT noise.
 */
export function placeholderSvg(tokenId: number, size = 400): string {
  const rand = mulberry32(tokenId * 2654435761);
  const palette = PALETTES[Math.floor(rand() * PALETTES.length)];
  const rings = 3 + Math.floor(rand() * 4);
  const rotation = Math.floor(rand() * 90);
  const cells = 2 + Math.floor(rand() * 3);
  const strokeW = 1 + rand() * 1.5;

  const cx = size / 2;
  const cy = size / 2;

  let shapes = "";

  // Concentric rotated squares.
  for (let i = 0; i < rings; i++) {
    const t = (i + 1) / (rings + 1);
    const half = (size * 0.42) * t;
    const rot = rotation + i * (12 + rand() * 20);
    const isAccent = rand() > 0.65;
    shapes += `<rect x="${(cx - half).toFixed(1)}" y="${(cy - half).toFixed(1)}" width="${(half * 2).toFixed(1)}" height="${(half * 2).toFixed(1)}" fill="none" stroke="${isAccent ? palette.accent : palette.fg}" stroke-width="${strokeW.toFixed(2)}" transform="rotate(${rot.toFixed(1)} ${cx} ${cy})" opacity="${(0.35 + t * 0.65).toFixed(2)}"/>`;
  }

  // A solid centre mark, size varying by token.
  const coreR = size * (0.04 + rand() * 0.05);
  shapes += `<circle cx="${cx}" cy="${cy}" r="${coreR.toFixed(1)}" fill="${palette.fg}"/>`;

  // Corner lattice marks.
  const inset = size * 0.08;
  const markLen = size * 0.05;
  const corners = [
    [inset, inset, 1, 1],
    [size - inset, inset, -1, 1],
    [inset, size - inset, 1, -1],
    [size - inset, size - inset, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    shapes += `<path d="M ${x} ${y} l ${markLen * dx} 0 M ${x} ${y} l 0 ${markLen * dy}" stroke="${palette.ink}" stroke-width="1.5" opacity="0.4"/>`;
  }

  // Sparse grid dots for texture.
  const step = size / (cells + 1);
  for (let i = 1; i <= cells; i++) {
    for (let j = 1; j <= cells; j++) {
      if (rand() > 0.6) {
        shapes += `<circle cx="${(i * step).toFixed(1)}" cy="${(j * step).toFixed(1)}" r="1.6" fill="${palette.accent}" opacity="0.5"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Placeholder artwork for token ${tokenId}">
  <rect width="${size}" height="${size}" fill="${palette.bg}"/>
  ${shapes}
  <text x="${size - 14}" y="${size - 14}" text-anchor="end" font-family="ui-monospace, monospace" font-size="11" fill="${palette.ink}" opacity="0.55">#${String(tokenId).padStart(3, "0")}</text>
</svg>`;
}

/** Data URI form, for use directly in an <img src>. */
export function placeholderDataUri(tokenId: number, size = 400): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(placeholderSvg(tokenId, size))}`;
}
