/** Audio comparison panel (decorative waveforms + TTS placeholder). */

import { getRegionStyle } from "./dialectLookup.js";
import { escapeForJs, speakWord } from "./speech.js";

function wordBurstSvg(wave, index) {
  const width = 400;
  const height = 38;
  const mid = height / 2;
  const upper = [];
  const amp = wave === "south" ? 14 : wave === "midwest" ? 11 : wave === "northeast" ? 9 : 8;
  const freq = wave === "south" ? 0.09 : wave === "northeast" ? 0.14 : 0.11;

  for (let x = 0; x <= width; x += 2) {
    const t = x / width;
    const envelope =
      Math.exp(-Math.pow((t - 0.58) / 0.12, 2)) * 0.95 +
      Math.exp(-Math.pow((t - 0.22) / 0.08, 2)) * 0.12;
    const y = mid - Math.sin(x * freq + index * 0.7) * amp * envelope;
    upper.push([x, y]);
  }

  const lower = upper
    .slice()
    .reverse()
    .map(([x, y]) => [x, height - (y - mid) + mid]);

  let d = `M ${upper[0][0]},${mid}`;
  upper.forEach(([x, y]) => {
    d += ` L ${x},${y}`;
  });
  lower.forEach(([x, y]) => {
    d += ` L ${x},${y}`;
  });
  d += " Z";

  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><path class="fill" d="${d}"></path></svg>`;
}

function audioLane(variant, index, selectedWord, words, regionStyles) {
  const isSelected = variant.word === selectedWord;
  const wave = variant.wave || "west";
  const safeWord = escapeForJs(variant.word);

  const style = getRegionStyle(variant.word, words, regionStyles);
  const color = style ? style.color : "var(--neon-cyan)";

  return `
    <div class="audio-lane ${isSelected ? "selected" : ""}">
      <button type="button" class="lane-play" data-speak-word="${safeWord}" data-speak-wave="${wave}" data-speak-index="${index}" title="Play “${variant.word}”">▶</button>
      <div class="lane-body">
        <div class="lane-wave">${wordBurstSvg(wave, index)}</div>
        <div class="lane-meta">
          <span class="lane-word" style="color: ${color}">${variant.word}</span>
          <span class="lane-region">${variant.region}</span>
          <span class="lane-ipa">${variant.ipa || ""}</span>
        </div>
      </div>
    </div>
  `;
}

export function renderAudioPanel(container, word, words, regionStyles) {
  const data = words[word];
  if (!data) {
    container.innerHTML =
      '<p class="muted small" style="margin:0">No regional vocabulary found.</p>';
    return;
  }

  const grouped = data.variants?.length
    ? data.variants
    : [
        {
          word,
          region: getRegionStyle(word, words, regionStyles).name,
          ipa: "",
          wave: "west",
          note: "",
        },
      ];

  const lanes = grouped.slice(0, 4);
  container.innerHTML = `
    <div class="audio-comparison">
      <div class="audio-graph-head">
        <div class="audio-graph-title">“${word}” · Meaning: ${data.concept}</div>
        <div class="audio-graph-subtitle">Same idea, different regional words</div>
      </div>
      <div class="audio-stack">
        ${lanes.map((v, i) => audioLane(v, i, word, words, regionStyles)).join("")}
      </div>
      <div class="audio-note">Yellow band = spoken-word timing (placeholder). Web Speech plays on ▶.</div>
    </div>
  `;

  container.querySelectorAll("[data-speak-word]").forEach((btn) => {
    btn.addEventListener("click", () => {
      speakWord(
        btn.dataset.speakWord,
        btn.dataset.speakWave,
        Number(btn.dataset.speakIndex),
      );
    });
  });
}

export function resetAudioPlaceholder(container, mode) {
  container.innerHTML =
    mode === "word"
      ? '<p class="muted small" style="margin:0">Explore a dialect word to compare pronunciations.</p>'
      : '<p class="muted small" style="margin:0">Reveal a regional signal to compare pronunciations.</p>';
}
