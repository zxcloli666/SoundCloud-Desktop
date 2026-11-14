import json
import sys

src, out = sys.argv[1], sys.argv[2]
rows = {}


def pick(value):
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        if value.get("DEFAULT"):
            return value["DEFAULT"]
        for v in value.values():
            if v:
                return v
    return None


use_silver = (sys.argv[3] if len(sys.argv) > 3 else "gold+silver") == "gold+silver"
if use_silver:
    for word, value in json.load(open(f"{src}/us_silver.json", encoding="utf8")).items():
        ph = pick(value)
        if ph:
            rows[word] = ph
for word, value in json.load(open(f"{src}/us_gold.json", encoding="utf8")).items():
    ph = pick(value)
    if ph:
        rows[word] = ph

with open(out, "w", encoding="utf8") as f:
    for word in sorted(rows):
        if "\t" in word or "\n" in word:
            continue
        f.write(f"{word}\t{rows[word]}\n")
print(len(rows), "entries")
