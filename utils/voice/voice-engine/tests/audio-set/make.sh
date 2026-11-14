#!/bin/sh
set -eu

here=$(cd "$(dirname "$0")" && pwd)
out=$1
music=${2:-}
tab=$(printf '\t')

mkdir -p "$out/speech" "$out/noise"
: > "$out/list.tsv"

wav() {
    afconvert -f WAVE -d LEI16@16000 -c 1 "$1" "$2"
}

spoken() {
    say -v "${1%:*}" -r "${1#*:}" -o "$out/take.aiff" "$3"
    wav "$out/take.aiff" "$out/$2"
}

voices() {
    case $1 in
        ru) echo "Milena:160 Milena:200" ;;
        en) echo "Samantha:170 Daniel:190" ;;
    esac
}

row=0
while IFS=$tab read -r language text; do
    row=$((row + 1))
    for voice in $(voices "$language"); do
        file=speech/$row-${voice%:*}-${voice#*:}.wav
        spoken "$voice" "$file" "$text"
        printf '%s\t%s\t%s\n' "$file" "$language" "$text" >> "$out/list.tsv"
    done
done < "$here/phrases.tsv"

russian="Вчера мы долго выбирали, куда поехать на выходные, и в итоге остались дома. \
Сначала хотели на дачу, потом вспомнили, что там не топлено и дорогу замело. \
Соседка обещала занести пирог, но так и не пришла, зато позвонила и час рассказывала про ремонт. \
Вечером смотрели старый фильм, я заснул на середине, а утром никто не помнил, чем он кончился."
english="We spent most of the morning looking for the keys and found them in the fridge. \
After that nobody wanted to drive, so we walked to the market and bought far too many apples. \
My brother says the new place on the corner has good coffee, but the queue goes around the block. \
Tomorrow we have to fix the fence before the rain comes back, or the dog will be out again."

talk=0
for voice in Milena:150 Karen:170 Moira:200 Tessa:180; do
    talk=$((talk + 1))
    case $voice in
        Milena*) spoken "$voice" "noise/talk$talk.wav" "$russian" ;;
        *) spoken "$voice" "noise/talk$talk.wav" "$english" ;;
    esac
done
python3 -I "$here/noise.py" "$out/noise"
rm -f "$out/take.aiff" "$out"/noise/talk*.wav

if [ -n "$music" ]; then
    wav "$music" "$out/noise/music.wav"
fi
