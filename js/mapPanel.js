/** US choropleth map (D3 + TopoJSON). */

import { d3, feature } from "./vendor/deps.js";
import { STATE_FIPS_TO_ABBR, US_ATLAS_URL } from "./config.js";
import { getRegionStyle } from "./dialectLookup.js";
import { hideWordCloudExplore, renderWordCloudExplore } from "./wordCloud.js";

function fipsToAbbr(id) {
  return STATE_FIPS_TO_ABBR[String(id).padStart(2, "0")];
}

export function createMapPanel({
  containerId,
  tooltipId,
  legendId,
  titleId,
  exploreId,
  stageId,
  mapWrapSelector = ".map-wrap",
  words,
  regionStyles,
  getCurrentWord,
  isWordMode,
}) {
  let svg;
  let g;
  let path;
  let projection;
  let stateFeatures;
  let stateSelection;
  let mapExploreActive = false;
  let mapWidth = 0;
  let mapHeight = 0;
  let initPromise = null;

  const container = document.getElementById(containerId);
  const mapWrap = document.querySelector(mapWrapSelector);
  const tooltip = document.getElementById(tooltipId);
  const legend = document.getElementById(legendId);
  const titleEl = document.getElementById(titleId);
  const exploreLayer = document.getElementById(exploreId);
  const stage = document.getElementById(stageId);

  function updateTitle(explore, word = null) {
    if (explore) {
      titleEl.textContent = "Map · trending dialect splits";
      legend.classList.add("hidden");
      mapWrap?.classList.remove("is-revealed");
    } else {
      titleEl.textContent = word ? `Map · “${word}”` : "Map · selected clue";
      legend.classList.remove("hidden");
      mapWrap?.classList.toggle("is-revealed", Boolean(word));
    }
  }

  function layoutSize() {
    const width = Math.max(container.clientWidth, 280);
    const height = Math.max(container.clientHeight, 220);
    return { width, height };
  }

  function resizeMap() {
    if (!stateFeatures || !svg) return;

    const { width, height } = layoutSize();
    if (width === mapWidth && height === mapHeight) return;

    mapWidth = width;
    mapHeight = height;
    projection = d3.geoAlbersUsa().fitSize([width, height], stateFeatures);
    path = d3.geoPath(projection);
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    stateSelection.attr("d", path);

    g.select(".nation-boundary").attr("d", path);
  }

  function resetMapBase() {
    if (!stateSelection) return;
    stateSelection
      .interrupt()
      .classed("active", false)
      .style("fill", "#000000")
      .style("opacity", 0.88);
    
    // Reset borders & glow to defaults
    container.style.removeProperty("--map-stroke");
    container.style.removeProperty("--map-glow");

    // Reset legend swatch color
    const swatch = legend.querySelector(".swatch");
    if (swatch) {
      swatch.style.backgroundColor = "";
    }

    updateTitle(mapExploreActive);
  }

  function hideExplore() {
    mapExploreActive = false;
    if (g) g.style("opacity", 1);
    hideWordCloudExplore(exploreLayer, stage);
    updateTitle(false, getCurrentWord());
  }

  function showExplore() {
    if (isWordMode() || !stateSelection) return;
    mapExploreActive = true;
    resetMapBase();
    if (g) g.style("opacity", 0.14);
    updateTitle(true);
    tooltip.style.opacity = 0;
    resizeMap();
    renderWordCloudExplore({
      mapEl: container,
      stage,
      exploreLayer,
      words,
      regionStyles,
      fontFamily: "Inter",
      projection,
    });
  }

  function renderChoropleth(word) {
    if (!stateSelection || !word || !words[word]) {
      resetMapBase();
      return;
    }

    resizeMap();
    hideExplore();

    const scores = words[word].states || {};
    const hasData = Object.keys(scores).length > 0;

    const MAP_COLOR_LOW = "#000000";
    const MAP_COLOR_HIGH = "#00e5ff";
    const style = getRegionStyle(word, words, regionStyles);
    const highColor = style ? style.color : MAP_COLOR_HIGH;

    // Update the legend swatch color dynamically
    const swatch = legend.querySelector(".swatch");
    if (swatch) {
      swatch.style.backgroundColor = highColor;
    }

    // Dynamically set borders and glow based on the region color
    const baseColor = d3.color(highColor);
    if (baseColor) {
      container.style.setProperty("--map-stroke", baseColor.copy({ opacity: 0.35 }).toString());
      container.style.setProperty("--map-glow", baseColor.copy({ opacity: 0.85 }).toString());
    }

    stateSelection
      .interrupt()
      .classed("active", (d) => Boolean(scores[fipsToAbbr(d.id)]))
      .transition()
      .duration(650)
      .style("fill", (d) => {
        const abbr = fipsToAbbr(d.id);
        return scores[abbr] ? d3.interpolateRgb(MAP_COLOR_LOW, highColor)(Math.max(0, Math.min(1, scores[abbr]))) : "#000000";
      })
      .style("opacity", (d) => {
        const abbr = fipsToAbbr(d.id);
        return scores[abbr] ? 1 : 0.42;
      });

    updateTitle(false, word);

    if (!hasData) {
      tooltip.style.opacity = 0;
    }
  }

  async function fetchAtlas() {
    const paths = [
      US_ATLAS_URL,
      new URL("../public/data/states-10m.json", import.meta.url).href,
      "./public/data/states-10m.json",
      "./data/states-10m.json",
      "/data/states-10m.json",
    ];
    for (const url of paths) {
      try {
        const data = await d3.json(url);
        if (data?.objects?.states) return data;
      } catch (_) {
        /* try next path */
      }
    }
    throw new Error("US map data failed to load (CDN blocked or missing public/data/states-10m.json)");
  }

  async function buildMap() {
    let us;
    try {
      us = await fetchAtlas();
    } catch (err) {
      container.innerHTML = `<p class="map-error">${err.message}</p>`;
      throw err;
    }
    stateFeatures = feature(us, us.objects.states);

    const { width, height } = layoutSize();
    mapWidth = width;
    mapHeight = height;

    projection = d3.geoAlbersUsa().fitSize([width, height], stateFeatures);
    path = d3.geoPath(projection);

    d3.select(container).selectAll("svg").remove();
    svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${width} ${height}`);
    g = svg.append("g");

    stateSelection = g
      .selectAll(".state")
      .data(stateFeatures.features)
      .join("path")
      .attr("class", "state")
      .attr("d", path)
      .on("mousemove", (event, d) => {
        if (mapExploreActive) return;
        const abbr = fipsToAbbr(d.id);
        const word = getCurrentWord();
        const value = words[word]?.states?.[abbr] || 0;
        tooltip.style.opacity = 1;
        tooltip.style.left = `${event.offsetX + 14}px`;
        tooltip.style.top = `${event.offsetY + 14}px`;
        tooltip.innerHTML = word
          ? `<strong>${abbr}</strong><br>${Math.round(value * 100)}% use “${word}”`
          : `<strong>${abbr}</strong>`;
      })
      .on("mouseleave", () => {
        tooltip.style.opacity = 0;
      });

    const nationMesh = topojson.mesh(us, us.objects.states, (a, b) => a === b);

    // Draw the overall US outer boundary (nation outline)
    g.append("path")
      .datum(nationMesh)
      .attr("class", "nation-boundary")
      .attr("d", path);

    resetMapBase();

    requestAnimationFrame(() => {
      resizeMap();
      stateSelection?.attr("d", path);
    });

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        resizeMap();
        if (mapExploreActive && !isWordMode()) {
          renderWordCloudExplore({
            mapEl: container,
            stage,
            exploreLayer,
            words,
            regionStyles,
            fontFamily: "Inter",
            projection,
          });
        }
      });
      ro.observe(container);
    }

    showExplore();
  }

  function init() {
    if (!initPromise) {
      initPromise = buildMap();
    }
    return initPromise;
  }

  function whenReady() {
    return initPromise || init();
  }

  return {
    init,
    whenReady,
    renderChoropleth,
    showExplore,
    hideExplore,
    resetMapBase,
    resizeMap,
  };
}
