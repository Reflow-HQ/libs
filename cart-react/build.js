const { build } = require("esbuild");
const { devDependencies, peerDependencies } = require("./package.json");

const entryFile = "./index.js";
const shared = {
  bundle: true,
  entryPoints: [entryFile],
  // Treat all dependencies in package.json as externals to keep bundle size to a minimum
  external: Object.keys(Object.assign({}, devDependencies, peerDependencies)),
  logLevel: "info",
  minify: true,
  sourcemap: true,
};

build({
  ...shared,
  outfile: "./dist/index.js",
  target: ["es2020"],
  format: "esm",
});

build({
  entryPoints: ["./src/cartview.css"],
  outfile: "./dist/style.css",
  minify: true,
});
