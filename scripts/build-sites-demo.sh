#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
FLUX_SITES_EXPORT=1 NEXT_PUBLIC_FLUX_DEMO=1 pnpm --filter @flux/web build
rm -rf out
mkdir -p out
cp -a apps/web/out/. out/
