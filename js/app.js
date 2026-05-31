/**
 * DialectDrift - Core Application Logic
 * Completely serverless, unified non-module JavaScript that runs directly in the browser.
 */

// ==========================================
// 1. CONFIGURATION CONSTANTS
// ==========================================
const STATE_FIPS_TO_ABBR = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
  "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL",
  "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
  "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
  "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
  "55": "WI", "56": "WY",
};

const STATE_ABBR_TO_NAME = {
  "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
  "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
  "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
  "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
  "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
  "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
  "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
  "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
  "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
  "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
  "DC": "District of Columbia"
};

const STATE_POPULATIONS = {
  "AL": "5.1M", "AK": "0.7M", "AZ": "7.4M", "AR": "3.1M", "CA": "39.6M",
  "CO": "5.9M", "CT": "3.6M", "DE": "1.0M", "FL": "22.6M", "GA": "11.0M",
  "HI": "1.4M", "ID": "2.0M", "IL": "12.5M", "IN": "6.8M", "IA": "3.2M",
  "KS": "2.9M", "KY": "4.5M", "LA": "4.6M", "ME": "1.4M", "MD": "6.2M",
  "MA": "7.0M", "MI": "10.0M", "MN": "5.7M", "MS": "2.9M", "MO": "6.2M",
  "MT": "1.1M", "NE": "2.0M", "NV": "3.2M", "NH": "1.4M", "NJ": "9.3M",
  "NM": "2.1M", "NY": "19.6M", "NC": "10.8M", "ND": "0.8M", "OH": "11.8M",
  "OK": "4.1M", "OR": "4.2M", "PA": "13.1M", "RI": "1.1M", "SC": "5.4M",
  "SD": "0.9M", "TN": "7.1M", "TX": "30.5M", "UT": "3.4M", "VT": "0.6M",
  "VA": "8.7M", "WA": "7.8M", "WV": "1.8M", "WI": "5.9M", "WY": "0.6M",
  "DC": "0.7M"
};

const US_ATLAS_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

const SAMPLE_SENTENCES = {
  sandwich: "I grabbed a hoagie before class.",
  soda: "Do you call it pop, soda, or coke?",
  water: "Where is the bubbler?",
  south: "Y'all want to grab a coke before the game?",
  midwest: "You guys want a pop? Put on your tennis shoes first.",
};

const QUICK_WORDS = ["hoagie", "pop", "y'all", "bubbler", "soda", "crawfish"];

const TRENDING_WORDS = [
  "hoagie", "sub", "grinder", "hero",
  "pop", "soda", "coke",
  "y'all", "you guys", "youse",
  "bubbler", "tennis shoes", "sneakers",
  "crawfish", "firefly", "lightning bug",
];

const WAVE_COLORS = {
  south: "var(--south)",
  midwest: "var(--midwest)",
  northeast: "var(--northeast)",
  west: "var(--west)",
};

const CLOUD_FILLER = [
  { text: "dialect", trend: 0.12 },
  { text: "regional", trend: 0.11 },
  { text: "accent", trend: 0.1 },
];

const MAX_CLOUD_WORDS = 72;


