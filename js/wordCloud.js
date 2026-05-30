/** Default explore view: word cloud geo-positioned over US map. */

import { d3 } from "./vendor/deps.js";
import { CLOUD_FILLER, MAX_CLOUD_WORDS, TRENDING_WORDS } from "./config.js";
import { getRegionStyle, getSignalStrength } from "./dialectLookup.js";

// Approximate geographic centroids [lng, lat] for each US state
const STATE_CENTROIDS = {
  AL: [-86.79, 32.80], AK: [-152.0,  64.20], AZ: [-111.50, 34.30], AR: [-92.40, 34.90],
  CA: [-119.70, 36.80], CO: [-105.50, 39.00], CT: [-72.70,  41.60], DE: [-75.50, 39.00],
  DC: [-77.00,  38.90], FL: [ -81.50, 27.80], GA: [ -83.40, 32.70], HI: [-157.50, 20.30],
  ID: [-114.50, 44.40], IL: [ -89.20, 40.00], IN: [ -86.30, 40.00], IA: [-93.10, 42.00],
  KS: [ -98.40, 38.50], KY: [ -84.30, 37.80], LA: [ -91.80, 31.20], ME: [-69.40, 45.40],
  MD: [ -76.80, 39.00], MA: [ -71.50, 42.40], MI: [ -84.50, 44.30], MN: [-94.30, 46.40],
  MS: [ -89.70, 32.70], MO: [ -92.50, 38.50], MT: [-110.50, 47.00], NE: [-99.90, 41.50],
  NV: [-116.40, 38.50], NH: [ -71.60, 44.00], NJ: [ -74.50, 40.10], NM: [-106.10, 34.50],
  NY: [ -75.00, 43.00], NC: [ -79.40, 35.60], ND: [-100.50, 47.50], OH: [-82.80, 40.40],
  OK: [ -97.50, 35.50], OR: [-120.60, 44.00], PA: [ -77.20, 40.90], RI: [-71.50, 41.70],
  SC: [ -80.90, 33.80], SD: [-100.20, 44.40], TN: [ -86.70, 35.80], TX: [-99.30, 31.50],
  UT: [-111.90, 39.30], VT: [ -72.70, 44.00], VA: [ -78.50, 37.50], WA: [-120.50, 47.40],
  WV: [ -80.60, 38.90], WI: [ -89.60, 44.30], WY: [-107.60, 43.00],
};

// Rebuild an AlbersUSA projection to match the map panel dimensions.
// Coefficients derived from geoAlbersUsa default geometry scaled to viewport.
function makeProjection(width, height) {
  const scale = Math.min(width * 1.28, height * 1.94);
  return d3.geoAlbersUsa().scale(scale).translate([width * 0.50, height * 0.485]);
}

// Number of states where a word has >15% usage
function spreadScore(states) {
  return Object.values(states).filter((v) => v > 0.15).length;
}

// Weighted screen-space centroid of a set of [state, value] pairs
function weightedCenter(entries, proj) {
  let wx = 0, wy = 0, wt = 0;
  for (const [state, val] of entries) {
    const c = STATE_CENTROIDS[state];
    if (!c) continue;
    const pt = proj(c);
    if (!pt) continue;
    wx += pt[0] * val;
    wy += pt[1] * val;
    wt += val;
  }
  return wt > 0 ? [wx / wt, wy / wt] : null;
}

// Simple axis-aligned bounding-box overlap check with padding
function overlaps(ax, ay, aw, ah, placed) {
  for (const p of placed) {
    if (Math.abs(ax - p.x) < (aw + p.w) / 2 + 6 &&
        Math.abs(ay - p.y) < (ah + p.h) / 2 + 6) return true;
  }
  return false;
}

// Spiral outward from (ox, oy) until a non-overlapping slot is found
function findSlot(ox, oy, bw, bh, placed, maxR) {
  if (!overlaps(ox, oy, bw, bh, placed)) return [ox, oy];
  for (let r = bh * 0.8; r < maxR; r += bh * 0.6) {
    const steps = Math.max(12, Math.round((2 * Math.PI * r) / (bw * 0.5)));
    for (let i = 0; i < steps; i++) {
      const angle = (2 * Math.PI * i) / steps;
      const nx = ox + Math.cos(angle) * r;
      const ny = oy + Math.sin(angle) * r;
      if (!overlaps(nx, ny, bw, bh, placed)) return [nx, ny];
    }
  }
  return [ox, oy]; // fallback – accept overlap rather than drop the word
}

