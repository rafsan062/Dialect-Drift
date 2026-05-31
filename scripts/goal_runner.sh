#!/usr/bin/env bash
set -e

echo "Starting Background Data Generation Goal..."

TARGET=400
CURRENT=$(node -e "try { console.log(Object.keys(require('./public/data/words_staging.json')).length) } catch(e) { console.log(0) }")

while [ "$CURRENT" -lt "$TARGET" ]; do
  echo "---------------------------------------------------"
  echo "Current staging words: $CURRENT. Target: $TARGET."
  echo "Running auto-discover..."
  npm run auto-discover || true
  sleep 4
  CURRENT=$(node -e "try { console.log(Object.keys(require('./public/data/words_staging.json')).length) } catch(e) { console.log(0) }")
done

echo "---------------------------------------------------"
echo "Target of $TARGET words reached! (Current: $CURRENT)"
echo "Now running pronunciation expansion on ALL words..."
npm run add-pronunciations --all

echo "GOAL COMPLETED SUCCESSFULLY!"
