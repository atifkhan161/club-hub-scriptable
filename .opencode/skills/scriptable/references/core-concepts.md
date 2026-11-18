# Core Concepts

This file covers Scriptable's runtime model and the globals you reach for in almost every script: how a script starts and ends, how it learns where it is running, how it receives input, how it imports shared code, and how to log, time, deep-link, and avoid the common pitfalls (especially in widgets).

> For widget UI classes see [widgets-and-layout.md](widgets-and-layout.md). For HTTP/file/storage see [network-data-and-storage.md](network-data-and-storage.md). A compact list of every class is in [api-quick-index.md](api-quick-index.md).

---

## The JavaScript environment

Scriptable uses Apple's **JavaScriptCore**, which supports ECMAScript 6. There is **no browser**: no `document`, `window`, `fetch`, `XMLHttpRequest`, `localStorage`, or `setTimeout`. Use the Scriptable classes instead:

| Browser concept | Scriptable equivalent |
| --- | --- |
| `fetch()` / XHR | `new Request(url).loadString()` / `.loadJSON()` / `.loadImage()` |
| `localStorage` | `Keychain`, `FileManager` |
| `setTimeout` / intervals | `Timer` (see below) |
| `console.log` | `console.log()` or global `log()` |
| `require('x')` | `importModule('x')` (`require` is an alias) |
| `document` / DOM | `ListWidget`, `UITable`, `WebView`, `DrawContext` |

Top-level `await` is not supported. Wrap async work in an `async function` and call it (often as an IIFE), then call `Script.complete()` when done.

---

## Script — script lifecycle

**Purpose:** read the current script's name, hand a widget to the system, set Shortcuts output, and signal completion.

```javascript
Script.name(): string
Script.complete(): void
Script.setWidget(widget: any): void
Script.setShortcutOutput(value: any): void
```

| Member | Type | Notes |
| --- | --- | --- |
| `name()` | `string` | Name of the currently running script. |
| `complete()` | `void` | Tells the system the script has finished. In Siri/Shortcuts, Scriptable otherwise uses heuristics to guess completion; call this as the **very last action** when a script takes a long time. When run from a share sheet it dismisses the presented view. |
| `setWidget(widget)` | `void` | Registers the `ListWidget` to be displayed. Required for widget rendering. |
| `setShortcutOutput(value)` | `void` | Pass text, number, boolean, dictionary, or an iCloud file path back to the Shortcuts app. JavaScript `return` also works. |

```javascript
async function main() {
  const widget = new ListWidget()
  widget.addText('Done')
  Script.setWidget(widget)
  await widget.presentSmall()   // optional dev preview
}
main().then(() => Script.complete())
```

---

## config — execution context

**Purpose:** read-only flags describing where and in what form the script is currently running.

```javascript
config.runsInApp: bool            // running in the Scriptable app
config.runsInActionExtension: bool // running in the share-sheet action extension
config.runsWithSiri: bool         // running with Siri / Shortcuts
config.runsInWidget: bool         // true for BOTH Home Screen and Lock Screen widgets
config.runsInAccessoryWidget: bool // true for accessory widgets (Lock Screen), iOS 16+
config.runsInNotification: bool   // running in a rich notification
config.runsFromHomeScreen: bool   // launched from a home-screen script icon
config.widgetFamily: string       // 'small' | 'medium' | 'large' | 'extraLarge'
                                  // | 'accessoryRectangular' | 'accessoryInline'
                                  // | 'accessoryCircular' | null
```

All properties are read-only. `widgetFamily` is `null` when not in a widget. `extraLarge` only on iPad (iPadOS 15+); the three `accessory*` families require iOS 16+.

```javascript
if (config.runsInWidget) {
  if (config.widgetFamily === 'medium') {
    // render the wider layout
  }
}
```

---

## args — inputs to the script

**Purpose:** values supplied by a share sheet, Shortcuts action, URL scheme, widget configuration, or notification. All properties are read-only.

| Property | Type | Meaning |
| --- | --- | --- |
| `args.plainTexts` | `[string]` | Plain texts from a share sheet or Shortcut. |
| `args.urls` | `[string]` | URLs from a share sheet or Shortcut. |
| `args.fileURLs` | `[string]` | File URLs from a share sheet or Shortcut. |
| `args.images` | `[Image]` | Images from a share sheet or Shortcut. |
| `args.queryParameters` | `{string: string}` | Query params when launched via URL scheme. |
| `args.shortcutParameter` | `any` | Input passed to the "Run Script" Shortcut action (text, list, dict, or file path). |
| `args.widgetParameter` | `any` | Parameter configured on the widget; differentiate multiple widgets. |
| `args.notification` | `Notification` | The notification being handled / that opened the app (includes `userInfo`). |

Deprecated: `args.length`, `args.all` (use the typed arrays), `args.siriShortcutArguments` (use `shortcutParameter`).

Large images/files passed from a share sheet can exceed the action extension's memory limit; enable **Run in App** in script settings when that happens.

```javascript
const city = args.widgetParameter || 'Copenhagen'
const shared = args.plainTexts[0]
```

---

## importModule / module — shared code

**Purpose:** split scripts into reusable modules. Each file is a module with a `module.exports` object. `importModule` is also available as the global alias `require`.

```javascript
importModule(name: string): any    // returns the imported module's module.exports
```

Search order for `importModule('foo')` (extension optional; a directory resolves to `index.js`):

