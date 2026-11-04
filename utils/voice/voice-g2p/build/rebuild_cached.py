import os
import shutil
import sys

from overrides import apply_overrides, pin_yo, read_forced_yo
from suffix_model import train

cached, out_dir = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))

stress = {}
with open(os.path.join(cached, "ru-stress.tsv"), encoding="utf8") as f:
    for line in f:
        word, positions = line.rstrip("\n").split("\t")
        stress[word] = [int(p) for p in positions.split(",")]

apply_overrides(stress, here)
for folded in read_forced_yo(here):
    stress.pop(folded, None)
pin_yo(stress)
rules, right, total = train(stress)

os.makedirs(out_dir, exist_ok=True)
with open(os.path.join(out_dir, "ru-stress.tsv"), "w", encoding="utf8") as f:
    for word in sorted(stress):
        f.write(word + "\t" + ",".join(map(str, stress[word])) + "\n")
with open(os.path.join(out_dir, "ru-suffix.tsv"), "w", encoding="utf8") as f:
    for suffix in sorted(rules):
        f.write(suffix + "\t" + str(rules[suffix]) + "\n")
for name in ["ru-yo.tsv", "en-us.tsv"]:
    if os.path.exists(os.path.join(cached, name)):
        shutil.copy(os.path.join(cached, name), os.path.join(out_dir, name))

multi = sum(1 for p in stress.values() if len(p) > 1)
print(f"stress {len(stress)} variants>1 {multi} suffix-rules {len(rules)}")
print(f"suffix predictor holdout {right}/{total} = {right / total:.3f}")