// ==========================================
// 2. TEXT MATCHING & REGIONAL LOOKUPS
// ==========================================
function normalizeText(text) {
  return text.toLowerCase().replace(/[.,!?;:"()]/g, " ");
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findWordKey(raw, words) {
  const normalized = normalizeText(raw).trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (words[normalized]) return normalized;

  const keys = Object.keys(words).sort((a, b) => b.length - a.length);
  return keys.find((key) => key === normalized || normalizeText(key) === normalized) ?? null;
}

function findDialectWords(text, words) {
  const seen = new Set();
  const ordered = [];
  findDialectMatches(text, words).forEach((match) => {
    if (seen.has(match.word)) return;
    seen.add(match.word);
    ordered.push(match.word);
  });
  return ordered;
}

function findDialectMatches(text, words) {
  const matches = [];
  const keys = Object.keys(words).sort((a, b) => b.length - a.length);

  keys.forEach((word) => {
    const pattern = new RegExp(
      `(^|[^a-z'])(${escapeRegExp(word)})(?=$|[^a-z'])`,
      "gi",
    );
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const prefixLength = match[1].length;
      matches.push({
        word,
        start: match.index + prefixLength,
        end: match.index + prefixLength + match[2].length,
      });
    }
  });

  return matches
    .sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
    .reduce((accepted, match) => {
      const overlaps = accepted.some(
        (existing) => match.start < existing.end && match.end > existing.start,
      );
      return overlaps ? accepted : [...accepted, match];
    }, []);
}

function getTopStates(word, words, limit = 3) {
  return Object.entries(words[word]?.states || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([state]) => state);
}

function getSignalStrength(word, words) {
  const values = Object.values(words[word]?.states || {});
  return values.length ? Math.max(...values) : 0.35;
}

function getRegionStyle(word, words, regionStyles) {
  const topStates = getTopStates(word, words, 5);
  const best = regionStyles
    .map((region) => ({
      ...region,
      hits: topStates.filter((state) => region.states.includes(state)).length,
    }))
    .sort((a, b) => b.hits - a.hits)[0];

  return best?.hits > 0
    ? { ...best }
    : { name: "Broad US", color: "#8b9bb4", match: "" };
}

function getVariantSet(word, words) {
  const own = words[word]?.variants || [];
  if (own.length) return own;

  const concept = words[word]?.concept;
  const owner = Object.values(words).find(
    (entry) => entry.concept === concept && entry.variants?.length,
  );
  return owner?.variants || [];
}


const MAP_COLOR_LOW = "#1a2436";
const MAP_COLOR_HIGH = "#00e5ff";

function colorScale(value) {
  return d3.interpolateRgb(MAP_COLOR_LOW, MAP_COLOR_HIGH)(Math.max(0, Math.min(1, value)));
}

function pickPrimaryWord(detected, words) {
  if (!detected.length) return null;
  const ranked = [...detected].sort((a, b) => {
    const scoreDiff = getSignalStrength(b, words) - getSignalStrength(a, words);
    if (scoreDiff !== 0) return scoreDiff;
    return b.length - a.length;
  });
  return (
    ranked.find((w) => Object.keys(words[w]?.states || {}).length > 0) || ranked[0]
  );
}


// ==========================================
// 3. SPEECH SYNTHESIS ENGINE
// ==========================================
const RATES = { south: 0.86, midwest: 0.94, northeast: 1.02, west: 1.0 };
const PITCHES = { south: 0.9, midwest: 1.0, northeast: 1.06, west: 1.0 };

function speakWord(word, wave = "west", index = 0) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = RATES[wave] ?? [0.92, 1.0, 0.86, 1.08][index % 4];
  utterance.pitch = PITCHES[wave] ?? [0.95, 1.03, 0.9, 1.08][index % 4];
  speechSynthesis.speak(utterance);
}

function escapeForJs(text) {
  return text.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}


// ==========================================
// 4. CONCEPT LABEL FORMATTER
// ==========================================
function formatConcept(raw) {
  if (!raw) return "";
  // Capitalize first letter
  let text = raw.charAt(0).toUpperCase() + raw.slice(1);
  // Truncate very long Harvard survey descriptions at a natural break
  if (text.length > 60) {
    const cutoff = text.lastIndexOf(" ", 57);
    text = text.slice(0, cutoff > 20 ? cutoff : 57) + "…";
  }
  return text;
}


// ==========================================
// 5. DETAILS POPOVER COMPONENT
// ==========================================
function createPopover({ popoverId, wordElId, metaElId, bodyElId }) {
  const popover = document.getElementById(popoverId);
  const wordEl = document.getElementById(wordElId);
  const metaEl = document.getElementById(metaElId);
  const bodyEl = document.getElementById(bodyElId);
  let hideTimer = null;

  function buildContent(word, words, regionStyles) {
    const data = words[word];
    if (!data) return null;

    const style = getRegionStyle(word, words, regionStyles);
    const states = getTopStates(word, words, 6);

    // Deduplicate variants to prevent repeated items
    const rawVariants = getVariantSet(word, words);
    const uniqueVariantsMap = new Map();
    for (const v of rawVariants) {
      if (!uniqueVariantsMap.has(v.word.toLowerCase())) {
        uniqueVariantsMap.set(v.word.toLowerCase(), v);
      }
    }
    const variants = Array.from(uniqueVariantsMap.values()).slice(0, 3);

    const fallback = [{ word, region: style.name, ipa: "", note: data.summary }];

    return { data, style, states, variants: variants.length ? variants : fallback };
  }

  function position(anchor) {
    const rect = anchor.getBoundingClientRect();
    const margin = 12;
    const popRect = popover.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - popRect.width / 2;
    let top = rect.bottom + 10;
    left = Math.max(margin, Math.min(left, window.innerWidth - popRect.width - margin));
    if (top + popRect.height > window.innerHeight - margin) {
      top = rect.top - popRect.height - 10;
    }
    top = Math.max(margin, top);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function show(word, anchor, words, regionStyles) {
    const content = buildContent(word, words, regionStyles);
    if (!content) return;

    clearTimeout(hideTimer);

    // Clean up original Harvard survey questions into nice concepts
    const cleanConcept = formatConcept(content.data.concept);

    wordEl.textContent = word;
    metaEl.textContent = `${cleanConcept} · ${content.style.name}`;
    const sourceLabel = content.data.source?.survey || "Auto-discovered via AI Dictionary";

    let cleanSummary = content.data.summary || "";
    // If the summary is identical to the concept, don't repeat it
    if (cleanSummary && content.data.concept && cleanSummary.toLowerCase() === content.data.concept.toLowerCase() ||
      cleanSummary && cleanConcept && cleanSummary.toLowerCase() === cleanConcept.toLowerCase()) {
      cleanSummary = "";
    }

    bodyEl.innerHTML = `
      ${cleanSummary ? `<p class="details-popover-summary">${cleanSummary}</p>` : ""}
      <div class="details-popover-states"><strong>Top states:</strong> ${content.states.join(", ") || "No state data."}</div>
      <div class="provenance-footer" style="margin-top: 12px; font-size: 0.75em; color: var(--text-muted, #8b9bb4); border-top: 1px solid var(--border-color, #2a3441); padding-top: 8px;">
         <strong>Source:</strong> ${sourceLabel}
      </div>
    `;

    popover.classList.remove("hidden");
    popover.style.visibility = "hidden";
    requestAnimationFrame(() => {
      position(anchor);
      popover.style.visibility = "visible";
    });
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(close, 140);
  }

  function close() {
    clearTimeout(hideTimer);
    popover.classList.add("hidden");
    document.querySelectorAll(".clue-token.hovering").forEach((t) => t.classList.remove("hovering"));
  }

  popover.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  popover.addEventListener("mouseleave", scheduleHide);

  return { show, scheduleHide, close };
}
// ==========================================
// 5. SMOOTH WAVEFORM & SYLLABLE PARSER
// ==========================================

function estimateSyllablesFromText(word) {
  if (!word) return { phonemes: [], syllables: [] };
  // Keep only letters and apostrophes for clean syllables
  const clean = word.toLowerCase().replace(/[^a-z']/g, '').trim();
  if (!clean) return { phonemes: [], syllables: [] };

  const vowelPattern = /[aeiouy]+/g;
  const matches = [...clean.matchAll(vowelPattern)];
  const syllableCount = Math.max(1, matches.length);
  const phonemes = [];
  const syllables = [];
  let charIdx = 0;

  for (let s = 0; s < syllableCount; s++) {
    const syl = { phonemes: [], stressed: s === 0, label: '', isGap: false };
    const start = matches[s]?.index ?? charIdx;
    const vowelEnd = start + (matches[s]?.[0]?.length ?? 1);

    for (let i = charIdx; i < start && i < clean.length; i++) {
      const ph = { char: clean[i], type: 'consonant', amplitude: 0.35, duration: 0.4 };
      phonemes.push(ph); syl.phonemes.push(ph);
    }
    for (let i = start; i < vowelEnd && i < clean.length; i++) {
      const ph = { char: clean[i], type: 'vowel', amplitude: s === 0 ? 0.95 : 0.75, duration: 1.0 };
      phonemes.push(ph); syl.phonemes.push(ph);
    }
    const nextStart = matches[s + 1]?.index ?? clean.length;
    // Split consonants between syllables evenly
    const codaEnd = s < syllableCount - 1 ? Math.floor((vowelEnd + nextStart) / 2 + 0.5) : clean.length;
    for (let i = vowelEnd; i < codaEnd && i < clean.length; i++) {
      const ph = { char: clean[i], type: 'consonant', amplitude: 0.3, duration: 0.35 };
      phonemes.push(ph); syl.phonemes.push(ph);
    }
    charIdx = codaEnd;
    syl.label = syl.phonemes.map(p => p.char).join('');
    syllables.push(syl);
  }
  if (charIdx < clean.length) {
    const last = syllables[syllables.length - 1];
    for (let i = charIdx; i < clean.length; i++) {
      const ph = { char: clean[i], type: 'consonant', amplitude: 0.25, duration: 0.3 };
      phonemes.push(ph); if (last) last.phonemes.push(ph);
    }
    if (last) last.label = last.phonemes.map(p => p.char).join('');
  }
  return { phonemes, syllables };
}

// ── Seeded random for subtle wave variations ──
function seededRandom(seed) {
  let s = seed;
  return function () { s = (s * 1664525 + 1013904223) & 0xFFFFFFFF; return (s >>> 0) / 0xFFFFFFFF; };
}
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) & 0xFFFFFFFF;
  return h;
}

// ── Smooth envelope waveform generator ──
function smoothWaveformSvg(word, wave, index) {
  const WIDTH = 440;
  const WAVE_H = 44;
  const LABEL_H = 18;
  const TOTAL_H = WAVE_H + LABEL_H;
  const MID = WAVE_H / 2;
  const MARGIN_X = 8;
  const usableW = WIDTH - MARGIN_X * 2;

  const { phonemes, syllables } = estimateSyllablesFromText(word);
  if (!phonemes.length) {
    return `<svg viewBox="0 0 ${WIDTH} ${TOTAL_H}" preserveAspectRatio="none"><text x="${WIDTH / 2}" y="${MID}" text-anchor="middle" fill="var(--muted)" font-size="10">${word}</text></svg>`;
  }

  // Map parts to pixel positions
  const totalDur = phonemes.reduce((s, p) => s + p.duration, 0);
  const phPos = [];
  let xC = MARGIN_X;
  for (const ph of phonemes) {
    const w = (ph.duration / totalDur) * usableW;
    phPos.push({ ...ph, x: xC, w });
    xC += w;
  }

  let phI = 0;
  const sylPos = [];
  for (const syl of syllables) {
    if (!syl.phonemes.length) continue;
    const s0 = phPos[phI], s1 = phPos[phI + syl.phonemes.length - 1];
    if (s0 && s1) sylPos.push({ x: s0.x, w: (s1.x + s1.w) - s0.x, stressed: syl.stressed, label: syl.label });
    phI += syl.phonemes.length;
  }

  // Regional aesthetic modifiers
  const regionMod = {
    south: { ampScale: 0.95, freqScale: 0.8 },
    midwest: { ampScale: 1.0, freqScale: 1.0 },
    northeast: { ampScale: 1.05, freqScale: 1.2 },
    west: { ampScale: 1.0, freqScale: 1.0 },
  };
  const mod = regionMod[wave] || regionMod.west;

  // Generate smooth waveform samples
  const rand = seededRandom(hashString(word + wave + index));
  const totalSamples = Math.ceil(usableW * 1.5);
  const upper = [], lower = [];
  const maxAmp = WAVE_H * 0.45;

  for (let s = 0; s <= totalSamples; s++) {
    const x = MARGIN_X + (s / totalSamples) * usableW;
    let ph = phPos[0], phLocalT = 0;
    for (const p of phPos) {
      if (x >= p.x && x < p.x + p.w) { ph = p; phLocalT = p.w > 0 ? (x - p.x) / p.w : 0; break; }
    }
    if (!ph) ph = phPos[phPos.length - 1];

    const amp = ph.amplitude * mod.ampScale;
    const freq = (0.2 + (index * 0.05)) * mod.freqScale;

    // Smooth envelope over the phoneme
    const env = Math.sin(phLocalT * Math.PI) * 0.4 + 0.6;

    // Aesthetic smooth overlapping sine waves
    const wv = Math.sin(x * freq + index * 1.1) * 0.75 +
      Math.sin(x * freq * 2.3 + 0.5) * 0.25;

    // Subtle jitter so it feels organic
    const jitter = (rand() - 0.5) * 0.15;

    let sY = amp * env * maxAmp * Math.abs(wv + jitter);

    // Taper the outer edges smoothly
    const gT = s / totalSamples;
    sY *= Math.min(gT * 8, (1 - gT) * 8, 1);

    upper.push([x, MID - sY]);
    lower.push([x, MID + sY]);
  }

  lower.reverse();
  let pathD = `M ${upper[0][0].toFixed(1)},${MID.toFixed(1)}`;
  for (const [x, y] of upper) pathD += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
  for (const [x, y] of lower) pathD += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
  pathD += ' Z';

  let svg = `<svg class="phoneme-waveform" viewBox="0 0 ${WIDTH} ${TOTAL_H}" preserveAspectRatio="none">`;

  // Stressed syllable background bands
  for (const sl of sylPos) {
    if (sl.stressed) svg += `<rect class="stress-bg" x="${sl.x.toFixed(1)}" y="0" width="${sl.w.toFixed(1)}" height="${WAVE_H}" rx="3"/>`;
  }

  // Waveform path
  svg += `<path class="waveform-fill" d="${pathD}"/>`;

  // Syllable boundary dashed lines
  for (let i = 1; i < sylPos.length; i++) {
    svg += `<line class="syl-boundary" x1="${sylPos[i].x.toFixed(1)}" y1="2" x2="${sylPos[i].x.toFixed(1)}" y2="${WAVE_H - 2}"/>`;
  }

  // English syllable labels
  for (const sl of sylPos) {
    const cx = sl.x + sl.w / 2;
    const ly = WAVE_H + LABEL_H * 0.75;
    const cls = sl.stressed ? 'syl-label stressed' : 'syl-label';
    svg += `<text class="${cls}" x="${cx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle">${sl.label}</text>`;
  }

  svg += '</svg>';
  return svg;
}


// ==========================================
// 5b. AUDIO COMPARISON PANEL COMPONENT
// ==========================================

function audioLane(variant, index, selectedWord) {
  const isSelected = variant.word === selectedWord;
  const wave = variant.wave || "west";
  const safeWord = escapeForJs(variant.word);

  return `
    <div class="audio-lane ${isSelected ? "selected" : ""}" data-variant-word="${safeWord}" style="cursor:pointer">
      <button type="button" class="lane-play" data-speak-word="${safeWord}" data-speak-wave="${wave}" data-speak-index="${index}" title="Play “${variant.word}”">▶</button>
      <div class="lane-body">
        <div class="lane-wave">${smoothWaveformSvg(variant.word, wave, index)}</div>
        <div class="lane-meta">
          <span class="lane-word">${variant.word}</span>
          ${variant.ipa ? `<span class="lane-ipa" style="color: var(--neon-magenta); margin-right: 0.25rem;">${variant.ipa}</span>` : ""}
          <span class="lane-region">${variant.region}</span>
          ${variant.note && !variant.note.includes("· Strongest in") ? `<div class="lane-note" style="font-size: 0.85em; color: var(--text-muted); margin-top: 2px; line-height: 1.2;">${variant.note}</div>` : ""}
        </div>
      </div>
    </div>
  `;
}

function renderAudioPanel(container, word, words, regionStyles, onVariantSelect) {
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

  const cleanConcept = formatConcept(data.concept);

  const lanes = grouped.slice(0, 4);
  container.innerHTML = `
    <div class="audio-comparison">
      <div class="audio-graph-head">
        <div class="audio-graph-title">“${word}” · ${cleanConcept}</div>
        <div class="audio-graph-subtitle">Same idea, different regional words · click a row to update map</div>
      </div>
      <div class="audio-stack">
        ${lanes.map((v, i) => audioLane(v, i, word)).join("")}
      </div>
    </div>
  `;

  container.querySelectorAll("[data-speak-word]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      speakWord(
        btn.dataset.speakWord,
        btn.dataset.speakWave,
        Number(btn.dataset.speakIndex),
      );
    });
  });

  // Make each audio lane clickable to select that variant and update the map
  container.querySelectorAll(".audio-lane[data-variant-word]").forEach((lane) => {
    lane.addEventListener("click", () => {
      const variantWord = lane.dataset.variantWord;
      // Update visual selection within the audio panel
      container.querySelectorAll(".audio-lane").forEach((l) => l.classList.remove("selected"));
      lane.classList.add("selected");
      // Notify the app to update the map
      if (onVariantSelect) onVariantSelect(variantWord);
    });
  });
}

