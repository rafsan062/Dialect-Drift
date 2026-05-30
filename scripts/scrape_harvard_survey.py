#!/usr/bin/env python3
"""Scrape state-level Harvard Dialect Survey summaries from dialect.redlog.net."""

from __future__ import annotations

import argparse
import re
import time
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup

BASE_URL = "http://dialect.redlog.net/staticmaps/"
STATES_INDEX = BASE_URL + "states.html"
QUESTION_RE = re.compile(r"^(\d+)\.\s*(.+)$", re.DOTALL)
ANSWER_RE = re.compile(r"^[a-z]\.\s*(.+)$", re.IGNORECASE)
PCT_RE = re.compile(r"\(([\d.]+)%\)")
STATE_LINK_RE = re.compile(r"state_([A-Z]{2})\.html")


def fetch(url: str, session: requests.Session) -> str:
    response = session.get(url, timeout=60)
    response.raise_for_status()
    return response.text


def list_state_codes(html: str) -> list[str]:
    codes = sorted(set(STATE_LINK_RE.findall(html)))
    if not codes:
        raise RuntimeError("No state links found on states index page.")
    return codes


def normalize_label(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def parse_state_page(html: str, state: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []

    for table in soup.find_all("table"):
        header = table.find("b")
        if header is None:
            continue
        header_text = re.sub(r"\s+", " ", header.get_text(strip=True))
        match = QUESTION_RE.match(header_text)
        if not match:
            continue

        question_id = int(match.group(1))
        question_text = match.group(2).strip()

        for tr in table.find_all("tr")[1:]:
            cells = tr.find_all("td")
            if len(cells) < 2:
                continue
            answer_text = cells[1].get_text(strip=True)
            pct_text = cells[-1].get_text(strip=True)
            answer_match = ANSWER_RE.match(answer_text)
            pct_match = PCT_RE.search(pct_text)
            if not answer_match or not pct_match:
                continue

            rows.append(
                {
                    "state": state,
                    "question_id": question_id,
                    "question_text": question_text,
                    "answer_label": normalize_label(answer_match.group(1)),
                    "pct": float(pct_match.group(1)),
                }
            )

    return rows


def scrape_all(delay: float) -> pd.DataFrame:
    session = requests.Session()
    session.headers["User-Agent"] = "DialectDrift/1.0 (academic; CSPC5320)"

    index_html = fetch(STATES_INDEX, session)
    states = list_state_codes(index_html)
    print(f"Found {len(states)} state/territory pages.")

    all_rows: list[dict] = []
    for i, state in enumerate(states, start=1):
        url = f"{BASE_URL}state_{state}.html"
        html = fetch(url, session)
        parsed = parse_state_page(html, state)
        all_rows.extend(parsed)
        print(f"  [{i:02d}/{len(states)}] {state}: {len(parsed)} answer rows")
        if delay > 0 and i < len(states):
            time.sleep(delay)

    df = pd.DataFrame(all_rows)
    print(f"Total rows: {len(df)}")
    print(f"Unique questions: {df['question_id'].nunique()}")
    return df


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/raw/survey_by_state.csv"),
        help="CSV output path",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.25,
        help="Seconds between state page requests",
    )
    args = parser.parse_args()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    df = scrape_all(args.delay)
    df.to_csv(args.output, index=False)
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
