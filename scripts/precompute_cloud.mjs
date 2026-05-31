import fs from 'fs';
import * as d3 from 'd3';
import topojson from 'topojson-client';

// 1. Read data and topology
const dataFile = fs.readFileSync('js/data.js', 'utf8');
// Very hacky data extraction (since data.js defines global vars)
const cleanData = dataFile.replace('const WORD_DATA = ', 'global.WORD_DATA = ')
                          .replace('const CLOUD_STATE_CENTROIDS = ', 'global.CLOUD_STATE_CENTROIDS = ');
eval(cleanData);

const topology = JSON.parse(fs.readFileSync('data/us-10m.json', 'utf8'));
const stateFeatures = topojson.feature(topology, topology.objects.states);

// 2. Setup projection
const width = 1000;
const height = 600;

const proj = (function () {
  const pts = Object.entries(global.CLOUD_STATE_CENTROIDS)
    .filter(([s]) => s !== 'AK' && s !== 'HI')
    .map(([, c]) => ({ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: {} }));
  return d3.geoAlbersUsa().fitExtent([[20, 20], [width - 20, height - 20]], { type: "FeatureCollection", features: pts });
})();

function isBoxInLand(cx, cy, bw, bh) {
  const hw = bw / 2, hh = bh / 2;
  const corners = [
    [cx, cy],
    [cx - hw, cy - hh],
    [cx + hw, cy - hh],
    [cx - hw, cy + hh],
    [cx + hw, cy + hh]
  ];
  let hits = 0;
  for (const [px, py] of corners) {
    const coords = proj.invert([px, py]);
    if (coords && stateFeatures.features.some(f => d3.geoContains(f, coords))) {
      hits++;
    }
  }
  return hits >= 3;
}

function cloudOverlaps(ax, ay, aw, ah, placed) {
  for (const p of placed) {
    if (Math.abs(ax - p.x) < (aw + p.w) / 2 + 1 &&
      Math.abs(ay - p.y) < (ah + p.h) / 2 + 1) return true;
  }
  return false;
}

function cloudFindSlot(ox, oy, bw, bh, placed, maxR) {
  if (!cloudOverlaps(ox, oy, bw, bh, placed) && isBoxInLand(ox, oy, bw, bh)) return [ox, oy, true];
  const step = Math.max(4, bh * 0.25);
  for (let r = step; r <= maxR; r += step) {
    const steps = Math.max(16, Math.round((2 * Math.PI * r) / Math.max(bw * 0.25, 6)));
    for (let i = 0; i < steps; i++) {
      const angle = (2 * Math.PI * i) / steps;
      const nx = ox + Math.cos(angle) * r;
      const ny = oy + Math.sin(angle) * r;
      if (!cloudOverlaps(nx, ny, bw, bh, placed) && isBoxInLand(nx, ny, bw, bh)) return [nx, ny, true];
    }
  }
  return [ox, oy, false];
}

// 3. Compute Ranked Items
const words = global.WORD_DATA;
const regionStyles = {}; // Not perfectly matched without logic, but color is in app.js
const ranked = Object.entries(words)
  .map(([text, data]) => {
    const states = Object.values(data.states || {});
    const max = states.length ? Math.max(...states) : 0;
    const sum = states.reduce((a, b) => a + b, 0);
    const uniqueness = sum > 0 ? max / sum : 0; 
    const score = max * Math.pow(uniqueness, 0.4); 
    return { text, trend: max, uniqueness, score };
  })
  .filter(d => d.trend >= 0.10)
  .sort((a, b) => b.score - a.score);

const topWords = ranked.slice(0, 500);
const scores = topWords.map(d => d.score);
const minScore = d3.min(scores) || 0;
const maxScore = d3.max(scores) || 1;

const sizeScale = d3.scalePow().exponent(0.8)
  .domain([minScore, maxScore])
  .range([8, 65]);

const cloudItems = topWords.map(d => ({ ...d, size: Math.round(sizeScale(d.score)) }));

let seed = 12345;
function random() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}

function effectiveSize(text, size) {
  const maxW = width * 0.72;
  const natural = size * 0.58 * text.length;
  return natural > maxW ? Math.floor(size * (maxW / natural)) : size;
}

const placed = [];
const maxR = Math.hypot(width, height) * 0.55;
const outputWords = [];

function stamp(text, rawSize, ox, oy, isVertical) {
  const size = Math.max(10, effectiveSize(text, rawSize));
  let bw = size * 0.58 * text.length;
  let bh = size * 1.15;
  
  if (isVertical) {
    let tmp = bw;
    bw = bh;
    bh = tmp;
  }

  const mg = 2;
  ox = Math.max(mg + bw / 2, Math.min(width - mg - bw / 2, ox));
  oy = Math.max(mg + bh / 2, Math.min(height - mg - bh / 2, oy));
  const [fx, fy, ok] = cloudFindSlot(ox, oy, bw, bh, placed, maxR);
  if (!ok) return false;
  if (fx - bw / 2 < mg || fx + bw / 2 > width - mg) return false;
  if (fy - bh / 2 < mg || fy + bh / 2 > height - mg) return false;
  
  placed.push({ x: fx, y: fy, w: bw, h: bh });
  outputWords.push({ text, fx, fy, size, isVertical });
  return true;
}

console.log("Computing word cloud layout...");
let processed = 0;
for (const item of cloudItems) {
  const stateEntries = Object.entries(words[item.text]?.states || {})
    .filter(([, v]) => v > 0.05)
    .sort((a, b) => b[1] - a[1]);

  if (!stateEntries.length) continue;

  const screenPts = stateEntries
    .map(([state, val]) => {
      const c = global.CLOUD_STATE_CENTROIDS[state];
      if (!c) return null;
      const pt = proj(c);
      if (!pt) return null;
      return { state, val, x: pt[0], y: pt[1] };
    })
    .filter(Boolean);

  let highCount = screenPts.filter(p => p.val > 0.4).length;
  if (!screenPts.length) continue;

  let center = [0, 0];
  let wt = 0;
  for (const pt of screenPts) {
    center[0] += pt.x * pt.val;
    center[1] += pt.y * pt.val;
    wt += pt.val;
  }
  center = [center[0] / wt, center[1] / wt];

  const isVertical = random() > 0.85;
  stamp(item.text, item.size, center[0], center[1], isVertical);

  if (highCount >= 2 && screenPts.length >= 2) {
    const extraCount = Math.min(10, highCount + 2);
    let lastPt = { x: center[0], y: center[1] };
    for (let i = 0; i < extraCount; i++) {
      const instanceSize = Math.max(8, Math.round(item.size * (0.7 - (i * 0.05))));
      const cands = screenPts.filter(p => Math.hypot(p.x - lastPt.x, p.y - lastPt.y) > width * 0.1);
      if (!cands.length) break;
      const alt = cands[Math.floor(random() * cands.length)];
      const altVert = random() > 0.65;
      stamp(item.text, instanceSize, alt.x, alt.y, altVert);
      lastPt = alt;
    }
  }
  processed++;
  if (processed % 50 === 0) console.log(`Processed ${processed}/${cloudItems.length}...`);
}

fs.writeFileSync('js/precomputed_cloud.js', `const PRECOMPUTED_CLOUD = ${JSON.stringify(outputWords)};\n`);
console.log("Done! Wrote " + outputWords.length + " words to js/precomputed_cloud.js");