function resetAudioPlaceholder(container, mode) {
  container.innerHTML =
    mode === "word"
      ? '<p class="muted small" style="margin:0">Explore a dialect word to compare pronunciations.</p>'
      : '<p class="muted small" style="margin:0">Reveal a sentence fingerprint to compare pronunciations.</p>';
}


// ==========================================
// 6. FINGERPRINT TOKENS COMPONENT
// ==========================================
function renderFingerprintSummary(container, wordList, words, regionStyles) {
  if (wordList.length === 0) {
    container.innerHTML = '';
    return;
  }

  const regionNames = [
    ...new Set(wordList.map((w) => getRegionStyle(w, words, regionStyles).name)),
  ].map((n) =>
    n
      .replace("Midwest / Great Lakes", "Midwest")
      .replace("Philadelphia / Mid-Atlantic", "Mid-Atlantic"),
  );

  container.textContent = `${wordList.length} clue${wordList.length === 1 ? "" : "s"} · ${regionNames.join(" + ")}`;
}

function attachClueToken(span, word, displayText, currentWord, regionStyles, words, handlers) {
  const style = getRegionStyle(word, words, regionStyles);
  span.className = `clue-token ${word === currentWord ? "selected" : ""}`;
  span.style.setProperty("--signal", style.color);
  span.textContent = displayText;
  span.dataset.word = word;
  span.addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onSelect(word);
  });
  span.addEventListener("mouseenter", () => {
    span.classList.add("hovering");
    handlers.onHover(word, span);
  });
  span.addEventListener("mouseleave", () => {
    span.classList.remove("hovering");
    handlers.onHoverEnd();
  });
}

