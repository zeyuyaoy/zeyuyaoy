import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    rules: {
      curly: ["error", "all"],
    },
  },
  globalIgnores([".next/**", ".vercel/**", "next-env.d.ts", "out/**"]),
]);
