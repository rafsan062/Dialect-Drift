# DialectDrift

Interactive US dialect map for CSPC 5320 — paste a sentence, see regional vocabulary on a choropleth, and compare pronunciations across regions.

## Data (ready)

Real state-level scores from the [Harvard Dialect Survey](http://dialect.redlog.net/) (Vaux & Golder, 2003):

```bash
pip install -r requirements.txt
python scripts/scrape_harvard_survey.py
python scripts/build_words_json.py
```

Outputs: `data/processed/words.json` (~280 regional terms, full survey vocabulary), `data/processed/region_styles.json`. See [data/README.md](data/README.md).

## Run locally (development)

```bash
npm install
npm run dev
```

Open http://localhost:5173 — modular `css/` + `js/` (Vite), dark neon theme, real `words.json` data.

After updating data: copy `data/processed/*.json` → `public/data/`, then refresh.

### VS Code Live Server (source files)

**One-time setup** (creates the local D3 bundle Live Server needs):

```bash
npm install
```

Then **stop Live Server → restart on `index.html` → hard-refresh** (Cmd+Shift+R).

Live Server serves raw files — it is not Vite. The app now loads D3 from **`js/vendor/deps.js`** (local, no CDN) and map shapes from **`public/data/states-10m.json`**.

If anything fails, a pink banner at the top of the page shows the error (e.g. missing `deps.js` → run `npm install`).

**Easier preview (same as CSS1 deploy):** `npm run live` → http://localhost:5500

## Deploy to CSS1 (Seattle U SFTP)

**Vite does not run on the server.** CSS1 only serves static files (HTML, CSS, JS, JSON). You build on your laptop, then upload the output.

```bash
npm install          # once, on your machine
npm run build        # writes a self-contained site to dist/
npm run preview      # optional: test the build locally before uploading
```

Upload **everything inside `dist/`** to your CSS1 web folder (e.g. `public_html/dialect-drift/`):

- `index.html`
- `assets/` (bundled JS + CSS)
- `data/` (dictionary JSON)

Do **not** upload `node_modules/`, source `js/`, or run `npm` on CSS1.

The production build bundles D3 and your app into one JS file — no Node, no Vite, no import maps on the server. The US map still loads TopoJSON from a public CDN in the visitor’s browser (normal for static sites).

## Status

- [x] Data wrangling pipeline
- [x] Modular frontend (Vite + D3, mockup flows)
- [x] Audio panel (placeholder waveforms + Web Speech)

Design spec: [AGENT_DESIGN_IMPLEMENTATION.md](AGENT_DESIGN_IMPLEMENTATION.md)