function appendPlain(container, text) {
  if (!text) return;
  const span = document.createElement("span");
  span.className = "token-plain";
  span.textContent = text;
  container.appendChild(span);
}

function renderSentenceTokens(container, text, words, regionStyles, currentWord, handlers) {
  const matches = findDialectMatches(text, words);
  container.innerHTML = "";

  if (matches.length === 0) {
    appendPlain(container, text);
    const note = document.createElement("div");
    note.style.width = "100%";
    note.style.marginTop = "0.75rem";
    note.style.paddingTop = "0.75rem";
    note.style.borderTop = "1px solid var(--border)";
    note.style.color = "var(--text-muted)";
    note.style.fontSize = "0.85rem";
    note.innerHTML = `No regional vocabulary detected. Try: <em>"I'm going to get a hoagie and a pop."</em>`;
    container.appendChild(note);
    return matches;
  }

  let cursor = 0;
  matches.forEach((match) => {
    appendPlain(container, text.slice(cursor, match.start));
    const span = document.createElement("span");
    attachClueToken(
      span,
      match.word,
      text.slice(match.start, match.end),
      currentWord,
      regionStyles,
      words,
      handlers,
    );
    container.appendChild(span);
    cursor = match.end;
  });
  appendPlain(container, text.slice(cursor));
  return matches.map((m) => m.word);
}

