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

// Release functionality
if (process.argv.includes("--release")) {
  const pkg = await Bun.file("package.json").json();
  const version = pkg.version;

  await Bun.$`git add .`;
  await Bun.$`git commit -m "Release v${version}"`;
  await Bun.$`git tag v${version}`;
}

export {};
