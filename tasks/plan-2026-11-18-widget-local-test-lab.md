# Implementation Plan: Local Widget Test Lab

## 1. Objective & Scope

- **Goal:** Give the repo a small, zero-dependency local tool that runs the real, unmodified `index.js` in a simulated Scriptable runtime, checks invariants against live football-data.org data, and writes an HTML preview so layout can be reviewed before releasing to the Scriptable app.
- **In Scope:**
  - One Node CLI tool under `tools/`, run with `node tools/widget-lab.js` (Node 18+; verified here on Node 26 with built-in `fetch`).
  - Scriptable API stubs (`ListWidget`, `WidgetStack`, text/image/spacer elements, `Request`, `FileManager`, `Keychain`, `Script`, `config`, `Color`, `Font`, `Size`, `Alert`, `console`, `DrawContext`, `Path`, `Rect`) sufficient to execute `index.js` unmodified in a `node:vm` context.
  - Live API mode: `Request` stub uses global `fetch` against `https://api.football-data.org/v4` with `FOOTBALL_DATA_TOKEN` from the environment (no token in source or logs).
  - CLI flags for exercising branches without JSON fixtures: `--no-key` (missing token), `--api-error` (simulated request failure), `--crest-fail` (simulated image failure), `--preview [path]`, `--json`.
  - Invariant assertions on the captured widget tree and outbound requests (structure, styles, status/form domains, badge sizes, no SVG URLs, `setWidget`/`complete` call counts).
  - HTML/CSS approximation of the widget tree (flexbox stacks, flex spacers, colors/fonts, placeholder crest squares) written to `.cache/widget-preview.html`.
  - `.gitignore` for `.cache/` and an `AGENTS.md` testing section documenting the workflow.
- **Out of Scope:**
  - npm packages, `package.json`, test frameworks (per repo convention and the chosen zero-dependency option).
  - Pixel-perfect iOS rendering or real WidgetKit screenshots — final visual approval still happens in Scriptable on macOS.
  - JSON fixture files (explicitly rejected; scenarios come from the live API plus simulation flags).
  - Modifying `index.js` to expose test hooks (explicitly rejected; black-box execution only).
  - Automating deployment to iCloud Drive / the iOS app.

## 2. Resolved Design Decisions & Edge Cases

- **Minimal approach from web research:** `scriptable-testlab`, `scriptable-mocks`, and the Scriptable VS Code preview extension all require npm dependencies/build tooling. The smallest solution that fits this repo is a self-contained Node `vm` harness with hand-rolled stubs — the same technique already used ad hoc to catch the `fixture.fixture.status` shape bug. No production-code changes.
- **Live data:** `FOOTBALL_DATA_TOKEN` is required by default; the tool exits with a clear setup message when absent. `--no-key` deliberately simulates a missing token to exercise the sample/cached fallback. The token is only placed in the `X-Auth-Token` header of stubbed requests and is never logged.
- **Network failures (incl. 401/403/429):** the stub reports HTTP status accurately so `index.js` takes its normal fallback path. The tool still validates the fallback widget and reports the API problem as a warning (exit code 0 if fallback assertions pass), because the tool's job is to verify widget behavior under failure — not to assert API availability.
- **Crests:** preview uses colored placeholder squares derived from the widget tree rather than downloading images, avoiding extra network calls and rate-limit pressure. Assertions still verify every crest URL requested by `index.js` was normalized to `.png` (SVG is unsupported by Scriptable `Image`).
- **Assertions are invariant-based:** live scores/statuses vary, so checks are on shape and domain — score matches `^\d+ - \d+$` or the empty-state dash, status is one of `FT`/`HT`/`LIVE`/`\d+'`/API labels, form has 0–5 entries of `W|D|L`, two badge `imageSize`s are exactly 40×40, background is `#1a1a1a`, padding was set to `(15,15,15,15)`, `refreshAfterDate` is set, and `Script.setWidget`/`Script.complete` were each called once.
- **Output hygiene:** all generated artifacts live in `.cache/` and are gitignored. The preview path can be overridden with `--preview <path>`.
- **Runtime safety:** the VM gets no `require`, `process`, or filesystem access — only the stubs and safe globals. Script execution is awaited via `setImmediate`-style draining so all Promises settle before assertions run.

## 3. Execution Tasks (Vertical Slices)