function renderWordToken(container, word, regionStyles, words, currentWord, handlers) {
  container.innerHTML = "";
  const span = document.createElement("span");
  attachClueToken(span, word, word, currentWord, regionStyles, words, handlers);
  container.appendChild(span);
}

function renderMissingWord(container, raw) {
  container.innerHTML = `
    <span class="token-plain">"${raw}"</span>
    <div style="width: 100%; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 0.85rem;">
      Not found in dictionary. Try common dialect words like hoagie, pop, bubbler, or crawfish.
    </div>`;
}

function syncTokenSelection(currentWord) {
  document.querySelectorAll(".clue-token").forEach((token) => {
    token.classList.toggle("selected", token.dataset.word === currentWord);
  });
}


// ==========================================
// 7. WORD CLOUD COMPONENT
// ==========================================

// Approximate geographic centroids [lng, lat] for each US state
const CLOUD_STATE_CENTROIDS = {
  AL: [-86.79, 32.80], AK: [-152.0, 64.20], AZ: [-111.50, 34.30], AR: [-92.40, 34.90],
  CA: [-119.70, 36.80], CO: [-105.50, 39.00], CT: [-72.70, 41.60], DE: [-75.50, 39.00],
  DC: [-77.00, 38.90], FL: [-81.50, 27.80], GA: [-83.40, 32.70], HI: [-157.50, 20.30],
  ID: [-114.50, 44.40], IL: [-89.20, 40.00], IN: [-86.30, 40.00], IA: [-93.10, 42.00],
  KS: [-98.40, 38.50], KY: [-84.30, 37.80], LA: [-91.80, 31.20], ME: [-69.40, 45.40],
  MD: [-76.80, 39.00], MA: [-71.50, 42.40], MI: [-84.50, 44.30], MN: [-94.30, 46.40],
  MS: [-89.70, 32.70], MO: [-92.50, 38.50], MT: [-110.50, 47.00], NE: [-99.90, 41.50],
  NV: [-116.40, 38.50], NH: [-71.60, 44.00], NJ: [-74.50, 40.10], NM: [-106.10, 34.50],
  NY: [-75.00, 43.00], NC: [-79.40, 35.60], ND: [-100.50, 47.50], OH: [-82.80, 40.40],
  OK: [-97.50, 35.50], OR: [-120.60, 44.00], PA: [-77.20, 40.90], RI: [-71.50, 41.70],
  SC: [-80.90, 33.80], SD: [-100.20, 44.40], TN: [-86.70, 35.80], TX: [-99.30, 31.50],
  UT: [-111.90, 39.30], VT: [-72.70, 44.00], VA: [-78.50, 37.50], WA: [-120.50, 47.40],
  WV: [-80.60, 38.90], WI: [-89.60, 44.30], WY: [-107.60, 43.00],
};

// Pick up to `limit` screen points that are maximally far apart (furthest-point greedy)
function cloudDiversePoints(candidates, limit, minPxGap) {
  if (!candidates.length) return [];
  const selected = [candidates[0]];
  while (selected.length < limit) {
    let best = null, bestMin = -1;
    for (const c of candidates) {
      if (selected.some(s => s.state === c.state)) continue;
      const minD = Math.min(...selected.map(s => Math.hypot(c.x - s.x, c.y - s.y)));
      if (minD > bestMin) { bestMin = minD; best = c; }
    }
    if (!best || bestMin < minPxGap) break;
    selected.push(best);
  }
  return selected;
}

function cloudWeightedCenter(entries, proj) {
  let wx = 0, wy = 0, wt = 0;
  for (const [state, val] of entries) {
    const c = CLOUD_STATE_CENTROIDS[state];
    if (!c) continue;
    const pt = proj(c);
    if (!pt) continue;
    wx += pt[0] * val; wy += pt[1] * val; wt += val;
  }
  return wt > 0 ? [wx / wt, wy / wt] : null;
}

function cloudOverlaps(ax, ay, aw, ah, placed) {
  for (const p of placed) {
    if (Math.abs(ax - p.x) < (aw + p.w) / 2 + 5 &&
      Math.abs(ay - p.y) < (ah + p.h) / 2 + 5) return true;
  }
  return false;
}

// Returns [x, y, ok] — ok=false means no clear slot found, caller should skip
function cloudFindSlot(ox, oy, bw, bh, placed, maxR) {
  if (!cloudOverlaps(ox, oy, bw, bh, placed)) return [ox, oy, true];
  const step = Math.max(6, bh * 0.35);
  for (let r = step; r <= maxR; r += step) {
    const steps = Math.max(16, Math.round((2 * Math.PI * r) / Math.max(bw * 0.25, 8)));
    for (let i = 0; i < steps; i++) {
      const angle = (2 * Math.PI * i) / steps;
      const nx = ox + Math.cos(angle) * r;
      const ny = oy + Math.sin(angle) * r;
      if (!cloudOverlaps(nx, ny, bw, bh, placed)) return [nx, ny, true];
    }
  }
  return [ox, oy, false];
}

function buildWordCloudData(words, regionStyles) {
  const ranked = Object.entries(words)
    .map(([text]) => ({ text, trend: getSignalStrength(text, words), color: getRegionStyle(text, words, regionStyles).color }))
    .filter(d => d.trend >= 0.30)
    .sort((a, b) => b.trend - a.trend);

  // Trending iconic words first, then fill with other high-signal words
  const trendingFirst = [
    ...ranked.filter(d => TRENDING_WORDS.includes(d.text)),
    ...ranked.filter(d => !TRENDING_WORDS.includes(d.text)),
  ].slice(0, 42);

  const trends = trendingFirst.map(d => d.trend);
  const sizeScale = d3.scaleSqrt().domain([d3.min(trends), d3.max(trends)]).range([13, 44]);
  return trendingFirst.map(d => ({ ...d, size: Math.round(sizeScale(d.trend)) }));
}

