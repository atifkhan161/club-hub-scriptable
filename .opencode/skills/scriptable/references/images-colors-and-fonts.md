# Images, Colors & Fonts

This file covers the visual value types you use throughout widgets and drawing: `Image`, `Color`, `Font`, `SFSymbol`, the geometry structs `Size`, `Point`, `Rect`, and the `Path`/`DrawContext` custom-drawing pair. Gradients are documented here as well (and cross-referenced from [widgets-and-layout.md](widgets-and-layout.md)).

> For widget image styling (`WidgetImage.imageSize`, `cornerRadius`, `containerRelativeShape`, tinting) see [widgets-and-layout.md](widgets-and-layout.md). For loading images over HTTP and caching them, see [network-data-and-storage.md](network-data-and-storage.md).

---

## Image

**Purpose:** holds image data; every Scriptable API that consumes or returns an image uses this type.

```javascript
Image.fromFile(filePath: string): Image    // null if unreadable
Image.fromData(data: Data): Image          // null if unreadable
```

| Property | Type | Notes |
| --- | --- | --- |
| `size` | `Size` (read-only) | Image dimensions in pixels. |

Other common sources (returned by other classes, not constructed here):

- `await new Request(url).loadImage()` → `Image`
- `FileManager.local().readImage(path)` → `Image`
- `SFSymbol.named(name).image` → `Image`
- `DrawContext.getImage()` → `Image`
- `Photos.latestPhoto()` / `Photos.fromLibrary()` → `Image`

```javascript
const img = Image.fromData(await new Request(url).load())
log('size: ' + img.size.width + 'x' + img.size.height)
```

---

## Color

**Purpose:** a color with opacity, constructible from hex or system colors, with dynamic light/dark variants.

```javascript
new Color(hex: string, alpha?: number)
```

Hex accepts 3, 4, 6, or 8 digits with or without `#`, e.g. `#ff0000`, `#00ff0080`, `#00f`, `#ff`. An explicit `alpha` argument overrides alpha encoded in the hex string.

### Read-only properties

`hex: string`, `red: number`, `green: number`, `blue: number`, `alpha: number`.

### Static system colors

```javascript
Color.black() Color.darkGray() Color.lightGray() Color.gray()
Color.white()  Color.red()     Color.green()     Color.blue()
Color.cyan()   Color.yellow()  Color.magenta()   Color.orange()
Color.purple() Color.brown()   Color.clear()
```

### Dynamic colors

```javascript
Color.dynamic(lightColor: Color, darkColor: Color): Color
```

Picks a variant based on system appearance. **Not supported with `DrawContext`.**

```javascript
const accent = new Color('#0a84ff')
const card = new Color('#1c1c1e', 0.8)
const adaptive = Color.dynamic(Color.white(), new Color('#1c1c1e'))
```

---

## Font

**Purpose:** a font and text size for styling text in widgets and tables.

```javascript
new Font(name: string, size: number)   // see iosfonts.com for available names
```

### Preferred text styles (no size argument)

```javascript
Font.largeTitle() Font.title1() Font.title2() Font.title3()
Font.headline() Font.subheadline() Font.body() Font.callout()
Font.footnote() Font.caption1() Font.caption2()
```

### System fonts (take `size: number`)

Weights: `systemFont`, `ultraLightSystemFont`, `thinSystemFont`, `lightSystemFont`, `regularSystemFont`, `mediumSystemFont`, `semiboldSystemFont`, `boldSystemFont`, `heavySystemFont`, `blackSystemFont`, `italicSystemFont`.

Monospaced variants: `ultraLightMonospacedSystemFont`, `thinMonospacedSystemFont`, `lightMonospacedSystemFont`, `regularMonospacedSystemFont`, `mediumMonospacedSystemFont`, `semiboldMonospacedSystemFont`, `boldMonospacedSystemFont`, `heavyMonospacedSystemFont`, `blackMonospacedSystemFont`.

Rounded variants: `ultraLightRoundedSystemFont`, `thinRoundedSystemFont`, `lightRoundedSystemFont`, `regularRoundedSystemFont`, `mediumRoundedSystemFont`, `semiboldRoundedSystemFont`, `boldRoundedSystemFont`, `heavyRoundedSystemFont`, `blackRoundedSystemFont`.

All system-font factories have the signature `(size: number): Font`.

```javascript
title.font = Font.boldSystemFont(18)
sub.font = Font.caption1()
mono.font = Font.mediumMonospacedSystemFont(13)
rounded.font = new Font('SF Pro Rounded', 15)
```

---

## SFSymbol — Apple SF Symbols

**Purpose:** Apple's configurable icons; convert to an `Image` for widgets.

