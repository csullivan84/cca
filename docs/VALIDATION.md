# Validation record

Run date: 2026-09-11 (America/Chicago).
Application: CCA 4.0.0. Electron: 44.3.0. Builder: 26.15.3.

## Executed locally

- 34 Node unit tests passed: colour formats, unrounded thresholds, alpha, suggestions,
  reports, bounded state, shortcuts, undo/redo, display bounds and private-update security.
- 12 source Electron UI tests passed on macOS ARM64.
- The same 12 tests passed against the packaged macOS ARM64 app.
- axe WCAG A/AA checks passed for the main view, both dialogs and expanded panels.
- Responsive screenshots at 390, 760 and 1100 pixels inspected; no horizontal overflow.
- 200% zoom reflow and forced-colour/reduced-motion checks passed.
- Screenshot pixel movement/application, focus restoration, exports, preferences,
  CSS Color 4, alpha, favourites and shortcut conflicts tested.
- Sandbox, no renderer Node, no generic IPC, sender validation, blocked popup/network
  requests and invalid payload rejection tested.
- Screen-picker success/cancellation tests use a deterministic EyeDropper test double;
  they test integration/focus behavior, not native OS picking or permission dialogs.
- Windows x64 directory cross-build succeeded; PE architecture and application version
  resources inspected. This does not by itself prove native Windows execution.
- Fresh Yarn lockfile audit: zero known vulnerabilities across 299 resolved dependencies.
  Some builder-only packages have upstream deprecation notices; no major-version shims
  were introduced. Audit results are a dated snapshot, not a security guarantee.

## Cross-platform CI

A manual GitHub Actions run was dispatched for Windows, macOS and Linux.
Final outcome is recorded below after the run completes.

## Remaining external validation/release limits

- Actual NVDA and VoiceOver speech sessions have not been run; automated accessibility
  checks and role/name/focus tests cannot certify a screen-reader experience.
- Native screen picking and multi-monitor mixed-DPI hardware behavior need target devices.
- No trusted Windows signing certificate or Apple Developer/notarization identity was
  available. Local builds are unsigned; the release configuration intentionally fails
  without signing credentials.
- Private update client and signing tools are implemented/tested, but no update service
  has been provisioned. No credentials are placed in source or the ZIP.

## Reproduce

- `npm test`
- `npm run test:ui`
- Package with `npm run build -- --dir`.
- Set `CCA_TEST_EXECUTABLE` to the packaged application executable, then `npm run test:ui`.
- Linux UI tests require a graphical session, or `xvfb-run --auto-servernum` in CI.

Sources consulted:
- https://releases.electronjs.org/
- https://www.electronjs.org/docs/latest/breaking-changes
- https://www.electronjs.org/docs/latest/tutorial/security
- https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- https://culorijs.org/api/
