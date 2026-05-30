# DialectDrift — Agent Design & Implementation Guide

> **Purpose:** This document gives a Cursor agent (or any developer) full context to implement the **DialectDrift** final project in a **new GitHub repo**. The design phase lives in the course "Final Project" folder; **this repo is for production code + real data**.

**Project:** DialectDrift  
**Team:** Andrew Levner · Rizvan Ahmed Rafsan · Sasivadhan Kandregula  
**Course:** CSPC 5320 Visual Analytics · Spring 2026  
**Hard deadline:** Mon Jun 1, 2026, 11:59 PM  
**Demo:** Tue Jun 2, 2026  

**Suggested GitHub repo description:**
> Interactive US dialect map for CSPC 5320 — paste a sentence, see regional vocabulary light up on a choropleth, and compare pronunciations across regions.

---

## 0. Read this first (agent instructions)

### What we are building
**DialectDrift** — one interactive visualization:

> Paste a sentence → regional dialect words highlight → US choropleth map updates → audio pronunciation comparison panel shows regional variants side-by-side.

**Selected concept:** DialectDrift was chosen for the final implementation. SentimentTube was pitched alongside it but is **out of scope** for this repo.

### Current state
- **Mockup exists** as a self-contained HTML file with **hard-coded fake data** in a `<script>` block.
- **No real datasets are wired yet.** First priority = **data wrangling** (see §4).
- **Do not** treat `README.md` / `PITCH.md` in the design folder as the build spec — those describe an older "Loanword Archaeology" direction. **This doc + `mockup_dialectdrift.html` + `v2 writeup.txt` are the source of truth.**

### What to copy from the design folder into the new repo
```
mockup_dialectdrift.html       → docs/mockups/
v2 writeup.txt                 → docs/writeups/dialectdrift-v2.txt
viz_concepts.pdf               → docs/viz_concepts.pdf (optional)
AGENT_DESIGN_IMPLEMENTATION.md → repo root (this file)
```

### Build order (mandatory)
1. **Repo scaffold** — structure, README, `.gitignore`, env example  
2. **Data wrangling pipelines** — scripts that output static JSON consumed by the frontend  
3. **Core viz** — US map + sentence/word fingerprint (no audio yet)  
4. **Audio panel** — TTS + waveform comparison  
5. **Polish** — popovers, samples, styling match mockup  
6. **Hosting + final writeup**

---

## 1. DialectDrift — product spec

### 1.1 Motivation, audience, questions (from v2 writeup)

**Motivation:** Help travelers understand how language changes across US regions — explore dialect interactively instead of static tables.

**Audience:** Tourists, travelers, people moving between regions who want to understand local speech patterns, slang, and regional vocabulary.

**Main questions:**
1. What region is a sentence most likely associated with based on dialect?
2. Where are different regional terms for the same object/concept most commonly used?
3. How does changing a single word shift its geographic dialect association?

### 1.2 v1 → v2 design drift
- **v1:** Geographic word map only (choropleth + word cloud).
- **v2 pivot:** Add **audio pronunciation** + **visual audio-comparison window** (stacked waveforms, IPA, regional variants side-by-side). Goal: tourists can **hear and see** how locals say things, not just read where words are used.

### 1.3 Interaction model (from `mockup_dialectdrift.html`)

```
[Landing]
  Default map view: faded US map + dialect word cloud overlay ("trending splits")
  Modes: Sentence | Word

[Sentence mode]
  User pastes sentence → "Reveal fingerprint"
  → Top bar switches to "Sentence fingerprint" with highlighted dialect tokens
  → Map: choropleth for selected/first dialect word
  → Right panel: "Audio · regional pronunciations" comparison chart

[Word mode]
  User types single word → "Explore word"
  → Map hides; word cloud / word focus only (body[data-mode="word"])
  → Same audio panel for that word's regional variants

[Interactions]
  - Click highlighted token → updates map + audio panel for that word
  - Hover token → popover with summary, top states, variant list
  - Sample buttons preload demo sentences/words
  - Play button per audio lane → Web Speech API (mock uses speechSynthesis)
```

