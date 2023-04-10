const { build } = require("esbuild");
const { dependencies } = require("./package.json");

const entryFile = "./index.js";
const shared = {
  bundle: true,
  entryPoints: [entryFile],
  // Treat all dependencies in package.json as externals to keep bundle size to a minimum
  external: Object.keys(dependencies),
  logLevel: "info",
  minify: true,
  sourcemap: true,
};

build({
  ...shared,
  outfile: "./dist/index.js",
  target: ["es2020"],
});

build({
  entryPoints: ["./src/cartview.css"],
  outfile: "./dist/style.css",
  minify: true,
});
