<p align="center">
  <img src="app-icon.svg" width="96" alt="Platinum Reader logo">
</p>

<h1 align="center">Platinum Reader</h1>

<p align="center">
  An ultra-lightweight, open-source document reader for Windows, Linux and macOS.<br>
  PDF · EPUB · MOBI/AZW3 · FB2 · CBZ/CBR · DjVu · XPS/OXPS · Markdown · CHM
</p>

---

Platinum Reader uses the operating system's own web engine (via [Tauri](https://tauri.app)) instead of bundling a browser, so the installer is small and it starts instantly. There is no splash screen. Rendering runs in a background worker, so very large documents don't freeze the window.

## Features

**Reading**
- Tabs across the top, or vertical tabs on the left (Settings → Layout)
- Right-click a tab: **open in new window**, **split view** (two documents side by side), duplicate, show in folder, close others
- View modes: **continuous scrolling**, **facing pages**, **single page**
- **F11**: distraction-free full screen, one page at a time
- Zoom in/out, fit width, fit page, Ctrl + mouse wheel
- Page box: shows the current page; type a number and press Enter to jump there
- Outline (table of contents) sidebar
- Clickable internal and external links
- History: recent files reopen at the page where you stopped; open tabs come back on the next launch
- **Hold to preview:** press and hold a file for 3 seconds without moving to see its first page; let go and it disappears. Works on tabs and the Recent/History lists, and on Windows also in **File Explorer and on the desktop**. Can be turned off in Settings.

**Find**
- `Ctrl+F`: match case, `n / total` counter, previous/next buttons (`Enter` / `Shift+Enter`)
- All matches are highlighted temporarily, and the current one is shown more strongly

**Text**
- Select text and copy it like on any web page
- A floating menu appears over the selection: **6 highlight colors**, Copy, Search the web, **Ask AI** (ChatGPT, Claude, Perplexity or Google AI Mode)
- Highlights are saved per file. Click one to copy its text or remove it.

