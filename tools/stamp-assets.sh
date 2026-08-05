#!/bin/bash
# Cache-bust the CSS/JS links in index.html, and write the same stamp into a
# build-stamp meta tag and version.txt.
#
# index.html referenced site.css?v=1 and main.js?v=1 for every deploy, so the
# asset URLs never changed and browsers kept serving the copy they had already
# cached — deploys looked like they "hadn't updated" until a manual hard
# refresh. Stamping a fresh version on each deploy changes the URL, so the
# browser is obliged to fetch the new file.
#
# GitHub Pages sends cache-control: max-age=600 on every file, including
# index.html itself, and there's no way to override that per-path on Pages.
# So a browser can hold a cached copy of the page for up to 10 minutes after
# a deploy with no idea it's stale. main.js checks version.txt (fetched with
# cache: 'no-store', so it's never served from the browser's own cache)
# against the build-stamp meta tag baked into the page it's currently running
# on, and force-reloads on a mismatch. version.txt has to move in lockstep
# with the meta tag or every page load would look stale — this script is the
# only thing that writes either.
#
# Run this before committing a deploy:  tools/stamp-assets.sh
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d%H%M)"

sed -i '' -E "s#(site\.css\?v=)[^\"]*#\1${STAMP}#; s#(main\.js\?v=)[^\"]*#\1${STAMP}#; s#(name=\"build-stamp\" content=\")[^\"]*#\1${STAMP}#" "$DIR/index.html"
printf '%s' "$STAMP" > "$DIR/version.txt"

grep -nE 'site\.css\?v=|main\.js\?v=|build-stamp' "$DIR/index.html"
echo "stamped assets: v=${STAMP}"
