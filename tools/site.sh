#!/bin/sh
# FMSS – veebisaidi kokkupanek (etapp 10). Build-sammu pole: failid kopeeritakse muutmata kujul.
#
#   tools/site.sh VÄLJUND [VERSIOON1_REF]
#
#   VÄLJUND/index.html  avaleht ja lühijuhend (site/index.html, praegusest harust)
#   VÄLJUND/v1/         versioon 1 (1.0, 1.1 …): index.html, src/, fonts/ – git-ref'ist (vaikimisi tööpuu);
#                       models/ alati praegusest harust (näidiseid saab lisada koodi muutmata, etapp 11)
#
# Veebis kutsub seda .github/workflows/pages.yml viimase 1.x tag'iga (praegu v1.1). Kohalik kontroll:
#   tools/site.sh /tmp/fmss-site && (cd /tmp/fmss-site && python3 -m http.server 8000)
set -eu

out=${1:?"kasutus: tools/site.sh VÄLJUND [VERSIOON1_REF]"}
ref=${2:-}
root=$(cd "$(dirname "$0")/.." && pwd)
app_files="index.html src fonts"

rm -rf "$out"
mkdir -p "$out/v1"
cp "$root/site/index.html" "$out/index.html"
touch "$out/.nojekyll"

if [ -n "$ref" ]; then
  git -C "$root" archive "$ref" $app_files | tar -x -C "$out/v1"
else
  for name in $app_files; do cp -R "$root/$name" "$out/v1/"; done
fi
mkdir -p "$out/v1/models"
cp "$root"/models/*.json "$out/v1/models/"

echo "Sait: $out (v1 ${ref:-tööpuust})"