function renderWordCloudExplore({ mapEl, stage, exploreLayer, words, regionStyles, fontFamily, projection: extProj }) {
  const width = Math.max(mapEl.clientWidth || 0, 320);
  const height = Math.max(mapEl.clientHeight || 0, 240);
  stage.innerHTML = "";

  // Fit the projection to the actual continental state centroids so words fill the panel
  const proj = (function () {
    const pts = Object.entries(CLOUD_STATE_CENTROIDS)
      .filter(([s]) => s !== 'AK' && s !== 'HI')
      .map(([, c]) => ({ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: {} }));
    return d3.geoAlbersUsa().fitExtent([[55, 55], [width - 55, height - 55]], { type: "FeatureCollection", features: pts });
  })();

  const svg = d3.select(stage)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const placed = [];
  const maxR = Math.hypot(width, height) * 0.55;

  // Effective size: shrink long phrases so they fit on screen
  function effectiveSize(text, size) {
    const maxW = width * 0.72;
    const natural = size * 0.58 * text.length;
    return natural > maxW ? Math.floor(size * (maxW / natural)) : size;
  }

  function stamp(text, rawSize, color, ox, oy) {
    const size = Math.max(10, effectiveSize(text, rawSize));
    const bw = size * 0.58 * text.length;
    const bh = size * 1.15;
    const mg = 52;
    ox = Math.max(mg + bw / 2, Math.min(width - mg - bw / 2, ox));
    oy = Math.max(mg + bh / 2, Math.min(height - mg - bh / 2, oy));
    const [fx, fy, ok] = cloudFindSlot(ox, oy, bw, bh, placed, maxR);
    if (!ok) return false;
    if (fx - bw / 2 < mg || fx + bw / 2 > width - mg) return false;
    if (fy - bh / 2 < mg || fy + bh / 2 > height - mg) return false;
    placed.push({ x: fx, y: fy, w: bw, h: bh });
    svg.append("text")
      .attr("x", fx).attr("y", fy)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", `${size}px`)
      .attr("font-family", fontFamily || "Inter")
      .attr("font-weight", "500")
      .attr("fill", color)
      .attr("opacity", "0.93")
      .attr("stroke", "var(--bg-base,#0d1520)")
      .attr("stroke-width", "2.5")
      .attr("stroke-linejoin", "round")
      .attr("paint-order", "stroke fill")
      .text(text);
    return true;
  }

  const cloudItems = buildWordCloudData(words, regionStyles);

  for (const item of cloudItems) {
    const stateEntries = Object.entries(words[item.text]?.states || {})
      .filter(([, v]) => v > 0.12)
      .sort((a, b) => b[1] - a[1]);

    if (!stateEntries.length) continue; // skip generic filler

    // Map states to screen positions
    const screenPts = stateEntries
      .map(([state, val]) => {
        const c = CLOUD_STATE_CENTROIDS[state];
        if (!c) return null;
        const pt = proj(c);
        if (!pt) return null;
        return { state, val, x: pt[0], y: pt[1] };
      })
      .filter(Boolean);

    if (!screenPts.length) continue;

    // Spread = 4+ states all with usage > 40% of the top state's value
    const peak = stateEntries[0][1];
    const highCount = stateEntries.filter(([, v]) => v > peak * 0.45).length;

    // Primary label at weighted centroid of top states
    const center = cloudWeightedCenter(stateEntries.slice(0, 5), proj);
    if (!center) continue;
    stamp(item.text, item.size, item.color, center[0], center[1]);

    // Spread words: add a second smaller instance biased toward the left side
    if (highCount >= 3 && screenPts.length >= 2) {
      const instanceSize = Math.max(12, Math.round(item.size * 0.72));
      // Prefer a western anchor (x < 45% of width) so the left side stays full
      const leftPts = screenPts.filter(p => p.x < width * 0.45);
      const rightPts = screenPts.filter(p => p.x >= width * 0.45);
      // If primary is on the right, try left first; otherwise try right
      const altPool = center[0] > width * 0.45 ? leftPts : rightPts;
      const fallback = center[0] > width * 0.45 ? rightPts : leftPts;
      const alt = (altPool.length ? altPool : fallback).sort((a, b) => {
        // pick point furthest from primary center
        const da = Math.hypot(a.x - center[0], a.y - center[1]);
        const db = Math.hypot(b.x - center[0], b.y - center[1]);
        return db - da;
      })[0];
      if (alt) stamp(item.text, instanceSize, item.color, alt.x, alt.y);
    }
  }

  exploreLayer.classList.remove("hidden");
}

function hideWordCloudExplore(exploreLayer, stage) {
  exploreLayer.classList.add("hidden");
  stage.innerHTML = "";
}


// ==========================================
// 8. INTERACTIVE US CHOROPLETH MAP COMPONENT
// ==========================================
function fipsToAbbr(id) {
  if (id === null || id === undefined) return "";
  return STATE_FIPS_TO_ABBR[String(id).padStart(2, "0")] || "";
}

