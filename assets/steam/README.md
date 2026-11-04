# Steam artwork

Artwork for adding Flash Royale itself to Steam as a non-Steam game (and for a future store page).

| File | Size | Steam slot |
| --- | --- | --- |
| `library_600x900.png` | 600×900 | Library capsule (portrait cover) |
| `header_920x430.png` | 920×430 | Wide capsule / header |
| `hero_1920x620.png` | 1920×620 | Hero (background of the game page, no text) |
| `logo_1280x480.png` | 1280×480, transparent | Logo shown over the hero |
| `icon_256.png` | 256×256 | Icon |

## Using it on a non-Steam shortcut

In Steam, right-click Flash Royale in the library:

- **Manage › Set custom artwork** sets the portrait cover (`library_600x900.png`).
- On the game page, right-click the background for **Set custom background** (`hero_1920x620.png`) and **Set custom logo** (`logo_1280x480.png`).
- The wide capsule (`header_920x430.png`) shows up in Recent Games. Set it in **Properties** or copy it to `userdata/<id>/config/grid/<appid>.png`.
- **Properties › Shortcut** sets the icon (`icon_256.png`).

## Rebuilding

`source/` holds the textless backgrounds. The title and slogan are drawn from the bundled Flash Royale Sans font with:

```
node scripts/build-steam-artwork.cjs
```

The backgrounds were AI-generated for this project from the app logo (`assets/new-flash-royale-logo.png`). This folder is not packaged into the app.
