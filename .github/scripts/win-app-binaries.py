import shutil
import sys
from pathlib import Path

MARKER = b"__TAURI_BUNDLE_TYPE_VAR_"
BUNDLE_TYPES = {"nsis": b"NSS", "msi": b"MSI"}


def main(exe, out):
    exe, out = Path(exe), Path(out)
    data = exe.read_bytes()
    at = data.find(MARKER + b"UNK")
    if at < 0:
        print(f"{exe}: no bundle type marker")
        return 1
    tag_at = at + len(MARKER)
    for name, tag in BUNDLE_TYPES.items():
        (out / name).mkdir(parents=True, exist_ok=True)
        (out / name / exe.name).write_bytes(data[:tag_at] + tag + data[tag_at + 3:])
    shutil.copyfile(exe, out / "soundcloud-desktop-portable.exe")
    return 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
