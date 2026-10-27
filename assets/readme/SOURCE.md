# README asset sources

## Generated illustrations

`source/render.py` generates every SVG in this folder. Edit the script, then
run it again:

```bash
python3 assets/readme/source/render.py
```

It needs fontTools 4.62.1 with Brotli, the same tool that builds the Hope fonts.

- `hope-<scene>-<en|ko>-<light|dark>.svg` are the hero, the skill flow, and
  stylized illustrations of an Align record, a Diff review with its code reader,
  and a Diff microworld. They show representative sample content, not a capture
  of a real run.
- `mark-<skill>.svg` are the skill marks beside each README heading. One teal
  stroke reads on both GitHub themes, so the marks have no theme variants.

The script converts all text to paths from Hope Sans and Hope Code, so GitHub
renders the artifact type without a web font. Colors come from
`plugins/hope/assets/artifact-theme.mjs`, with Diff's status roles for the
review markers. Each README pairs the light and dark files with `<picture>` and
`prefers-color-scheme`.

## Other files

- `whiplash-not-my-tempo.jpg` is a still from
  [Hulu’s official “Not My Tempo” clip](https://www.youtube.com/watch?v=gfceCnMJZ3c),
  credited in each README.
- `hope-align-ko.png` and `hope-align-decisions-ko.png` are 8.x Align captures
  that the READMEs no longer show. `e2e/align-artifact.spec.mjs` still uses them
  as sample design-direction images.
