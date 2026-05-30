#!/usr/bin/env python3
"""Build words.json from scraped Harvard Dialect Survey CSV."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from survey_vocab import (
    concept_from_question,
    label_to_key,
    resolve_survey_labels,
    should_skip_answer,
    vocab_question_ids,
)

MIN_STATE_SCORE = 0.01  # omit states below 1% usage
MAX_VARIANTS_PER_CONCEPT = 6


def load_yaml(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def extract_state_scores(
    df: pd.DataFrame, question_id: int, survey_labels: list[str]
) -> dict[str, float]:
    subset = df[
        (df["question_id"] == question_id)
        & (df["answer_label"].isin(survey_labels))
    ]
    if subset.empty:
        return {}

    scores: dict[str, float] = {}
    for state, group in subset.groupby("state"):
        pct = group["pct"].max()
        if pct >= MIN_STATE_SCORE * 100:
            scores[state] = round(pct / 100.0, 4)
    return dict(sorted(scores.items(), key=lambda x: x[1], reverse=True))


def peak_score(states: dict[str, float]) -> float:
    return max(states.values()) if states else 0.0


def auto_variants(siblings: list[tuple[str, dict[str, float]]]) -> list[dict]:
    ranked = sorted(siblings, key=lambda x: peak_score(x[1]), reverse=True)
    variants = []
    for word, states in ranked[:MAX_VARIANTS_PER_CONCEPT]:
        top = next(iter(states.items()), None)
        region = f"Strongest in {top[0]}" if top else "Regional"
        variants.append(
            {
                "word": word,
                "region": region,
                "phrase": f'I say "{word}".',
                "ipa": "",
                "note": "Harvard Dialect Survey response option.",
                "wave": "west",
            }
        )
    return variants


def apply_metadata(entry: dict, word: str, meta_entries: dict, is_primary: bool) -> dict:
    if word not in meta_entries:
        return entry
    meta = meta_entries[word]
    if meta.get("summary"):
        entry["summary"] = meta["summary"]
    if meta.get("variants"):
        entry["variants"] = meta["variants"]
    return entry


def iter_vocab_entries(df: pd.DataFrame, metadata_path: Path):
    """Yield (key, entry, peak, question_id) for each vocabulary answer."""
    metadata_cfg = load_yaml(metadata_path)
    meta_entries = metadata_cfg.get("entries", {})

    qtext = (
        df.drop_duplicates("question_id")[["question_id", "question_text"]]
        .set_index("question_id")["question_text"]
        .to_dict()
    )

    for qid in sorted(vocab_question_ids(qtext.items())):
        concept = concept_from_question(qtext[qid])
        q_df = df[df["question_id"] == qid]
        siblings: list[tuple[str, dict[str, float]]] = []

        for label in sorted(q_df["answer_label"].unique()):
            if should_skip_answer(label):
                continue
            key = label_to_key(label)
            states = extract_state_scores(df, qid, resolve_survey_labels(key))
            if states:
                siblings.append((key, states))

        if not siblings:
            continue

        siblings.sort(key=lambda x: peak_score(x[1]), reverse=True)
        primary_key = siblings[0][0]

        for key, states in siblings:
            is_primary = key == primary_key
            entry = {
                "concept": concept,
                "summary": (
                    f"Regional term for {concept} "
                    f"(Harvard Dialect Survey Q{qid})."
                ),
                "states": states,
                "variants": auto_variants(siblings) if is_primary else [],
                "source": {
                    "survey": "Harvard Dialect Survey (Vaux & Golder, 2003)",
                    "question_id": qid,
                    "answer_labels": resolve_survey_labels(key),
                },
            }
            entry = apply_metadata(entry, key, meta_entries, is_primary)
            yield key, entry, peak_score(states), qid


def merge_entries(words: dict, key: str, entry: dict, score: float, qid: int) -> None:
    if key not in words:
        words[key] = entry
        return

    existing = words[key]
    if score > peak_score(existing["states"]):
        existing["states"] = entry["states"]
        existing["concept"] = entry["concept"]
        existing["source"] = entry["source"]
        if entry.get("variants"):
            existing["variants"] = entry["variants"]
        existing["summary"] = entry["summary"]
    else:
        existing["summary"] += f" (also surveyed on Q{qid})."


def build_full(df: pd.DataFrame, metadata_path: Path) -> dict:
    words: dict = {}
    for key, entry, score, qid in iter_vocab_entries(df, metadata_path):
        merge_entries(words, key, entry, score, qid)
    return words


def build_from_yaml(
    df: pd.DataFrame, concepts_path: Path, metadata_path: Path
) -> dict:
    metadata_cfg = load_yaml(metadata_path)
    meta_entries = metadata_cfg.get("entries", {})
    concepts_cfg = load_yaml(concepts_path)
    words: dict = {}

    for concept in concepts_cfg.get("concepts", []):
        question_id = concept["question_id"]
        concept_name = concept["concept"]
        primary = concept.get("primary")
        aliases = concept.get("label_aliases") or {}

        for word in concept["words"]:
            labels = (
                [a.strip().lower() for a in aliases[word]]
                if word in aliases
                else [word.strip().lower()]
            )
            states = extract_state_scores(df, question_id, labels)
            entry_meta = meta_entries.get(word, {})
            entry = {
                "concept": concept_name,
                "summary": entry_meta.get(
                    "summary",
                    f'Regional term for "{concept_name}" (Q{question_id}).',
                ),
                "states": states,
                "variants": [],
                "source": {
                    "survey": "Harvard Dialect Survey (Vaux & Golder, 2003)",
                    "question_id": question_id,
                    "answer_labels": labels,
                },
            }
            if word == primary and entry_meta.get("variants"):
                entry["variants"] = entry_meta["variants"]
            words[word] = entry
    return words


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path("data/raw/survey_by_state.csv"))
    parser.add_argument("--output", type=Path, default=Path("data/processed/words.json"))
    parser.add_argument("--metadata", type=Path, default=Path("data/variant_metadata.yaml"))
    parser.add_argument(
        "--concepts",
        type=Path,
        default=Path("data/concept_questions.yaml"),
        help="Used only with --mode curated",
    )
    parser.add_argument(
        "--mode",
        choices=("full", "curated"),
        default="full",
        help="full = all vocabulary survey answers; curated = yaml list only",
    )
    args = parser.parse_args()

    if not args.input.exists():
        raise SystemExit(
            f"Missing {args.input}. Run: python scripts/scrape_harvard_survey.py"
        )

    df = pd.read_csv(args.input)
    df["answer_label"] = df["answer_label"].str.strip().str.lower()

    words = (
        build_from_yaml(df, args.concepts, args.metadata)
        if args.mode == "curated"
        else build_full(df, args.metadata)
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        json.dump(words, f, indent=2, ensure_ascii=False)
        f.write("\n")

    size_kb = args.output.stat().st_size / 1024
    concepts = len({v["concept"] for v in words.values()})
    print(f"Mode: {args.mode}")
    print(f"Wrote {len(words)} words ({concepts} concepts) to {args.output} ({size_kb:.0f} KB)")
    for key in ("hoagie", "pop", "bubbler", "crawfish", "firefly"):
        if key in words:
            print(f"  {key}: {list(words[key]['states'].items())[:3]}")


if __name__ == "__main__":
    main()