- [ ] **Task 1: VM harness skeleton and Scriptable stubs**
  - **Files:** `tools/widget-lab.js`
  - **Details:** Implement element objects with `addText`/`addImage`/`addSpacer`/`addStack`, layout/alignment methods, and style properties; `ListWidget`/`WidgetStack` classes; value types `Color`, `Font`, `Size`, `Point`, `Rect`, `Path`, `DrawContext`; globals `Script`, `config`, `args`, `console`, `FileManager` (in-memory cache), `Keychain`, `Alert`. Add `node:vm` context creation, load `index.js` from repo root, capture widget + call counts, and wait for async completion.
  - **Acceptance Criteria:** `node tools/widget-lab.js --no-key` runs `index.js` to completion without exceptions, prints one `setWidget` and one `complete`, and dumps a widget tree.

- [ ] **Task 2: Live API Request stub and scenarios**
  - **Files:** `tools/widget-lab.js`
  - **Details:** `Request.loadJSON()` uses built-in `fetch` with `X-Auth-Token`, checks `response.status`, and maps the two endpoint paths (`status=FINISHED`, `status=LIVE`) to responses. `loadImage()` returns a harmless placeholder (never downloads). Implement flags: `--no-key`, `--api-error`, `--crest-fail`, `--json`, `--preview <path>`, `--help`; clear error when `FOOTBALL_DATA_TOKEN` is missing by default.
  - **Acceptance Criteria:** With a valid token, the tool prints the live normalized score/status/form and the two API URLs used (token redacted); `--api-error` and `--crest-fail` still produce a widget and report the simulated problem; no token by default produces an actionable setup message.

- [ ] **Task 3: Invariant assertions**
  - **Files:** `tools/widget-lab.js`
  - **Details:** Walk the captured widget tree and assert the §2 invariants; print a compact PASS/FAIL list and set `process.exitCode = 1` on any failure. Include checks that the header text hint is one of the expected labels and that no requested crest URL contains `.svg`.
  - **Acceptance Criteria:** A normal live run prints PASS for all checks; deliberately breaking a stub (e.g. returning a 200×200 badge) makes the corresponding check FAIL with a clear message.

- [ ] **Task 4: HTML preview renderer**
  - **Files:** `tools/widget-lab.js`
  - **Details:** Recursively convert the widget tree to HTML/CSS: `ListWidget` = 322×148 dark card, `WidgetStack` = flex row (default) / column when `axis === 'v'`, `WidgetSpacer` = `flex-grow:1` when length is `null` else fixed width, `WidgetText` = font/size/color/opacity, `WidgetImage` = square with the team code or a neutral placeholder. Write to `.cache/widget-preview.html` with a short header showing run mode, timestamp, and status. Escape all text.
  - **Acceptance Criteria:** Opening the generated HTML in a browser shows a medium-sized dark widget with centered score/status, crests on the correct sides, and five form squares; preview reflects scenario flags.

- [ ] **Task 5: Repo integration and docs**
  - **Files:** `.gitignore`, `AGENTS.md`
  - **Details:** Add `.cache/` (and `.DS_Store`) to `.gitignore`. Add a "Local testing" section to `AGENTS.md` documenting `export FOOTBALL_DATA_TOKEN=...`, `node tools/widget-lab.js`, the flags, where the preview is written, and the reminder that final visual approval still requires Scriptable on macOS.
  - **Acceptance Criteria:** Running the tool creates only ignored artifacts; `git status` stays clean apart from the intended tool/doc files; another agent can follow `AGENTS.md` without further explanation.

## 4. Verification & Rollback Plan

- **Automated Tests:** The tool itself is the test. Run:
  - `node tools/widget-lab.js --no-key` (fallback rendering, no token needed)
  - `FOOTBALL_DATA_TOKEN=... node tools/widget-lab.js --json` (live data, assertions)
  - `node tools/widget-lab.js --api-error` / `--crest-fail` (failure branches)
  - `node -e` sanity check of generated HTML for the expected CSS classes and escaped text.
- **Manual Check:** Open `.cache/widget-preview.html` in a browser and compare against PRD §4–§6: scoreline centered, gold status, 40×40 badges, abbreviations on correct sides, five form colors, dark background, 15pt padding. Then run the real `index.js` in Scriptable macOS with `presentMedium()` and compare — the tool is a pre-flight check, not a replacement.
- **Rollback:** All new files are additive (`tools/`, `.gitignore`, `AGENTS.md` edit, `.cache/` output). Remove `tools/widget-lab.js`, revert the `AGENTS.md` hunk, and delete `.cache/`; `index.js` is untouched by design, so no production rollback is needed.
