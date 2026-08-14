# Hope font sources

Hope embeds fixed WOFF2 files so every offline artifact has the same type.

Unsupported characters still fall back to the local sans-serif or monospace
font.

## Hope Sans

`HopeSansLight.woff2`, `HopeSansMedium.woff2`, and `HopeSansBold.woff2` are
full-glyph WOFF2 conversions of Gmarket Sans TTF Light, Medium, and Bold.

Source:

- https://corp.gmarket.com/fonts/
- archive: `GmarketSansTTF.zip`
- source SHA-256:
  - Light: `7e8e8c70349ed94acf3ea4c6962a56417fdfa0a8803bc6cf9dc36324d5656849`
  - Medium: `c6b9a2c10bfdb55975948ce191f9cf638955b5cfdc99149969add5b579262fc1`
  - Bold: `ff7c354dd1a324e4cecc1223c4f71e74fa81be7027e0c7f6324c475909cacefc`
- output SHA-256:
  - Light: `8f46f4eb180510bd51df24201712da9919b88b706c7dfeebe3d311ed3c965766`
  - Medium: `5362eae258ca7c2ed5388cdc36462838bf6ea4cc0e1b84385e431edd607f35ed`
  - Bold: `a83f8f0286045306fedc149c0a8112d113a2f8cfc557dcb1ebee4a902d99df8a`

## Hope Code

`HopeCode.woff2` is a full WOFF2 conversion of D2Coding Regular 1.3.2.

Source:

- https://github.com/naver/d2codingfont
- release: `VER1.3.2`
- archive: `D2Coding-Ver1.3.2-20180524.zip`
- archive SHA-256:
  `0f1c9192eac7d56329dddc620f9f1666b707e9c8ed38fe1f988d0ae3e30b24e6`
- source file: `D2Coding/D2Coding-Ver1.3.2-20180524.ttf`
- source SHA-256:
  `8b1b23e5de4dff652fb0b938528150d2f531edfda281d3944618b655711aba84`
- output SHA-256:
  `04a13754c4b99ba06a5d98648075751ef273f532881b2c67af46b22230913307`

## Build

Build tool: fontTools `4.62.1`.

Hope Sans:

```text
pyftsubset <source.ttf>
  --output-file=<output.woff2>
  --flavor=woff2
  --glyphs=*
  --layout-features=*
  --name-IDs=*
  --name-legacy
  --notdef-glyph
  --recommended-glyphs
```

Hope Code:

```text
fonttools ttLib.woff2 compress D2Coding-Ver1.3.2-20180524.ttf
  -o HopeCode.woff2
```

After all four WOFF2 files exist, replace their primary family, full, unique,
PostScript, and typographic names:

```text
python3 tools/rename-hope-fonts.py
```

The script requires fontTools `4.62.1`.

It leaves the original copyright, authorship, trademark, source, and license
records intact.

The WOFF2 files are modified versions.

Their internal primary names and the CSS family names are `Hope Sans` and
`Hope Code`, not the reserved Gmarket Sans or D2Coding names.

This follows the OFL's
[webfont and reserved-name guidance](https://openfontlicense.org/ofl-faq/),
especially sections 2.2 and 3.1.

See `OFL-Gmarket.txt` and `OFL-D2Coding.txt`.
