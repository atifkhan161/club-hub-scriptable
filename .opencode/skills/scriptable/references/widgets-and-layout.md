# Widgets & Layout

This is the primary reference for building home-screen and Lock Screen widgets. It documents `ListWidget`, `WidgetStack`, and every element you can place in them, with extra depth on nested stacks, padding, sizing, async images, refresh scheduling, previews, and accessory (Lock Screen) widgets.

> Colors, fonts, gradients, and symbols used below are detailed in [images-colors-and-fonts.md](images-colors-and-fonts.md). HTTP loading and disk caching are detailed in [network-data-and-storage.md](network-data-and-storage.md). Lifecycle (`Script.setWidget`, `Script.complete`) and context flags are in [core-concepts.md](core-concepts.md).

---

## How widgets work

A widget is a `ListWidget` containing a vertical list of elements. Each element is created by calling an `add*` method on the widget or on a `WidgetStack`. You never construct `WidgetText`, `WidgetImage`, `WidgetSpacer`, or `WidgetDate` directly — the `add*` factory methods return them for styling.

```javascript
const widget = new ListWidget()          // root container
const text = widget.addText('Hello')    // returns WidgetText to style
const stack = widget.addStack()         // returns WidgetStack (horizontal by default)
const t2 = stack.addText('Inside stack')
Script.setWidget(widget)                // hand it to the system to render
```

Layout rules:

- The root `ListWidget` lays its children out **vertically**.
- A `WidgetStack` lays its children out **horizontally by default**. Call `stack.layoutVertically()` to switch it. Stacks nest to any depth.
- `addSpacer()` creates a spacer. With a numeric length it occupies that many points; with `null` it becomes **flexible**, absorbing leftover space (great for pushing text to the right).
- Alignment helpers on text apply to the root list; **inside a stack, use spacers** to align text/images instead.

---

## ListWidget

**Purpose:** the root widget object. Pass it to `Script.setWidget()` to display it.

```javascript
new ListWidget()
```

### Properties

| Property | Type | Default | Notes |
| --- | --- | --- | --- |
| `backgroundColor` | `Color` | solid on Home Screen, transparent on Lock Screen | Widget background. |
| `backgroundImage` | `Image` | — | Background image. |
| `backgroundGradient` | `LinearGradient` | — | Background gradient. |
| `addAccessoryWidgetBackground` | `bool` | `false` | Adaptive standard background. **iOS 16+.** |
| `spacing` | `number` | `0` | Vertical spacing between elements. |
| `url` | `string` | — | Whole-widget tap target; overrides configured tap behavior. |
| `refreshAfterDate` | `Date` | `null` | Earliest date the widget may refresh again. `null` = default interval. Not guaranteed. |

### Methods

```javascript
addText(text: string): WidgetText
addDate(date: Date): WidgetDate
addImage(image: Image): WidgetImage
addSpacer(length: number): WidgetSpacer        // length null => flexible
addStack(): WidgetStack                         // horizontal by default
setPadding(top: number, leading: number, bottom: number, trailing: number): void
useDefaultPadding(): void                       // discards prior setPadding
presentSmall(): Promise<void>
presentMedium(): Promise<void>
presentLarge(): Promise<void>
presentExtraLarge(): Promise<void>              // iPad, iPadOS 15+
presentAccessoryInline(): Promise<void>         // iOS 16+ (iPhone)
presentAccessoryCircular(): Promise<void>       // iOS 16+ (iPhone)
presentAccessoryRectangular(): Promise<void>    // iOS 16+ (iPhone)
```

Each `present*()` returns a Promise fulfilled when the preview is dismissed. Lock Screen previews are only estimates (appearance depends on wallpaper/tint).

```javascript
const widget = new ListWidget()
widget.backgroundColor = new Color('#111114')
widget.setPadding(12, 14, 12, 14)
widget.spacing = 6
widget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000)
widget.url = 'my-app://open'
Script.setWidget(widget)
await widget.presentMedium()
```

---

## WidgetStack

**Purpose:** a container that groups elements and controls their layout and alignment. This is the key to complex widget designs.

```javascript
widget.addStack(): WidgetStack
stack.addStack(): WidgetStack       // nested stacks
```

### Properties

| Property | Type | Default | Notes |
| --- | --- | --- | --- |
| `backgroundColor` | `Color` | — | Stack background. |
| `backgroundImage` | `Image` | — | Stack background image. |
| `backgroundGradient` | `LinearGradient` | — | Stack background gradient. |
| `spacing` | `number` | `0` | Spacing between stack children. |
| `size` | `Size` | `0 x 0` | Explicit stack size. A dimension `<= 0` means auto-size. |
| `cornerRadius` | `number` | `0` | Rounded corners. |
| `borderWidth` | `number` | `0` | Border width. |
| `borderColor` | `Color` | black | Border color. |
| `url` | `string` | — | Tap target — **medium/large widgets only**; small widgets use `widget.url`. |

### Methods

