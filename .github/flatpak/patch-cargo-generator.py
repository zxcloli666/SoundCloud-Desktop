import sys

path = sys.argv[1]
source = open(path).read()
anchor = '        cargo_vendored_entry[repo_url]["branch"] = branch[0]\n'
if source.count(anchor) != 1:
    sys.exit(f"{path}: the git source block changed upstream, update this patch")
rekey = (
    "    key = repo_url\n"
    '    for kind in ("rev", "tag", "branch"):\n'
    "        if kind in cargo_vendored_entry[repo_url]:\n"
    '            key = f"{repo_url}?{kind}={cargo_vendored_entry[repo_url][kind]}"\n'
    "    cargo_vendored_entry = {key: cargo_vendored_entry[repo_url]}\n"
)
open(path, "w").write(source.replace(anchor, anchor + rekey))
print("cargo generator: one vendored source per git ref")
