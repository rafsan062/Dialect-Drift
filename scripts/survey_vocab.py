"""Classify Harvard Dialect Survey questions and normalize answer labels."""

from __future__ import annotations

import re
from typing import Iterable

# Questions that elicit regional vocabulary (not pronunciation).
VOCAB_QUESTION_RE = re.compile(
    r"(what do you call|what is your .* term for|what term do you use|"
    r"what word\(s\) do you use|what nicknames|what do/did you call|"
    r"which of these terms do you prefer|what about your paternal|"
    r"what do you call the|what do you call a|what do you call an|"
    r"what do you call it when|what do you call food|what do you call someone)",
    re.IGNORECASE,
)

SKIP_ANSWER_RE = re.compile(
    r"i have no |^other$|^yes$|^no$|not sure|acceptable|unacceptable|"
    r"i have never|i know what|interchangeably|^\[|as in \"|do not look up|"
    r"please |state here|both interchangeably|i use both|i have both|"
    r"^i use the same|^i pronounce it the same|^rhymes with",
    re.IGNORECASE,
)

# Survey label -> canonical dictionary key (for lookup in sentences).
LABEL_TO_KEY: dict[str, str] = {
    "yous, youse": "youse",
    "milkshake/shake": "milkshake",
    "you 'uns": "you-uns",
    "gymshoes": "gym shoes",
    "the subway": "subway",
    "the l, or the el": "the L",
    "the t": "the T",
    "the metro": "metro",
    "i use lightning bug and firefly interchangeably": "lightning bug / firefly",
    "i use both interchangeably": "both",
}

KEY_ALIASES: dict[str, list[str]] = {
    "youse": ["yous, youse", "youse"],
    "gym shoes": ["gymshoes", "gym shoes"],
    "y'all": ["y'all"],
    "you-uns": ["you 'uns"],
    "milkshake": ["milkshake/shake"],
}


def is_vocab_question(text: str) -> bool:
    text = text.strip()
    if VOCAB_QUESTION_RE.search(text):
        return True
    # Grandfather Q71 uses different wording.
    return bool(re.match(r"^71\.\s*paternal grandfather", text, re.I))


def vocab_question_ids(question_texts: Iterable[tuple[int, str]]) -> set[int]:
    ids: set[int] = set()
    for qid, text in question_texts:
        if is_vocab_question(text) or qid == 71:
            ids.add(qid)
    return ids


def should_skip_answer(label: str) -> bool:
    label = label.strip().lower()
    if len(label) > 80:
        return True
    return bool(SKIP_ANSWER_RE.search(label))


def label_to_key(label: str) -> str:
    normalized = re.sub(r"\s+", " ", label.strip().lower())
    return LABEL_TO_KEY.get(normalized, normalized)


def resolve_survey_labels(key: str) -> list[str]:
    if key in KEY_ALIASES:
        return [a.strip().lower() for a in KEY_ALIASES[key]]
    return [key.strip().lower()]


def concept_from_question(text: str) -> str:
    """Short concept label from survey question wording."""
    text = re.sub(r"^\d+\.\s*", "", text.strip())
    text = re.sub(r"\*+", "", text)
    replacements = [
        (r"^What do you call (the |a |an )?", ""),
        (r"^What is your general term for ", ""),
        (r"^What is your \*general\* term for ", ""),
        (r"^What term do you use to refer to ", ""),
        (r"^What word\(s\) do you use to address ", ""),
        (r"^What nicknames do/did you use for your ", ""),
        (r"^What do/did you call your ", ""),
        (r"^Which of these terms do you prefer( for .+)?\??$", "preferred term"),
        (r"\?$", ""),
    ]
    for pattern, repl in replacements:
        text = re.sub(pattern, repl, text, flags=re.IGNORECASE)
    text = text.strip()
    return text[:120] if text else "regional term"
