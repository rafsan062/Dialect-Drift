/** Hover popover for dialect token details. */

import { getTopStates, getVariantSet, getRegionStyle } from "./dialectLookup.js";

export function createPopover({ popoverId, wordElId, metaElId, bodyElId }) {
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
    const variants = getVariantSet(word, words).slice(0, 3);
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
    wordEl.textContent = word;
    metaEl.textContent = `${content.data.concept} · ${content.style.name}`;
    bodyEl.innerHTML = `
      <p class="details-popover-summary">${content.data.summary}</p>
      <div class="details-popover-states"><strong>Top states:</strong> ${content.states.join(", ") || "No state data."}</div>
      ${content.variants
        .map(
          (v) => `
        <div class="details-popover-variant">
          <strong>${v.word}</strong> · ${v.region}
          ${v.ipa ? `<br><span class="ipa-pill">${v.ipa}</span>` : ""}
          ${v.note ? `<br>${v.note}` : ""}
        </div>`,
        )
        .join("")}
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
