# Implementation Plan: Glass Styling Across All Home Screen Widget Families

## 1. Objective & Scope

- **Goal:** Extend the medium-only Club Hub widget to small, medium, large and extraLarge (iPad) Home Screen families, each with a layout that fits its space, all sharing the translucent glass-style treatment and the same data layer.
- **In Scope:**
  - Family dispatch from `config.widgetFamily` (with a dev override via `args.widgetParameter`).
  - Four layouts: small, medium (existing two rows), large, extraLarge.
  - Shared glass helpers (translucent base, diagonal gradient, rounded panels) applied consistently, scaled per family.
  - Family-correct previews in the Scriptable app (`presentSmall`/`presentMedium`/`presentLarge`/`presentExtraLarge`).
  - `tools/widget-lab.js --family <name>` with family-specific assertions and preview dimensions.
  - README and AGENTS.md updates.
- **Out of Scope:**
  - Lock Screen accessory families (`accessoryInline`, `accessoryCircular`, `accessoryRectangular`). If `config.runsInAccessoryWidget` is somehow true, render the small layout as a safe fallback rather than a blank widget.
  - True Apple Liquid Glass APIs (unavailable in Scriptable); iOS 26 applies it at system level.
  - New data sources, new API calls, or changes to caching/fallback logic.

## 2. Resolved Design Decisions & Edge Cases

- **Families (Q1A/3C):** small, medium, large, extraLarge only. Accessories are excluded; `addAccessoryWidgetBackground = true` may be set defensively, but no accessory-specific layout is built.
- **Layouts (Q2A):**
  - *small* (~158×158): compact next-match card — two 32×32 crests, `NEXT`, opponent code, relative countdown; bottom compact last score + 15px form blocks.
  - *medium* (~322×148): unchanged two-row layout with 40×40 next crests and 24×24 last-match crests.
  - *large* (~338×354): expanded two-panel layout — 56×56 next crests, larger score/countdown, full last-match row with 40×40 crests and names, form row.
  - *extraLarge* (~502×354, iPad): two-column grid — next-match panel on the left, last-match/form panel on the right, extra breathing space.
- **Glass:** one `applyGlass(widget)` helper sets `backgroundColor` to translucent `#1a1a1a`, a two-stop `LinearGradient`, and a faint highlight; `glassPanel(panel, padding)` handles panel fill/corner radius. Large/extraLarge use slightly larger corner radii. Text stays high contrast for legibility under iOS 26 system glass.
- **Family detection:** `const family = (args.widgetParameter is a known family) ? args.widgetParameter : (config.widgetFamily || 'medium')`. This keeps the widget usable in the app (where `widgetFamily` is `null`) while letting developers preview any family by setting the widget parameter.
- **Preview safety:** `config.runsInApp` calls the matching `present*` method; `presentExtraLarge()` is iPad-only, so wrap previews in try/catch and fall back to `presentMedium()`.
- **Failure states:** kept per family (sample/cached/no-fixture); empty state reuses a family-scaled badge. No code path may leave a blank widget.
- **Data layer:** unchanged — all families consume the same normalized `{ last, next, form, hint }` model; images are loaded once and shared across layouts.

## 3. Execution Tasks (Vertical Slices)

- [ ] **Task 1: Family dispatch and shared glass helpers**
  - **Files:** `index.js`
  - **Details:** Add `resolveFamily()`, `applyGlass()` and a parameterized `glassPanel()`; rename current `buildWidget` body to `buildMedium()` and add a `buildWidget(model, family, images)` dispatcher. Set `refreshAfterDate` in one place. Keep empty-state handling per family.
  - **Acceptance Criteria:** Selecting `medium` produces the exact current widget; an unknown family falls back to medium; syntax check passes.

- [ ] **Task 2: Small and large layouts**
  - **Files:** `index.js`
  - **Details:** Implement `buildSmall()` and `buildLarge()` using shared helpers; small uses 32×32 next crests and a compact bottom strip; large uses 56×56 next crests, 40×40 last crests with names, larger typography, and a form row.
  - **Acceptance Criteria:** Previewing each family shows the intended hierarchy with no clipped text and all glass surfaces applied.

- [ ] **Task 3: extraLarge layout and preview routing**
  - **Files:** `index.js`
  - **Details:** Implement `buildExtraLarge()` as a two-column panel grid; update `run()` to call the family-specific `present*()` in app previews with try/catch fallback; pass family through the error fallback path.
  - **Acceptance Criteria:** extraLarge renders only on iPad-compatible previews without error; other families preview correctly; fatal-error fallback still renders a glass widget.

- [ ] **Task 4: Test lab multi-family support**
  - **Files:** `tools/widget-lab.js`
  - **Details:** Add `--family <small|medium|large|extraLarge>` (default medium); set `config.widgetFamily` and `args.widgetParameter` accordingly; per-family assertions (badge counts/sizes, glass gradient, family labels) and HTML card dimensions; update `--json` output with the family. Keep existing scenario flags working for every family.
  - **Acceptance Criteria:** Lab passes all 19+ invariants for each family; HTML preview dimensions match the family; unknown `--family` exits with a clear error.

- [ ] **Task 5: Documentation**
  - **Files:** `README.md`, `AGENTS.md`
  - **Details:** Document supported families, sizing, family override via widget parameter, `--family` lab usage, and the exclusion of Lock Screen accessories / true Liquid Glass.
  - **Acceptance Criteria:** Docs match the released behavior and mention how to preview each family.

## 4. Verification & Rollback Plan

- **Automated Tests:** Run `node tools/widget-lab.js --family <family>` for all four families, plus `--no-key`, `--api-error`, `--crest-fail` with a live-like injected `fetch`; `node --check index.js`.
- **Manual Check:** In Scriptable on macOS, run the script with widget parameter `small`, `medium`, `large` (and `extraLarge` on iPad) to preview each family; confirm glass styling, legibility and no clipping. Final visual approval remains in Scriptable.
- **Rollback:** All changes are additive/refactored within `index.js` and the tool/docs; a single git revert restores the medium-only widget. No cache migration is needed — the data model is unchanged.
