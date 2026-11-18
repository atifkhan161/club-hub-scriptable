# Implementation Plan: Club Hub — Real Madrid Matchday Widget (V1)

## 1. Objective & Scope

- **Goal:** Build the V1 Scriptable widget described in `docs/product_requirements_document_prd.md`: a dark-themed, medium-size home-screen widget showing Real Madrid's current/last match scoreline, both team crests, match status, and a five-match form indicator.
- **In Scope:**
  - A single self-contained `index.js` Scriptable script.
  - API-Football integration for fixture data (live or most recent final), with API key stored in Scriptable `Keychain`.
  - Recent form derived from the API-Football "last 5 fixtures" endpoint.
  - Async crest loading with `FileManager` disk caching and a 3-letter initials fallback.
  - Medium widget UI: `ListWidget` with 15pt padding, nested horizontal/vertical `WidgetStack`s, 40×40 badges, gold status accent, five form squares.
  - Graceful degradation: last cached match → bundled sample match → clean "No fixture" state; never a blank/crashed widget.
  - `refreshAfterDate` to set the earliest acceptable refresh; manual preview validation in Scriptable on macOS.
- **Out of Scope (per PRD §8 and agreed decisions):**
  - Small/large/extra-large and Lock Screen accessory widget variants.
  - RSS feeds (Managing Madrid), tap-to-open highlights, deep links.
  - Custom opponent selection, multi-team support, Server-side backend.
  - SVG crest rendering (Scriptable `Image` cannot reliably render SVG — PNG only).

## 2. Resolved Design Decisions & Edge Cases

- **Data source (Q1A):** API-Football v3 (`https://v3.football.api-sports.io`). Auth via `x-apisports-key` header. Real Madrid team ID `541`. Two endpoints per refresh: `/fixtures?team=541&last=5` (form + latest finished match) and `/fixtures?team=541&next=1` (live/upcoming candidate). Select the live fixture if its status is in-progress; otherwise use the latest finished fixture from the first response.
- **Credentials (Q1A, Q3A):** Key stored under a constant key name in `Keychain`, never hardcoded. When the script runs in the app (`config.runsInApp`) and no key exists, offer an `Alert` + `TextField` setup prompt to save it. Missing/invalid key must not crash the widget; fall back to cached/sample data with a subtle "Set API key" hint.
- **Widget family (Q2A):** Medium only. Preview with `widget.presentMedium()`. No family branching in V1 — the same layout is built regardless of `config.widgetFamily`.
- **Team placement (Q3A):** Detect home/away from `fixture.teams.home.id === 541`. Render Real Madrid on the side the API says it occupies; score and abbreviation positions follow the same orientation. Never hardcode RMA to the left.
- **Failure states (Q4A):** Priority order: (1) fresh API response → (2) cached `match.json` within TTL (stale labeled "Last match") → (3) bundled `SAMPLE_MATCH` constant (labeled "Sample data") → (4) clean club-branded "No fixture scheduled" state. API errors must be caught per-request so one failed endpoint doesn't discard the other's data.
- **Recent form (round 2, Q1A):** Derive from `/fixtures?team=541&last=5`: for each finished fixture, compare home/away goals against team 541 → `W`/`D`/`L`; emit array oldest→newest (PRD example `["W","W","D","W","L"]`). Cache with the match payload.
- **Crest images (round 2, Q2A):** Use API-provided PNG `logo` URLs only. Cache to disk with `FileManager` (24h TTL, keyed by team ID). On any load failure render a styled 3-letter initials square (same 40×40 footprint) using the team's `code` field when available, else a small known-team map, else the first three uppercase letters of the name.
- **Status mapping (round 2, Q4A):** `1H`/`2H` → `elapsed'`, `HT` → `HT`, all finished states (`FT`, `AET`, `ET`, `PEN`) → `FT`, scheduled/postponed (`TBD`, `PST`) → short label. Use `goals.home/away` for live score and `score.fulltime.home/away` for finished matches.
- **Design tokens (PRD §6):** Background `#1a1a1a`, gold `#f1d382` for status, form colors `#2ecc71` / `#95a5a6` / `#e74c3c`, system fonts (`Font.boldSystemFont` for score, `Font.semiboldSystemFont` for labels).
- **Architecture:** One `index.js` at repo root. No build step, no package manager, no README (per choice 5A); setup/deployment notes live in a header comment and in `AGENTS.md`.
- **Scriptable constraints:** No DOM/`fetch`/`setTimeout`; use `Request`, `Timer`, Promises. Top-level `await` must be wrapped in an async IIFE. Always call `Script.setWidget(widget)` and `Script.complete()` on both success and failure paths. Widget processes are memory-constrained — bound image sizes and catch decode errors. OS controls actual refresh timing; `refreshAfterDate` only sets the earliest date.

## 3. Execution Tasks (Vertical Slices)

- [ ] **Task 1: Script skeleton, constants, and themed placeholder widget**
  - **Files:** `index.js`
  - **Details:** Add header comment (setup: API key, where to paste, refresh behavior). Declare constants: `TEAM_ID = 541`, `API_BASE`, `KEYCHAIN_KEY`, `CACHE_TTL_MS` (30 min), `CREST_TTL_MS` (24 h), colors (`BG`, `GOLD`, `FORM_COLORS`), `SAMPLE_MATCH`. Add async IIFE with `try/catch/finally` calling `Script.setWidget()` and `Script.complete()`. Build a minimal `ListWidget` with `backgroundColor`, `setPadding(15, 15, 15, 15)`, and a centered placeholder text.
  - **Acceptance Criteria:** Running the script in Scriptable on macOS with `await widget.presentMedium()` shows a dark, correctly padded medium widget; console shows no errors; `Script.complete()` is reached on both paths.

