# voice-g2p lexicon build

Full rebuild from the Wiktionary dump:

    python3 ruwikt_stress.py <ruwiktionary dump.xml.bz2> <extra pairs.tsv>
    python3 ru_lexicon.py <kaikki ru dump.jsonl> <out dir> [<extra pairs.tsv>]
    cargo run --release -p voice-g2p --example pack -- <out dir> ../data

Rebuild from cached TSVs, no dump needed (ru-stress.tsv, ru-yo.tsv, ru-suffix.tsv, en-us.tsv):

    sh rebuild.sh <cache dir>

It applies the override files to the cached ru-stress.tsv, retrains the suffix model, and packs the result into ../data.
The cached TSVs from the last full build reproduce the committed FSTs byte for byte when the override files are unchanged.

Override files, applied in this order, the later wins per word:

- overrides-homographs.txt: default order for words with several stress positions
- overrides.txt: names and loanwords
- overrides-lines.txt: words from the voice-lab script lines

Format: one `+` before the stressed vowel. A word repeated with different `+` positions keeps them in order, the first is the default.
`[a|b]` expands the ending: `мин+ут[|а|ы]`.