### 1.4 UI layout (preserve from mockup)
- **Header:** Title + tagline ("One ordinary sentence. Several different Americas hiding inside it.")
- **Top bar:** Input (sentence or word) OR fingerprint strip with Edit button
- **Main grid:** ~58% US map (D3 + TopoJSON) | ~42% pronunciation panel
- **Visual style:** Purple/lavender gradient background, Barlow Semi Condensed, orange accent buttons, glassmorphism panels — see mockup CSS `:root` variables

### 1.5 Mock data schema (target JSON shape)

The mockup embeds data in a `WORDS` object. Production JSON should mirror this:

```json
{
  "hoagie": {
    "concept": "long sandwich",
    "summary": "Philadelphia / Mid-Atlantic word for a submarine sandwich.",
    "states": { "PA": 0.92, "NJ": 0.78, "DE": 0.62 },
    "variants": [
      {
        "word": "hoagie",
        "region": "Philadelphia / Mid-Atlantic",
        "phrase": "I grabbed a hoagie for lunch.",
        "ipa": "/ˈhoʊɡi/",
        "note": "Two syllables, long OH, hard G.",
        "wave": "northeast",
        "audioUrl": null
      }
    ]
  }
}
```

**Concept groups:** Words sharing a `concept` (e.g. hoagie/sub/grinder/hero) link via `concept` so variants group even when the user selects `sub`.

**Region styling:** Mock uses `REGION_STYLES` — region names → colors → state lists for token highlighting. Ship as `region_styles.json`.

**Runtime logic to reimplement:**
- `findDialectWords(text)` — longest-match scan against dictionary keys
- `findDialectMatches(text)` — position-aware tokenization for highlighting
- `getVariantSet(word)` — own variants or sibling variants from same concept
- Map choropleth: state fill = `colorScale(states[abbr])`, opacity by score

### 1.6 Intended real data sources (from `viz_concepts.pdf`)

| Source | Use | Notes |
|---|---|---|
| **Harvard Dialect Survey** (Vaux & Golder, 2003) | State-level % for ~120 regional terms | Powered NYT 2014 dialect quiz; **primary target** for `states` scores |
| **Jack Grieve US Dialect Twitter** | County/word frequency maps | Academic; may need aggregation to state level |
| **Reddit Pushshift** (state/city subreddits) | Geo-labels for informal terms | Fallback if survey data thin |
| **Wiktionary / Lingua Libre** | IPA + optional native audio | Pronunciation metadata |
| **Web Speech API** | en-US playback for regional phrases | Free, client-side; mock already uses this |
| **OpenAI TTS API** (optional backend) | Higher-quality regional voice variants | Requires API key + backend proxy — use only if time permits |

**If real data isn't ready:** Ship a **curated subset JSON** (~10–15 concept groups from Harvard survey) rather than blocking the UI. Document gaps in README.

### 1.7 Audio visualization — recommended stack

| Layer | Tool | Role |
|---|---|---|
| Playback (MVP) | **Web Speech API** | Zero-cost TTS for demo; mock uses `speechSynthesis` with rate/pitch per `wave` region |
| Waveform render | **wavesurfer.js** OR **D3 SVG paths from AudioBuffer** | Mock draws fake waveforms via `wordBurstSvg()` — replace with real peaks from decoded audio |
| Pre-recorded clips | Static MP3/OGG in `/public/audio/` | Preferred for consistent demo |
| Optional backend | **Python FastAPI** + OpenAI TTS | Generate/cache audio server-side; never expose API keys in frontend |

**Audio panel spec (from mockup):**
- Header: `"hoagie" · long sandwich` + subtitle "Same idea, different regional words"
- Up to 4 stacked lanes: play button | waveform | word + region + IPA
- Yellow vertical band = spoken-word timing alignment across lanes
- Selected lane highlighted when word matches user's selection

### 1.8 Related work (how we differ)

