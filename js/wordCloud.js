/** Default explore view: word cloud over faded map. */

import { d3, cloud } from "./vendor/deps.js";
import { CLOUD_FILLER, MAX_CLOUD_WORDS, TRENDING_WORDS } from "./config.js";
import { getRegionStyle, getSignalStrength } from "./dialectLookup.js";

function drawWordCloud(stage, width, height, words) {
  stage.innerHTML = "";
  const svg = d3
    .select(stage)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg.append("g").attr("transform", `translate(${width / 2}, ${height / 2})`);

  g.selectAll("text")
    .data(words)
    .join("text")
    .attr("transform", (d) => `translate(${d.x}, ${d.y}) rotate(${d.rotate})`)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-size", (d) => `${d.size}px`)
    .attr("fill", (d) => d.color)
    .text((d) => d.text);
}

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

  CLOUD_FILLER.forEach((entry) => add(entry.text, entry.trend, "var(--muted)"));

  const trends = items.map((item) => item.trend);
  const sizeScale = d3
    .scaleSqrt()
    .domain([d3.min(trends), d3.max(trends)])
    .range([12, 52]);

  return items
    .map((item) => ({ ...item, size: Math.round(sizeScale(item.trend)) }))
    .sort((a, b) => b.size - a.size);
}

export function renderWordCloudExplore({ mapEl, stage, exploreLayer, words, regionStyles, fontFamily }) {
  const width = Math.max(mapEl.clientWidth || 0, 320);
  const height = Math.max(mapEl.clientHeight || 0, 240);
  stage.innerHTML = "";

  const cloudWords = buildWordCloudData(words, regionStyles).map((entry) => ({ ...entry }));

  const layout = cloud()
    .size([width * 0.92, height * 0.88])
    .words(cloudWords)
    .padding(3)
    .rotate((d) => (d.size < 22 ? (Math.random() > 0.45 ? 90 : 0) : 0))
    .font(fontFamily)
    .fontSize((d) => d.size)
    .on("end", (placed) => drawWordCloud(stage, width, height, placed));

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      try {
        layout.start();
      } catch (err) {
        console.error("Failed to start cloud layout:", err);
      }
    });
  } else {
    layout.start();
  }
  exploreLayer.classList.remove("hidden");
}

export function hideWordCloudExplore(exploreLayer, stage) {
  exploreLayer.classList.add("hidden");
  stage.innerHTML = "";
}
