# Independent releases and private updates

The supplied Windows build is unsigned. No trusted Windows certificate, Apple
Developer identity, notarization credentials, or private update service was available during this session. No dummy certificate or
embedded token has been substituted. OS warnings must not be disabled globally.

## Local builds

- `npm run build:windows`: Windows x64 ZIP, no administrator install required.
- `npm run build:windows:installer`: per-user NSIS installer, no elevation;
  preserves user data on uninstall. Build on Windows for reliable installer tooling.
- `npm run build:mac`: local macOS ARM64 build.
- `npm run build -- --linux`: Linux packages (build on Linux).
- `scripts/build-windows.cmd`: locked install, unit tests, Windows ZIP from source.

The production renderer is bundled by `npm run bundle`. No network-hosted scripts,
fonts or assets are used. Dependencies are locked in yarn.lock. Native third-party
picker executables have been removed: the screen picker is Chromium's built-in
EyeDropper; the keyboard pixel sampler is entirely shipped JavaScript. There is no
unknown 32-bit helper to rebuild or install, and screenshot sampling works offline.

## Trusted OS signatures

Release configuration: `electron-builder.release.yml` requires code signing and
enables macOS notarization. Run `npm run bundle`, then
`npx electron-builder --config electron-builder.release.yml --publish never` on
an appropriate signing machine. Supply standard builder certificate credentials
through the process environment or the OS certificate store, never in source.
For macOS supply a trusted Developer ID and the Apple notarization credentials.
For Windows use a trusted signing certificate supported by the OS signing tool.
There is no AWS integration. The default local configuration does not sign.

## Private updates: implemented client, not a deployed service

Updates are off by default and never contact TPGi. The optional main-process client
requires all three environment values:
- `CCA_UPDATE_URL`: HTTPS signed-manifest URL.
- `CCA_UPDATE_PUBLIC_KEY`: pinned Ed25519 public PEM key (literal or escaped newlines).
- `CCA_UPDATE_TOKEN`: private service access token, passed only in Authorization.

No token reaches the renderer, report, preferences, archive, or log. Redirects are
rejected. Artifact URLs must stay on the configured HTTPS origin. The manifest is
signed, platform/architecture-bound, expiring, and includes exact size plus SHA-256.
The client rejects downgrades, untrusted signatures, size mismatches and checksums.
Downloads are streamed to a temporary file and renamed only after verification.
They are never executed automatically. The user saves the archive, exits CCA and
extracts the upgrade. This is a verified download flow, not an auto-install updater.

Create signed metadata with `scripts/sign-manifest.cjs`; the private key is read
from `CCA_RELEASE_PRIVATE_KEY_FILE` and is never generated into the repository.
Each platform/architecture needs its own manifest. Publish the signed manifest and
ZIP behind an authenticated HTTPS origin (for example Cloudflare or Google Cloud).
Hosting credentials are deliberately not guessed or provisioned by this task.

## Repository

The private independent repository is https://github.com/csullivan84/cca.
The saved GitHub CLI token returned HTTP 401; repository creation succeeded using
the existing signed-in browser session, and source pushes use existing SSH authentication.
No new credentials were created. The delivery ZIP does not require GitHub access.
