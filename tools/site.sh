#!/bin/sh
# FMSS – veebisaidi kokkupanek (etapp 10). Build-sammu pole: failid kopeeritakse muutmata kujul.
#
#   tools/site.sh VÄLJUND [VERSIOON1_REF]
#
#   VÄLJUND/index.html  avaleht ja lühijuhend (site/index.html, praegusest harust)
#   VÄLJUND/doc/        dokumentatsioon (site/doc/, praegusest harust; etapp 12)
#   VÄLJUND/v1/         versioon 1 (1.0, 1.1 …): index.html, src/, fonts/, core/ – git-ref'ist (vaikimisi tööpuu);
#                       models/ alati praegusest harust (näidiseid saab lisada koodi muutmata, etapp 11)
#
# Kaustad (alates 2026-11-14): v1/ (liides), core/ (ühine simulaator), models/; v1/core ja v1/models on
# repos lingid (../core, ../models), saidil päris koopiad – versiooni kaust on iseseisev. Kuni tag'ini v1.5
# oli paigutus vana (juures index.html, src/, fonts/) – see tuntakse ära ja sait tuleb sama.
#
# Veebis kutsub seda .github/workflows/pages.yml viimase 1.x tag'iga (praegu v1.5). Kohalik kontroll:
#   tools/site.sh /tmp/fmss-site && (cd /tmp/fmss-site && python3 -m http.server 8000)
set -eu

out=${1:?"kasutus: tools/site.sh VÄLJUND [VERSIOON1_REF]"}
ref=${2:-}
root=$(cd "$(dirname "$0")/.." && pwd)

rm -rf "$out"
mkdir -p "$out/v1"
cp "$root/site/index.html" "$out/index.html"
mkdir -p "$out/doc"
cp -R "$root/site/doc/." "$out/doc/"
touch "$out/.nojekyll"

tmp=$(mktemp -d)
if [ -z "$ref" ]; then
  cp -R "$root/v1" "$root/core" "$tmp/"
elif git -C "$root" cat-file -e "$ref:v1/index.html" 2>/dev/null; then
  git -C "$root" archive "$ref" v1 core | tar -x -C "$tmp"
else
  mkdir "$tmp/v1"
  git -C "$root" archive "$ref" index.html src fonts | tar -x -C "$tmp/v1"
fi
rm -rf "$tmp/v1/core" "$tmp/v1/models"
if [ -d "$tmp/core" ]; then cp -R "$tmp/core" "$tmp/v1/core"; fi
cp -R "$tmp/v1/." "$out/v1/"
rm -rf "$tmp"
mkdir -p "$out/v1/models"
cp "$root"/models/*.json "$out/v1/models/"

echo "Sait: $out (v1 ${ref:-tööpuust})"
