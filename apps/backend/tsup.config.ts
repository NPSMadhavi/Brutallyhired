import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/scripts/create-tenant.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  sourcemap: true,
  clean: true,
  // Bundle workspace TS sources; keep Prisma and native deps external.
  noExternal: ["@verity/shared", "@verity/db"],
  external: ["@prisma/client", ".prisma/client"],
  loader: { ".json": "json" },
});
