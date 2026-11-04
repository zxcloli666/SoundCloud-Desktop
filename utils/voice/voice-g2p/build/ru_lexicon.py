import json
import os
import re
import sys
import unicodedata

from overrides import apply_overrides, pin_yo, read_forced_yo
from suffix_model import train

src, out_dir = sys.argv[1], sys.argv[2]
extra_pairs = sys.argv[3] if len(sys.argv) > 3 else None
here = os.path.dirname(os.path.abspath(__file__))

VOWELS = "аеёиоуыэюя"
ACUTE = "́"
ALPHABET = set("абвгдежзийклмнопрстуфхцчшщъыьэюяё-")


def split(form):
    form = unicodedata.normalize("NFC", form).replace("\u0300", "")
    if " " in form or not form:
        return None
    plain = []
    marks = []
    for ch in form:
        if ch == ACUTE:
            if not plain:
                return None
            marks.append(len(plain) - 1)
        else:
            plain.append(ch)
    plain = "".join(plain).lower()
    if not set(plain) <= ALPHABET:
        return None
    return plain, marks


def vowel_count(word):
    return sum(1 for c in word if c in VOWELS)


pairs_path = f"{out_dir}/pairs.tmp"
keys_path = f"{out_dir}/keys.tmp"
yo_words = set()
entries = 0

with open(src, encoding="utf8") as f, open(pairs_path, "w", encoding="utf8") as pairs, open(keys_path, "w", encoding="utf8") as keys:
    for line in f:
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        entries += 1
        forms = [entry["word"]] + [x.get("form", "") for x in entry.get("forms", []) if "romanization" not in x.get("tags", [])]
        for form in forms:
            parsed = split(form)
            if parsed is None:
                continue
            plain, marks = parsed
            keys.write(plain + "\n")
            if "ё" in plain:
                yo_words.add(plain)
            if vowel_count(plain) < 2:
                continue
            if "ё" in plain and not marks:
                marks = [plain.index("ё")]
            if len(marks) != 1:
                continue
            pos = marks[0]
            if plain[pos] not in VOWELS:
                continue
            pairs.write(f"{plain}\t{pos}\n")

import subprocess

if extra_pairs:
    with open(extra_pairs, encoding="utf8") as f, open(pairs_path, "a", encoding="utf8") as pairs:
        for line in f:
            pairs.write(line)

subprocess.run(
    ["bash", "-c", f"set -o pipefail; LC_ALL=C sort -S 16M -T {out_dir} {pairs_path} | uniq -c > {pairs_path}.counted"],
    check=True,
)

stress = {}


def flush(word, c):
    ranked = sorted(c, key=lambda p: (-c[p], p))
    stress[word] = ranked[:3]


current, c = None, {}
with open(f"{pairs_path}.counted", encoding="utf8") as f:
    for line in f:
        count, rest = line.strip().split(" ", 1)
        word, pos = rest.split("\t")
        if word != current:
            if current is not None:
                flush(current, c)
            current, c = word, {}
        c[int(pos)] = int(count)
if current is not None:
    flush(current, c)

if not os.environ.get("NO_OVERRIDES"):
    apply_overrides(stress, here)

candidates = {w.replace("ё", "е"): w for w in yo_words if w.count("ё") == 1}
with open(keys_path, encoding="utf8") as f:
    for line in f:
        candidates.pop(line.rstrip("\n"), None)
yo = {folded: word.index("ё") for folded, word in candidates.items()}
forced = {} if os.environ.get("NO_OVERRIDES") else read_forced_yo(here)
yo.update(forced)
for folded in forced:
    stress.pop(folded, None)
os.remove(keys_path)
os.remove(pairs_path)
os.remove(pairs_path + ".counted")

pin_yo(stress)
rules, right, total = train(stress)

with open(f"{out_dir}/ru-stress.tsv", "w", encoding="utf8") as f:
    for word in sorted(stress):
        f.write(word + "\t" + ",".join(map(str, stress[word])) + "\n")
with open(f"{out_dir}/ru-yo.tsv", "w", encoding="utf8") as f:
    for word in sorted(yo):
        f.write(word + "\t" + str(yo[word]) + "\n")
with open(f"{out_dir}/ru-suffix.tsv", "w", encoding="utf8") as f:
    for suffix in sorted(rules):
        f.write(suffix + "\t" + str(rules[suffix]) + "\n")

multi = sum(1 for p in stress.values() if len(p) > 1)
print(f"entries {entries} stress {len(stress)} variants>1 {multi} yo {len(yo)} suffix-rules {len(rules)}")
print(f"suffix predictor holdout {right}/{total} = {right / total:.3f}")
