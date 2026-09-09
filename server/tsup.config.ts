import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  // Bundle the workspace shared package (TS source) into the output.
  noExternal: ["@marvinho/shared"],
  sourcemap: true,
});
