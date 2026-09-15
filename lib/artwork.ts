export type WatchArtwork = {
  id: "green" | "onyx" | "rose" | "steel";
  src: string;
  alt: string;
  width: number;
  height: number;
};

export const watchArtwork: WatchArtwork[] = [
  {
    id: "onyx",
    src: "/images/vault-01/vault-01-watch-onyx.webp",
    alt: "VAULT 01 Onyx mechanical watch preview",
    width: 1254,
    height: 1254,
  },
  {
    id: "rose",
    src: "/images/vault-01/vault-01-watch-rose.webp",
    alt: "VAULT 01 Rose mechanical watch preview",
    width: 1254,
    height: 1254,
  },
  {
    id: "green",
    src: "/images/vault-01/vault-01-watch-green.webp",
    alt: "VAULT 01 Green mechanical watch preview",
    width: 1254,
    height: 1254,
  },
  {
    id: "steel",
    src: "/images/vault-01/vault-01-watch-steel.webp",
    alt: "VAULT 01 Steel mechanical watch preview",
    width: 1254,
    height: 1254,
  },
];

export const heroArtwork = [
  watchArtwork[1],
  watchArtwork[0],
  watchArtwork[3],
];

export const galleryArtwork = watchArtwork;