```javascript
addText(text: string): WidgetText
addDate(date: Date): WidgetDate
addImage(image: Image): WidgetImage
addSpacer(length: number): WidgetSpacer   // null => flexible
addStack(): WidgetStack
setPadding(top, leading, bottom, trailing): void
useDefaultPadding(): void
topAlignContent(): void        // default
centerAlignContent(): void
bottomAlignContent(): void
layoutHorizontally(): void     // default
layoutVertically(): void
```

### Nested stack example

```javascript
const widget = new ListWidget()
widget.setPadding(12, 12, 12, 12)

// Outer horizontal row: [icon] [vertical text block]
const row = widget.addStack()
row.layoutHorizontally()
row.spacing = 10
row.centerAlignContent()

const icon = row.addImage(SFSymbol.named('figure.walk').image)
icon.imageSize = new Size(36, 36)
icon.tintColor = new Color('#0a84ff')

// Nested vertical stack on the right
const col = row.addStack()
col.layoutVertically()
const heading = col.addText('Morning Run')
heading.font = Font.boldSystemFont(16)
heading.textColor = Color.white()
const sub = col.addText('5.2 km · 28:14')
sub.font = Font.footnote()
sub.textColor = Color.lightGray()

Script.setWidget(widget)
```

Alignment inside stacks: use flexible spacers.

```javascript
const line = widget.addStack()      // horizontal
line.addText('Left')
line.addSpacer(null)                // flexible: pushes following element to the right
line.addText('Right')
```

---

## WidgetText

**Purpose:** styled text in a widget. Created via `addText()` on a widget or stack.

```javascript
widget.addText(text: string): WidgetText
```

### Properties

| Property | Type | Default | Notes |
| --- | --- | --- | --- |
| `text` | `string` | — | The string to display. |
| `textColor` | `Color` | — | Text color. |
| `font` | `Font` | — | Font/size. |
| `textOpacity` | `number` | `1` | 0–1. |
| `lineLimit` | `number` | `0` | Max lines; `<= 0` disables the limit. |
| `minimumScaleFactor` | `number` | `1` | 0–1; text may shrink to this fraction to fit. |
| `shadowColor` | `Color` | black | Needs `shadowRadius > 0`. |
| `shadowRadius` | `number` | `0` | Shadow size. |
| `shadowOffset` | `Point` | `(0, 0)` | Needs `shadowRadius > 0`. |
| `url` | `string` | — | Tap target (medium/large only). |

### Methods

```javascript
leftAlignText(): void    // default
centerAlignText(): void
rightAlignText(): void
```

> These alignment methods do **not** affect text placed inside a stack; use spacers there.

---

## WidgetImage

**Purpose:** an image in a widget. Created via `addImage()` on a widget or stack. Central to async network images.

```javascript
widget.addImage(image: Image): WidgetImage
```

### Properties

| Property | Type | Default | Notes |
| --- | --- | --- | --- |
| `image` | `Image` | — | The image to show. |
| `resizable` | `bool` | `true` | Whether the image can be resized. |
| `imageSize` | `Size` | `null` | Render size; `null` shows full size. |
| `imageOpacity` | `number` | `1` | 0–1. |
| `cornerRadius` | `number` | `0` | Ignored when `containerRelativeShape` is `true`. |
| `borderWidth` | `number` | `0` | Border width. |
| `borderColor` | `Color` | black | Border color. |
| `containerRelativeShape` | `bool` | `false` | Rounds corners relative to the containing widget (ignores `cornerRadius`). |
| `tintColor` | `Color` | `null` | Tints the image; `null` = original. |
| `url` | `string` | — | Tap target (medium/large only). |

### Methods

```javascript
leftAlignImage(): void     // default
centerAlignImage(): void
rightAlignImage(): void
applyFittingContentMode(): void   // default: fit within available space
applyFillingContentMode(): void   // fill available space (may crop)
```

### Async image from a URL (with caching)

```javascript
const fm = FileManager.local()
const dir = fm.joinPath(fm.cacheDirectory(), 'widget-img')
if (!fm.fileExists(dir)) fm.createDirectory(dir, true)

async function cachedImage(url, filename, maxAgeMs) {
  const path = fm.joinPath(dir, filename)
  const fresh = fm.fileExists(path) &&
                fm.modificationDate(path) > new Date(Date.now() - maxAgeMs)
  if (fresh) return Image.fromFile(path)
  const req = new Request(url)
  const img = await req.loadImage()
  fm.writeImage(path, img)
  return img
}

async function build() {
  const widget = new ListWidget()
  try {
    const img = await cachedImage('https://example.com/cover.jpg', 'cover.jpg', 6 * 3600e3)
    const wi = widget.addImage(img)
    wi.imageSize = new Size(0, 120)   // height 120, width auto
    wi.resizable = true
    wi.applyFillingContentMode()
    wi.containerRelativeShape = true   // corners match the widget
    // ... or: wi.cornerRadius = 12
  } catch (e) {
    widget.addText('Image unavailable').textColor = Color.lightGray()
  }
  Script.setWidget(widget)
}
build().then(() => Script.complete())
```

Keep network work in `try/catch`: a failed fetch must not prevent `Script.setWidget()`. Cache to `cacheDirectory()` (survives longer than `temporaryDirectory()`, but OS may purge it), and prefer a modest `maxAgeMs` to avoid stale content.

