# Implementation Plan: Two-Row Glass Widget Redesign

## 1. Objective & Scope

- **Goal:** Redesign the medium Club Hub widget into two rows — next match with an auto-updating relative countdown on top, last match result plus recent form below — with a translucent "glass-like" visual treatment, while keeping the existing data/fallback architecture.
- **In Scope:**
  - New next-fixture fetch from football-data.org (`/v4/teams/86/matches?status=SCHEDULED&limit=1`) with local filtering/caching fallbacks.
  - `WidgetDate.applyRelativeStyle()` countdown ("2 days, 5 hours") that updates periodically without re-running the script.
  - Two-row medium layout: top = next opponent, kickoff/countdown, 40×40 crests; bottom = last result score, opponent code, five W/D/L form squares.
  - Glass approximation: translucent backgrounds, subtle white highlight gradient, rounded panels, reduced opaque fill so iOS 26 system glass/clear tint can show through.
  - Updated fallback/sample data for both rows (no next fixture, no last match, API/cache failures).
  - Updated `tools/widget-lab.js` stubs, assertions and HTML preview CSS; updated `README.md` and `AGENTS.md`.
- **Out of Scope:**
  - True Apple Liquid Glass (`glassEffect`, materials, refraction, accented-rendering-mode APIs) — Scriptable exposes none of these; iOS 26 applies system glass itself.
  - Small/large/Lock Screen widget families, tap targets, RSS/news, live minute countdown.
  - Changing the API provider or credentials model.

## 2. Resolved Design Decisions & Edge Cases

- **Size (Q1A):** medium only, two compact rows. The PRD's 40×40 crest constraint is kept for the top (next-match) row; the bottom row uses text plus form squares so it fits without a second pair of large crests.
- **Countdown (Q2B):** use `widget.addDate(kickoff).applyRelativeStyle()` — output like "2 days, 5 hours". `WidgetDate` refreshes periodically on its own; no per-second timer and no widget rerun required. Fall back to "Kickoff TBD" when `utcDate` is missing or already past.
- **Next match (Q3A):** fetch `/v4/teams/86/matches?status=SCHEDULED&limit=1` as a third request. If it returns nothing, scan the cached/unfiltered match list for the first entry with a future `utcDate`. If still nothing, render an explicit "No fixture scheduled" top row. Cache the next match alongside the existing last-match payload with a backward-compatible shape (old caches without `next` are valid).
- **Refresh timing:** keep the 30-minute `CACHE_TTL_MS` for data, but when the next kickoff is sooner than the TTL, set `refreshAfterDate` to just after kickoff so the widget transitions from countdown to result promptly.
- **Glass look (Q4A):** base `backgroundColor` becomes translucent (e.g. `#1a1a1a` at ~0.62 alpha), with a subtle `LinearGradient` white-to-clear highlight and rounded, semi-transparent panel stacks. Text remains high-contrast white/gold so legibility survives on varied wallpapers; no attempt to fake real blur/refraction. Research confirmed: in iOS 26 the system replaces widget backgrounds with glass in clear/tinted Home Screen modes and Scriptable cannot read `widgetRenderingMode` or apply `.glassEffect()`.
- **Failure modes:** invalid token → "Set API token" hint in the header; API down → cached last/next with "Last match" hint; no cache → sample data with generated future kickoff; crest failure → existing 3-letter initials badge; empty form → five neutral `D` placeholders as today.
- **Data shape:** the internal render model gains `next` (opponent team, kickoff `Date`/ISO string, home/away flag) and `last` (existing score/status/home/away/form). The old flat fields remain during migration so the test lab and caches don't break mid-change.

## 3. Execution Tasks (Vertical Slices)

