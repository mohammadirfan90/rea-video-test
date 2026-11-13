"""Verify every media path the built page loads resolves in the deploy tree.

Only checks paths that are actually used as media locations:
  - entries of the inlined data island's shot/asset paths
  - literal `media(...)` calls in the script
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Works both in the pipeline repo (page lives in deploy/) and in the deployed
# repo itself (where this script sits at <repo>/tools/ and index.html at <repo>/).
STAGE = os.path.join(ROOT, "deploy") if os.path.isfile(os.path.join(ROOT, "deploy", "index.html")) else ROOT

html = open(os.path.join(STAGE, "index.html"), encoding="utf-8").read()

m = re.search(r'"mediaBase"\s*:\s*"([^"]*)"', html)
base = m.group(1) if m else None
print("mediaBase =", base)

# Pull the inlined JSON island out of the page.
island = re.search(
    r'<script id="data" type="application/json">(.*?)</script>', html, re.S
) or re.search(r'<script[^>]*type="application/json"[^>]*>(.*?)</script>', html, re.S)

paths = set()
if island:
    raw = island.group(1)
    raw = raw.replace("\\u003c", "<").replace("\\u003e", ">").replace("\\u0026", "&")
    data = json.loads(raw)
    blob = json.dumps(data)
    paths |= set(re.findall(r'(?:shots|packaging)/[\w\-.]+\.(?:jpg|jpeg|png|webp|gif)', blob))
    for key in ("storyboard", "audio_timeline"):
        v = (data.get("assets") or {}).get(key)
        if v:
            paths.add(v)
else:
    print("!! could not locate the inlined JSON island")

# literal media('...') calls
paths |= set(re.findall(r"media\('([^']+)'\)", html))

paths = sorted(p for p in paths if p and not p.startswith(("..", "/")))
print("media paths under test: %d" % len(paths))

missing, ok = [], 0
for p in paths:
    target = os.path.join(STAGE, base, p) if base else os.path.join(STAGE, p)
    if os.path.isfile(target):
        ok += 1
    else:
        missing.append((p, target))

print("resolved: %d" % ok)
print("missing : %d" % len(missing))
for p, t in missing:
    print("  MISSING %s -> %s" % (p, t))

# The page must not reference anything outside the deploy tree.
stray = sorted(set(re.findall(r'(?:src|href)="([^"]+)"', html)) -
                {s for s in re.findall(r'(?:src|href)="([^"]+)"', html) if s.startswith(("#", "data:"))})
stray = [s for s in stray if not s.startswith(("http", "//")) and not os.path.isfile(os.path.join(STAGE, s))]
print("stray local refs:", stray if stray else "none")

sys.exit(1 if missing else 0)
