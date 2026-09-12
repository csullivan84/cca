# CCA — independent Colour Contrast Analyser

An offline-first, keyboard-accessible colour contrast workbench for Windows,
macOS and Linux. Electron 44.3.0; application version 4.0.0.

## Windows: no developer tools required

Download/extract the entire `cca.zip`, then run `Start CCA.cmd` or
`windows/CCA.exe`. Do not run the EXE from inside the ZIP or move it away from
its DLLs and resources. Node.js, Git, GitHub login and administrator installation
are not required. The included Windows build is x64 and unsigned.

A `portable.txt` marker beside the EXE keeps preferences, history and favourites
in `windows/data/`. Remove the marker before launching to use the per-user
application-data folder instead. If the portable folder is not writable, CCA
falls back to per-user storage. Back up the data folder before replacing a build.

Two extra Windows conveniences:
- Portable launch and a source-build `.cmd` script handle paths with spaces.
- Optional per-user NSIS installation needs no elevation and preserves user data.

Windows x64 is the delivered binary target. Native Windows ARM64 is not included.
The source also builds for macOS 13+ and Linux. See [release notes](docs/RELEASES.md).

## Workbench

- Exact WCAG 2.2 contrast decisions, with rounding only for display.
- Modern CSS colour input, alpha compositing, RGB/HSL/HSV sliders and colour swapping.
- Debounced screen-reader announcements, a read-result shortcut, keyboard navigation,
  focus restoration, high-contrast support and zoom/reflow.
- Undo/redo, recent history, named favourites and collections.
- Passing-colour suggestions that preserve the locked colour and opacity.
- Font-size/weight previews and eight colour-vision simulations.
- Palette import/batch analysis and HTML, text, JSON or Excel-compatible CSV export.
- Built-in screen picker and a keyboard-navigable screenshot pixel sampler.
- Sandboxed renderer, validated IPC, restricted navigation and offline defaults.

Default shortcuts while CCA has focus:
- Alt+R: read the full contrast result.
- F11 / F12: pick foreground / background.
- Alt+S: swap colours.
- Alt+Z / Alt+Y: undo / redo a colour change.
- Alt+C: copy the report.
- F1: About. Ctrl+, (Command+, on Mac): preferences.
- Escape: dismiss a dialog, picker or expanded section and restore focus.

All workbench shortcuts can be changed in Preferences. Screen-picker keyboard
behavior depends on Chromium/platform support; the screenshot sampler supports
explicit X/Y coordinates, arrows, Shift+arrows, Enter and Escape on every platform.

Original translations remain available for existing labels; new workbench copy
currently falls back to English. Simulations are approximations, not compliance
guarantees. These results assess contrast, not full accessibility conformance.

## Attribution and license

This repository was independently initialized from the supplied 3.5.5 source archive of
[The Paciello Group / TPGi’s Colour Contrast Analyser](https://github.com/ThePacielloGroup/CCAe).
Credit belongs to TPGi, Cédric Trévisan, and all original contributors. This is not
an official TPGi release and is not a GitHub fork. Original icons, translations,
license and historical change notes are retained.

GPL-3.0-or-later. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).
Source accompanies the delivery ZIP. The software is supplied without warranty.

Private development repository: https://github.com/csullivan84/cca

## Build and test

Node.js 22+ and a desktop session are needed for source builds/UI tests, not for
running the bundled Windows application.

```sh
npx --yes yarn@1.22.22 install --frozen-lockfile --non-interactive
npm test
npm run test:ui
npm start
npm run build:windows
```

- Windows source helper: `scripts/build-windows.cmd`.
- `npm run build:windows:installer` creates the per-user installer.
- CI is manually triggered to avoid unwanted build usage on every push.
- Private updates are opt-in, signature-verified downloads; no credentials are embedded.
- OS signing/notarization and a private update service require trusted external identities.

See [implementation status](IMPROVEMENTS.md), [validation](docs/VALIDATION.md),
and [release/security configuration](docs/RELEASES.md).