- [ ] **Task 1: Fetch and normalize the next fixture**
  - **Files:** `index.js`
  - **Details:** Add `fetchNextMatch(apiKey)` calling `status=SCHEDULED&limit=1`; parse `utcDate`, `homeTeam`/`awayTeam`, `tla`, `crest` via existing `teamModel`/`pngCrest`; derive `opponent`, `isHome`, `kickoff`. Extend cached payload with `next`; add fallback scan of cached matches for a future `utcDate`. Add a `sampleModel()` factory that generates a future kickoff at runtime.
  - **Acceptance Criteria:** With live data the normalized model contains a future kickoff and correct opponent; with an empty SCHEDULED response the top row falls back cleanly; old cache files (no `next`) still load without throwing.

- [ ] **Task 2: Countdown element and refresh scheduling**
  - **Files:** `index.js`
  - **Details:** In the top row add `const countdown = stack.addDate(new Date(model.next.kickoff)); countdown.applyRelativeStyle();` styled with a readable font and gold/muted color. Compute `refreshAfterDate` as described in §2. Handle missing/past kickoff with a static "Kickoff TBD" label instead of a `WidgetDate`.
  - **Acceptance Criteria:** Preview shows a relative countdown string; no countdown is rendered for past/missing kickoffs; `refreshAfterDate` is a valid future Date in both normal and near-kickoff cases.

- [ ] **Task 3: Two-row UI redesign with glass approximation**
  - **Files:** `index.js`
  - **Details:** Replace `buildWidget` with: translucent base background + subtle gradient sheen; compact header ("REAL MADRID" + state hint); top rounded panel with two 40×40 crests, opponent code, `NEXT` label and countdown; bottom rounded panel with `LAST` label, last score/status and the five form squares. Keep all text high contrast and escape-free; use existing helpers where possible.
  - **Acceptance Criteria:** `presentMedium()` shows two distinct rows, countdown under/next to the opponent, last result and form below, two 40×40 crests total, no clipped text, translucent panels visible over a wallpaper on iOS 26.

- [ ] **Task 4: Update the local test lab**
  - **Files:** `tools/widget-lab.js`
  - **Details:** Add `applyRelativeStyle`/other style methods to the `WidgetDate` stub; teach assertions and JSON output to find the date node and the new labels (`NEXT`, `LAST`, countdown); assert two 40×40 badges, five form blocks, translucent background alpha, and the third API endpoint; update the HTML renderer to draw the new panels/rows and the countdown text. Keep assertions invariant-based (live data varies).
  - **Acceptance Criteria:** All scenarios (`--no-key`, `--api-error`, `--crest-fail`, live-like) pass with the new layout; HTML preview mirrors the two-row design; `--json` reports next opponent, countdown, last score and form.

- [ ] **Task 5: Documentation and cleanup**
  - **Files:** `README.md`, `AGENTS.md`
  - **Details:** Describe the two-row layout, relative countdown, next-match endpoint, free-tier caveat, and the fact that true Liquid Glass is system-controlled in iOS 26 while the widget only approximates the look. Update conventions for the new model fields.
  - **Acceptance Criteria:** Docs match the released behavior; no stale references to a single scoreline row.

## 4. Verification & Rollback Plan

- **Automated Tests:** `node tools/widget-lab.js --no-key`, `--api-error`, `--crest-fail`, and a live-like run (injected fake `fetch` from `/tmp` with SCHEDULED/LIVE/FINISHED responses) — all checks PASS, including the new next-match and countdown assertions. `node --check index.js` for syntax.
- **Manual Check:** Open `.cache/widget-preview.html` via `./tools/view-widget.sh` and confirm the two-row hierarchy, glass translucency, gold status and five form colors; then run `index.js` in Scriptable on macOS with `presentMedium()` and compare. Verify with an iOS 26 device in both light/dark and clear/tinted Home Screen modes that text stays legible.
- **Rollback:** All changes are in `index.js` plus the tool/docs files; git can revert this commit as a unit. Cached match JSON gains an optional field and remains backward compatible, so no user-side cache reset is required.
