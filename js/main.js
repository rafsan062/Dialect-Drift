/** Entry point: load data and boot the app. */

import { createApp } from "./app.js";
import { loadDictionary } from "./dataLoader.js";
import { createPopover } from "./popover.js";

async function boot() {
  const banner = document.getElementById("boot-banner");

  function showBanner(message, isError = false) {
    if (!banner) return;
    banner.hidden = false;
    banner.textContent = message;
    banner.classList.toggle("boot-banner--error", isError);
  }

  if (location.protocol === "file:") {
    showBanner(
      "Open with Live Server or run npm run dev — file:// URLs cannot load modules or data.",
      true,
    );
    return;
  }

  showBanner("Loading dictionary and map…");

  try {
    const { words, regionStyles } = await loadDictionary();
    const popover = createPopover({
      popoverId: "details-popover",
      wordElId: "popover-word",
      metaElId: "popover-meta",
      bodyElId: "details-popover-body",
    });

    const app = createApp({ words, regionStyles, popover });
    await app.init();
    if (banner) banner.hidden = true;
  } catch (err) {
    console.error(err);
    showBanner(`Failed to load: ${err.message}`, true);
  }
}

boot();
