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
    r"^i use the same|^i pronounce it the same|^rhymes with|"
    r"i can only use|never heard of this|no special term for them|"
    r"these words refer to different|not the same, and i know the difference|"
    r"i spell it .* but pronounce|we have these in my area|"
    r"a freeway is (bigger|free)",
    re.IGNORECASE,
)

# Real dialect phrases top out around 28 chars; longer keys are usually survey commentary.
MAX_ANSWER_CHARS = 30
MAX_ANSWER_WORDS = 6

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
    if len(label) > MAX_ANSWER_CHARS:
        return True
    if len(label.split()) > MAX_ANSWER_WORDS:
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
        (r"^What is your generic term for (a |an )?", ""),
        (r"^What term do you use to refer to ", ""),
        (r"^What word\(s\) do you use to address ", ""),
        (r"^What nicknames do/did you use for your ", ""),
        (r"^What do/did you call your ", ""),
        (r"^What about your paternal grandmother \(is there a distinction\?\)", "paternal grandmother"),
        (r"^What about your ", ""),
        (r"^Which of these terms do you prefer( for .+)?\??$", "preferred term"),
        (r"\s*\([^)]*\)\s*$", ""),
        (r"\?$", ""),
    ]
    for pattern, repl in replacements:
        text = re.sub(pattern, repl, text, flags=re.IGNORECASE)
    text = text.strip()
    if not text:
        return "regional term"
    if len(text) <= 180:
        return text
    cutoff = text.rfind(" ", 0, 177)
    if cutoff < 90:
        cutoff = 177
    return text[:cutoff].rstrip(" ,;") + "…"
