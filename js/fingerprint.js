/** Sentence / word fingerprint tokens and summary. */

import {
  findDialectMatches,
  findDialectWords,
  getRegionStyle,
} from "./dialectLookup.js";

export function renderFingerprintSummary(container, wordList, words, regionStyles) {
  if (wordList.length === 0) {
    container.textContent =
      "No clues yet. Try hoagie, pop, y'all, bubbler, or crawfish.";
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

export function renderSentenceTokens(container, text, words, regionStyles, currentWord, handlers) {
  const matches = findDialectMatches(text, words);
  container.innerHTML = "";

  if (matches.length === 0) {
    container.innerHTML =
      '<span class="muted small">No regional vocabulary found. Try hoagie, pop, y\'all, bubbler, or crawfish.</span>';
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

export function renderWordToken(container, word, regionStyles, words, currentWord, handlers) {
  container.innerHTML = "";
  const span = document.createElement("span");
  attachClueToken(span, word, word, currentWord, regionStyles, words, handlers);
  container.appendChild(span);
}

export function renderMissingWord(container, raw) {
  container.innerHTML = `<span class="muted small">${raw ? `"${raw}" is not in the dialect dictionary yet.` : "Enter a dialect word to explore."} Try hoagie, pop, y'all, bubbler, or soda.</span>`;
}

export function syncTokenSelection(currentWord) {
  document.querySelectorAll(".clue-token").forEach((token) => {
    token.classList.toggle("selected", token.dataset.word === currentWord);
  });
}

export { findDialectWords };
