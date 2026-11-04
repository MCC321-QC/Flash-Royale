"""Derive Flash Royale Sans from Selawik 1.01 (OFL-1.1).

Two Wine rendering problems made letter spacing uneven (for example "ti" touching):
- Selawik has no TrueType hinting program, so Wine's FreeType runs its auto-hinter, which snaps
  vertical stems sideways by up to a pixel. A one-instruction no-op `prep` table makes FreeType
  use the TrueType interpreter instead, which (v40) never moves outlines horizontally.
- Wine's DirectWrite truncates each glyph's fractional position when it rasterizes text
  (glyphrunanalysis_render offsets the glyph bitmap with an integer OffsetRect). Chromium draws
  COLR glyph layers from their outlines instead, and those honor sub-pixel positions, so every
  outline glyph gets one COLR layer drawn in the text color (palette index 0xFFFF).
Outlines, metrics, and kerning are unchanged.

Selawik is a Reserved Font Name, so the modified fonts are renamed.

Usage: pip install fonttools brotli
       python scripts/build-flash-royale-sans.py <Selawik woff2 folder>
"""

import json
import pathlib
import sys

from fontTools.colorLib.builder import buildCOLR, buildCPAL
from fontTools.ttLib import TTFont, newTable
from fontTools.ttLib.tables import ttProgram

FAMILY = "Flash Royale Sans"
STYLES = {
    "selawkl": ("Light", "flash-royale-sans-light"),
    "selawksl": ("Semilight", "flash-royale-sans-semilight"),
    "selawk": ("Regular", "flash-royale-sans-regular"),
    "selawksb": ("Semibold", "flash-royale-sans-semibold"),
    "selawkb": ("Bold", "flash-royale-sans-bold"),
}

root = pathlib.Path(__file__).resolve().parent.parent
source = pathlib.Path(sys.argv[1])
target = root / "src" / "assets" / "fonts" / "flash-royale-sans"
target.mkdir(parents=True, exist_ok=True)

for name, (style, output) in STYLES.items():
    font = TTFont(source / f"{name}.woff2")
    for record in font["name"].names:
        if record.nameID in (1, 3, 4, 6, 16, 17, 18, 21, 22):
            text = record.toUnicode()
            text = text.replace("Selawik", FAMILY.replace(" ", "") if record.nameID == 6 else FAMILY)
            record.string = text
    layers = {glyph: [(glyph, 0xFFFF)] for glyph in font.getGlyphOrder() if font["glyf"][glyph].numberOfContours != 0}
    font["COLR"] = buildCOLR(layers, version=0)
    font["CPAL"] = buildCPAL([[(0, 0, 0, 1.0)]])
    prep = newTable("prep")
    prep.program = ttProgram.Program()
    prep.program.fromAssembly(["SVTCA[0]"])
    font["prep"] = prep
    font.flavor = "woff2"
    font.save(target / f"{output}.woff2")
    print(f"{output}.woff2 ({style}, {len(layers)} layers)")

provenance_path = root / "public" / "selawik" / "provenance.json"
provenance = json.loads(provenance_path.read_text())
provenance.update({
    "location": "src/assets/fonts/flash-royale-sans",
    "files": [f"{output}.woff2" for _, output in STYLES.values()],
    "modified": True,
    "modifiedName": FAMILY,
    "modification": "Renamed; added a no-op TrueType prep program so FreeType under Wine does not auto-hint stems sideways, and gave every outline glyph a single COLR layer in the text color so Chromium under Wine positions glyphs at sub-pixel offsets. Outlines, metrics, and kerning are unchanged.",
    "generator": "scripts/build-flash-royale-sans.py",
})
provenance_path.write_text(json.dumps(provenance, indent=2) + "\n")