function createMapPanel({
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
  let highlightPath;
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

    if (highlightPath) {
      highlightPath.attr("d", null).style("opacity", 0);
    }

    g.selectAll(".state-label")
      .attr("x", d => {
        const centroid = path.centroid(d);
        return (centroid && !isNaN(centroid[0])) ? centroid[0] : -9999;
      })
      .attr("y", d => {
        const centroid = path.centroid(d);
        return (centroid && !isNaN(centroid[1])) ? centroid[1] : -9999;
      });
  }

  function resetMapBase() {
    if (!stateSelection) return;
    stateSelection
      .interrupt()
      .classed("active", false)
      .style("fill", "#1a2436")
      .style("opacity", 0.88);

    g.selectAll(".state-label")
      .interrupt()
      .style("fill", "#ffffff")
      .style("opacity", 0.45);

    if (highlightPath) {
      highlightPath
        .style("opacity", 0)
        .attr("d", null);
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
    if (g) g.style("opacity", 0);
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

    if (highlightPath) {
      highlightPath
        .style("opacity", 0)
        .attr("d", null);
    }

    const scores = words[word].states || {};
    const hasData = Object.keys(scores).length > 0;

    stateSelection
      .interrupt()
      .classed("active", (d) => Boolean(scores[fipsToAbbr(d.id)]))
      .transition()
      .duration(650)
      .style("fill", (d) => {
        const abbr = fipsToAbbr(d.id);
        return scores[abbr] ? colorScale(scores[abbr]) : "#1a2436";
      })
      .style("opacity", (d) => {
        const abbr = fipsToAbbr(d.id);
        return scores[abbr] ? 1 : 0.42;
      });

    g.selectAll(".state-label")
      .interrupt()
      .transition()
      .duration(650)
      .style("fill", (d) => {
        const abbr = fipsToAbbr(d.id);
        const score = scores[abbr] || 0;
        return score > 0.4 ? "#0c1018" : "#ffffff";
      })
      .style("opacity", (d) => {
        const abbr = fipsToAbbr(d.id);
        const score = scores[abbr] || 0;
        return score > 0 ? 0.9 : 0.35;
      });

    updateTitle(false, word);

    if (!hasData) {
      tooltip.style.opacity = 0;
    }
  }

  async function fetchAtlas() {
    const paths = [
      US_ATLAS_URL,
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
    throw new Error("US map data failed to load (CDN blocked or missing local states-10m.json)");
  }

  async function buildMap() {
    let us;
    try {
      us = await fetchAtlas();
    } catch (err) {
      container.innerHTML = `<p class="map-error">${err.message}</p>`;
      throw err;
    }
    stateFeatures = topojson.feature(us, us.objects.states);

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
      .on("mouseenter", function (event, d) {
        if (mapExploreActive) return;

        d3.select(this).style("cursor", "pointer");

        if (highlightPath) {
          highlightPath
            .attr("d", path(d))
            .style("opacity", 1);
        }
      })
      .on("mousemove", (event, d) => {
        if (mapExploreActive) return;
        const abbr = fipsToAbbr(d.id);
        const fullName = STATE_ABBR_TO_NAME[abbr] || abbr;
        const pop = STATE_POPULATIONS[abbr] || "N/A";
        const word = getCurrentWord();
        const value = words[word]?.states?.[abbr] || 0;
        tooltip.style.opacity = 1;
        tooltip.style.left = `${event.offsetX + 14}px`;
        tooltip.style.top = `${event.offsetY + 14}px`;
        tooltip.innerHTML = word
          ? `<strong>${fullName} (${abbr})</strong><span style="display:block; font-size: 0.85em; color: var(--muted); margin-bottom: 0.35rem;">Population: ~${pop}</span><span style="color: var(--neon-cyan); font-weight: 700; font-size: 1.25em;">${Math.round(value * 100)}%</span> use “${word}”`
          : `<strong>${fullName} (${abbr})</strong><span style="display:block; font-size: 0.85em; color: var(--muted);">Population: ~${pop}</span>`;
      })
      .on("mouseleave", function (event, d) {
        tooltip.style.opacity = 0;
        if (mapExploreActive) return;

        if (highlightPath) {
          highlightPath
            .style("opacity", 0)
            .attr("d", null);
        }
      });

    // Create a single shared highlight path node drawn AFTER states to ensure it is always on top of states (but under labels)
    highlightPath = g.append("path")
      .attr("class", "state-hover-highlight")
      .attr("fill", "none")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", "2.0px")
      .attr("pointer-events", "none")
      .style("opacity", 0);

    // Bulletproof container/svg escape clearing
    svg.on("mouseleave", () => {
      tooltip.style.opacity = 0;
      if (highlightPath) {
        highlightPath
          .style("opacity", 0)
          .attr("d", null);
      }
    });

    // Render state abbreviation short labels on centroid
    g.selectAll(".state-label")
      .data(stateFeatures.features)
      .join("text")
      .attr("class", "state-label")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .style("pointer-events", "none")
      .text(d => fipsToAbbr(d.id))
      .attr("x", d => {
        const centroid = path.centroid(d);
        return (centroid && !isNaN(centroid[0])) ? centroid[0] : -9999;
      })
      .attr("y", d => {
        const centroid = path.centroid(d);
        return (centroid && !isNaN(centroid[1])) ? centroid[1] : -9999;
      });

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


// ==========================================
// 9. APPLICATION ORCHESTRATION & EVENT BINDINGS
// ==========================================
function createApp({ words, regionStyles, popover }) {
  let appMode = "sentence";
  let currentWord = "hoagie";

  const els = {
    body: document.body,
    analyzeBtn: document.getElementById("analyzeBtn"),
    inputPanel: document.getElementById("input-panel"),
    fingerprintPanel: document.getElementById("fingerprint-panel"),
    sentence: document.getElementById("sentence"),
    tokens: document.getElementById("sentence-tokens"),
    summary: document.getElementById("fingerprint-summary"),
    variants: document.getElementById("variants"),
    inputLabel: document.getElementById("input-label"),
    sentenceBlock: document.getElementById("sentence-input-block"),
    sentenceSamples: document.getElementById("sentence-samples"),
    fingerprintTitle: document.getElementById("fingerprint-title"),
    fingerprintKicker: document.getElementById("fingerprint-kicker"),
  };



  const tokenHandlers = {
    onSelect: (word) => selectWord(word),
    onHover: (word, anchor) => popover.show(word, anchor, words, regionStyles),
    onHoverEnd: () => popover.scheduleHide(),
  };

  const map = createMapPanel({
    containerId: "map",
    tooltipId: "tooltip",
    legendId: "map-legend-choropleth",
    titleId: "map-panel-title",
    exploreId: "map-explore",
    stageId: "word-cloud-stage",
    words,
    regionStyles,
    getCurrentWord: () => currentWord,
    isWordMode: () => appMode === "word",
  });

  // Called when user clicks a variant row in the audio panel
  function handleVariantSelect(variantWord) {
    // If the variant word exists in the dictionary, update the map for it
    if (words[variantWord]) {
      currentWord = variantWord;
      map.renderChoropleth(variantWord);
      syncTokenSelection(currentWord);
    }
  }

  function showFingerprintMode() {
    els.inputPanel.classList.add("hidden");
    els.fingerprintPanel.classList.remove("hidden");
  }

  function showInputMode() {
    els.fingerprintPanel.classList.add("hidden");
    els.inputPanel.classList.remove("hidden");
    popover.close();
    resetAudioPlaceholder(els.variants, "sentence");
    map.showExplore();
  }

  function selectWord(word) {
    if (!words[word]) return;
    currentWord = word;

    if (appMode === "sentence") {
      const text = els.sentence.value;
      const detected = findDialectWords(text, words);
      renderSentenceTokens(
        els.tokens,
        text,
        words,
        regionStyles,
        currentWord,
        tokenHandlers,
      );
      renderFingerprintSummary(
        els.summary,
        detected.includes(word) ? detected : [word, ...detected],
        words,
        regionStyles,
      );
      map.renderChoropleth(word);
    } else {
      renderWordToken(els.tokens, word, regionStyles, words, currentWord, tokenHandlers);
      renderFingerprintSummary(els.summary, [word], words, regionStyles);
      map.renderChoropleth(word);
    }

    syncTokenSelection(currentWord);
    renderAudioPanel(els.variants, word, words, regionStyles, handleVariantSelect);
  }



  async function analyze() {
    els.analyzeBtn.disabled = true;
    popover.close();

    try {
      let mapReady = false;
      try {
        await map.whenReady();
        mapReady = true;
      } catch (mapErr) {
        console.warn("Map not ready, proceeding with other elements:", mapErr);
      }

      if (appMode === "word") {
        const raw = els.wordInput.value.trim();
        const word = findWordKey(raw, words);
        if (!word) {
          renderMissingWord(els.tokens, raw);

          renderFingerprintSummary(els.summary, [], words, regionStyles);
          showFingerprintMode();
          if (mapReady) map.resetMapBase();
          els.variants.innerHTML =
            '<p class="muted small" style="margin:0">Try hoagie, pop, y\'all, bubbler, soda, or crawfish.</p>';
          return;
        }
        currentWord = word;
        renderWordToken(els.tokens, word, regionStyles, words, currentWord, tokenHandlers);
        renderFingerprintSummary(els.summary, [word], words, regionStyles);
        showFingerprintMode();
        if (mapReady) map.renderChoropleth(word);
        renderAudioPanel(els.variants, word, words, regionStyles, handleVariantSelect);
        return;
      }

      const text = els.sentence.value.trim();
      const detected = findDialectWords(text, words);
      const primary = pickPrimaryWord(detected, words);

      renderSentenceTokens(
        els.tokens,
        text,
        words,
        regionStyles,
        primary || "",
        tokenHandlers,
      );
      renderFingerprintSummary(els.summary, detected, words, regionStyles);
      showFingerprintMode();

      if (!primary) {
        if (mapReady) map.showExplore();
        resetAudioPlaceholder(els.variants, appMode);
        return;
      }

      currentWord = primary;
      syncTokenSelection(currentWord);
      if (mapReady) map.renderChoropleth(currentWord);
      renderAudioPanel(els.variants, currentWord, words, regionStyles, handleVariantSelect);
    } catch (err) {
      console.error(err);
      els.summary.textContent = `Could not analyze text: ${err.message}`;
    } finally {
      els.analyzeBtn.disabled = false;
    }
  }



  let isMapLoaded = false;

  function updateAnalyzeButtonState() {
    if (!isMapLoaded) return;
    els.analyzeBtn.disabled = els.sentence.value.trim() === "";
  }

  function bindEvents() {
    els.analyzeBtn.addEventListener("click", analyze);
    document.getElementById("resetBtn").addEventListener("click", showInputMode);

    els.sentence.addEventListener("input", updateAnalyzeButtonState);

    els.sentence.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!els.analyzeBtn.disabled) analyze();
      }
    });

    document.querySelectorAll("[data-sample]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetText = SAMPLE_SENTENCES[btn.dataset.sample];
        els.sentence.value = "";
        let i = 0;
        
        els.analyzeBtn.disabled = true;

        const typeInterval = setInterval(() => {
          els.sentence.value += targetText.charAt(i);
          // Trigger input event to update any other listeners, but we control button state here manually
          i++;
          if (i >= targetText.length) {
            clearInterval(typeInterval);
            updateAnalyzeButtonState();
          }
        }, 15);
      });
    });

  }

  async function init() {
    bindEvents();
    els.analyzeBtn.disabled = true;
    els.analyzeBtn.innerHTML = "Loading<br>map…";

    try {
      await map.init();
      isMapLoaded = true;
    } catch (err) {
      console.error(err);
      els.summary.textContent =
        "US map data could not load. Ensure you have network access to load the topoJSON boundaries.";
    } finally {
      els.analyzeBtn.innerHTML = "Reveal fingerprint";
      updateAnalyzeButtonState();
      showInputMode();
    }
  }

  return { init, analyze };
}

