#!/usr/bin/env bash
# Build and upload DialectDrift to Seattle U CSS1 (public_html/DialectDrift).
# Usage: ./scripts/deploy-css1.sh
# You will be prompted for your CSS1 password once.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Building production site..."
npm run build

DIST="$ROOT/dist"
CSS_FILE="$(basename "$DIST"/assets/index-*.css)"
BATCH="$(mktemp)"

cat > "$BATCH" <<EOF
cd public_html/DialectDrift
lcd $DIST
put index.html
mkdir assets
put assets/$CSS_FILE assets/
mkdir js
put js/data.js js/
put js/app.js js/
mkdir data
put data/states-10m.json data/
bye
EOF

echo "Uploading to css1.seattleu.edu:public_html/DialectDrift ..."
sftp -b "$BATCH" rrafsan@css1.seattleu.edu
rm -f "$BATCH"

echo ""
echo "Done. Open:"
echo "  https://css1.seattleu.edu/~rrafsan/DialectDrift/"
echo "  (or your course-linked URL if different)"
