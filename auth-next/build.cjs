const { build } = require("esbuild");
const { devDependencies, peerDependencies } = require("./package.json");

build({
  entryPoints: ["./src/auth-client.ts"],
  outdir: "./dist/",
  target: ["es2020"],
  format: "esm",
  bundle: true,
  // Treat all dependencies in package.json as externals to keep bundle size to a minimum
  external: Object.keys(Object.assign({}, devDependencies, peerDependencies)),
  logLevel: "info",
  minify: false,
  sourcemap: true,
});
