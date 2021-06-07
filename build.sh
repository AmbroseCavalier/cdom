#!/bin/sh
tsc --project tsconfig.production.json
terser --compress --mangle --output ./dist/cdom.min.js -- ./dist/cdom.js
