"""Build the theme fonts from Lilita One, Nunito, Playfair Display, Cinzel, Orbitron and Russo One (all OFL-1.1).

Same Wine fixes as scripts/build-flash-royale-sans.py: a no-op TrueType `prep` program when the font has
none (so FreeType does not auto-hint stems sideways) and one COLR layer per outline glyph drawn in the
text color (so Chromium under Wine keeps sub-pixel glyph positions). Nunito is a variable font; it is
instanced at the weights the app uses. Outlines, metrics, and kerning are unchanged.

"Lilita" is a Reserved Font Name, so the modified fonts are renamed (Nunito too, for consistency and so an
installed Nunito can never be picked instead).

Usage: pip install fonttools brotli
       python scripts/build-theme-fonts.py <folder with LilitaOne-Regular.ttf and Nunito[wght].ttf>
"""

import hashlib
import json
import pathlib
import sys

from fontTools.colorLib.builder import buildCOLR, buildCPAL
from fontTools.ttLib import TTFont, newTable
from fontTools.ttLib.tables import ttProgram
from fontTools.varLib import instancer

root = pathlib.Path(__file__).resolve().parent.parent
source = pathlib.Path(sys.argv[1])
target = root / "src" / "assets" / "fonts" / "theme"
target.mkdir(parents=True, exist_ok=True)

DISPLAY = "Flash Royale Display"
ROUNDED = "Flash Royale Rounded"
NUNITO_WEIGHTS = {400: "Regular", 600: "SemiBold", 700: "Bold", 800: "ExtraBold"}
# Title fonts for the other built-in themes: one weight each, (family, file, source glob, original name, Google Fonts folder, weight).
TITLE_FONTS = [
    ("Flash Royale Serif", "flash-royale-serif.woff2", "PlayfairDisplay*.ttf", "Playfair Display", "playfairdisplay", 800),
    ("Flash Royale Deco", "flash-royale-deco.woff2", "Cinzel*.ttf", "Cinzel", "cinzel", 700),
    ("Flash Royale Tech", "flash-royale-tech.woff2", "Orbitron*.ttf", "Orbitron", "orbitron", 700),
    ("Flash Royale Arcade", "flash-royale-arcade.woff2", "RussoOne-Regular.ttf", "Russo One", "russoone", None),
]


def rename(font, family, style, old_names):
    for record in list(font["name"].names):
        if record.nameID in (16, 17, 25) or record.nameID >= 256:
            font["name"].removeNames(nameID=record.nameID)
            continue
        if record.nameID not in (1, 2, 3, 4, 6):
            continue
        if record.nameID == 1:
            text = family
        elif record.nameID == 2:
            text = "Regular"
        elif record.nameID == 4:
            text = f"{family} {style}" if style != "Regular" else family
        elif record.nameID == 6:
            text = f"{family.replace(' ', '')}-{style}"
        else:
            text = record.toUnicode()
            for old in old_names:
                text = text.replace(old, family)
        record.string = text


def wine_safe(font):
    layers = {glyph: [(glyph, 0xFFFF)] for glyph in font.getGlyphOrder() if font["glyf"][glyph].numberOfContours != 0}
    font["COLR"] = buildCOLR(layers, version=0)
    font["CPAL"] = buildCPAL([[(0, 0, 0, 1.0)]])
    if "prep" not in font:
        prep = newTable("prep")
        prep.program = ttProgram.Program()
        prep.program.fromAssembly(["SVTCA[0]"])
        font["prep"] = prep
    for table in ("STAT", "fvar", "gvar", "avar", "HVAR", "MVAR", "cvar"):
        if table in font:
            del font[table]
    font.flavor = "woff2"
    return len(layers)


outputs = []
display_source = source / "LilitaOne-Regular.ttf"
font = TTFont(display_source)
rename(font, DISPLAY, "Regular", ["Lilita One", "LilitaOne", "Lilita"])
layers = wine_safe(font)
font.save(target / "flash-royale-display.woff2")
outputs.append("flash-royale-display.woff2")
print(f"flash-royale-display.woff2 ({layers} layers)")

rounded_source = next(source.glob("Nunito*.ttf"))
for weight, style in NUNITO_WEIGHTS.items():
    font = instancer.instantiateVariableFont(TTFont(rounded_source), {"wght": weight})
    font["OS/2"].usWeightClass = weight
    rename(font, ROUNDED, style, ["Nunito"])
    layers = wine_safe(font)
    name = f"flash-royale-rounded-{weight}.woff2"
    font.save(target / name)
    outputs.append(name)
    print(f"{name} ({layers} layers)")

title_entries = []
licenses = root / "public" / "theme-fonts"
licenses.mkdir(parents=True, exist_ok=True)
for family, file_name, pattern, original, folder, weight in TITLE_FONTS:
    font_source = next(source.glob(pattern))
    font = TTFont(font_source)
    if "fvar" in font:
        font = instancer.instantiateVariableFont(font, {"wght": weight})
        font["OS/2"].usWeightClass = 400
    compact = original.replace(" ", "")
    rename(font, family, "Regular", [original, compact])
    layers = wine_safe(font)
    font.save(target / file_name)
    outputs.append(file_name)
    print(f"{file_name} ({layers} layers)")
    license_name = f"OFL-{compact}.txt"
    (licenses / license_name).write_bytes((source / license_name).read_bytes())
    title_entries.append({
        "name": family, "original": original, "license": f"OFL-1.1 ({license_name})",
        "source": f"https://github.com/google/fonts/tree/main/ofl/{folder}", "sourceFile": font_source.name,
        "sha256": hashlib.sha256(font_source.read_bytes()).hexdigest(), "files": [file_name],
    })

sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
provenance = {
    "location": "src/assets/fonts/theme",
    "generator": "scripts/build-theme-fonts.py",
    "modification": "Renamed; variable fonts instanced at fixed weights; a no-op TrueType prep program where the font had none and one COLR layer per outline glyph in the text color, so glyphs keep sub-pixel positions under Wine. Outlines, metrics, and kerning are unchanged.",
    "fonts": [
        {
            "name": DISPLAY, "original": "Lilita One", "license": "OFL-1.1 (OFL-LilitaOne.txt)",
            "source": "https://github.com/google/fonts/tree/main/ofl/lilitaone", "sourceFile": display_source.name, "sha256": sha(display_source),
            "files": ["flash-royale-display.woff2"],
        },
        {
            "name": ROUNDED, "original": "Nunito", "license": "OFL-1.1 (OFL-Nunito.txt)",
            "source": "https://github.com/google/fonts/tree/main/ofl/nunito", "sourceFile": rounded_source.name, "sha256": sha(rounded_source),
            "files": [name for name in outputs if name.startswith("flash-royale-rounded")],
        },
        *title_entries,
    ],
}
(licenses / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