| Work | What it does | Our difference |
|---|---|---|
| NYT Dialect Quiz | Static survey quiz | Dynamic real-time mapping + audio |
| DARE | Text dictionary | Visual interactive map |
| Atlas of North American English | Static linguistic maps | User sentence input |

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **React** + **D3.js v7** | Mockup is vanilla HTML/JS — port to React components |
| Maps | **D3 + TopoJSON** (`us-atlas@3/states-10m.json`) | Mock uses CDN; vendor into repo |
| Word cloud | **d3-cloud** | Default explore view only |
| Audio waveforms | **wavesurfer.js** (optional) | If using pre-recorded clips |
| Backend (optional) | **Python FastAPI** | TTS caching only if needed |
| Data wrangling | **Python 3.11+** (`pandas`) | Offline scripts → static JSON |
| Hosting | **GitHub Pages** or **Vercel** | Static JSON + SPA is enough if no backend |
| Fonts | Google Fonts — Barlow Semi Condensed | Match mockup |

**CDN deps to pin (from mockup):**
- `d3@7`
- `topojson-client@3`
- `d3-cloud@1.2.7`

---

## 3. Recommended repo structure

```
dialectdrift/
├── README.md
├── AGENT_DESIGN_IMPLEMENTATION.md    # this file
├── .gitignore
├── .env.example                      # OPENAI_API_KEY (optional, backend only)
│
├── docs/
│   ├── mockups/
│   │   └── mockup_dialectdrift.html
│   └── writeups/
│       └── dialectdrift-v2.txt
│
├── data/
│   ├── raw/                          # downloaded survey CSVs (gitignore if huge)
│   ├── processed/
│   │   ├── words.json                # WORDS schema
│   │   └── region_styles.json
│   └── README.md                     # cite every source + preprocessing steps
│
├── scripts/                          # DATA WRANGLING — START HERE
│   ├── fetch_harvard_survey.py
│   ├── build_words_json.py
│   └── fetch_wiktionary_ipa.py
│
├── src/                              # Vite + React (or apps/dialectdrift/)
│   ├── components/
│   │   ├── MapPanel.tsx
│   │   ├── WordCloudExplore.tsx
│   │   ├── SentenceFingerprint.tsx
│   │   ├── AudioComparison.tsx
│   │   └── DetailsPopover.tsx
│   ├── hooks/
│   └── lib/
│       └── dialectLookup.ts
│
└── public/
    └── audio/                        # optional pre-recorded clips
```

---

## 4. Phase 0 — Data wrangling (PRIORITY)

> **We have no real data wired.** Do not build polished UI on fake inline JS objects. First deliverable = **processed JSON + wrangling scripts with README**.

### Wrangling tasks

| Task | Owner (plan) | Output | Deadline |
|---|---|---|---|
| Locate & download Harvard Dialect Survey raw responses | Sasivadhan / Rafsan | `data/raw/` | May 27 |
| Parse survey → state % per answer term | | `scripts/build_words_json.py` | May 27 |
| Define ~10–15 concept groups (sandwich, soda, you-plural, water fountain, sneakers…) | | `words.json` | May 27 |
| Add IPA + notes (manual or Wiktionary scrape) | | enriched `words.json` | May 28 |
| Optional: Grieve Twitter dialect → state aggregates | | extend JSON | if time |

**Minimum viable dictionary:** 10 concept groups × 3–4 variants — enough for all demo sentences in the mockup.

**Acceptance criteria:**
- [ ] `words.json` loads and reproduces mockup choropleth for "hoagie" and "pop"
- [ ] Every state score traceable to survey question ID in `data/README.md`
- [ ] No hardcoded `WORDS` object inside React components

### Wrangling conventions
- Python 3.11+ with `pandas`
- Scripts accept `--input` / `--output` CLI args
- Log row counts and drop reasons
- Commit **processed JSON** (<5MB); gitignore large raw files with download instructions in `data/README.md`

---

## 5. Implementation phases (after data exists)

