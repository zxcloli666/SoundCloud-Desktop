import bz2
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET

src, out = sys.argv[1], sys.argv[2]
ACUTE = "\u0301"
VOWELS = "аеёиоуыэюя"
stem_re = re.compile(r"\|\s*основа\d*\s*=\s*([^|}\n]+)")


def split(form):
    form = unicodedata.normalize("NFC", form).replace("\u0300", "").strip()
    plain, marks = [], []
    for ch in form:
        if ch == ACUTE:
            if not plain:
                return None
            marks.append(len(plain) - 1)
        else:
            plain.append(ch)
    return "".join(plain).lower(), marks


count = 0
with bz2.open(src, "rb") as f, open(out, "w", encoding="utf8") as o:
    title = None
    ns = None
    for event, el in ET.iterparse(f, events=("end",)):
        tag = el.tag.rsplit("}", 1)[-1]
        if tag == "title":
            title = el.text
        elif tag == "ns":
            ns = el.text
        elif tag == "text" and ns == "0" and title and el.text and "{{-ru-}}" in el.text:
            low = title.lower()
            if all(c in "абвгдеёжзийклмнопрстуфхцчшщъыьэюя-" for c in low):
                seen = set()
                for m in stem_re.finditer(el.text):
                    parsed = split(m.group(1))
                    if parsed is None:
                        continue
                    stem, marks = parsed
                    if len(marks) != 1 or not low.startswith(stem) or stem[marks[0]] not in VOWELS:
                        continue
                    if (low, marks[0]) not in seen:
                        seen.add((low, marks[0]))
                        o.write(f"{low}\t{marks[0]}\n")
                        count += 1
        elif tag == "page":
            el.clear()
print(count, "pairs")
