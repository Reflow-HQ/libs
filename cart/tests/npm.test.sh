#!/bin/bash

# Tests if the library can be packaged and installed with npm.

cd ..
npm i
npm pack
packname=$(find . -iname '*.tgz')

cd tests
rm npm-test-app -rf
mkdir npm-test-app
cd npm-test-app
npm init es6 -y --prefix=npm-test-app
npm i "../.$packname"
rm "../.$packname"

echo "import Cart from '@reflowhq/cart';console.log(Cart);console.log('-----------');console.log('| Success |');console.log('-----------');" > index.js

echo "const {
  build
} = require('esbuild');

build({
  entryPoints: ['./index.js'],
  outfile: './browser.js',
  target: ['es2020'],
  format: 'esm',
  bundle: true,
  logLevel: 'info',
  minify: true,
  sourcemap: true,
});
" > build.cjs
node ./build.cjs

echo "<html><head><script src='browser.js'></script></head><body>Check your console</body></html>" > index.html

open ./index.html