#!/usr/bin/env python3

from pathlib import Path
from stat import S_IMODE
from tempfile import NamedTemporaryFile

from fontTools.ttLib import TTFont


FONT_NAMES = {
    "HopeCode.woff2": {
        1: "Hope Code",
        3: "Hope Code Regular 1.3.2",
        4: "Hope Code Regular",
        6: "HopeCode-Regular",
        16: "Hope Code",
        20: "HopeCode-KSCpc-EUC-H",
    },
    "HopeSansLight.woff2": {
        1: "Hope Sans Light",
        3: "Hope Sans Light 1.000",
        4: "Hope Sans Light",
        6: "HopeSans-Light",
        16: "Hope Sans",
    },
    "HopeSansMedium.woff2": {
        1: "Hope Sans Medium",
        3: "Hope Sans Medium 1.000",
        4: "Hope Sans Medium",
        6: "HopeSans-Medium",
        16: "Hope Sans",
    },
    "HopeSansBold.woff2": {
        1: "Hope Sans Bold",
        3: "Hope Sans Bold 1.000",
        4: "Hope Sans Bold",
        6: "HopeSans-Bold",
        16: "Hope Sans",
    },
}


def rename_font(path: Path, replacements: dict[int, str]) -> None:
    original_mode = S_IMODE(path.stat().st_mode)
    font = TTFont(path, recalcTimestamp=False)
    changed = False
    seen = set()
    for record in font["name"].names:
        replacement = replacements.get(record.nameID)
        if replacement is None:
            continue
        encoded = replacement.encode(record.getEncoding())
        if record.string != encoded:
            record.string = encoded
            changed = True
        seen.add(record.nameID)

    missing = set(replacements) - seen
    if missing:
        missing_names = ", ".join(str(name_id) for name_id in sorted(missing))
        raise ValueError(f"{path.name} is missing name IDs: {missing_names}")

    if not changed:
        return

    with NamedTemporaryFile(
        dir=path.parent,
        prefix=f".{path.name}.",
        suffix=".tmp",
        delete=False,
    ) as temporary:
        temporary_path = Path(temporary.name)
    try:
        font.save(temporary_path, reorderTables=False)
        temporary_path.chmod(original_mode)
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    shared = root / "plugins" / "hope" / "assets" / "fonts"
    targets = [shared / filename for filename in FONT_NAMES]
    for path in targets:
        rename_font(path, FONT_NAMES[path.name])


if __name__ == "__main__":
    main()
