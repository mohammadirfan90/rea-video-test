# A Night in Red — trailer breakdown

Interactive report for the **Smritikotha — A Night in Red** wedding trailer,
built from a [`rea-video`](https://puku.sh) breakdown.

**Live site:** https://mohammadirfan90.github.io/rea-video-test/

## What's here

```
index.html     the report — a single self-contained page (CSS/JS/data inlined)
assets/        source for the page: template, CSS, JS, generated data
media/         every image the page loads (shots, packaging, storyboard, waveform)
tools/         build + verify scripts
```

`index.html` is generated. The editable sources are in `assets/`.

| Path | What |
|---|---|
| `assets/index.template.html` | Page shell with `__CSS__` / `__JS__` / `__DATA__` tokens |
| `assets/guide.css` | Theme tokens, layout, components |
| `assets/guide.js` | Rendering, filters, search, lightbox |
| `assets/data.json` | Generated payload — do not edit by hand |
| `tools/build-guide.mjs` | Inlines `assets/*` into `index.html` |
| `tools/verify.mjs` | Headless-Chrome assertions + screenshots |

## Media

`assets/data.json` sets `mediaBase` to `media/`, and every referenced image is
committed under `media/`.

The **source video is not in this repo** — `Smritikotha_ANightInRed_Trailer.mp4`
and the three audio stems are gitignored. The report is image-based: shot
stills, first/last frames, contact strips, the storyboard and the audio
waveform timeline. The trailer's filename and runtime still appear in the
footer as metadata.

If a shot image is missing from `media/`, the page shows a broken thumbnail.

## Rebuild

```bash
node tools/build-guide.mjs     # assets/* -> index.html
node tools/verify.mjs          # headless-Chrome checks + screenshots
```

Requires `npm install` (one dev dependency: `puppeteer-core`) and a local
Chrome install for the verifier.

`assets/data.json` is produced by `tools/extract-data.py` from the upstream
`rea-video` breakdown JSON. That extractor is not part of this repo — it
lives with the pipeline that generated the breakdown.

## Notes

- No quiz. This is a technical analysis report, not a learning guide.
- The shot list was reviewed by eye; the tool's own misclassifications (22
  shots labelled 3D/AI) were overridden before extraction.
- The three "stickers" the tool detected are false positives. They are flagged
  as such in the UI rather than hidden.
- The audio source cannot be settled from the audio alone — that ambiguity is
  stated in the Sound section.