Symbols are referenced by name (browse in Apple's SF Symbols app on macOS, or the SF Symbols Browser / San Fransymbols iOS apps).

```javascript
SFSymbol.named(symbolName: string): SFSymbol   // null if the name doesn't exist
symbol.image: Image (read-only)

symbol.applyFont(font: Font): void
symbol.applyUltraLightWeight(): void
symbol.applyThinWeight(): void
symbol.applyLightWeight(): void
symbol.applyRegularWeight(): void
symbol.applyMediumWeight(): void
symbol.applySemiboldWeight(): void
symbol.applyBoldWeight(): void
symbol.applyHeavyWeight(): void
symbol.applyBlackWeight(): void
```

```javascript
const symbol = SFSymbol.named('bolt.fill')
symbol.applyMediumWeight()
const wi = widget.addImage(symbol.image)
wi.tintColor = new Color('#ffd60a')
wi.imageSize = new Size(28, 28)
```

---

## Size, Point, Rect — geometry structs

### Size

```javascript
new Size(width: number, height: number)
size.width: number
size.height: number
```

### Point

```javascript
new Point(x: number, y: number)
point.x: number
point.y: number
```

### Rect

```javascript
new Rect(x: number, y: number, width: number, height: number)
rect.minX / minY / maxX / maxY: number   // read-only
rect.x / rect.y / rect.width / rect.height: number
rect.origin: Point
rect.size: Size
```

```javascript
const box = new Rect(10, 10, 100, 50)
log(box.maxX)   // 110
```

---

## LinearGradient (cross-reference)

Used as `ListWidget.backgroundGradient` or `WidgetStack.backgroundGradient`. Fully documented in [widgets-and-layout.md](widgets-and-layout.md#lineargradient).

```javascript
const g = new LinearGradient()
g.colors = [new Color('#0a84ff'), new Color('#5e5ce6')]
g.locations = [0, 1]
g.startPoint = new Point(0, 0)
g.endPoint = new Point(1, 1)
widget.backgroundGradient = g
```

`colors` and `locations` must have equal lengths; locations are 0–1; `startPoint`/`endPoint` are normalized (0–1) and default to `(0, 1)`.

---

## Path — describe a shape

**Purpose:** build an arbitrary shape for drawing with `DrawContext`.

```javascript
new Path()
path.move(point: Point): void
path.addLine(point: Point): void
path.addRect(rect: Rect): void
path.addEllipse(rect: Rect): void
path.addRoundedRect(rect: Rect, cornerWidth: number, cornerHeight: number): void
path.addCurve(point: Point, control1: Point, control2: Point): void      // cubic Bézier
path.addQuadCurve(point: Point, control: Point): void                   // quadratic Bézier
path.addLines(points: [Point]): void
path.addRects(rects: [Rect]): void
path.closeSubpath(): void
```

---

## DrawContext — custom bitmap drawing

**Purpose:** a canvas for drawing shapes, text, and images into a new `Image`. Set `size`, draw, then call `getImage()`.

```javascript
new DrawContext()
```

| Property | Type | Default | Notes |
| --- | --- | --- | --- |
| `size` | `Size` | — | Canvas size; output image has this size (unless `respectScreenScale`). |
| `respectScreenScale` | `bool` | `false` | Multiply canvas size by screen scale for crisp retina output. |
| `opaque` | `bool` | `true` | Whether the produced image is opaque. |

### Drawing methods

```javascript
getImage(): Image
drawImageInRect(image: Image, rect: Rect): void    // scaled to fit rect
drawImageAtPoint(image: Image, point: Point): void  // top-left at point

setFillColor(color: Color): void
setStrokeColor(color: Color): void
setLineWidth(width: number): void

fill(rect: Rect): void
fillRect(rect: Rect): void
fillEllipse(rect: Rect): void
stroke(rect: Rect): void
strokeRect(rect: Rect): void
strokeEllipse(rect: Rect): void

addPath(path: Path): void    // only the most recently added path is affected
strokePath(): void
fillPath(): void

drawText(text: string, pos: Point): void           // top-left at pos
drawTextInRect(text: string, rect: Rect): void
setFont(font: Font): void
setFontSize(size: number): void                    // deprecated in 1.5; use setFont
setTextColor(color: Color): void
setTextAlignedLeft() / setTextAlignedCenter() / setTextAlignedRight(): void
```

### Example — draw a rounded badge image

```javascript
const ctx = new DrawContext()
ctx.size = new Size(120, 120)
ctx.respectScreenScale = true
ctx.opaque = false
ctx.setFillColor(new Color('#0a84ff'))
ctx.fillEllipse(new Rect(0, 0, 120, 120))
ctx.setFont(Font.boldSystemFont(40))
ctx.setTextColor(Color.white())
ctx.setTextAlignedCenter()
ctx.drawTextInRect('12', new Rect(0, 0, 120, 120))
const badge = ctx.getImage()

const wi = widget.addImage(badge)
wi.imageSize = new Size(60, 60)
```

`Dynamic` colors created with `Color.dynamic()` are **not supported** in `DrawContext`. Only the latest `addPath()` path is affected by `strokePath()`/`fillPath()`.
