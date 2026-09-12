# Implementation status — CCA 4.0.0

The Electron 44.3.0 upgrade is separate from the 32 items below. Implementations
are in the source and exercised by automated tests where stated. External
certification/assistive-technology limits are stated explicitly rather than counted
as completed validation.

1. Implemented: debounced, atomic live-region contrast announcements (650 ms).
2. Implemented: Alt+R reads the pair, ratio, and all five pass/fail results.
3. Automated accessibility/keyboard regression suite implemented and run, including
   both dialogs, expanded panels, labels, focus, and reflow. Actual NVDA/VoiceOver
   speech output has not been certified; automated axe checks are not equivalent.
4. Implemented: dialog, picker and expanded-panel focus restoration and Escape handling.
5. Implemented: visible, linked invalid-colour messages and aria-invalid.
6. Implemented: resizable windows, responsive reflow, and zoom support.
7. Implemented: forced-colour/system/light/dark styles, keyboard outlines and text statuses.
8. Implemented: configurable shortcuts, canonicalization, reserved-key and conflict validation.
9. Implemented: picker instructions, cancellation, failure feedback and screenshot fallback.
10. Implemented: bounded undo/redo, including sliders, swaps, picked and loaded pairs.
11. Implemented: searchable, persistent 100-pair history with explicit clear.
12. Implemented: named favourites/collections (up to 200), search and deletion.
13. Implemented: unrounded threshold decisions and regression vectors at 3, 4.5 and 7.
    Fixed the upstream three-decimal pre-classification rounding defect.
14. Implemented: foreground/background alpha compositing, effective-colour explanation,
    white backdrop disclosure, and unit tests.
15. Implemented: WCAG 2.2 criterion links, large-text thresholds and scope/exception wording.
16. Implemented: passing-colour search preserving either locked colour and opacity.
    Searches 2,050 black/white-blend candidates by OKLab distance; it is not a
    mathematical global nearest-colour solver and says so in the UI.
17. Implemented: font size/weight preview and large-text eligibility explanation.
18. Implemented: bounded palette import (text/JSON) and all ordered pair combinations.
19. Implemented: HTML, text, JSON and CSV exports; generated from validated colours.
20. Implemented: Culori CSS Color 4 parsing, original HSV input, explicit sRGB clipping.
21. Implemented: PNG/JPEG import, bounded decode, keyboard/click/coordinate pixel sampling.
22. Implemented: eight simulations with approximation and non-conformance warnings.
23. Implemented: Node-free sandboxed renderer, context isolation, narrow preload API.
24. Implemented: sender/main-frame checks, fixed IPC methods and bounded validated payloads.
25. Implemented: strict script CSP, local custom protocol, denied popups/navigation/permissions.
    Dynamic colour styles alone permit inline style attributes; scripts never do.
26. Fixed by replacing the broken this.store language callback with validated settings
    and safe translation lookup; French language switching is regression tested.
27. Implemented: shared accessible dialogs on all platforms; no Linux platform exclusion.
28. Implemented: persisted bounds and on-display-change recovery in logical coordinates;
    tests cover disconnected displays, negative origins and small work areas.
29. Replaced opaque native helpers with Chromium EyeDropper plus shipped JavaScript
    screenshot sampling. No 32-bit picker executable or unreproducible native helper
    remains. Native screen-picker behavior still depends on OS/Chromium permissions.
30. Implemented: unit, source UI, packaged-app, accessibility, security and CI tests.
    Exact executed platforms/results are in docs/VALIDATION.md.
31. Implemented: builder/dependency modernization, exact direct versions, fresh frozen
    Yarn lockfile and audit. The checked lockfile had zero known audit findings.
32. Implemented: fail-closed signed-release configuration and opt-in authenticated,
    Ed25519-verified private update downloads with origin/size/hash/expiry checks.
    No trusted OS signing certificates or update hosting were supplied: the delivered
    build is unsigned; signed/notarized releases and a live update service are not deployed.

## Extra Windows improvements

33. Portable runtime and launch script: no Node/Git/login/admin needed, paths with spaces
    supported, optional adjacent data folder, safe per-user fallback and single-instance activation.
34. Per-user installer configuration preserves data and disables elevation; source-build
    command script and Excel-friendly BOM/CRLF CSV simplify Windows workflows.

## Repository and licensing

- Private independent GitHub repository: https://github.com/csullivan84/cca
- Fresh Git root, no GitHub fork or imported upstream commit ancestry.
- README credits TPGi, Cédric Trévisan and original contributors; GPL preserved.
- Existing browser sign-in and SSH authentication avoided the invalid GitHub CLI token.
- No AWS, new credentials, or upstream updater/publisher targets.