// ==========================================
// 10. SYSTEM BOOTSTRAP (ON PAGE LOAD)
// ==========================================
async function boot() {
  const banner = document.getElementById("boot-banner");

  function showBanner(message, isError = false) {
    if (!banner) return;
    banner.hidden = false;
    banner.textContent = message;
    banner.classList.toggle("boot-banner--error", isError);
  }

  showBanner("Loading dictionary and map…");

  try {
    // 1. Load dictionary data from globally accessible static data source window.DICTIONARY_DATA
    if (!window.DICTIONARY_DATA || !window.DICTIONARY_DATA.words) {
      throw new Error("Local dictionary data is not loaded. Ensure js/data.js is referenced correctly.");
    }
    const { words, regionStyles } = window.DICTIONARY_DATA;

    // 2. Initialize hover popovers
    const popover = createPopover({
      popoverId: "details-popover",
      wordElId: "popover-word",
      metaElId: "popover-meta",
      bodyElId: "details-popover-body",
    });

    // 3. Launch App logic
    const app = createApp({ words, regionStyles, popover });
    await app.init();
    if (banner) banner.hidden = true;
  } catch (err) {
    console.error(err);
    showBanner(`Failed to load: ${err.message}`, true);
  }
}

// Fire up the app on window load!
window.addEventListener("DOMContentLoaded", boot);
