# Source definitions

The JSON files in [`enabled/`](enabled/) describe the Explore catalogs and the metadata sources used by Flash Royale. The app downloads this folder from GitHub (`MCC321-QC/Flash-Royale`, branch `main`), so sources can be added, edited or removed **without an app update**: commit the change to `main` and the apps pick it up.

Definitions are **data only**. They hold addresses, allowed hosts, CSS selectors, JSON paths and regular expressions. They never contain code.

## When the app checks for changes

- **Explore**: when the catalog list loads (at most once a day) and every time the **Reload** button is pressed.
- **Metadata**: before each metadata completion, automatic or manual (**Complete metadata now**), and before each **Find metadata…** search, at most once every 10 minutes.

The app lists the folder with the GitHub API (using `ETag`, so an unchanged folder costs nothing). It downloads only the changed files and checks each one against its git hash. The result is cached in `library/catalogue-cache/source-definitions/`.

- If the folder does not exist on GitHub, the copy shipped with the app is used.
- If GitHub cannot be reached, the last downloaded copy is kept, and the app tries again after 5 minutes.
- An invalid file is skipped. If a file with the same name ships with the app, that copy is used instead. Problems are printed to the main-process console (the terminal running `npm run dev`).

## Files

- Use one file per source, named `<kind>-<id>.json` (for example `metadata-newgrounds.json` or `catalog-y8.json`).
- Files must be under 64 KiB, and there can be at most 100 files.
- Only `.json` files directly inside `enabled/` are read.

| Change | How |
| --- | --- |
| Rename or reorder a source | Edit `name` or `order` (lower comes first). |
| Remove a source | Delete its file. Users keep their on/off switch and position in case it comes back. |
| Add a source | Add a file with a new `id` (see the examples below). New metadata sources start switched on, at the end of the user's list. |
| Fix a built-in metadata source whose site changed | Add `hosts` plus `search` and/or `details` to its file. They replace the built-in step. |
| Turn a built-in catalog into a definition-driven one | Add `hosts` and `list` (and optionally `details`) to its file. |

`flashpointLocal` reads the installed Flashpoint and can only be renamed, reordered or removed. Site quirks that can't be described with selectors and patterns still need an app update.

## Common keys

| Key | Required | Description |
| --- | --- | --- |
| `schema` | yes | Always `1`. Files with a higher number are ignored by older apps. |
| `kind` | yes | `metadata` or `catalog`. |
| `id` | yes | 2 to 40 letters, digits or dashes, starting with a letter. Never reuse an id for a different site. |
| `name` | yes | Name shown in the app (60 characters max). |
| `builtin` | for built-in ids | `true` for the sources with code in the app: metadata `flashpointLocal`, `flashpointOnline`, `newgrounds`, `silvergames`, `y8`, `armorgames`, `andkon`, `flashgames247`; catalogs `silvergames`, `y8`, `andkon`. |
| `order` | no | Sort position (default 1000). |
| `minAppVersion` | no | For example `"1.4.0"`. Older apps ignore the file. |
| `hosts` | with `search`/`details`/`list` | Host names the source may read pages from. A leading dot (`.example.com`) allows every subdomain. |
| `imageHosts` | no | Extra hosts allowed for images. |
| `downloadHosts` | no | Extra hosts allowed for SWF downloads (catalogs). |
| `allowHttp` | no | Allow `http://` addresses (default: https only). |
| `ignoredTags` | no | Tags to drop (case-insensitive). |
| `siteUrl` | no | Home page, opened by the Explore site link. |
| `description` | no | A note for maintainers. The app does not show it. |

Every address template must point to one of `hosts`. Responses that redirect elsewhere are rejected.

## Metadata sources

```json
{
  "schema": 1,
  "kind": "metadata",
  "id": "examplegames",
  "name": "Example Games",
  "order": 90,
  "hosts": ["www.example.com"],
  "imageHosts": ["img.example.com"],
  "idPattern": "/game/(\\d+)$",
  "search": {
    "url": "https://www.example.com/search?q={query}",
    "items": ".result",
    "fields": { "url": "a@href", "title": "a", "imageUrl": "img@src", "developer": ".by" }
  },
  "details": {
    "url": "https://www.example.com/game/{id}",
    "fields": {
      "title": { "meta": "og:title" },
      "description": [{ "jsonLd": "description" }, { "meta": "og:description" }],
      "developer": ".credits .author",
      "releaseDate": { "selector": ".released", "pattern": "(\\d{4}-\\d{2}-\\d{2})" },
      "tags": { "selector": ".tags a", "all": true },
      "coverUrl": { "meta": "og:image" }
    }
  }
}
```