1. Relative to the file doing the import.
2. Scriptable's iCloud folder (if iCloud Drive enabled).
3. Scriptable's app-group folder (default when iCloud is off).
4. Scriptable's local folder.

You can pass a path, e.g. `importModule('/lib/foo')`.

```javascript
// lib/circle.js
module.exports.area = (r) => Math.PI * Math.pow(r, 2)
module.exports.circumference = (r) => 2 * Math.PI * r

// main.js
const circle = require('lib/circle')   // or importModule('lib/circle')
log('Area: ' + circle.area(2))
```

`module` object:

| Member | Type | Notes |
| --- | --- | --- |
| `module.filename` | `string` (read-only) | Absolute path of the current module's file. |
| `module.exports` | `any` (default `{}`) | Values exported to whoever imports this file. You may assign a single function/value directly: `module.exports = (x) => x * 2`. |

---

## Timer — delayed and repeating callbacks

**Purpose:** fire a callback after a time interval (optionally repeating). Useful for polling or animations while a script's UI is presented. Not used inside a rendered widget.

```javascript
new Timer()                                   // instance form
timer.timeInterval: number                    // milliseconds; default 0 (fires immediately)
timer.repeats: bool                           // default false; repeating timers must be invalidated
timer.schedule(callback: fn()): void
timer.invalidate(): void

Timer.schedule(timeInterval: number, repeats: bool, callback: fn()): Timer  // convenience
```

A non-repeating timer invalidates itself after firing. A repeating timer keeps firing until `invalidate()`.

```javascript
const t = Timer.schedule(1000, true, () => {
  log('tick ' + new Date().toISOString())
})
// later: t.invalidate()
```

---

## console — logging

**Purpose:** write diagnostic messages to Scriptable's log.

```javascript
console.log(message: any)      // alias: log(message)
console.warn(message: any)     // alias: logWarning(message)
console.error(message: any)    // alias: logError(message)
console.logError(message: any) // deprecated since 1.3; use console.error
```

Use the console when debugging widgets — `log()` inside a widget can be viewed in the app's log view, which is essential because a crashing widget otherwise renders blank.

```javascript
console.log('value=' + JSON.stringify(args.widgetParameter))
```

---

## URLScheme — deep links into Scriptable

**Purpose:** build URLs that open or run scripts, and read query parameters from an incoming URL-scheme invocation. The app also supports the universal link `https://open.scriptable.app/...`.

```javascript
URLScheme.forOpeningScript(): string          // opens the current script (editor)
URLScheme.forOpeningScriptSettings(): string  // opens the current script's settings
URLScheme.forRunningScript(): string          // runs the current script
URLScheme.allParameters(): {string: string}   // deprecated -> args.queryParameters
URLScheme.parameter(name: string): string     // deprecated -> args.queryParameters
```

Documented scheme forms:

- Add a script: `scriptable:///add`
- Open a script: `scriptable:///open/SCRIPT_NAME` (URL-encode the name; optional `openSettings=true`)
- Run a script: `scriptable:///run/SCRIPT_NAME` (optional `openEditor=true` to see the log)

Universal-link equivalents use `https://open.scriptable.app/run/...`. Read incoming values with `args.queryParameters`.

```javascript
const url = URLScheme.forRunningScript() + '?city=' + encodeURIComponent('Aarhus')
Safari.open(url)
```

---

## Gotchas & best practices

- **Widget memory limits cause silent crashes.** Widget/action-extension processes have a small memory budget. Large images or big arrays can terminate the process, producing a blank widget. Download only what you need, downsample when possible, cache to disk with `FileManager`, and wrap network/image work in `try/catch`.
- **Refresh cadence is OS-controlled.** Widgets refresh periodically; iOS decides when based on battery, usage, and relevance. `widget.refreshAfterDate` only sets the *earliest* allowable refresh — it is not a guarantee. `WidgetDate` elements update independently without re-running your script.
- **Lock Screen transparency.** `ListWidget.backgroundColor` defaults to a solid color on the Home Screen and **transparent** on the Lock Screen. Accessory widgets adopt appearance based on the wallpaper/tint, so previews are only approximations. Use `widget.addAccessoryWidgetBackground = true` (iOS 16+) for an adaptive system background.
- **iOS 16+ accessory widgets.** Inline/circular/rectangular accessory families and `config.runsInAccessoryWidget` / `addAccessoryWidgetBackground` require iOS 16+. Inline accessories can show only one image and one text; extra elements are filtered out. Extra-large widgets require iPad (iPadOS 15+).
- **Async correctness.** Always `await` Promises (`Request.load*`, `DocumentPicker`, `Notification.schedule`, previews, etc.). Unhandled rejections can abort a widget before `Script.setWidget` runs. Call `Script.complete()` last — never before you have set the widget.
- **Build UI only after awaits.** Construct the widget inside the async function *after* data is ready, so a failed fetch doesn't leave a half-built widget.
- **Prefer `args.widgetParameter` for per-widget config** rather than hard-coding; one script can back many widgets.
- **Dynamic colors don't work in `DrawContext`.** `Color.dynamic(light, dark)` is supported in widgets but not with `DrawContext`.
- **Not every widget surface supports tap targets.** Small widgets have a single tap target (`widget.url`); per-element `url` works only in medium/large widgets.
- **Keychain is encrypted storage** for secrets; `get()` throws if the key is missing — check `contains()` first.
