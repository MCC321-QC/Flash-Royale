# Source definitions

The JSON files in [`enabled/`](enabled/) and [`disabled/`](disabled/) describe Explore catalogs and metadata sources. The app reads the signed set from GitHub (`MCC321-QC/Flash-Royale`, branch `main`), so sources can be added, edited, temporarily disabled or removed **without another app update** once clients support this folder policy.

- A file in `enabled/` is available, subject to each user's own on/off choice.
- Moving that file to `disabled/` makes it unavailable to every client that accepts the updated signed set. Its option is unchecked, greyed out and locked, with a **Currently disabled** pill. Metadata entries display at the bottom, but their saved positions and on/off choices are retained. Catalog options stay in their normal positions.
- Moving it back to `enabled/` restores each user's saved choice and, for metadata, its saved priority position.
- Folder placement is signed too: after a move, run `npm run sign-sources` and publish both folders together with `enabled/signatures.json`. An unsigned move is not accepted.

The folder policy requires an app version that understands schema-2 source manifests. Older builds keep their last supported signed set and cannot show the new disabled state. Automatic-update, offline and security-monitor restrictions still apply; clients detect changes on their normal source refresh or a manual check/import, not instantly.

Definitions are **data only**. They hold addresses, allowed hosts, CSS selectors, JSON paths and regular expressions. They never contain code.

## When the app checks for changes

- **Explore**: when the catalog list loads (at most once a day) and every time the **Reload** button is pressed.
- **Metadata**: before each metadata completion, automatic or manual (**Scan missing metadata**), and before each **Find metadata…** search, at most once every 10 minutes.

The app lists `enabled/` with the GitHub API (using `ETag` to avoid downloading an unchanged listing again), then reads `disabled/` when the signed manifest lists disabled files. It downloads only changed files and checks each one against its git hash. The verified set and its folder policy are cached in `library/catalogue-cache/source-definitions/`.