---

## WidgetSpacer

**Purpose:** empty space between elements. A spacer with `null` length expands to fill leftover space.

```javascript
widget.addSpacer(length: number): WidgetSpacer
stack.addSpacer(length: number): WidgetSpacer
```

| Property | Type | Notes |
| --- | --- | --- |
| `length` | `number` | Spacer length; `null` = flexible. |

```javascript
widget.addSpacer(8)       // fixed 8pt gap
stack.addSpacer(null)     // flexible gap (alignment trick)
```

---

## WidgetDate

**Purpose:** a date that updates itself periodically while displayed — you do not need to re-run the script to update it.

```javascript
widget.addDate(date: Date): WidgetDate
```

Dates update independently of the widget's script refresh. Created with `addDate()`; style like `WidgetText`.

### Shared text-style properties

`date`, `textColor`, `font`, `textOpacity`, `lineLimit`, `minimumScaleFactor`, `shadowColor`, `shadowRadius`, `shadowOffset`, `url`.

### Methods

```javascript
leftAlignText() / centerAlignText() / rightAlignText()
applyTimeStyle()      // e.g. "11:23PM"
applyDateStyle()      // e.g. "June 3, 2019" — DEFAULT
applyRelativeStyle()  // e.g. "2 hours, 23 minutes"
applyOffsetStyle()    // e.g. "+2 hours", "-3 months"
applyTimerStyle()     // e.g. "2:32" or "36:59:01" (counts from now)
```

```javascript
const d = widget.addDate(new Date('2026-11-20T19:00:00'))
d.applyRelativeStyle()
d.font = Font.footnote()
d.textColor = new Color('#9a9aa0')
```

---

## LinearGradient

**Purpose:** a linear gradient usable as a widget/stack background (or re-used from the image/color reference).

```javascript
new LinearGradient()
```

| Property | Type | Default | Notes |
| --- | --- | --- | --- |
| `colors` | `[Color]` | — | Must match `locations` length. |
| `locations` | `[number]` | — | 0–1 positions for each color. |
| `startPoint` | `Point` | `(0, 1)` | Normalized start (0–1 per axis). |
| `endPoint` | `Point` | `(0, 1)` | Normalized end (0–1 per axis). |

```javascript
const g = new LinearGradient()
g.colors = [new Color('#0a84ff'), new Color('#5e5ce6')]
g.locations = [0, 1]
g.startPoint = new Point(0, 0)
g.endPoint = new Point(1, 1)
const widget = new ListWidget()
widget.backgroundGradient = g
```

---

## Sizing, padding & layout details

- `widget.setPadding(top, leading, bottom, trailing)` — padding in points on all four edges. `useDefaultPadding()` restores defaults.
- `stack.size = new Size(w, h)` — a dimension of `0` or less lets the widget auto-size that axis. Useful for fixed-width image tiles.
- `widget.spacing` / `stack.spacing` — spacing between direct children.
- `addSpacer(n)` for fixed gaps; `addSpacer(null)` for flexible gaps.
- `stack.centerAlignContent() / topAlignContent() / bottomAlignContent()` control cross-axis alignment of the stack's children.
- Rounded image corners: `widgetImage.cornerRadius` or `widgetImage.containerRelativeShape = true` (the latter matches the widget's own corner radius; used for edge-to-edge background images).
- A stack's `url` and an element's `url` are **tap targets only in medium/large widgets**. In small widgets, set `widget.url`.

---

## Previews and widget families

```javascript
await widget.presentSmall()
await widget.presentMedium()
await widget.presentLarge()
await widget.presentExtraLarge()          // iPad only
await widget.presentAccessoryInline()     // iOS 16+
await widget.presentAccessoryCircular()   // iOS 16+
await widget.presentAccessoryRectangular()// iOS 16+
```

Use `config.widgetFamily` to render the correct layout. Accessory previews are estimates; the Lock Screen re-tints content based on wallpaper. Inline accessories show only one image and one text (extras are filtered).

```javascript
const family = config.widgetFamily
if (family === 'accessoryCircular') {
  // minimal gauge: one image + one short text
} else if (family === 'medium' || family === 'large') {
  // full layout with per-element urls
}
```

`refreshAfterDate` sets the earliest refresh time; the OS may refresh later or not at all (low battery, low relevance). `WidgetDate` keeps ticking without re-running your script.

---

## Gotchas (widget-specific)

- Exceeding widget memory terminates the process → blank widget. Cache images, avoid huge bitmaps, handle errors.
- `Script.setWidget(widget)` must be called before the script ends; `Script.complete()` last.
- Text alignment methods on `WidgetText` do nothing inside stacks — use spacers.
- `containerRelativeShape = true` makes `cornerRadius` irrelevant.
- `resizable = false` prevents scaling; combine with `imageSize` carefully.
- Lock Screen widget backgrounds default to transparent; use `addAccessoryWidgetBackground = true` for an adaptive background (iOS 16+).
- Extra-large preview requires iPad (iPadOS 15+); accessory previews require iOS 16+.
