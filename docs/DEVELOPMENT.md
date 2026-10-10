# Developing Pelagix

How to run, test, package and find your way around the code. For what the app does, see the
[README](../README.md); for the datasets, see [DATA.md](DATA.md).

- [Setup](#setup)
- [Scripts](#scripts)
- [Ways to run the app](#ways-to-run-the-app)
- [How the app is put together](#how-the-app-is-put-together)
- [The save file](#the-save-file)
- [Tests](#tests)
- [Packaging](#packaging)
- [Assets and screenshots](#assets-and-screenshots)

## Setup

- Windows 10 or 11, 64-bit. The packaging scripts target Windows x64 only.
- Node.js 24 and npm 11. The data scripts run `.ts` files directly, which relies on Node's
  built-in type stripping.
- Only for rebuilding the datasets: the .NET SDK 10 and the `PKHeX/` and `PokeAPI/` source trees
  (see [DATA.md](DATA.md#rebuilding-the-datasets)).
- Only for redrawing the app icon: Python 3 with Pillow.

```
npm install
```

Electron 44 has no install script, so its binary is not downloaded by `npm install`. `npm run dev`
and `npm run preview` fetch it on first use; `npx install-electron` does it by hand.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the app in Electron with hot reload. |
| `npm run dev:web` | Serves only the interface at http://127.0.0.1:5199 for a normal browser. Set `PELAGIX_WEB_PORT` to use another port. |
| `npm run build` | Type-checks, then builds main, preload and renderer into `out/`. |
| `npm run preview` | Builds and runs the production build in Electron. |
| `npm run reader:build` | Builds the game-save reader (`tools/save-reader`) into its `.artifacts` folder. Needs the .NET SDK and `PKHeX/`. |
| `npm run dist` | Builds the reader and the app, then packages a Windows installer and a portable executable into `dist/`. |
| `npm run typecheck` | Type-checks the app: main, preload, renderer and shared. |
| `npm run typecheck:tools` | Type-checks the tooling in `tools/`. |
| `npm test` | Runs the unit tests with Vitest. |
| `npm run data:extract` | Runs the PKHeX extractor (`tools/extractor`). Needs the .NET SDK and `PKHeX/`. |
| `npm run data:build` | Builds the datasets into `src/renderer/public/data/`. |
| `npm run data:validate` | Checks the built datasets. Read-only. |
| `npm run data` | `data:extract`, `data:build` and `data:validate` in sequence. |
| `npm run screenshots` | Re-creates the pictures in `docs/screenshots/`. |

## Ways to run the app

**In Electron, with hot reload:** `npm run dev`. This uses your real save in `%APPDATA%\Pelagix`.

**In a browser:** `npm run dev:web`. There is no Electron API there, so the save goes to
`localStorage` and renders load straight from the CDN. Each port has its own save. This is the
quickest way to work on the interface.

**The production build, against a scratch profile:** to try the built app without touching your
own save, give Electron another data folder:

```
npx install-electron
npm run build
npx electron-vite preview --skipBuild -- --user-data-dir=C:\path\to\a\scratch\folder
```

The first line fetches the Electron binary if it is not there yet. Calling `electron-vite`
directly skips the step that does this for `npm run dev` and `npm run preview`.

Setting `PELAGIX_SMOKE=1` makes the app print `SMOKE_OK Pelagix` once its window has loaded and
then quit, which is enough to confirm that a build boots.

Two things exist only in development and are left out of every production build:

- a small **fixture dataset** (`src/renderer/public/data-fixture`, 24 species) that the app falls
  back to when the real datasets are missing. The title bar shows a "Fixture data" chip when it
  is in use;
- the **component gallery** at `#/_kit`, described in
  [`src/renderer/src/components/README.md`](../src/renderer/src/components/README.md).

## How the app is put together

```
src/main/        Electron main process
src/preload/     Exposes window.api to the page
src/shared/      Types and static data shared with the data tools
src/renderer/    The React interface
```

**Main process** (`src/main`)

- `index.ts` starts the app, allows a single instance, and refuses every permission request
  except copying text.
- `window.ts` creates the one window (1360 × 860 by default, 1040 × 680 at least), remembers its
  size, position and theme in `window.json`, and blocks navigation away from the app's own page.
  Links open in the system browser, `https` only.
- `save.ts` reads and writes the save: one queue for loads and writes, atomic writes, a daily
  backup (the newest 14 are kept) and recovery from an unreadable file.
- `sprites.ts` serves the `sprite://` protocol: Pokémon HOME renders, downloaded once and then
  read from `sprite-cache\`, with thumbnails made on demand.
- `ipc.ts` holds the handlers behind `window.api`. Each one checks that the call comes from the
  app's own page and validates its arguments.
- `updates.ts` and the `update-*.ts` files are the updater: see [Updates](#updates).

**Preload** (`src/preload/index.ts`) exposes exactly the methods of `PelagixApi`
([`src/shared/api.ts`](../src/shared/api.ts)): the save, sprite-cache, app-info, `openExternal`
and `setTheme` calls, and the update calls with `onUpdateState`, the one subscription the main
process pushes to. The page runs sandboxed, with context isolation on and Node integration off,
under a Content Security Policy that allows network requests only to the two sprite hosts. The
main process is what talks to GitHub for updates.

**Renderer** (`src/renderer/src`)

| Folder | Contents |
| --- | --- |
| `features/` | One folder per page or app-wide feature: `home`, `pokedex`, `species`, `entry`, `living`, `homedex`, `journal`, `achievements`, `settings`, `search`, `gamesave`, `updates` (and `kit`, development only). |
| `domain/` | The rules, as pure functions: Living Dex slots, progress, encounters, achievements. |
| `components/` | Shared components (`ui/`) and Pokémon-specific ones (`pokemon/`). |
| `lib/` | Data loading, sprites, storage, search, formatting, animation helpers. |
| `store/` | zustand stores: the save, and the interface state. |
| `shell/` | The app frame: navigation rail, title bar and routing. |
| `styles/` | Design tokens and base styles. |

Routing is hash-based: `#/`, `#/dex`, `#/dex/<number>?form=<index>`, `#/living`, `#/home-dex`, `#/journal`,
`#/achievements` and `#/settings`.

Animation goes through `lib/anim.ts`, a thin layer over anime.js that honours the reduce-motion
setting.

Preferences that belong to a device rather than to a collection (tile size, sort orders, the
Living Dex view, the shiny toggle, recently opened Pokémon) are kept in `localStorage`, not in
the save.

## The save file

`save.json` is plain JSON, described by
[`src/shared/save-types.ts`](../src/shared/save-types.ts):

| Part | Contents |
| --- | --- |
| `version` | The format version, currently 1. |
| `entries` | Every logged catch: species, form, optional sweet, gender, shiny, Gigantamax, Alpha, game, how it was obtained, method, location, what it was caught as, ball, level, date, nickname, Original Trainer, notes, and when it was logged and last changed. |
| `settings` | The Living Dex rules, theme, reduce motion and trainer name. |
| `achievements` | The id of each unlocked achievement and when it was unlocked. |

Species and forms are stored as National Pokédex numbers and PKHeX form indices, games as the
ids in [`src/shared/games.ts`](../src/shared/games.ts), balls as PKHeX ball ids. Those ids are
part of the save format and must never be renamed.

The main process only checks the top-level shape. The renderer validates each entry when a save
is loaded or imported, and reports what it had to drop or repair.

## Tests

```
npm test
```

Vitest, in a Node environment: 1,773 tests in 50 files at the time of writing. They cover the
logic: slot rules, progress, encounter handling, achievements (including that every one of them
can be earned on the real datasets), search, the entry editor's draft handling, the page models,
the save store and the sprite protocol's request parsing.

There is no DOM test environment, so components are not tested automatically. What is on screen
is checked by running the app.

## Packaging

```
npm run dist
```

runs `npm run build` and then `electron-builder --win --publish never` with
[`electron-builder.yml`](../electron-builder.yml). It writes to `dist/`:

| File | What it is |
| --- | --- |
| `Pelagix-<version>-setup.exe` | NSIS installer, x64. Not one-click: it lets the user choose the folder. |
| `Pelagix-<version>-setup.exe.blockmap` | Lets an installed copy download only the parts of the installer that changed. |
| `latest.yml` | What an installed copy reads to learn the newest version: the installer's name, size and checksum. |
| `Pelagix-<version>-portable.exe` | Portable executable, x64. |

- All four belong to a release: see [Releasing](#releasing).
- electron-builder also leaves its working files in `dist/`: the unpacked app in `win-unpacked/`
  and `builder-debug.yml`. Those are not needed.
- The package contains `out/` and `package.json`. The datasets are in `out/renderer/data`, so
  there are no extra resources. electron-updater is a devDependency on purpose: electron-vite
  bundles it into `out/main`, so the package still has no `node_modules`.
- The executables are **not code-signed**.
- Nothing is uploaded: `--publish never` is part of the script.
- The version comes from `package.json`.

## Importing from a game save

`tools/save-reader` is a small .NET 10 console program on PKHeX.Core. Given the path of a save
file it prints one JSON document: the save, and every Pokémon in the party and the boxes with
PKHeX's legality match for how it was first obtained. It only reads the file.

- It is published as a trimmed, self-contained single file (about 16 MB) and shipped outside the
  asar as `resources/save-reader/pelagix-save-reader.exe`. In development the app looks for it
  in `tools/save-reader/.artifacts/publish`; without `npm run reader:build` the import reports
  that the reader is missing.
- `src/main/game-save.ts` runs it (no shell, a timeout, an output cap) and checks every field of
  what comes back. The main process opens the file dialog itself, so the page never passes a
  path.
- `src/renderer/src/features/gamesave` turns the result into preview rows and entries, through
  the same functions the entry editor uses. Each imported entry keeps the reader's
  `fingerprint`, which is how a second import recognises it.
- The encounter kinds in `tools/save-reader/Pokemon.cs` repeat the rules of `tools/extractor` by
  hand. Change them together.

## Updates

An installed copy updates itself through electron-updater, reading the GitHub releases of
`HydrosPlays/Pelagix`. The contract with the page is `UpdateState` in
[`src/shared/api.ts`](../src/shared/api.ts): the main process owns the state and always sends the
whole snapshot.

| Mode | When | What it does |
| --- | --- | --- |
| `auto` | Packaged, with the NSIS uninstaller beside the exe | Checks, downloads, installs. |
| `manual` | Packaged otherwise: the portable exe, an unpacked folder | Checks and shows the notes; the button opens the release page. Never downloads. |
| `off` | Not packaged, `PELAGIX_SMOKE=1`, or not Windows | Nothing: no request, no timer, no file. |

- **Main process** (`src/main`): `updates.ts` wires it up and decides the mode; `updater.ts` is
  the only file that touches electron-updater; `update-service.ts` is the state machine;
  `update-model.ts`, `update-version.ts` and `update-releases.ts` are pure logic (error kinds,
  version comparison, reading GitHub's release list); `update-store.ts` reads and writes
  `updates.json` and `updates.log` in the user-data folder.
- **Renderer** (`src/renderer/src/features/updates`): the watcher that decides when a window may
  open by itself, the changelog and What's-new windows, the rail marker, and a dependency-free
  Markdown parser and renderer (`markdown.ts`, `render.ts`). Release notes are untrusted text:
  they are never rendered as HTML, and links are `https` only.
- **Timing**: the first check about 12 seconds after the page loads, then every six hours, only
  while the automatic check is on. With it off, the app sends no update request of its own.
- **Installing**: the page flushes the save, the main process waits for it to reach the disk, and
  only then starts the installer silently. The installer stops a running app after about a
  second, so nothing may still be unsaved by then.
- **Uninstalling**: `build/installer.nsh` removes the download cache
  (`%LOCALAPPDATA%\pelagix-updater`) on a real uninstall, and leaves it alone during an update.
- **Seeing the windows without a release**: a development run is in mode `off`. The development
  page `#/_kit` has previews of every update state.

## Releasing

Users see the release description as the changelog inside the app, so write it for them, in
Markdown (headings, lists, tables, bold, italics, code and links are rendered; images become
links; HTML is shown as text).

1. Set the new `version` in `package.json`.
2. Run `npm run dist` once.
3. On GitHub, create a release with the tag `v<version>`, for example `v0.2.1`, and paste the
   description.
4. Upload these four files from that same run of `npm run dist`, without renaming them:
   `Pelagix-<version>-setup.exe`, `Pelagix-<version>-setup.exe.blockmap`, `latest.yml` and
   `Pelagix-<version>-portable.exe`.
5. Publish it as a normal release: not a pre-release, and marked as the latest.
6. Check that `https://github.com/HydrosPlays/Pelagix/releases/latest/download/latest.yml` opens.

What goes wrong otherwise:

- **A newest release without `latest.yml`** makes the update check of every installed copy fail,
  silently, until the file is added.
- **A `latest.yml` from a different build than the uploaded setup exe** fails the checksum, and
  the download is rejected. Never rebuild between uploading the two.
- **A pre-release or a draft** is not seen by the updater.

Version 0.1.0 has no updater, so its users install a newer version by hand.

## Assets and screenshots

- `build/make-assets.py` draws the app icon and derives the logo sizes and game icons used by the
  interface: `python -I build/make-assets.py <project root> [icon|logo|games|all]`.
- `games/` holds the 46 game icons as supplied; the copies the app ships are in
  `src/renderer/public/games/`.
- `npm run screenshots` drives the built app over the DevTools protocol on a generated demo save
  and writes `docs/screenshots/`. See
  [`tools/screenshots/README.md`](../tools/screenshots/README.md).