- [ ] **Task 2: API client, data normalization, and JSON cache**
  - **Files:** `index.js`
  - **Details:** Implement `getApiKey()`/`setupApiKey()` using `Keychain`, `Alert`, `TextField` (setup only when `config.runsInApp`). Implement `fetchJson(path)` with `Request`, `headers = { "x-apisports-key": key }`, timeouts, and `try/catch`. Fetch both fixture endpoints; normalize into `{ home, away, score, status, isLive, form, fetchedAt }` using the mapping rules in §2. Derive abbreviations via `team.code` → small known-team map → first 3 uppercase letters. Cache with `FileManager.local()` under `cacheDirectory()/club-hub/match.json` using `writeString`/`readString` and `modificationDate`; implement `loadCachedMatch()` and TTL checks. Detect missing/invalid key (HTTP 401/403) and set `needsSetup` flag.
  - **Acceptance Criteria:** In the app, console logs a normalized object with correct home/away, score, status, and a 5-element form array; with an invalid key the script logs a handled auth error and still renders the widget; after a successful fetch, disabling network and re-running loads the cached payload.

- [ ] **Task 3: Async crest loading with disk cache and initials fallback**
  - **Files:** `index.js`
  - **Details:** Implement `loadCrest(team)` → `Image`: build cache path from team ID; on hit with fresh `modificationDate` use `Image.fromFile(path)`; otherwise `new Request(url).loadImage()` then `fm.writeImage(path, img)`. Wrap in try/catch; on failure return `null` and have the UI render the initials fallback. Use `new Size(40, 40)` and `resizable = true` on the `WidgetImage` so badges can't stretch.
  - **Acceptance Criteria:** With network available, both crests render at exactly 40×40; after first load, a second run uses the cache (no visible delay); with a deliberately broken logo URL, a 40×40 initials square renders in its place and the widget still completes.

- [ ] **Task 4: Widget UI assembly (PRD layout)**
  - **Files:** `index.js`
  - **Details:** Replace the placeholder with the full tree: root `ListWidget` (`bg #1a1a1a`, padding 15, `spacing` tuned); top `WidgetStack` in horizontal layout with nested vertical stacks for each side: `[crest 40×40] [abbr label]`, a flexible spacer, centered vertical stack with score (`Font.boldSystemFont(34)`) and status (`Color('#f1d382')`, `Font.semiboldSystemFont(12)`), another flexible spacer, then opponent side. Bottom horizontal stack of five 16×16 `WidgetStack` form squares with `backgroundColor` from `FORM_COLORS`, small `cornerRadius`, and optional single-letter glyph. Apply `widget.refreshAfterDate = new Date(Date.now() + CACHE_TTL_MS)` and optionally `widget.url` only if a future tap target is desired (PRD says out of scope — leave unset in V1).
  - **Acceptance Criteria:** `presentMedium()` shows: centered scoreline, status directly beneath in gold, crests constrained to 40×40, abbreviations correct for home/away as reported by the API, and five evenly spaced form blocks in W/D/L colors. Visually matches PRD §4–§6.

- [ ] **Task 5: Fallback states and key setup flow**
  - **Files:** `index.js`
  - **Details:** Wire the §2 fallback chain into the render path. Add a small status label ("Last match" / "Sample data" / "No fixture scheduled" / "Set API key") using a subdued color so failure states are explicit but not alarming. Implement the app-only key setup `Alert` with a secure `TextField`, saving via `Keychain.set()` and confirming with a success `Alert`. Ensure no code path can throw before `Script.setWidget()`.
  - **Acceptance Criteria:** With no key and no cache, the sample-data state renders with the hint; with an invalid key, no crash; with a key removed but cache present, the cached match renders labeled "Last match"; running in the app with no key offers the setup prompt and persists the entered key.

- [ ] **Task 6: Hardening, documentation comment, and final verification**
  - **Files:** `index.js`, `AGENTS.md` (if a convention needs clarifying)
  - **Details:** Review all `await`s and error handlers; confirm no unbounded image sizes or retained large `Data` objects; confirm `refreshAfterDate` and cache TTLs agree; finalize header comment with setup steps, rate-limit note (API-Football free tier is limited — adjust TTL if quota is exceeded), and deployment instructions (iCloud Drive Scriptable folder or paste into the app). Run a syntax check if Node is available (`node --check index.js`).
  - **Acceptance Criteria:** Script passes syntax check; a final `presentMedium()` preview looks correct for live, final, cached, and no-data states; working tree changes are reviewed and committed.

## 4. Verification & Rollback Plan

- **Automated Tests:** None — the repo has no test runner and no build system. Optional lightweight check: `node --check index.js` for syntax only (Scriptable globals are unavailable under Node). Data-shaping can be sanity-checked by logging normalized objects to `console` in the app.
- **Manual Check (Scriptable on macOS):**
  1. Install/copy `index.js` into Scriptable; run in the app. If prompted, set a valid API-Football key.
  2. Run with `await widget.presentMedium()` to preview a live or most-recent final match: verify score, status, home/away placement, both 40×40 crests, abbreviations, and five form colors.
  3. Re-run immediately: verify disk cache is used (fast render) and images don't re-download.
  4.Temporarily use an invalid key: verify the widget still renders with the cached/sample label and no crash.
  5. Remove key and cache: verify the "No fixture scheduled" / "Set API key" state renders cleanly.
  6. Confirm the widget completes (`Script.complete()`) in widget, app, and preview contexts.
- **Rollback:** All V1 code lives in a single new file `index.js`. Revert with `git checkout -- index.js` before commit, or `git revert <commit>` after commit. Cache files live only inside Scriptable's cache directory and can be deleted there without touching the repo. No migrations or destructive changes to existing files.