- `search` reads a results page for the user's search terms. Fields: `id`, `title`, `developer`, `year`, `platform`, `imageUrl`, `url`. Every result needs a `title` and either an `id` or a `url` plus a top-level `idPattern` (a regular expression whose first group takes the id out of the URL).
- `details` reads one game. Fields: `title` (required), `developer`, `publisher`, `releaseDate`, `description`, `notes`, `tags`, `coverUrl`, `platform`, `version`.
- `entryUrl` (optional) is the game page linked from the prompts when a search result has no `url`. It defaults to `details.url`.
- A new metadata source needs both `search` and `details`.

## Catalogs (Explore)

```json
{
  "schema": 1,
  "kind": "catalog",
  "id": "examplearcade",
  "name": "Example Arcade",
  "order": 40,
  "siteUrl": "https://arcade.example.com/",
  "hosts": ["arcade.example.com"],
  "downloadHosts": ["files.example.com"],
  "list": {
    "url": "https://arcade.example.com/flash?page={page}",
    "maxPages": 5,
    "items": ".game-card",
    "fields": { "title": ".name", "pageUrl": "a@href", "imageUrl": "img@src", "tags": { "selector": ".tag", "all": true } }
  },
  "details": {
    "url": "{pageUrl}",
    "fields": { "description": ".about", "instructions": ".controls", "developer": ".author", "swfUrl": "embed@src" }
  }
}
```

- `list` reads the catalog. Use either `url` with `{page}` (numbered from `firstPage`, default 1, up to `maxPages`, at most 50; it stops at the first page that adds nothing) or a fixed `pages` list. `items` is required. Fields: `id`, `title`, `imageUrl`, `pageUrl`, `tags`, `rating`, `description`, `developer`. `title` and either `id` or `pageUrl` are required.
- `details` reads a game page. `url` defaults to `{pageUrl}`. Fields: `title`, `description`, `instructions`, `developer`, `tags`, `swfUrl`, `releaseDate`, `imageUrl`, `rating`. Without `swfUrl`, the first `.swf` found in the page (`embed`, `object`, `param` or a quoted address) is used.
- The list is cached for 24 hours, like the other catalogs. Search filters by title or exact tag, and sorting is by name. Downloads must be real SWF files (checked by their first bytes).
- Imported games remember `<id>:<game id>`, so Explore can mark them as already in the library.

## Address placeholders

| Placeholder | Value |
| --- | --- |
| `{query}` | The search terms, URL-encoded. |
| `{id}` | The game id. Each path segment is URL-encoded. |
| `{slug}` | The search terms (or the title) in lower case with dashes, for example `super-game-2`. |
| `{page}` | The page number. |
| `{pageUrl}` | The whole game page address, used alone (catalog `details.url`). |

## Reading a field

A field is one of the following:

- **A text**, `"selector@attribute"`. For example, `"a.title@href"` reads an attribute, `".name"` reads the text, and `"@href"` reads an attribute of the item itself.
- **An object** with these keys:

  | Key | Meaning |
  | --- | --- |
  | `selector` | A CSS selector inside the current item (or page). |
  | `attr` | The attribute to read (default: the text). |
  | `meta` | The content of `<meta property|name="…">`, for example `og:image`. |
  | `jsonLd` | A path inside the page's JSON-LD blocks, for example `author.name`. |
  | `json` | A path inside JSON text found by `selector` (for example a `<script>` tag). |
  | `path` | For `"format": "json"` responses: a path in the JSON. `*` walks every entry of a list. |
  | `pattern`, `flags` | A regular expression (`flags`: `i` and/or `s`). It keeps the first group, or the whole match if there is no group. A value that does not match is dropped. |
  | `template` | Rewrites the value. `{value}` is the value (or the whole match), and `{1}`, `{2}`… are the pattern's groups. |
  | `value` | A fixed text. |
  | `split` | Splits the text into several values, for example `","`. |
  | `all` | Keeps every match instead of only the first (`tags` always keeps all). |

- **A list** of up to 6 alternatives. The first one that gives a value is used.

Relative addresses are made absolute against the page they were read from. Images, cover and SWF addresses must also be on the allowed hosts.

For a JSON API, set `"format": "json"` on `search`, `details` or `list`. `items` is then a path (for example `data.games.*`), and fields use `path`.

## Testing changes locally

Point the app at a local folder instead of GitHub:

```powershell
$env:FLASH_ROYALE_SOURCES_DIR = "C:\path\to\sources\enabled"; npm run dev
```

To try a branch of this repository, set `FLASH_ROYALE_SOURCES_REF` to the branch name instead. Problems with a definition are printed in that terminal. The tests in `electron/source-definitions.test.cjs` validate every bundled file:

```powershell
node --test electron\source-definitions.test.cjs
```
