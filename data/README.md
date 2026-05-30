# DialectDrift data

## Sources

| Dataset | Citation | Use |
|---------|----------|-----|
| **Harvard Dialect Survey** | Bert Vaux & Scott Golder (2003). *The Harvard Dialect Survey.* Harvard University Linguistics Department. Public summaries at [dialect.redlog.net](http://dialect.redlog.net/). | State-level % per answer → `words.json` choropleth scores |

## Pipeline

```bash
pip install -r requirements.txt
python scripts/scrape_harvard_survey.py --output data/raw/survey_by_state.csv
python scripts/build_words_json.py
```

Default **`--mode full`** exports every regional **vocabulary** answer from the survey (~280 words across 46 questions). Use `--mode curated` for the small 16-word mockup list only.

## Dictionary scope

| Mode | Words | Source |
|------|-------|--------|
| `full` (default) | ~280 | All “What do you call…?” / “What term…” questions (excludes pronunciation & syntax) |
| `curated` | 16 | `concept_questions.yaml` only |

Richer IPA/phrases for demo terms: `variant_metadata.yaml` (merged onto primary entries in full mode).

## Files

- `raw/survey_by_state.csv` — scraped long format (gitignored HTML; CSV can be committed)
- `processed/words.json` — frontend dictionary (`WORDS` schema)
- `processed/region_styles.json` — token highlight regions (curated)

## Notes

- Scores are **within-state** percentages from published survey tables, divided by 100.
- States with &lt;1% usage for a term are omitted from `states` to keep maps readable.
- Small states have few respondents (e.g. WY); treat low-N states cautiously in writeups.
