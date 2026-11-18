# AGENTS.md

Guidance for AI agents working in this repository.

## Project

**Club Hub** is a Scriptable widget for Real Madrid fans, as specified in
[`docs/product_requirements_document_prd.md`](docs/product_requirements_document_prd.md).

- **Platform:** iOS / iPadOS / macOS via the Scriptable app
- **Language:** JavaScript (ES6+, Apple JavaScriptCore)
- **Goal:** an at-a-glance matchday widget with scoreline, team crests, and a
  recent-form indicator, styled for dark mode with Real Madrid gold accents.

## Repository layout

```
docs/                              Product requirements document
.opencode/skills/scriptable/       Complete Scriptable API reference skill
  SKILL.md                         Entry point and core workflow
  references/                      Detailed API reference, split by topic
```

There is no build system or package manager. Scripts are plain `.js` files that
run inside Scriptable.

## Before you write Scriptable code

**Load the `scriptable` skill** (it is registered in this repo at
`.opencode/skills/scriptable/`). Start with `SKILL.md`, then open the relevant
reference file:

- Widget UI / layout → `references/widgets-and-layout.md`
- Network calls, JSON, image caching → `references/network-data-and-storage.md`
- Colors, fonts, gradients, symbols → `references/images-colors-and-fonts.md`
- Script lifecycle, `args`, `config` → `references/core-concepts.md`
- Find a specific API → `references/api-quick-index.md`

The skill is derived from the complete official docs at
`https://docs.scriptable.app/`. Prefer it over guessing APIs.

## Conventions

- Use `async`/`await` for all I/O (`Request.loadJSON()`, `Request.loadImage()`).
- Wrap top-level work in an async IIFE; always call `Script.setWidget(widget)`
  and `Script.complete()` on both success and failure paths.
- Build UI with one root `ListWidget` plus nested `WidgetStack`s (stacks are
  horizontal by default — call `layoutVertically()` for columns).
- Use flexible spacers (`addSpacer(null)`) for alignment inside stacks.
- Cache downloaded crests with `FileManager` and constrain badge sizes (the PRD
  requires `40x40`) with `WidgetImage.imageSize`.
- The medium widget has two rows: next fixture (`status=SCHEDULED&limit=1`) with
  a `WidgetDate.applyRelativeStyle()` countdown, and last result plus form.
  Keep cached payloads backward compatible — old files may lack `next`.
- Follow the PRD's design tokens: translucent `#1a1a1a` background, `#f1d382`
  gold accents, form colors `#2ecc71` / `#95a5a6` / `#e74c3c`. The "glass" look
  is only approximated with translucent panels and a gradient; Scriptable has
  no Liquid Glass API (iOS 26 applies it at the system level).
- Be mindful of widget memory limits and OS-controlled refresh cadence; set
  `refreshAfterDate` for the earliest acceptable refresh.

## Testing and deployment

### Local pre-flight checks (Node, no dependencies)

`tools/widget-lab.js` runs the real, unmodified `index.js` in a `node:vm`
context with stubbed Scriptable APIs. It checks widget invariants, prints a
widget tree, and writes an HTML approximation of the medium widget. Requires
Node 18+ (uses built-in `fetch`); there are no packages to install.

```sh
export FOOTBALL_DATA_TOKEN=...          # football-data.org token; never logged
node tools/widget-lab.js                # live API + assertions + preview
node tools/widget-lab.js --json         # also print the rendered model
node tools/widget-lab.js --no-key       # fallback: sample data + "Set API token"
node tools/widget-lab.js --api-error    # fallback when API requests fail
node tools/widget-lab.js --crest-fail   # fallback: 3-letter initials badges
node tools/widget-lab.js --preview /tmp/preview.html
node tools/widget-lab.js --help
```

Output goes to `.cache/widget-preview.html` (gitignored). To run the lab and
open that file in your default browser automatically (macOS/Linux):

```sh
./tools/view-widget.sh              # live data
./tools/view-widget.sh --no-key     # fallback state
./tools/view-widget.sh --api-error  # failure state
./tools/view-widget.sh --no-open    # generate only, don't open a browser
```

If no browser launcher is available, the script prints the file path instead.
The HTML preview is an approximation, not a real iOS render.

To see the **real** widget, run `index.js` inside the Scriptable app on macOS
or iOS. `config.runsInApp` makes the script call `presentMedium()` automatically,
so the medium widget preview appears immediately; final visual approval should
always be done there.

### Final validation and deployment

- Develop and preview with the Scriptable app on macOS (`presentSmall()`,
  `presentMedium()`, `presentLarge()`) for pixel-level debugging. Compare the
  result with the HTML preview, then release.
- Deployment is manual: copy the `.js` script into the iCloud Drive Scriptable
  folder or paste it into Scriptable on iOS.

## Scope

V1 is the widget described in the PRD. RSS feeds, tap-to-open highlights, and
Lock Screen widget variants are explicitly out of scope until a later version.
