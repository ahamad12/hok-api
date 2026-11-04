import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
  clean: true,
  copy: [
    {
      from: "./src/modules/profit-report/pdf/templates",
      to: "./dist/modules/profit-report/pdf/templates",
    },
  ],
  noExternal: [/@tapt-api\/.*/],
  external: ["bcrypt", /^@prisma\//],
});
