/** Text matching and regional metadata for dialect terms. */

export function normalizeText(text) {
  return text.toLowerCase().replace(/[.,!?;:"()]/g, " ");
}

export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findWordKey(raw, words) {
  const normalized = normalizeText(raw).trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (words[normalized]) return normalized;

  const keys = Object.keys(words).sort((a, b) => b.length - a.length);
  return keys.find((key) => key === normalized || normalizeText(key) === normalized) ?? null;
}

export function findDialectWords(text, words) {
  const seen = new Set();
  const ordered = [];
  findDialectMatches(text, words).forEach((match) => {
    if (seen.has(match.word)) return;
    seen.add(match.word);
    ordered.push(match.word);
  });
  return ordered;
}

export function findDialectMatches(text, words) {
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

export function getTopStates(word, words, limit = 3) {
  return Object.entries(words[word]?.states || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([state]) => state);
}

export function getSignalStrength(word, words) {
  const values = Object.values(words[word]?.states || {});
  return values.length ? Math.max(...values) : 0.35;
}

export function getRegionStyle(word, words, regionStyles) {
  const topStates = getTopStates(word, words, 5);
  const best = regionStyles
    .map((region) => ({
      ...region,
      hits: topStates.filter((state) => region.states.includes(state)).length,
    }))
    .sort((a, b) => b.hits - a.hits)[0];

  return best?.hits > 0
    ? best
    : { name: "Regional", color: "var(--neon-amber)", states: [] };
}

export function getVariantSet(word, words) {
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

export function colorScale(value, d3) {
  return d3.interpolateRgb(MAP_COLOR_LOW, MAP_COLOR_HIGH)(Math.max(0, Math.min(1, value)));
}

export function pickPrimaryWord(detected, words) {
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