**Look and feel**
- Light, dark or system mode, plus 8 accent themes (Platinum, Graphite, Ocean, Forest, Rose, Amber, Violet, Sepia)
- Optional inverted pages for night reading
- Comfortable or compact density, toolbar labels, page gap
- Minimal single-color icons ([Lucide](https://lucide.dev))

**Extensions**
- Built-in: Translate, Dictionary, Word count, Reading progress bar (switch each on or off)
- Add your own `.js` extensions: selection actions, ⋮ menu items, document-open hooks. See [EXTENSIONS.md](EXTENSIONS.md).

**Developer mode** (Settings → Developer)
- Performance overlay (render times, queue, canvases, memory)
- Show the hidden text layer, render quality, parallel page renders
- Open DevTools, copy diagnostics, reset all app data

**Updates**
- Checks GitHub Releases on launch and once a day, and always asks first
- Update in the app (downloads, verifies the SHA-256 checksum, runs the installer), download the installer, or copy a terminal command
- Pause: "Remind me in 7 days", skip a version, or turn automatic checks off

**Help** (⋮ → Help, or `F1`)
- User guide, keyboard shortcuts, check for updates
- **Self-test**: checks the engine, text search, storage, install, default app, the Explorer preview helper and the update server, with a pass/warn/fail report
- **Send feedback / Report a problem**: drafts an email to the developer with subject `Needs Pt. Reader: <topic>`, and saves a diagnostic report (no document contents) and your screenshot to a folder to attach

**System**
- Registers as an "Open with" app for every supported format, so it can be set as the default PDF reader
- Minimal per-type file icons in Explorer (PDF, EPUB, MOBI, FB2, CBZ, CBR, DJVU, XPS, MD, CHM) instead of the app logo
- Single instance: double-clicking another file opens it as a new tab in the running window
- Drag and drop files onto the window
- Print (`Ctrl+P`)

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `Ctrl+O` | Open |
| `Ctrl+N` | New window |
| `Ctrl+W` | Close tab |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Next / previous tab |
| `Ctrl+1…9` | Go to tab |
| `Ctrl+F` | Find |
| `Ctrl+G` | Go to page |
| `Ctrl+B` | Outline sidebar |
| `Ctrl+H` | History |
| `Ctrl+,` | Settings |
| `Ctrl+P` | Print |
| `Ctrl +` / `Ctrl -` / `Ctrl 0` | Zoom in / out / fit width |
| `←` `→`, `PgUp` `PgDn`, `Home` `End` | Navigate |
| `F11` | Full screen (single page) |

## Install

**One command** (downloads the newest release and verifies its checksum):

```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/mishuk-11/platinum-reader/main/install.ps1 | iex
```
```bash
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/mishuk-11/platinum-reader/main/install.sh | sh
```

**Or** download the installer for your system from [Releases](../../releases):

- **Windows:** `Platinum Reader_x.y.z_x64-setup.exe` (about 6 MB). The installer asks: **just for me** (no admin rights) or **all users in Program Files** (admin).
- **Linux:** `.AppImage`, `.deb` or `.rpm`
- **macOS:** `.dmg`

### Make Platinum Reader the default PDF app (Windows)
Right-click any PDF → **Properties** → **Opens with: Change…** → choose **Platinum Reader** → OK.
Or go to *Settings → Apps → Default apps → Platinum Reader* and pick the file types.

## Build from source

Requirements: [Node.js 20+](https://nodejs.org), [Rust](https://rustup.rs), and the platform's [Tauri prerequisites](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run app:dev      # run with hot reload
npm run app:build    # build installers into src-tauri/target/release/bundle
npm test             # unit tests
```

**Windows:** the build uses only open-source tools: Rust's GNU toolchain and [WinLibs](https://winlibs.com) MinGW-w64 (GCC). No Visual Studio needed, no admin rights.

```bash
winget install BrechtSanders.WinLibs.POSIX.UCRT
rustup toolchain install stable-x86_64-pc-windows-gnu
```
Then, in Git Bash, put WinLibs' `mingw64/bin` first on `PATH` and build:
```bash
export PATH="$(ls -d ~/AppData/Local/Microsoft/WinGet/Packages/BrechtSanders.WinLibs*/mingw64/bin):$PATH"
RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-gnu npm run app:build
```
If an old 32-bit MinGW (for example `C:/MinGW/bin`) is on your `PATH`, remove it for the build.

**Linux (Debian/Ubuntu):**
```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf p7zip-full
```
`p7zip-full` (or `chmlib`) is only needed for CHM files.

Pushing a tag like `v0.1.0` runs [.github/workflows/release.yml](.github/workflows/release.yml), which builds Windows, Linux and macOS installers into a draft release.

## How it works

| Part | Library |
|---|---|
| App shell, windows, installers, file associations | [Tauri 2](https://tauri.app) |
| PDF, XPS, EPUB, MOBI, FB2, CBZ, HTML rendering and text | [MuPDF](https://mupdf.com) (WebAssembly) |
| DjVu | [djvu-rs](https://github.com/matyushkin/djvu-rs) |
| CBR (RAR 4/5) | [libarchive](https://libarchive.org) via [libarchive-wasm](https://github.com/ofk/libarchive-wasm) → repacked as CBZ with [fflate](https://github.com/101arrowz/fflate) |
| Markdown | [marked](https://marked.js.org) → paginated by MuPDF |
| CHM | Unpacked by the OS (`hh.exe` on Windows, `7z`/`extract_chmLib` elsewhere) → paginated by MuPDF |
| Icons | [Lucide](https://lucide.dev) |

```
src/
  main.ts            startup, keyboard shortcuts, files from the OS
  app/app.ts         tabs, split view, windows, home screen
  app/viewer.ts      virtualized pages, text layer, highlights, find marks
  app/toolbar.ts     toolbar, page box, zoom, view modes, ⋮ menu
  app/find.ts        find bar
  app/selection.ts   floating selection menu
  app/dialogs.ts     settings, history, properties, about
  app/store.ts       settings, history, highlights (localStorage)
  app/extensions.ts  extension API, built-in extensions
  app/dev.ts         developer mode tools
  app/eggs.ts        a few surprises
  app/peek.ts        hold-to-preview card
  app/updates.ts     GitHub release check
  app/help.ts        help menu, self-test, feedback
  peek-window.ts     preview window for the Explorer helper
  engine/worker.ts   MuPDF + djvu-rs in a Web Worker
  engine/client.ts   talks to the worker
  engine/formats.ts  CBR, Markdown, CHM converters
src-tauri/           Rust: file reading, CLI args, single instance, CHM unpacking, updates
  src/peek.rs        Explorer/desktop hold-to-preview helper (Windows)
```

## Known limits

- **Explorer hold-to-preview** uses a small helper that starts when you sign in (only while the setting is on) and a system-wide mouse hook, so a few antivirus tools may ask about it. It finds the file through Explorer's own API; unusual views (search results, some network or cloud folders) may not show a preview.

- DjVu pages render, but their hidden text layer is not extracted yet, so DjVu text can't be searched or selected.
- Printing renders every page first, so very long documents take a while to prepare.
- Reflowable books (EPUB, MOBI, FB2, Markdown, CHM) are laid out at a fixed A5-like page size.

## Versions

| Version | Codename |
|---|---|
| 0.4.0-beta | Honeybee |
| 0.3.0-beta | Carrotbunny |
| 0.2.0 | FairyRocket (as Quire) |
| 0.1.0 | Cherry Lava (as Quire) |

## License

[AGPL-3.0-or-later](LICENSE), required by MuPDF.

## Author

Developed by **Inzamam Islam** · GitHub [@mishuk-11](https://github.com/mishuk-11)
