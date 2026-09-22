"""Parsing free-text follow-up durations into a concrete number of days.

Doctors dictate follow-up timing naturally ("come back in three days",
"in a week"), not as clean structured data. This is a best-effort parser
for a handful of common patterns — it does NOT guess an approximate
duration when the text doesn't match a known pattern. Returning None is
the correct behavior for unparseable text; the caller must not schedule
a reminder off a guess.
"""

import re

_WORD_NUMBERS = {
    "a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4,
    "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
}


def parse_followup_days(text: str) -> int | None:
    """Return the number of days until follow-up, or None if the text
    doesn't match a recognized pattern."""
    if not text:
        return None
    normalized = text.strip().lower()

    match = re.search(r"(\d+)\s*day", normalized)
    if match:
        return int(match.group(1))

    match = re.search(r"(\d+)\s*week", normalized)
    if match:
        return int(match.group(1)) * 7

    match = re.search(r"(\d+)\s*month", normalized)
    if match:
        return int(match.group(1)) * 30

    match = re.search(r"(\w+)\s*day", normalized)
    if match and match.group(1) in _WORD_NUMBERS:
        return _WORD_NUMBERS[match.group(1)]

    match = re.search(r"(\w+)\s*week", normalized)
    if match and match.group(1) in _WORD_NUMBERS:
        return _WORD_NUMBERS[match.group(1)] * 7

    match = re.search(r"(\w+)\s*month", normalized)
    if match and match.group(1) in _WORD_NUMBERS:
        return _WORD_NUMBERS[match.group(1)] * 30

    return None