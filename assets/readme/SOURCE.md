# README asset sources

## Generated illustrations

`source/render.py` generates every SVG in this folder. Edit the script, then
run it again:

```bash
python3 assets/readme/source/render.py
```

It needs fontTools 4.62.1 with Brotli, the same tool that builds the Hope fonts.

- `hope-<scene>-<en|ko>-<light|dark>.svg` are the hero, the skill flow, and
  stylized illustrations of an Align record, the summary of a Diff review, and
  a Diff "Try it" microworld. The record illustrations follow the version 6
  Technical Record shell: a rail with a filled current index, numbered
  sections, and gutter labels. They show representative sample content, not a
  capture of a real run.
- `mark-<skill>.svg` are the skill marks beside each README heading. One teal
  stroke reads on both GitHub themes, so the marks have no theme variants.

The hero's wordmark comes from `assets/brand/source/render.py`, which shares
this script's text engine; see [`assets/brand/SOURCE.md`](../brand/SOURCE.md).

The script converts all text to paths from Hope Sans and Hope Code, so GitHub
renders the artifact type without a web font. It reads its colors when it
runs: the light and dark palettes from `plugins/hope/assets/artifact-theme.mjs`,
and Diff's status roles and added and removed line marks from
`plugins/hope/skills/diff/scripts/design/tokens.mjs`. Run it again after a theme
change. The hero's wordmark and "Decide more." line keep the brand blue from
`assets/brand/source/render.py`. Each README pairs the light and dark files
with `<picture>` and `prefers-color-scheme`.

## Other files

- `whiplash-not-my-tempo.jpg` is a still from
  [Hulu’s official “Not My Tempo” clip](https://www.youtube.com/watch?v=gfceCnMJZ3c),
  credited in each README.
- `hope-align-ko.png` and `hope-align-decisions-ko.png` are 8.x Align captures
  that the READMEs no longer show. `e2e/align-artifact.spec.mjs` still uses them
  as sample design-direction images.
