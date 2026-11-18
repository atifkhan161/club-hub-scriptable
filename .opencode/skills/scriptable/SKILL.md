---
name: scriptable
description: Complete Scriptable JavaScript API reference for building and debugging Scriptable widgets, scripts and automations on iOS/iPadOS/macOS. Use when working with home screen or Lock Screen widgets (small/medium/large/extraLarge/accessory families), widget layout with ListWidget and nested WidgetStacks, async network image loading and caching, colors/fonts/gradients/symbols, or any Scriptable JS API such as Request, Script, config, args, FileManager, Image, Notification, Calendar, or UITable.
---

# Scriptable API Reference

## Overview

[Scriptable](https://scriptable.app) lets you automate iOS/iPadOS using JavaScript and render native home-screen and Lock Screen widgets. Scripts run in Apple's JavaScriptCore (ES6) inside the app, a share-sheet action extension, Siri/Shortcuts, a widget process, or a rich notification. There is no browser DOM: no `document`, `window`, `fetch`, `setTimeout`, etc. Instead, Scriptable provides global classes (`ListWidget`, `Request`, `Image`, `FileManager`, `Script`, `config`, `args`, ...) and uses Promises for all async work.

This skill is a complete, faithful reference to the official docs at `https://docs.scriptable.app/`. The full API is split across the reference files linked below.

## When to use this skill

Use it when you need to:

- Build or debug a Scriptable **home screen widget** (small / medium / large / extra-large on iPad) or a **Lock Screen accessory widget** (inline / circular / rectangular, iOS 16+).
- Compose UI with `ListWidget`, `WidgetStack`, `WidgetText`, `WidgetImage`, `WidgetSpacer`, `WidgetDate`, gradients, SF Symbols, and custom drawing.
- Fetch JSON or **load images asynchronously from URLs** with `Request`, then **cache them** with `FileManager`.
- Style with `Color` (hex), `Font`, `LinearGradient`, `SFSymbol`.
- Read script inputs via `args.widgetParameter` / `config`, import shared modules via `importModule` (`require` alias).
- Work with system APIs: alerts, notifications, calendar/reminders, contacts, location, mail/message, photos, tables, web views, keychain, etc.

## Core mental model

1. **A script is a module.** Each `.js` file has a `module.exports`; other files are loaded with `importModule('name')` (also available as `require('name')`). File extension is optional; a directory resolves to `index.js`.
2. **A widget is an object tree.** Create one `ListWidget`, then add elements (`addText`, `addImage`, `addDate`, `addSpacer`) and `WidgetStack`s. Stacks nest arbitrarily and lay out **horizontally by default**; call `stack.layoutVertically()` to stack vertically.
3. **Everything async returns a Promise.** Use `async` / `await` (or `.then()`). A widget script typically `await`s network calls, builds the widget, calls `Script.setWidget(widget)`, then `Script.complete()`.
4. **Context matters.** `config.runsInWidget`, `config.widgetFamily`, and `args.widgetParameter` let one script adapt to where and how it runs. Widgets are refreshed on an OS-controlled cadence; `widget.refreshAfterDate` sets the *earliest* next refresh.
5. **Widget processes are memory-constrained.** Download/decode images carefully, cache to disk, and catch errors — a widget that exceeds its memory budget crashes and renders blank.

## Essential workflow

```javascript
// 1) Imports (optional)
const WidgetKit = importModule('lib/widgetkit')   // require() is an alias

// 2) Build a widget. Top-level await is NOT allowed; wrap in an async IIFE.
async function buildWidget() {
  const widget = new ListWidget()
  widget.backgroundColor = new Color('#1c1c1e')
  widget.setPadding(12, 12, 12, 12)
  widget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000)

  const row = widget.addStack()
  row.layoutHorizontally()
  const title = row.addText('Hello')
  title.textColor = Color.white()
  title.font = Font.boldSystemFont(16)
  row.addSpacer()                       // flexible spacer pushes content apart
  row.addImage(SFSymbol.named('star.fill').image)

  widget.url = 'https://scriptable.app' // whole-widget tap target
  Script.setWidget(widget)              // REQUIRED to render the widget
}

// 3) Preview during development (promise resolves when preview is dismissed):
// await widget.presentSmall() / presentMedium() / presentLarge()

// 4) Signal completion (important for Siri/Shortcuts and share sheets):
buildWidget().then(() => Script.complete()).catch(e => { console.error(e); Script.complete() })
```

Preview entry points on a widget: `presentSmall()`, `presentMedium()`, `presentLarge()`, `presentExtraLarge()` (iPad), `presentAccessoryInline()`, `presentAccessoryCircular()`, `presentAccessoryRectangular()`.

Read inputs with `args.widgetParameter` (configured per widget), `args.shortcutParameter` (Shortcuts input), `args.plainTexts` / `args.urls` / `args.images` (share sheet), and `args.queryParameters` (URL scheme). Detect context with `config.runsInApp`, `config.runsInWidget`, `config.runsInAccessoryWidget`, `config.widgetFamily`.

## End-to-end widget example (async network image + disk cache + nested stacks)

```javascript
// Club dashboard widget — small/medium, iOS 16+
const fm = FileManager.local()
const cacheDir = fm.joinPath(fm.cacheDirectory(), 'club-widget')
if (!fm.fileExists(cacheDir)) fm.createDirectory(cacheDir, true)

async function loadImage(url) {
  const path = fm.joinPath(cacheDir, 'logo.png')
  if (fm.fileExists(path) && fm.modificationDate(path) > new Date(Date.now() - 3600e3)) {
    return Image.fromFile(path)          // cache hit
  }
  const req = new Request(url)
  const img = await req.loadImage()      // async network fetch
  fm.writeImage(path, img)               // cache for next refresh
  return img
}

async function buildWidget() {
  const widget = new ListWidget()
  widget.backgroundColor = new Color('#0b0b0d')
  widget.setPadding(14, 14, 14, 14)
  widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000)

  const header = widget.addStack()
  header.layoutHorizontally()
  header.spacing = 8
  try {
    const logo = header.addImage(await loadImage('https://example.com/logo.png'))
    logo.imageSize = new Size(34, 34)
    logo.cornerRadius = 8
    logo.resizable = true
  } catch (e) {
    console.warn('logo failed: ' + e)
  }
  header.addSpacer()
  const title = header.addText('Club Hub')
  title.textColor = Color.white()
  title.font = Font.semiboldSystemFont(15)

  widget.addSpacer(6)
  const info = widget.addStack()
  info.layoutVertically()
  const status = info.addText('Next event tonight, 7 PM')
  status.textColor = new Color('#9a9aa0')
  status.font = Font.regularSystemFont(12)
  status.lineLimit = 2

  widget.url = 'https://example.com/club'
  Script.setWidget(widget)
}

buildWidget().then(() => Script.complete()).catch(e => { console.error(e); Script.complete() })
```

## Reference table of contents

Load the reference file relevant to your task (you usually only need one or two):

| File | What it covers |
| --- | --- |
| [references/core-concepts.md](references/core-concepts.md) | Scriptable basics, script lifecycle, `args`, `config`, `importModule`/`module`, timers, console, URL schemes, and gotchas (memory limits, refresh cadence, Lock Screen transparency, iOS 16+ accessories). |
| [references/widgets-and-layout.md](references/widgets-and-layout.md) | `ListWidget`, `WidgetStack`, `WidgetText`, `WidgetImage`, `WidgetSpacer`, `WidgetDate`, `LinearGradient`; nested stacks, padding, sizes, refresh, previews, accessory widgets. **Read this first for widget UI.** |
| [references/network-data-and-storage.md](references/network-data-and-storage.md) | `Request`, `Data`, `FileManager`, `Keychain`, `XMLParser`, `Dictation`, `Pasteboard`, `DocumentPicker`, `WebView` — including async HTTP and image caching patterns. |
| [references/images-colors-and-fonts.md](references/images-colors-and-fonts.md) | `Image`, `Color`, `Font`, `DrawContext`, `SFSymbol`, `Size`, `Point`, `Rect` (and gradient cross-reference). |
| [references/system-and-automation.md](references/system-and-automation.md) | `Alert`, `Notification`, `Device`, calendars/contacts/reminders, location, mail/message, photos, speech, Safari, share sheet, QuickLook, tables, formatters, and all script/context globals. |
| [references/api-quick-index.md](references/api-quick-index.md) | Compact alphabetical index of **all** API classes with a one-line purpose and the file that documents it. |

**Source:** official Scriptable documentation, `https://docs.scriptable.app/` (all navigation pages fetched). APIs are accurate to that documentation; where a capability is version- or platform-specific it is noted inline in the reference files.