function charWidth(size) { return size * 0.58; }

export function buildWordCloudData(words, regionStyles) {
  const seen = new Set();
  const items = [];
  const add = (text, trend, color) => {
    if (seen.has(text)) return;
    seen.add(text);
    items.push({ text, trend, color });
  };

  TRENDING_WORDS.forEach((word) => {
    if (!words[word]) return;
    add(word, getSignalStrength(word, words), getRegionStyle(word, words, regionStyles).color);
  });

  Object.entries(words)
    .sort((a, b) => getSignalStrength(b[0], words) - getSignalStrength(a[0], words))
    .slice(0, MAX_CLOUD_WORDS)
    .forEach(([word]) => {
      add(word, getSignalStrength(word, words), getRegionStyle(word, words, regionStyles).color);
    });

  CLOUD_FILLER.forEach((e) => add(e.text, e.trend, "var(--muted)"));

  const trends = items.map((d) => d.trend);
  const sizeScale = d3.scaleSqrt().domain([d3.min(trends), d3.max(trends)]).range([11, 50]);
  return items.map((d) => ({ ...d, size: Math.round(sizeScale(d.trend)) })).sort((a, b) => b.size - a.size);
}

export function renderWordCloudExplore({ mapEl, stage, exploreLayer, words, regionStyles, fontFamily, projection: extProj }) {
  const width  = Math.max(mapEl.clientWidth  || 0, 320);
  const height = Math.max(mapEl.clientHeight || 0, 240);
  stage.innerHTML = "";

  const proj = extProj || makeProjection(width, height);

  const svg = d3.select(stage)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const placed = [];  // { x, y, w, h } of each committed label

  function stamp(text, size, color, ox, oy) {
    const bw = charWidth(size) * text.length;
    const bh = size * 1.1;
    const margin = size * 0.6;
    // Clamp origin to viewport before spiral search
    ox = Math.max(margin + bw / 2, Math.min(width  - margin - bw / 2, ox));
    oy = Math.max(margin + bh / 2, Math.min(height - margin - bh / 2, oy));
    const [fx, fy] = findSlot(ox, oy, bw, bh, placed, Math.min(width, height) * 0.45);
    // Only commit if within viewport
    if (fx - bw / 2 < 0 || fx + bw / 2 > width) return;
    if (fy - bh / 2 < 0 || fy + bh / 2 > height) return;
    placed.push({ x: fx, y: fy, w: bw, h: bh });
    svg.append("text")
      .attr("x", fx)
      .attr("y", fy)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", `${size}px`)
      .attr("font-family", fontFamily || "Inter")
      .attr("fill", color)
      .attr("opacity", 0.92)
      .text(text);
  }

  const cloudItems = buildWordCloudData(words, regionStyles);

  for (const item of cloudItems) {
    const stateEntries = Object.entries(words[item.text]?.states || {})
      .sort((a, b) => b[1] - a[1]);

    if (!stateEntries.length) {
      // Generic filler – scatter lightly around the center
      const jx = width  / 2 + (Math.random() - 0.5) * width  * 0.55;
      const jy = height / 2 + (Math.random() - 0.5) * height * 0.45;
      stamp(item.text, item.size, item.color, jx, jy);
      continue;
    }

    const spread = spreadScore(Object.fromEntries(stateEntries));

    if (spread <= 5) {
      // Concentrated word – one large label at the weighted centroid
      const center = weightedCenter(stateEntries.slice(0, 3), proj);
      if (!center) continue;
      stamp(item.text, item.size, item.color, center[0], center[1]);
    } else {
      // Spread word – up to 4 smaller labels at the top state positions
      const instanceSize = Math.max(10, Math.round(item.size * 0.65));
      let placed_count = 0;
      for (const [state] of stateEntries.slice(0, 4)) {
        const c = STATE_CENTROIDS[state];
        if (!c) continue;
        const pt = proj(c);
        if (!pt) continue;
        stamp(item.text, instanceSize, item.color, pt[0], pt[1]);
        placed_count++;
        if (placed_count >= 4) break;
      }
    }
  }

  exploreLayer.classList.remove("hidden");
}

export function hideWordCloudExplore(exploreLayer, stage) {
  exploreLayer.classList.add("hidden");
  stage.innerHTML = "";
}
