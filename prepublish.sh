#!/bin/bash

set -e

npm run build
npm test
npm run npm-package-test

echo
echo '-----------------------------------------------------------------------------'
echo '  Manual package test. Inspect the result in the browser and press y if ok.'
echo '-----------------------------------------------------------------------------'
read choice

if [ "$choice" != "y" ]; then
    echo 'Failed manual test. Exiting'
    exit 1
fi