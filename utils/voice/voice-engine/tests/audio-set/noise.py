import random
import struct
import sys
import wave
from pathlib import Path

RATE = 16000
PINK_SECONDS = 30
PEAK = 0.5


def read(path):
    with wave.open(str(path)) as clip:
        raw = clip.readframes(clip.getnframes())
    return [sample / 32768 for (sample,) in struct.iter_unpack("<h", raw)]


def write(path, samples):
    scale = PEAK / max(abs(sample) for sample in samples)
    with wave.open(str(path), "w") as clip:
        clip.setnchannels(1)
        clip.setsampwidth(2)
        clip.setframerate(RATE)
        clip.writeframes(b"".join(struct.pack("<h", int(sample * scale * 32767)) for sample in samples))


def pink():
    rng = random.Random(7)
    rows = [0.0] * 16
    out = []
    for at in range(1, PINK_SECONDS * RATE + 1):
        lowest = (at & -at).bit_length() - 1
        rows[min(lowest, len(rows) - 1)] = rng.uniform(-1, 1)
        out.append(sum(rows) + rng.uniform(-1, 1))
    return out


def babble(folder):
    talks = [read(path) for path in sorted(folder.glob("talk*.wav"))]
    shortest = min(len(talk) for talk in talks)
    return [sum(talk[at] for talk in talks) for at in range(shortest)]


folder = Path(sys.argv[1])
write(folder / "pink.wav", pink())
write(folder / "babble.wav", babble(folder))
