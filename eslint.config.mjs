import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/*
 * eslint-config-next 16 ships native flat configs.
 *
 * This previously wrapped the legacy eslintrc shareable configs with FlatCompat,
 * which eslint 9.39 could not serialise ("Converting circular structure to JSON"),
 * so `npm run lint` failed before reading a single file. Importing the flat entries
 * directly removes the compatibility layer entirely.
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ["contracts/**", ".next/**", "node_modules/**"],
  },
];

export default eslintConfig;
