#!/bin/bash
# Cache-bust the CSS/JS links in index.html.
#
# index.html referenced site.css?v=1 and main.js?v=1 for every deploy, so the
# asset URLs never changed and browsers kept serving the copy they had already
# cached — deploys looked like they "hadn't updated" until a manual hard
# refresh. Stamping a fresh version on each deploy changes the URL, so the
# browser is obliged to fetch the new file.
#
# Run this before committing a deploy:  tools/stamp-assets.sh
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d%H%M)"

sed -i '' -E "s#(site\.css\?v=)[^\"]*#\1${STAMP}#; s#(main\.js\?v=)[^\"]*#\1${STAMP}#" "$DIR/index.html"

grep -nE 'site\.css\?v=|main\.js\?v=' "$DIR/index.html"
echo "stamped assets: v=${STAMP}"