- If the folder does not exist on the first check, the copy shipped with the app is used. Once a signed set is accepted, a missing folder or failed check keeps that set, so a temporary failure cannot reactivate a disabled source.
- If GitHub cannot be reached, the last downloaded copy is kept, and the app tries again after 5 minutes.
- An invalid definition can use the bundled copy with the same name, but a signed disabled status still applies to that fallback. Problems are printed to the main-process console (the terminal running `npm run dev`).
- While online features are paused by a [security alert](../docs/SECURITY.md#security-monitor-and-network-guard), the app does not check for changes.

These checks can be switched off in **Settings > Catalog and metadata sources > Update sources automatically**. The sources then only change when you press **Check for updates now** or import files by hand.

## Updating by hand

When the app can't reach GitHub, or automatic updates are off, the files can be installed manually:

1. Open the source folders on GitHub (the **Latest sources on GitHub** button in that settings section).
2. Download `enabled/signatures.json` and changed files from their `enabled/` or `disabled/` location (open a file, then **Download raw file**). Renamed downloads such as `signatures (1).json` are fine: files are matched by content.
3. In the same settings section, choose **Import files…** and select them, or **Import a folder…** containing the downloads or the `enabled/` and `disabled/` subfolders.

The import goes through the same checks as an online update: `signatures.json` must be signed by a trusted key and not older than the one in use, and every file it lists must be selected or already installed with the same content. The newest valid selected manifest is used when several are present. Folder status comes from that signed manifest, not from where a downloaded file was saved. Otherwise nothing changes and the missing or different files are named.

The same section has a switch for each Explore catalog and metadata source, a link to each source's file on GitHub, and shows why a file can't be used. When an Explore catalog fails to load, or a source fails in **Find metadata…**, the app links to that source's file on GitHub and explains both ways to update it.

## Signing (required)

Remote updates are only used if **signed**. The schema-2 `enabled/signatures.json` lists the SHA-256 of every definition in both folders and a `disabled` array of file names. Its Ed25519 signature authenticates both file contents and folder status. Definition JSON itself still uses schema 1. Legacy schema-1 manifests remain readable as all-enabled sets. The app checks signatures against the public keys in [`electron/trusted-keys.json`](../electron/trusted-keys.json), which ship inside the app. Someone who can change files on GitHub but does not have the private key cannot forge a new accepted source set:

- A missing, invalid or untrusted `signatures.json` makes the app ignore the whole update and keep its current files.
- A signed file that is changed or deleted makes the app ignore the whole update. Files that are not listed in `signatures.json` are ignored and logged.
- A `signatures.json` older than one the app already accepted is refused, so an old folder can't be put back.
- The cached copy is checked again at each start.

After editing or moving anything in either folder, sign the complete set and publish `enabled/signatures.json` with the same change:

```powershell
npm run sign-sources
```

The command validates every definition first and rejects duplicate file names or duplicate kind/id pairs across folders. Files must use LF line endings (`.gitattributes` enforces this), because the hashes cover the exact text.

The private key is read from the `FLASH_ROYALE_SIGNING_KEY` environment variable (a path), or else from `.flash-royale/signing-key.pem` in your user folder. **Back it up and never commit it** (`*.pem` is git-ignored). `npm run sign-sources -- --init` creates a key and adds its public key to `electron/trusted-keys.json`. A new trusted key only works in app versions that ship it. To replace a key, ship both keys in one release before signing with the new one.

## Files

- Use one file per source, named `<kind>-<id>.json` (for example `metadata-newgrounds.json` or `catalog-y8.json`).
- Files must be under 64 KiB, and there can be at most 100 definition files across both folders.
- Only `.json` files directly inside `enabled/` or `disabled/` are read. Keep a single manifest at `enabled/signatures.json`.

| Change | How |
| --- | --- |
| Rename or reorder a source | Edit `name` or `order` (lower comes first). |
| Temporarily disable a source | Move its JSON from `enabled/` to `disabled/`, re-sign and publish the set. |
| Restore a disabled source | Move it back to `enabled/`, re-sign and publish. Saved user choices and metadata positions return. |
| Remove a source | Delete its file. Users keep their on/off switch and position in case it comes back. |
| Add a source | Add a file with a new `id` (see the examples below). New metadata sources start switched on, at the end of the user's list. |
| Fix a built-in metadata source whose site changed | Add `hosts` plus `search` and/or `details` to its file. They replace the built-in step. |
| Turn a built-in catalog into a definition-driven one | Add `hosts` and `list` (and optionally `details`) to its file. |

`flashpointLocal` reads the installed Flashpoint. Its definition only customizes its name/order, but it can be disabled or removed like other sources. Site quirks that can't be described with selectors and patterns still need an app update.

Catalog and metadata definitions are independent: move both `catalog-<id>.json` and `metadata-<id>.json` if both uses of a site should be unavailable.

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
- `details` reads one game. Fields: `title` (required), `developer`, `publisher`, `releaseDate`, `description`, `notes`, `tags`, `coverUrl`, `platform`, `version`, `rating` (must already be on a 0-to-5 scale).
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
- `details` reads a game page. `url` defaults to `{pageUrl}`. Fields: `title`, `description`, `instructions`, `developer`, `tags`, `swfUrl`, `releaseDate`, `imageUrl`, `iconUrl`, `logoUrl`, `rating`. Without `swfUrl`, the first `.swf` found in the page (`embed`, `object`, `param` or a quoted address) is used.

Both metadata and catalog `details.fields` can expose `iconUrl` or `logoUrl` for a **dedicated game icon/logo**. These URLs use the same host validation as cover images. Metadata completion offers the image as a separate shortcut-icon field; catalog imports save it with the game. Do not map cover art, screenshots, generic social preview images or the site's favicon to these fields. Existing `coverUrl`/`imageUrl` never imply an icon.
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

Point a development build (`npm run dev`) at a local folder instead of GitHub. Packaged builds ignore these variables. A local folder doesn't need to be signed.

```powershell
$env:FLASH_ROYALE_SOURCES_DIR = "C:\path\to\sources\enabled"; npm run dev
```

To try a branch of this repository, set `FLASH_ROYALE_SOURCES_REF` to the branch name instead (the branch must be signed). Problems with a definition are printed in that terminal. The tests in `electron/source-definitions.test.cjs` validate every bundled file and check that `signatures.json` matches them:

```powershell
node --test electron\source-definitions.test.cjs
```
