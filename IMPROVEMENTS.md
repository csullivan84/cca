# Proposed next 32 improvements

These are proposals, not implemented features. Electron 44.3.0 migration is separate.
Based on inspection of the supplied 3.5.5 code; prioritize accessibility, correctness,
and safe desktop boundaries before adding advanced analysis.

## Accessibility and everyday use

1. Announce contrast changes through a debounced live region, without speech flooding.
2. Add one keyboard command to read foreground, background, ratio, and pass/fail together.
3. Run and document VoiceOver and NVDA regression checks for every dialog and picker.
4. Restore focus to the invoking control after help, sliders, dialogs, and picker cancellation.
5. Add inline invalid-colour errors with aria-invalid and linked error descriptions.
6. Make windows resizable and layouts reflow at large text and zoom levels.
7. Audit forced-colour/high-contrast support and visible keyboard focus across themes.
8. Add user-configurable shortcuts with conflict detection and an accessible shortcut reference.
9. Provide spoken picker instructions, Escape cancellation, and clear permission-denied feedback.
10. Add undo/redo for colour changes, including swaps and slider adjustments.
11. Keep a searchable recent-pair history with an explicit clear-history action.
12. Save named favourite pairs and collections.

## Analysis and reporting

13. Add contrast regression vectors around 3:1, 4.5:1, and 7:1; never judge rounded ratios.
14. Add alpha-compositing tests with explicit effective-colour explanations.
15. Audit WCAG 2.2 wording and link each result to the relevant criterion and assumptions.
16. Suggest the nearest passing colour while allowing either colour to remain locked.
17. Preview font size and weight with clear large-text eligibility explanations.
18. Import palettes and evaluate all foreground/background combinations.
19. Export accessible HTML, plain text, JSON, and CSV reports.
20. Accept modern CSS colour syntax with explicit out-of-gamut handling.
21. Add screenshot import and keyboard-navigable pixel sampling.
22. Explain colour-vision simulations as approximations rather than compliance guarantees.

## Security and reliability

23. Replace renderer Node access with narrow preload APIs and enable context isolation/sandboxing.
24. Validate IPC senders and payloads; replace the arbitrary store-method dispatcher with an allowlist.
25. Add a strict content security policy and block unexpected navigation in every window.
26. Fix language-change handling: the main-process callback currently references this.store incorrectly.
27. Add Linux support for dialogs currently restricted to macOS and Windows.
28. Recover off-screen windows after display changes and test mixed-DPI monitor movement.
29. Make native picker helpers reproducible from source and test Apple Silicon/Windows architectures.
30. Add unit, integration, and packaged-app tests across all supported operating systems.
31. Modernize remaining dependencies and builder tooling with lockfile checks and vulnerability triage.
32. Establish independent signed/notarized releases and authenticated private updates, without AWS or embedded tokens.

## Migration baseline

- Electron upgraded from 35.7.5 to 44.3.0, exact version and Yarn lockfile.
- README credits TPGi / The Paciello Group, Cédric Trévisan, and original contributors.
- Fresh local Git history; no upstream Git history or GitHub fork operation.
- Upstream update checks disabled, publisher/release endpoints removed, inherited AWS signing removed.
- Separate application ID and user-data directory to avoid overwriting upstream preferences.
- Updated window-open handler, context-menu options, and clipboard rejection handling.
- Manual-only build workflow prevents automatic CI expenditure on the first push.

Sources checked on 2026-09-11:
- Latest stable: https://releases.electronjs.org/
- Migration/platform requirements: https://www.electronjs.org/docs/latest/breaking-changes

Electron 44 requires macOS 13+ and drops 32-bit Electron builds.
Native picker interaction, assistive technology behavior, Windows/Linux execution,
and signed installers still require manual/platform validation.
