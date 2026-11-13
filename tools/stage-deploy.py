"""
Stage the artifact into a self-contained GitHub Pages tree.

Deploy layout:
  index.html          built artifact (CSS/JS/data inlined)
  assets/             source css/js/template/data + build & verify tools
  media/              every media file the artifact actually references
  tools/              python pipeline helpers

Media base is repointed from '../out/trailer/' to 'media/' so the page
resolves relative to the deployed site root.
"""
import json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_ARTIFACT = os.path.join(ROOT, "artifact")
SRC_MEDIA = os.path.join(ROOT, "out", "trailer")
STAGE = os.path.join(ROOT, "deploy")

OLD_BASE = "../out/trailer/"
NEW_BASE = "media/"

# Media extensions the page loads over the network.
PAGE_MEDIA = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg")
# Never shipped: source video and audio stems.
EXCLUDED = (".mp4", ".mov", ".mkv", ".webm", ".wav", ".mp3", ".m4a", ".aac", ".flac")


def sh(*parts):
    return os.path.join(*parts)


def main():
    if os.path.isdir(STAGE):
        shutil.rmtree(STAGE)
    os.makedirs(STAGE)

    # --- assets/ : css, js, template, data, plus build/verify tools --------
    for sub in ("assets", "tools"):
        src = sh(SRC_ARTIFACT, sub)
        if not os.path.isdir(src):
            continue
        dst = sh(STAGE, sub)
        os.makedirs(dst, exist_ok=True)
        for name in os.listdir(src):
            s = sh(src, name)
            if os.path.isfile(s):
                shutil.copy2(s, sh(dst, name))

    # data.json is the source of truth for which media the page needs.
    data = json.load(open(sh(SRC_ARTIFACT, "assets", "data.json"), encoding="utf-8"))
    blob = json.dumps(data)

    referenced = set(re.findall(r'[\w./\-]*\.(?:jpg|jpeg|png|webp|gif|svg|mp4|wav|mov|webm)', blob))

    # --- media/ : copy only what the page references ----------------------
    media_dst = sh(STAGE, "media")
    os.makedirs(media_dst, exist_ok=True)

    copied, skipped = 0, []
    for rel in sorted(referenced):
        ext = os.path.splitext(rel)[1].lower()
        if ext in EXCLUDED:
            skipped.append(rel)
            continue

        # Resolve the source file. Stems live in out/trailer/stems/.
        candidates = [
            sh(SRC_MEDIA, rel),
            sh(SRC_MEDIA, "stems", os.path.basename(rel)),
            sh(SRC_MEDIA, os.path.basename(rel)),
        ]
        src = next((c for c in candidates if os.path.isfile(c)), None)
        if src is None:
            print("  !! missing source for %s" % rel)
            continue

        dst = sh(media_dst, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        copied += 1

    # --- index.html : repoint media base ----------------------------------
    html = open(sh(SRC_ARTIFACT, "index.html"), encoding="utf-8").read()
    n = html.count(OLD_BASE)
    html = html.replace(OLD_BASE, NEW_BASE)
    # The inlined data island also carries mediaBase.
    html = html.replace('"mediaBase":"%s"' % OLD_BASE, '"mediaBase":"%s"' % NEW_BASE)
    html = html.replace('\\u003c', '<')  # no-op safeguard; keeps original encoding
    open(sh(STAGE, "index.html"), "w", encoding="utf-8").write(html)
    print("  repointed %d mediaBase reference(s) -> %s" % (n, NEW_BASE))

    # --- summary ----------------------------------------------------------
    def tree_size(path):
        total = 0
        for dirpath, _, files in os.walk(path):
            for f in files:
                total += os.path.getsize(sh(dirpath, f))
        return total

    print("\nstaged tree: %s" % STAGE)
    print("  media files copied : %d" % copied)
    print("  excluded (video/audio): %s" % ", ".join(sorted(skipped)))
    print("  media size         : %.1f MB" % (tree_size(media_dst) / 1024 / 1024))
    print("  total size         : %.1f MB" % (tree_size(STAGE) / 1024 / 1024))


if __name__ == "__main__":
    main()
