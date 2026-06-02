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

const TARGET_CLOUD_PLACED = 150;
const MAX_CLOUD_CANDIDATES = 280;
const CLOUD_MAX_SPIRAL_PX = 52;
const CLOUD_LABEL_GAP = 3;
const CLOUD_SAME_TEXT_MIN_RATIO = 0.2;


// ==========================================
// 2. TEXT MATCHING & REGIONAL LOOKUPS
// ==========================================
function normalizeText(text) {
  return text.toLowerCase().replace(/[.,!?;:"()]/g, " ");
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const META_TERM_RE = /i can only use|never heard of this|no special term for them|these words refer to different|not the same, and i know the difference|i spell it .* but pronounce|we have these in my area|a freeway is (bigger|free)/i;
const MAX_DIALECT_TERM_CHARS = 30;
const MAX_DIALECT_TERM_WORDS = 6;

function isDialectTerm(word) {
  const term = word.trim();
  if (!term) return false;
  if (META_TERM_RE.test(term)) return false;
  if (term.length > MAX_DIALECT_TERM_CHARS) return false;
  if (term.split(/\s+/).length > MAX_DIALECT_TERM_WORDS) return false;
  return true;
}

function findWordKey(raw, words) {
  const normalized = normalizeText(raw).trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (words[normalized] && isDialectTerm(normalized)) return normalized;

  const keys = Object.keys(words)
    .filter(isDialectTerm)
    .sort((a, b) => b.length - a.length);
  return keys.find((key) => {
    let regexStr = escapeRegExp(key).replace(/^(a|an|the) /i, '(?:(?:a|an|the) )?');
    const pattern = new RegExp(`^${regexStr}$`, 'i');
    return pattern.test(normalized) || key === normalized || normalizeText(key) === normalized;
  }) ?? null;
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
  const keys = Object.keys(words)
    .filter(isDialectTerm)
    .sort((a, b) => b.length - a.length);

  keys.forEach((word) => {
    let regexStr = escapeRegExp(word).replace(/^(a|an|the) /i, '(?:(?:a|an|the) )?');
    const pattern = new RegExp(
      `(^|[^a-z'])(${regexStr})(?=$|[^a-z'])`,
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
    : { name: "Broad US", color: "#c4ced8", match: "" };
}

function formatRegionLegendLabel(name) {
  return name
    .replace("Midwest / Great Lakes", "Midwest")
    .replace("Philadelphia / Mid-Atlantic", "Mid-Atlantic")
    .replace("West / Broad US", "West");
}

function formatVariantRegion(region) {
  if (!region) return "";
  return region.replace(/^Strongest in ([A-Z]{2})$/, (_, abbr) => {
    const name = STATE_ABBR_TO_NAME[abbr];
    return name ? `Strongest in ${name}` : region;
  });
}

function renderCloudLegend(listEl, regionStyles) {
  if (!listEl) return;
  const items = [
    ...regionStyles,
    { name: "Broad US", color: "#c4ced8" },
  ];
  listEl.innerHTML = items
    .map(
      (region) => `
        <li class="cloud-legend-item">
          <span class="cloud-legend-swatch" style="background:${region.color}"></span>
          <span>${formatRegionLegendLabel(region.name)}</span>
        </li>
      `,
    )
    .join("");
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


const MAP_COLOR_LOW = "#000000";
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
  const sanitizedWord = word.replace(/[^a-zA-Z0-9]/g, '_');
  const audioUrl = `./public/audio/${sanitizedWord}.mp3`;

  const audio = new Audio(audioUrl);

  audio.play().catch(e => {
    console.warn("Failed to play MP3, falling back to speechSynthesis", e);
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = RATES[wave] ?? [0.92, 1.0, 0.86, 1.08][index % 4];
    utterance.pitch = PITCHES[wave] ?? [0.95, 1.03, 0.9, 1.08][index % 4];
    speechSynthesis.speak(utterance);
  });
}

function escapeForJs(text) {
  return text.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function escapeHtmlAttr(text) {
  return String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}


// ==========================================
// 4. CONCEPT LABEL FORMATTER
// ==========================================
function normalizeConcept(raw) {
  if (!raw) return "";
  let text = raw.trim();
  text = text
    .replace(/^what (do you call|term do you use|is your .* term for|about your)\s+/i, "")
    .replace(/^which of these terms do you prefer(?:\s+for\s+.+)?\??$/i, "preferred term")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\?$/, "")
    .trim();
  if (!text) return "Regional term";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatConcept(raw, { maxLen = 60, data = null } = {}) {
  let text = normalizeConcept(raw);

  if (data && data.source && data.source.question_id) {
    if (data.source.question_id === 58) {
      text = "A sale of miscellaneous household goods, typically held in a garage or front yard";
    } else if (data.source.question_id === 97) {
      text = "A container for temporarily storing household waste or refuse";
    }
  }

  if (!maxLen || text.length <= maxLen) return text;
  const cutoff = text.lastIndexOf(" ", maxLen - 3);
  return text.slice(0, cutoff > 20 ? cutoff : maxLen - 3) + "…";
}

const BOILERPLATE_NOTE_RE = /harvard dialect survey response option/i;

const IPA_DIGRAPHS = [
  ["tion", "ʃən"], ["sion", "ʒən"], ["ing", "ɪŋ"], ["igh", "aɪ"], ["eigh", "eɪ"],
  ["ough", "ʌf"], ["augh", "ɔː"], ["sch", "sk"], ["tch", "tʃ"], ["dge", "dʒ"],
  ["ch", "tʃ"], ["sh", "ʃ"], ["th", "θ"], ["ph", "f"], ["wh", "w"], ["ng", "ŋ"],
  ["kn", "n"], ["wr", "r"], ["gn", "n"], ["ee", "iː"], ["ea", "iː"], ["oo", "uː"],
  ["ou", "aʊ"], ["ow", "aʊ"], ["oi", "ɔɪ"], ["oy", "ɔɪ"], ["ai", "eɪ"], ["ay", "eɪ"],
  ["au", "ɔː"], ["aw", "ɔː"], ["oa", "oʊ"], ["oe", "oʊ"], ["ue", "uː"], ["ui", "uː"],
  ["ie", "iː"], ["ei", "eɪ"], ["ar", "ɑr"], ["er", "ɚ"], ["or", "ɔr"], ["ir", "ɚ"],
  ["ur", "ɚ"], ["ck", "k"], ["qu", "kw"], ["x", "ks"],
];

const IPA_CHARS = {
  a: "æ", b: "b", c: "k", d: "d", e: "ɛ", f: "f", g: "ɡ", h: "h", i: "ɪ",
  j: "dʒ", k: "k", l: "l", m: "m", n: "n", o: "ɑ", p: "p", q: "k", r: "r",
  s: "s", t: "t", u: "ʌ", v: "v", w: "w", x: "ks", y: "j", z: "z",
};

const IPA_LETTER_NAMES = {
  a: "eɪ", b: "bi", c: "si", d: "di", e: "i", f: "ɛf", g: "dʒi", h: "eɪtʃ",
  i: "aɪ", j: "dʒeɪ", k: "keɪ", l: "ɛl", m: "ɛm", n: "ɛn", o: "oʊ", p: "pi",
  q: "kju", r: "ɑr", s: "ɛs", t: "ti", u: "ju", v: "vi", w: "dʌbəlju", x: "ɛks",
  y: "waɪ", z: "zi",
};

function normalizeForIpa(word) {
  return String(word || "")
    .trim()
    .toLowerCase()
    .replace(/'/g, " ")
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenToApproxIpa(token) {
  if (!token) return "";
  if (!/[aeiouy]/.test(token) && token.length <= 4) {
    return [...token].map((ch) => IPA_LETTER_NAMES[ch] || ch).join("");
  }

  let out = "";
  for (let i = 0; i < token.length;) {
    let matched = false;
    for (const [graph, ipa] of IPA_DIGRAPHS) {
      if (token.startsWith(graph, i)) {
        out += ipa;
        i += graph.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (token[i] === "-") {
      i += 1;
      continue;
    }
    out += IPA_CHARS[token[i]] || token[i];
    i += 1;
  }
  return out;
}

function approximateIpa(word) {
  const tokens = normalizeForIpa(word).split(/\s+/).filter(Boolean);
  if (!tokens.length) return "";
  const parts = tokens.map(tokenToApproxIpa).filter(Boolean);
  if (!parts.length) return "";
  parts[0] = `ˈ${parts[0]}`;
  return `/${parts.join(" ")}/`;
}

function resolveVariantIpa(variant) {
  const ipa = variant?.ipa?.trim();
  if (ipa) return ipa;
  return approximateIpa(variant?.word);
}

function resolveVariantNote(note) {
  if (!note || BOILERPLATE_NOTE_RE.test(note) || note.includes("· Strongest in")) return "";
  return note;
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
    const cleanConcept = formatConcept(content.data.concept, { data: content.data });

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
    // Maximize onset: middle consonants go to the next syllable (e.g. cra-yfish, wa-ter)
    // If there are multiple consonants, keep only the first one or two in the coda depending on length
    const codaEnd = vowelEnd + Math.floor((nextStart - vowelEnd) / 2);
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

// ── Smooth envelope waveform generator (Placeholder) ──
function smoothWaveformSvg(word, wave, index) {
  const safeWord = word.replace(/[^a-zA-Z0-9]/g, '_');
  return `<div id="waveform-container-${safeWord}-${index}" class="waveform-placeholder" style="width: 100%; height: 62px; position: relative;"></div>`;
}

// ── Dynamic Audio Waveform Loader ──
let sharedAudioContext = null;
const audioBufferCache = new Map();

function renderWaveformSvg(word, index, audioBuffer, maxDuration) {
  const safeWord = word.replace(/[^a-zA-Z0-9]/g, '_');
  const containerId = `waveform-container-${safeWord}-${index}`;
  const containerEl = document.getElementById(containerId);
  if (!containerEl) return;

  try {
    // Scale by duration so we have a common ms x-axis
    const duration = audioBuffer.duration;
    const MAX_DURATION = maxDuration; // Represent 440px
    const WIDTH = 440;
    const WAVE_H = 44;
    const LABEL_H = 18;
    const TOTAL_H = WAVE_H + LABEL_H;
    const MID = WAVE_H / 2;
    const MARGIN_X = 8;

    // The width of this specific waveform based on time
    const waveWidth = Math.min(WIDTH - MARGIN_X * 2, (duration / MAX_DURATION) * (WIDTH - MARGIN_X * 2));

    // Downsample the channel data
    const rawData = audioBuffer.getChannelData(0);
    // Adjust bins based on width so resolution is consistent
    const bins = Math.max(50, Math.floor((waveWidth / (WIDTH - MARGIN_X * 2)) * 300));
    const blockSize = Math.floor(rawData.length / bins);
    const peaks = [];

    for (let i = 0; i < bins; i++) {
      let start = i * blockSize;
      let sum = 0;
      for (let j = 0; j < blockSize && start + j < rawData.length; j++) {
        sum += Math.abs(rawData[start + j]);
      }
      peaks.push(sum / blockSize);
    }

    // Normalize peaks
    const maxPeak = Math.max(...peaks, 0.001);
    const normalized = peaks.map(p => p / maxPeak);

    const upper = [];
    const lower = [];

    for (let i = 0; i < bins; i++) {
      const x = MARGIN_X + (i / (bins - 1)) * waveWidth;
      const amp = normalized[i] * (WAVE_H * 0.45);
      upper.push([x, MID - amp]);
      lower.push([x, MID + amp]);
    }

    lower.reverse();
    let pathD = `M ${upper[0][0].toFixed(1)},${MID.toFixed(1)}`;
    for (const [x, y] of upper) pathD += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
    for (const [x, y] of lower) pathD += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
    pathD += ' Z';

    // Syllables
    const { phonemes, syllables } = estimateSyllablesFromText(word);
    const totalDur = phonemes.reduce((s, p) => s + p.duration, 0);
    const phPos = [];
    let xC = MARGIN_X;
    for (const ph of phonemes) {
      const w = (ph.duration / totalDur) * waveWidth;
      phPos.push({ ...ph, x: xC, w });
      xC += w;
    }

    let phI = 0;
    const sylPos = [];
    for (const syl of syllables) {
      if (!syl.phonemes.length) continue;
      const s0 = phPos[phI], s1 = phPos[phI + syl.phonemes.length - 1];
      if (s0 && s1) sylPos.push({ x: s0.x, w: (s1.x + s1.w) - s0.x, label: syl.label });
      phI += syl.phonemes.length;
    }

    // Tick marks
    let ticksSvg = '';
    for (let t = 0; t <= Math.ceil(duration * 4) / 4; t += 0.25) {
      if (t > duration) break;
      const x = MARGIN_X + (t / MAX_DURATION) * (WIDTH - MARGIN_X * 2);
      // Use yellow (#f0a038) for the time markers, solid thicker strokes
      ticksSvg += `<line x1="${x.toFixed(1)}" y1="2" x2="${x.toFixed(1)}" y2="${WAVE_H - 2}" stroke="#f0a038" stroke-opacity="0.5" stroke-width="2" />`;
      if (t > 0) {
        ticksSvg += `<text x="${(x + 2).toFixed(1)}" y="10" fill="#f0a038" font-size="9" text-anchor="start">${t * 1000}ms</text>`;
      }
    }

    let svg = `<svg class="phoneme-waveform" viewBox="0 0 ${WIDTH} ${TOTAL_H}" preserveAspectRatio="xMinYMin meet">`;
    svg += `<path class="waveform-fill" d="${pathD}" style="transition: d 0.3s ease;"/>`;
    svg += ticksSvg;

    for (let i = 1; i < sylPos.length; i++) {
      svg += `<line class="syl-boundary" x1="${sylPos[i].x.toFixed(1)}" y1="2" x2="${sylPos[i].x.toFixed(1)}" y2="${WAVE_H - 2}"/>`;
    }

    for (const sl of sylPos) {
      const cx = sl.x + sl.w / 2;
      const ly = WAVE_H + LABEL_H * 0.75;
      svg += `<text class="syl-label" x="${cx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle">${sl.label}</text>`;
    }

    svg += '</svg>';
    containerEl.innerHTML = svg;
  } catch (err) {
    console.warn("Could not generate true waveform for", word, err);
  }
}


// ==========================================
// 5b. AUDIO COMPARISON PANEL COMPONENT
// ==========================================

function audioLane(variant, index, selectedWord, words, regionStyles) {
  const isSelected = variant.word === selectedWord;
  const wave = variant.wave || "west";
  const safeWord = escapeHtmlAttr(variant.word);
  const ipa = resolveVariantIpa(variant);
  const note = resolveVariantNote(variant.note);

  const style = getRegionStyle(variant.word, words, regionStyles);
  const color = style ? style.color : "var(--neon-cyan)";

  return `
    <div class="audio-lane ${isSelected ? "selected" : ""}" data-variant-word="${safeWord}" style="cursor:pointer">
      <button type="button" class="lane-play" data-speak-word="${safeWord}" data-speak-wave="${wave}" data-speak-index="${index}" title="Play “${variant.word}”">▶</button>
      <div class="lane-body">
        <div class="lane-wave">${smoothWaveformSvg(variant.word, wave, index)}</div>
        <div class="lane-meta">
          <span class="lane-word" style="color: ${color}">${variant.word}</span>
          <span class="lane-region">${formatVariantRegion(variant.region)}</span>
          ${ipa ? `<span class="lane-ipa">${ipa}</span>` : ""}
          ${note ? `<span class="audio-note">${note}</span>` : ""}
        </div>
      </div>
    </div>
  `;
}

function renderAudioPanel(container, word, words, regionStyles, onVariantSelect, selectedWord = word) {
  const data = words[word];
  if (!data) {
    container.innerHTML =
      '<p class="muted small" style="margin:0">No regional vocabulary found.</p>';
    return;
  }

  const grouped = getVariantSet(word, words);
  const lanes = (grouped.length ? grouped : [
    {
      word,
      region: getRegionStyle(word, words, regionStyles).name,
      ipa: "",
      wave: "west",
      note: "",
    },
  ]).slice(0, 4);

  const cleanConcept = formatConcept(data.concept, { maxLen: 0, data: data });
  const isGeneric = !cleanConcept || cleanConcept.toLowerCase() === "preferred term" || cleanConcept.toLowerCase() === "regional term";

  container.innerHTML = `
    <div class="audio-comparison">
      <div class="audio-graph-head" style="margin-bottom: 12px;">
        ${isGeneric
      ? `<div class="audio-graph-title" style="font-size: 1.25em; font-weight: 600; color: var(--text);">“${word}”</div>`
      : `<div class="audio-graph-concept" style="color: var(--text-deep); font-size: 1.15em; font-weight: 500; line-height: 1.4;">Meaning: ${cleanConcept}</div>`
    }
        <div style="font-size: 0.85em; color: var(--muted); margin-top: 4px;">Y-axis indicates acoustic amplitude (loudness).</div>
      </div>
      <div class="audio-stack">
        ${lanes.map((v, i) => audioLane(v, i, selectedWord, words, regionStyles)).join("")}
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

  container.querySelectorAll(".audio-lane[data-variant-word]").forEach((lane) => {
    lane.addEventListener("click", () => {
      if (onVariantSelect) onVariantSelect(lane.dataset.variantWord);
    });
  });

  // Asynchronously load and render actual audio waveforms dynamically scaled to the max local duration
  (async () => {
    if (!sharedAudioContext) {
      sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const variantBuffers = await Promise.all(lanes.map(async (v) => {
      const safeWord = v.word.replace(/[^a-zA-Z0-9]/g, '_');
      const audioUrl = `./public/audio/${safeWord}.mp3`;
      try {
        let audioBuffer = audioBufferCache.get(audioUrl);
        if (!audioBuffer) {
          const response = await fetch(audioUrl);
          if (!response.ok) return null;
          const arrayBuffer = await response.arrayBuffer();
          audioBuffer = await sharedAudioContext.decodeAudioData(arrayBuffer);
          audioBufferCache.set(audioUrl, audioBuffer);
        }
        return audioBuffer;
      } catch (e) {
        return null;
      }
    }));

    let localMaxDuration = 0.5;
    for (const b of variantBuffers) {
      if (b && b.duration > localMaxDuration) {
        localMaxDuration = b.duration;
      }
    }
    // Add a tiny 5% visual margin so the longest wave doesn't touch the absolute right edge
    localMaxDuration = localMaxDuration * 1.05;

    lanes.forEach((v, i) => {
      if (variantBuffers[i]) {
        renderWaveformSvg(v.word, i, variantBuffers[i], localMaxDuration);
      }
    });
  })();
}

function resetAudioPlaceholder(container, mode) {
  container.innerHTML =
    mode === "word"
      ? '<p class="muted small" style="margin:0">Explore a dialect word to compare pronunciations.</p>'
      : '<p class="muted small" style="margin:0">Reveal a regional signal to compare pronunciations.</p>';
}


// ==========================================
// 6. FINGERPRINT TOKENS COMPONENT
// ==========================================
function renderFingerprintSummary(summaryEl, legendEl, wordList, words, regionStyles) {
  if (!wordList.length) {
    if (summaryEl) summaryEl.textContent = "";
    if (legendEl) legendEl.innerHTML = "";
    return;
  }

  if (summaryEl) {
    summaryEl.textContent = `${wordList.length} regional signal${wordList.length === 1 ? "" : "s"} detected`;
  }

  if (!legendEl) return;

  const regions = new Map();
  wordList.forEach((word) => {
    const style = getRegionStyle(word, words, regionStyles);
    if (!regions.has(style.name)) regions.set(style.name, style.color);
  });

  legendEl.innerHTML = [...regions.entries()]
    .map(
      ([name, color]) => `
        <li class="fingerprint-legend-item">
          <span class="fingerprint-legend-swatch" style="background:${color}"></span>
          <span>${formatRegionLegendLabel(name)}</span>
        </li>
      `,
    )
    .join("");
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

function cloudSpreadScore(stateEntries) {
  return stateEntries.filter(([, v]) => v > 0.15).length;
}

function cloudAnchorPoint(stateEntries, proj) {
  if (!stateEntries.length) return null;
  const total = stateEntries.reduce((sum, [, v]) => sum + v, 0);
  const [[topState, topScore]] = stateEntries;
  if (total > 0 && topScore / total >= 0.42) {
    const c = CLOUD_STATE_CENTROIDS[topState];
    const pt = c ? proj(c) : null;
    if (pt) return pt;
  }
  const significant = stateEntries.filter(([, v]) => v >= Math.max(0.1, topScore * 0.35)).slice(0, 4);
  return cloudWeightedCenter(significant.length ? significant : stateEntries.slice(0, 1), proj);
}

function cloudOverlaps(ax, ay, aw, ah, placed, overlapOpts = {}) {
  const { text = null, sameTextMinPx = 0 } = overlapOpts;
  for (const p of placed) {
    if (Math.abs(ax - p.x) < (aw + p.w) / 2 + CLOUD_LABEL_GAP &&
      Math.abs(ay - p.y) < (ah + p.h) / 2 + CLOUD_LABEL_GAP) return true;
    if (text && p.text === text && sameTextMinPx > 0 &&
      Math.hypot(ax - p.x, ay - p.y) < sameTextMinPx) return true;
  }
  return false;
}

// Returns [x, y, ok] — ok=false means no clear slot found, caller should skip
function cloudFindSlot(ox, oy, bw, bh, placed, maxR, isBoxInLand, overlapOpts = {}) {
  if (!cloudOverlaps(ox, oy, bw, bh, placed, overlapOpts) &&
    (!isBoxInLand || isBoxInLand(ox, oy, bw, bh))) return [ox, oy, true];
  const step = Math.max(4, bh * 0.25);
  for (let r = step; r <= maxR; r += step) {
    const steps = Math.max(16, Math.round((2 * Math.PI * r) / Math.max(bw * 0.25, 6)));
    for (let i = 0; i < steps; i++) {
      const angle = (2 * Math.PI * i) / steps;
      const nx = ox + Math.cos(angle) * r;
      const ny = oy + Math.sin(angle) * r;
      if (!cloudOverlaps(nx, ny, bw, bh, placed, overlapOpts) &&
        (!isBoxInLand || isBoxInLand(nx, ny, bw, bh))) return [nx, ny, true];
    }
  }
  return [ox, oy, false];
}

function buildWordCloudData(words, regionStyles, { limit = MAX_CLOUD_CANDIDATES } = {}) {
  const ranked = Object.entries(words)
    .filter(([text]) => isDialectTerm(text))
    .map(([text, data]) => {
      const states = Object.values(data.states || {});
      const max = states.length ? Math.max(...states) : 0;
      const sum = states.reduce((a, b) => a + b, 0);
      const uniqueness = sum > 0 ? max / sum : 0;
      // max gives regional strength, uniqueness penalizes diluted words
      const score = max * Math.pow(uniqueness, 0.4);
      return {
        text,
        trend: max,
        uniqueness,
        score,
        color: getRegionStyle(text, words, regionStyles).color
      };
    })
    .filter(d => d.trend >= 0.07)
    .sort((a, b) => b.score - a.score);

  const topWords = ranked.slice(0, limit);
  const n = topWords.length;

  const scores = topWords.map(d => d.score);
  const minScore = d3.min(scores) || 0;
  const maxScore = d3.max(scores) || 1;
  const scoreSize = d3.scaleSqrt().domain([minScore, maxScore]).range([13, 46]);

  return topWords.map((d, i) => {
    const rankT = i / Math.max(n - 1, 1);
    const byRank = d3.interpolateNumber(58, 12)(rankT);
    const bySignal = scoreSize(d.score);
    const bySplit = 12 + d.uniqueness * 34;
    const size = Math.round(byRank * 0.45 + bySignal * 0.35 + bySplit * 0.2);
    return { ...d, size: Math.min(62, Math.max(11, size)) };
  });
}

function renderWordCloudExplore({ mapEl, stage, exploreLayer, words, regionStyles, fontFamily, projection: extProj, stateFeatures, nationMesh, onWordClick }) {
  const width = Math.max(mapEl.clientWidth || 0, 320);
  const height = Math.max(mapEl.clientHeight || 0, 240);
  stage.innerHTML = "";

  // Fit the projection to the actual continental state centroids so words fill the panel
  const proj = (function () {
    const pts = Object.entries(CLOUD_STATE_CENTROIDS)
      .filter(([s]) => s !== 'AK' && s !== 'HI')
      .map(([, c]) => ({ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: {} }));
    // Extra right inset keeps labels clear of the region legend
    return d3.geoAlbersUsa().fitExtent([[80, 80], [width - 170, height - 80]], { type: "FeatureCollection", features: pts });
  })();

  // Render US Mask to offscreen canvas to verify landmass hits
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
  const maskPath = d3.geoPath(proj, maskCtx);

  maskCtx.fillStyle = "black";
  maskCtx.fillRect(0, 0, width, height);
  if (stateFeatures) {
    maskCtx.fillStyle = "white";
    maskCtx.beginPath();
    maskPath(stateFeatures);
    maskCtx.fill();
  }
  const imgData = maskCtx.getImageData(0, 0, width, height).data;

  function isLand(x, y) {
    if (!stateFeatures) return true; // fallback if no states
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
    return imgData[idx] > 128;
  }

  function isBoxInLand(cx, cy, bw, bh) {
    const hw = bw * 0.4, hh = bh * 0.4;
    const pts = [
      [cx, cy], // center
      [cx - hw, cy - hh], [cx + hw, cy - hh], // top corners
      [cx - hw, cy + hh], [cx + hw, cy + hh], // bottom corners
      [cx - hw, cy], [cx + hw, cy],           // left/right edges
      [cx, cy - hh], [cx, cy + hh]            // top/bottom edges
    ];
    let hits = 0;
    for (const [px, py] of pts) {
      if (isLand(px, py)) hits++;
    }
    return hits >= 6;
  }

  const svg = d3.select(stage)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  // Draw the US map border underneath
  if (nationMesh) {
    svg.append("g")
      .attr("class", "word-cloud-basemap")
      .style("opacity", "0.4") // keep it subtle
      .style("pointer-events", "none")
      .append("path")
      .datum(nationMesh)
      .attr("d", d3.geoPath(proj))
      .attr("fill", "transparent")
      .attr("stroke", "var(--text-muted, #8b9bb4)")
      .attr("stroke-width", "1.0")
      .attr("stroke-linejoin", "round");
  }

  const placed = [];
  const sameTextMinPx = Math.min(width, height) * CLOUD_SAME_TEXT_MIN_RATIO;

  // Effective size: shrink long phrases so they fit on screen
  function effectiveSize(text, size) {
    const maxW = width * 0.72;
    const natural = size * 0.58 * text.length;
    return natural > maxW ? Math.floor(size * (maxW / natural)) : size;
  }

  function stamp(text, rawSize, color, ox, oy, { sameTextMinPx: minSameText = 0 } = {}) {
    const overlapOpts = { text, sameTextMinPx: minSameText };
    for (const shrink of [1, 0.84, 0.7]) {
      const attemptSize = Math.max(9, effectiveSize(text, Math.max(9, Math.round(rawSize * shrink))));
      let bw = attemptSize * 0.55 * text.length;
      let bh = attemptSize * 1.0;

      const mg = 2;
      const sx = Math.max(mg + bw / 2, Math.min(width - mg - bw / 2, ox));
      const sy = Math.max(mg + bh / 2, Math.min(height - mg - bh / 2, oy));
      const localMaxR = Math.min(
        Math.max(bw, bh) * 2.2 + rawSize * 0.25,
        CLOUD_MAX_SPIRAL_PX,
      );
      const [fx, fy, ok] = cloudFindSlot(sx, sy, bw, bh, placed, localMaxR, isBoxInLand, overlapOpts);
      if (!ok) continue;
      if (fx - bw / 2 < mg || fx + bw / 2 > width - mg) continue;
      if (fy - bh / 2 < mg || fy + bh / 2 > height - mg) continue;
      placed.push({ x: fx, y: fy, w: bw, h: bh, text });

      const textEl = svg.append("text")
        .attr("x", fx).attr("y", fy)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", `${attemptSize}px`)
        .attr("font-family", fontFamily || "Inter")
        .attr("font-weight", "500")
        .attr("fill", color)
        .attr("opacity", "0.93")
        .attr("stroke", "var(--bg-base,#0d1520)")
        .attr("stroke-width", "2.5")
        .attr("stroke-linejoin", "round")
        .attr("paint-order", "stroke fill")
        .attr("class", "word-cloud-label")
        .style("cursor", onWordClick ? "pointer" : "default")
        .text(text);

      if (onWordClick) {
        textEl
          .on("click", (event) => {
            event.stopPropagation();
            onWordClick(text);
          })
          .on("mouseenter", function () {
            d3.select(this).attr("opacity", 1);
          })
          .on("mouseleave", function () {
            d3.select(this).attr("opacity", 0.93);
          });
      }

      return true;
    }

    return false;
  }

  const cloudItems = buildWordCloudData(words, regionStyles)
    .sort((a, b) => b.size - a.size);

  let placedCount = 0;

  for (const item of cloudItems) {
    if (placedCount >= TARGET_CLOUD_PLACED) break;

    const stateEntries = Object.entries(words[item.text]?.states || {})
      .filter(([, v]) => v > 0.08)
      .sort((a, b) => b[1] - a[1]);

    if (!stateEntries.length) continue;

    const spread = cloudSpreadScore(stateEntries);

    if (spread <= 5) {
      const anchor = cloudAnchorPoint(stateEntries, proj);
      if (!anchor) continue;
      if (stamp(item.text, item.size, item.color, anchor[0], anchor[1])) {
        placedCount += 1;
      }
      continue;
    }

    const instanceSize = Math.max(10, Math.round(item.size * 0.78));
    const stateCandidates = stateEntries.slice(0, 8).flatMap(([state]) => {
      const c = CLOUD_STATE_CENTROIDS[state];
      const pt = c ? proj(c) : null;
      return pt ? [{ state, x: pt[0], y: pt[1] }] : [];
    });
    const anchors = cloudDiversePoints(stateCandidates, 3, sameTextMinPx * 0.85);

    for (const anchor of anchors) {
      if (placedCount >= TARGET_CLOUD_PLACED) break;
      if (stamp(item.text, instanceSize, item.color, anchor.x, anchor.y, {
        sameTextMinPx: sameTextMinPx,
      })) {
        placedCount += 1;
      }
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
  onCloudWordClick,
}) {
  let svg;
  let g;
  let path;
  let projection;
  let stateFeatures;
  let nationMesh;
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
  const cloudLegendList = document.getElementById("map-legend-cloud-list");

  renderCloudLegend(cloudLegendList, regionStyles);

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
      .style("fill", "#000000")
      .style("opacity", 0.88);

    g.selectAll(".state-label")
      .interrupt()
      .style("fill", "#ffffff")
      .style("opacity", 0.45);

    // Reset borders & glow to defaults
    container.style.removeProperty("--map-stroke");
    container.style.removeProperty("--map-glow");

    // Reset legend swatch color
    const swatch = legend.querySelector(".swatch");
    if (swatch) {
      swatch.style.backgroundColor = "";
    }

    if (highlightPath) {
      highlightPath
        .style("opacity", 0)
        .attr("d", null);
    }

    updateTitle(mapExploreActive);
  }

  function hideExplore() {
    mapExploreActive = false;
    document.querySelector(".grid")?.classList.remove("is-explore");
    hideWordCloudExplore(exploreLayer, stage);
    updateTitle(false, getCurrentWord());
  }

  function showExplore() {
    if (isWordMode() || !stateSelection) return;
    mapExploreActive = true;
    document.querySelector(".grid")?.classList.add("is-explore");
    resetMapBase();
    updateTitle(true);
    tooltip.style.opacity = 0;

    // Defer to allow CSS layout reflow to finish before sizing word cloud
    setTimeout(() => {
      renderWordCloudExplore({
        mapEl: container,
        stage,
        exploreLayer,
        words,
        regionStyles,
        fontFamily: "Inter",
        projection,
        stateFeatures,
        nationMesh,
        onWordClick: onCloudWordClick,
      });
    }, 400);
  }

  function renderChoropleth(word) {
    if (!stateSelection || !word || !words[word]) {
      resetMapBase();
      return;
    }

    const leavingExplore = mapExploreActive;
    hideExplore();
    if (!leavingExplore) resizeMap();

    if (highlightPath) {
      highlightPath
        .style("opacity", 0)
        .attr("d", null);
    }

    const scores = words[word].states || {};
    const hasData = Object.keys(scores).length > 0;

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

    const applyChoropleth = () => {
      if (leavingExplore) resizeMap();

      stateSelection
        .interrupt()
        .classed("active", (d) => Boolean(scores[fipsToAbbr(d.id)]))
        .transition("choropleth")
        .duration(650)
        .ease(d3.easeCubicInOut)
        .style("fill", (d) => {
          const abbr = fipsToAbbr(d.id);
          return scores[abbr] ? d3.interpolateRgb(MAP_COLOR_LOW, highColor)(Math.max(0, Math.min(1, scores[abbr]))) : "#000000";
        })
        .style("opacity", (d) => {
          const abbr = fipsToAbbr(d.id);
          return scores[abbr] ? 1 : 0.42;
        });

      g.selectAll(".state-label")
        .interrupt()
        .transition("choropleth-labels")
        .duration(650)
        .ease(d3.easeCubicInOut)
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
    };

    if (leavingExplore) {
      setTimeout(applyChoropleth, 620);
    } else {
      applyChoropleth();
    }

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
    nationMesh = topojson.mesh(us, us.objects.states, (a, b) => a === b);

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

    // Draw the overall US outer boundary (nation outline)
    g.append("path")
      .datum(nationMesh)
      .attr("class", "nation-boundary")
      .attr("d", path);

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

    // ResizeObserver removed: Map does not need to dynamically recalculate on layout changes.
    // Native SVG preserveAspectRatio or stretching is preferred for performance and smoothness.

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
    legend: document.getElementById("fingerprint-legend"),
  };



  const tokenHandlers = {
    onSelect: (word) => selectWord(word),
    onHover: (word, anchor) => popover.show(word, anchor, words, regionStyles),
    onHoverEnd: () => popover.scheduleHide(),
  };

  let typeInterval = null;

  function typeIntoSentence(text) {
    if (!text) return;
    if (typeInterval) clearInterval(typeInterval);
    els.sentence.value = "";
    els.analyzeBtn.disabled = true;
    let i = 0;
    typeInterval = setInterval(() => {
      els.sentence.value += text.charAt(i);
      i += 1;
      if (i >= text.length) {
        clearInterval(typeInterval);
        typeInterval = null;
        updateAnalyzeButtonState();
        els.sentence.focus();
      }
    }, 15);
  }

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
    onCloudWordClick: typeIntoSentence,
  });

  // Called when user clicks a variant row in the audio panel
  function handleVariantSelect(variantWord) {
    if (words[variantWord]) selectWord(variantWord);
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
        els.legend,
        detected.includes(word) ? detected : [word, ...detected],
        words,
        regionStyles,
      );
    } else {
      renderWordToken(els.tokens, word, regionStyles, words, currentWord, tokenHandlers);
      renderFingerprintSummary(els.summary, els.legend, [word], words, regionStyles);
    }

    syncTokenSelection(currentWord);
    renderAudioPanel(els.variants, word, words, regionStyles, handleVariantSelect);
    map.renderChoropleth(word);
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

          renderFingerprintSummary(els.summary, els.legend, [], words, regionStyles);
          showFingerprintMode();
          if (mapReady) map.resetMapBase();
          els.variants.innerHTML =
            '<p class="muted small" style="margin:0">Try hoagie, pop, y\'all, bubbler, soda, or crawfish.</p>';
          return;
        }
        currentWord = word;
        renderWordToken(els.tokens, word, regionStyles, words, currentWord, tokenHandlers);
        renderFingerprintSummary(els.summary, els.legend, [word], words, regionStyles);
        showFingerprintMode();
        renderAudioPanel(els.variants, word, words, regionStyles, handleVariantSelect);
        if (mapReady) map.renderChoropleth(word);
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
      renderFingerprintSummary(els.summary, els.legend, detected, words, regionStyles);
      showFingerprintMode();

      if (!primary) {
        if (mapReady) map.showExplore();
        resetAudioPlaceholder(els.variants, appMode);
        return;
      }

      currentWord = primary;
      syncTokenSelection(currentWord);
      renderAudioPanel(els.variants, currentWord, words, regionStyles, handleVariantSelect);
      if (mapReady) map.renderChoropleth(currentWord);
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
        typeIntoSentence(SAMPLE_SENTENCES[btn.dataset.sample]);
      });
    });

    const infoBtn = document.getElementById("infoBtn");
    const infoModal = document.getElementById("info-modal");
    const infoClose = document.getElementById("info-modal-close");
    const infoBackdrop = document.getElementById("info-modal-backdrop");

    if (infoBtn && infoModal) {
      const closeModal = () => infoModal.classList.add("hidden");
      infoBtn.addEventListener("click", () => infoModal.classList.remove("hidden"));
      infoClose.addEventListener("click", closeModal);
      infoBackdrop.addEventListener("click", closeModal);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
      });
    }

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
      els.analyzeBtn.innerHTML = "Analyze";
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
