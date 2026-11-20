import os
import re

VOWELS = "аеёиоуыэюя"
FILES = ["overrides-homographs.txt", "overrides.txt", "overrides-lines.txt"]


def expand(token):
    m = re.search(r"\[([^\]]*)\]", token)
    if not m:
        return [token]
    return [token[: m.start()] + alt + token[m.end():] for alt in m.group(1).split("|")]


def read_overrides(path):
    out = {}
    with open(path, encoding="utf8") as f:
        for line in f:
            for token in line.split():
                for word in expand(token):
                    if "+" not in word:
                        continue
                    pos = word.index("+")
                    plain = word.replace("+", "").lower()
                    if plain[pos] not in VOWELS:
                        continue
                    out.setdefault(plain, [])
                    if pos not in out[plain]:
                        out[plain].append(pos)
    return out


def apply_overrides(stress, here):
    overridden = {}
    for name in FILES:
        overridden.update(read_overrides(os.path.join(here, name)))
    for word, positions in overridden.items():
        stress[word] = positions[:3]


def read_forced_yo(here):
    forced = {}
    with open(os.path.join(here, "yo-force.txt"), encoding="utf8") as f:
        for token in f.read().split():
            word = token.lower()
            if word.count("ё") == 1:
                forced[word.replace("ё", "е")] = word.index("ё")
    return forced


def pin_yo(stress):
    for word in list(stress):
        if "ё" in word:
            stress[word] = [word.index("ё")]
