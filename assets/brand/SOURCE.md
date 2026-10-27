# Brand asset sources

## The mark

Two overlapping circles: pink for the person, blue for the AI. Where they
overlap, the colors mix like two inks on paper in light themes and like two
beams of light in dark themes. One point is cut out of the overlap: the
decision that stays with the person. The wordmark puts the mark in place of
the o in Hope.

## Regenerate

`source/render.py` generates every file in this folder and the plugin icons.
Edit the script, then run it again:

```bash
python3 assets/brand/source/render.py
```

It needs fontTools 4.62.1 with Brotli, the same tool that builds the Hope
fonts, and Playwright Chromium (`npx playwright install chromium`). Loading the
fonts takes about half a minute.

The script writes the SVGs, then runs `source/rasterize.mjs` for the PNGs. It
draws text with the README generator's text engine in
`assets/readme/source/render.py`, which converts Hope Sans Bold to paths. The
README hero draws its wordmark with this script's `wordmark()` function.

## Files

- `hope-mark-light.svg`, `hope-mark-dark.svg`: the mark alone. The point is a
  hole, so the background shows through.
- `hope-wordmark-light.svg`, `hope-wordmark-dark.svg`: Hope with the mark as
  its o.
- `hope-icon.svg`, `hope-icon-dark.svg`: the square app icon.
- `hope-icon-small.svg`: the app icon with a larger mark, for 32 px and below.
- `hope-icon-128.png`, `-256.png`, `-512.png`, `-1024.png`: app icon exports.
- `hope-favicon-32.png`: the small icon at 32 px.
- `hope-social-preview.svg`, `hope-social-preview.png`: the 1280 × 640 GitHub
  repository card. Upload the PNG in the repository's Settings, under Social
  preview; GitHub does not read it from the repository.

The script also writes these plugin icons at the paths and sizes their
manifests expect:

- `plugins/hope/assets/hope-icon.png` (128 px): the Codex composer icon and the
  artifact favicon.
- `plugins/hope/assets/hope-protected-light.png` (512 px): the Codex plugin
  logo.
- `plugins/hope/skills/diff/assets/hope-protected-light.png` and
  `plugins/hope/skills/write/assets/hope-protected-light.png` (256 px): the
  skill icons.

## Colors

Pink `#ff4f8b` and blue `#3157ff` are the brand's own inks; the artifact theme
has no matching token. The overlap color is computed from them. Text and
neutral colors come from `plugins/hope/assets/artifact-theme.mjs` through the
README generator.
