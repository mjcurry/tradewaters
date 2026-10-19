#!/bin/sh
# Copies only the files the game needs into dist/ for Cloudflare Pages.
# Keeps docs/, README and dev config out of the public site.
set -e
cd "$(dirname "$0")/.."
rm -rf dist
mkdir -p dist
cp -R index.html _headers css js assets dist/
find dist -name '.DS_Store' -delete
echo "Built dist/ ($(du -sh dist | cut -f1))"
