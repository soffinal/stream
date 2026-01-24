// Generate documentation
await Bun.$`bun run scripts/generate-docs.ts`;

// Clean dist
await Bun.$`rm -rf dist`;

// Build JavaScript
await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: "./dist",
  target: "node",
  format: "esm",
  sourcemap: true,
  minify: true,
});

// Build TypeScript declarations
await Bun.$`bunx tsc --emitDeclarationOnly --allowImportingTsExtensions --noEmit false`;

export {};