### Phase 1 — Core skeleton (May 28)
- Vite + React app shell, import `words.json`
- Port map init from mockup (`initMap`, `renderMap`, TopoJSON)
- Sentence + word input modes, token highlighting
- Word cloud default explore view
- **Skip audio** until Phase 2

### Phase 2 — Audio panel (May 29)
- Audio comparison panel (lanes, IPA, play)
- Web Speech API MVP; wavesurfer.js if pre-recorded files exist
- Popover + details modal from mockup

### Phase 3 — Polish & deploy (May 30–Jun 1)
- Sample sentence buttons, Edit/reset flow, tooltips
- Match mockup styling (CSS tokens)
- GitHub Pages or Vercel
- README with live link, data citations, AI use note
- Final bug pass + rehearsal

---

## 6. Key mockup functions to port

From `mockup_dialectdrift.html`:

| Function | Purpose |
|---|---|
| `findDialectWords` / `findDialectMatches` | Detect & position dialect terms in text |
| `renderSentenceTokens` | Build clickable highlighted tokens |
| `renderMap` / `renderMapExplore` | Choropleth vs word-cloud default |
| `getVariantSet` | Group synonyms for audio panel |
| `getRegionStyle` | Color tokens by dominant region |
| `audioComparisonChart` / `wordBurstSvg` | Audio UI (replace fake waves with real) |
| `speakWord` | Web Speech API playback |
| `showDetailsPopover` | Hover tooltip with word details |

---

## 7. Visual design tokens

Copy from mockup `:root`:
```css
--bg: #b8aae4;
--bg-deep: #a090d8;
--bg-light: #d4ccf2;
--panel: rgba(255, 255, 255, 0.68);
--text-deep: #35174d;
--muted: #6b5a82;
--accent: #f0a038;
--violet: #694ce0;
--pink: #d870e0;
--font: "Barlow Semi Condensed", ...;
```

Map base fill: `#d8d0ec` → highlight `#d870e0`.

---

## 8. Team task ownership

| Task | Primary | Secondary | Deadline |
|---|---|---|---|
| Data wrangling & setup | Sasivadhan | Rafsan | May 27 |
| Core viz build (map + fingerprint) | Andrew | Sasivadhan | May 28 |
| Audio panel + interactions | Rafsan | Andrew | May 29 |
| Hosting & writeup | Sasivadhan | Rafsan | May 30 |
| Slides | Andrew | Sasivadhan | May 31 |
| Rehearsal | Rafsan | All | Jun 1 5PM |
| Submission | Sasivadhan | Rafsan | Jun 1 11:59PM |

---

## 9. Explicit non-goals (scope control)

- **Do not** implement SentimentTube — pitched but not selected.
- **Do not** rebuild Loanword Archaeology (world etymology map, migration animation, time slider).
- **Do not** require LLM at runtime for dialect statistics.
- **Do not** block UI on county-level coverage — state-level Harvard survey is enough for MVP.
- **Do not** expose API keys in frontend code.

---

## 10. AI use note (for submission)

Design mockups and presentation slides used Claude/Cursor during ideation. Implementation may use Cursor AI assistance. **Runtime viz must use real cited datasets**, not LLM-generated dialect statistics.

---

## 11. Agent quick-start checklist

When opening this repo fresh:

- [ ] Read this entire document
- [ ] Open `docs/mockups/mockup_dialectdrift.html` in browser — click through all interactions
- [ ] Create `scripts/` and `data/processed/` per §3
- [ ] **Implement §4 data wrangling before any React UI**
- [ ] Validate `words.json` against schema in §1.5
- [ ] Scaffold React app and port map + lookup from mockup
- [ ] Replace inline mock `WORDS` with imported JSON
- [ ] Add deployment URL to root README

**First command the agent should run after scaffold:**
```bash
python scripts/build_words_json.py --input data/raw --output data/processed/words.json
```

---

*DialectDrift · CSPC 5320 Final Project · May 2026 · Keep this file updated as data sources and scope change.*
