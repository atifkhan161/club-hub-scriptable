# Network, Data & Storage

This file covers HTTP requests, raw data, on-disk and iCloud storage, the keychain, XML parsing, dictation, the pasteboard, the document picker, and web views. The async image-loading and caching recipes here are the backbone of network-backed widgets.

> Widget rendering classes are in [widgets-and-layout.md](widgets-and-layout.md). Colors/fonts/image construction are in [images-colors-and-fonts.md](images-colors-and-fonts.md). Lifecycle and gotchas are in [core-concepts.md](core-concepts.md).

---

## Request — HTTP client

**Purpose:** perform an HTTP request and parse the response as data, string, JSON, or image.

```javascript
new Request(url: string)
```

### Properties

| Property | Type | Default | Notes |
| --- | --- | --- | --- |
| `url` | `string` | — | Target URL. |
| `method` | `string` | `'GET'` | HTTP method. |
| `headers` | `{string: string}` | `{}` | Header name → value. |
| `body` | `any` | — | String or `Data` currently supported. Ignored for multipart requests. |
| `timeoutInterval` | `number` | `60` | Seconds of inactivity before timeout. |
| `onRedirect` | `fn(Request) -> Request` | allow | Return the redirect request to continue, or `null` to stop. Invoked on the initial request only. |
| `response` | `{string: any}` (read-only) | — | Populated after completion: `url`, `statusCode`, `mimeType`, `textEncodingName`, `headers`, `cookies`. |
| `allowInsecureRequest` | `bool` | `false` | Allow requests deemed insecure (e.g. invalid certificate). Use at your own risk. |

### Methods

```javascript
load(): Promise<Data>           // raw response data
loadString(): Promise<string>   // response as string
loadJSON(): Promise<any>        // parse response as JSON
loadImage(): Promise<Image>     // parse response as an image
```

Multipart helpers (calling any of these converts the request to `multipart/form-data` and makes `body` ignored):

```javascript
addParameterToMultipart(name: string, value: string): void
addFileDataToMultipart(data: Data, mimeType: string, name: string, filename: string): void
addFileToMultipart(filePath: string, name: string, filename: string): void
addImageToMultipart(image: Image, name: string, filename: string): void
```

### Examples

```javascript
// JSON
const req = new Request('https://api.example.com/clubs')
req.method = 'POST'
req.headers = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
req.body = JSON.stringify({ city: 'Aarhus' })
const data = await req.loadJSON()
log(data.events.length)
console.log(req.response.statusCode)
```

```javascript
// Image from URL (async)
const imgReq = new Request('https://example.com/logo.png')
const image = await imgReq.loadImage()
```

Always `await` these promises and handle rejection with `try/catch` inside widgets.

---

## Data — raw bytes

**Purpose:** convert between strings/files/images and raw byte data (and base64).

```javascript
Data.fromString(string: string): Data          // UTF-8; null if invalid
Data.fromFile(filePath: string): Data
Data.fromBase64String(base64String: string): Data
Data.fromJPEG(image: Image): Data
Data.fromPNG(image: Image): Data
Data.fromBytes(bytes: [number]): Data

data.toRawString(): string
data.toBase64String(): string
data.getBytes(): [number]
```

```javascript
const bytes = Data.fromString('hello').getBytes()
const back = Data.fromBytes(bytes).toRawString()
const png = Data.fromPNG(image)
```

---

## FileManager — files and directories

**Purpose:** read/write files locally or in iCloud; manage directories, tags, and metadata. Paths are strings.

```javascript
FileManager.local(): FileManager
FileManager.iCloud(): FileManager    // requires iCloud enabled
```

### Read / write

```javascript
read(filePath: string): Data          // returns null if unreadable
readString(filePath: string): string
readImage(filePath: string): Image
write(filePath: string, content: Data): void
writeString(filePath: string, content: string): void    // creates or overwrites
writeImage(filePath: string, image: Image): void        // creates or overwrites
```

Reading errors if the file does not exist or is an undownloaded iCloud file. Check with `fileExists()` and call `await downloadFileFromiCloud(path)` first (safe to call for local files too).

### File operations

```javascript
remove(filePath: string): void
move(sourceFilePath: string, destinationFilePath: string): void  // overwrites destination
copy(sourceFilePath: string, destinationFilePath: string): void  // fails if destination exists
fileExists(filePath: string): bool
isDirectory(path: string): bool
createDirectory(path: string, intermediateDirectories: bool = false): void
```

### Well-known directories

```javascript
temporaryDirectory(): string   // shortest-lived; OS may purge anytime; NOT shared app/extension/Siri
cacheDirectory(): string       // longer-lived than temp, still purgeable; NOT shared
documentsDirectory(): string   // long-lived; where scripts live; visible in Files app only if iCloud enabled
libraryDirectory(): string     // long-lived; not visible in Files app
joinPath(lhsPath: string, rhsPath: string): string   // RECOMMENDED way to build paths
```

### Metadata & tags

```javascript
allTags(filePath: string): [string]
addTag(filePath: string, tag: string): void
removeTag(filePath: string, tag: string): void

readExtendedAttribute(filePath: string, name: string): string     // null if missing
writeExtendedAttribute(filePath: string, value: string, name: string): void
removeExtendedAttribute(filePath: string, name: string): void
allExtendedAttributes(filePath: string): [string]   // extended attrs are NOT iCloud-synced

getUTI(filePath: string): string
listContents(directoryPath: string): [string]
fileName(filePath: string, includeFileExtension: bool = false): string
fileExtension(filePath: string): string
creationDate(filePath: string): Date     // null if unreadable
modificationDate(filePath: string): Date // null if unreadable
fileSize(filePath: string): number       // kilobytes; null if unreadable
```

### iCloud helpers

```javascript
downloadFileFromiCloud(filePath: string): Promise   // resolves immediately for local files
isFileStoredIniCloud(filePath: string): bool
isFileDownloaded(filePath: string): bool
```

### Bookmarks

```javascript
bookmarkedPath(name: string): string       // throws if missing
bookmarkExists(name: string): bool
allFileBookmarks(): [{string: string}]     // { name, source } where source = 'host' | 'siri_shortcuts'
```

Bookmarks created in settings work only in the app; for Siri/Shortcuts create them with the "Create File Bookmark" shortcut action.

### Image caching recipe (widget-safe)

```javascript
const fm = FileManager.local()
const dir = fm.joinPath(fm.cacheDirectory(), 'club-cache')
if (!fm.fileExists(dir)) fm.createDirectory(dir, true)

async function fetchAndCache(url, key, maxAgeMs) {
  const path = fm.joinPath(dir, key)
  if (fm.fileExists(path) && fm.modificationDate(path) > new Date(Date.now() - maxAgeMs)) {
    return fm.readImage(path)
  }
  const req = new Request(url)
  const data = await req.load()          // Data
  fm.write(path, data)                   // cache raw bytes
  return Image.fromData(data)
}
```

Cache in `cacheDirectory()` (or `documentsDirectory()` for long-lived data). Keep cached images reasonably small — widget memory limits still apply when they are decoded for display.

---

## Keychain — secure storage

**Purpose:** store credentials/keys in an encrypted database.

```javascript
Keychain.contains(key: string): bool
Keychain.set(key: string, value: string): void    // overwrites existing
Keychain.get(key: string): string                 // THROWS if key missing
Keychain.remove(key: string): void
```

```javascript
if (!Keychain.contains('apiToken')) Keychain.set('apiToken', 'secret')
const token = Keychain.get('apiToken')
```

---

## XMLParser — event-driven XML parsing

**Purpose:** callbacks-based parser for XML strings. It does not build a tree itself.

```javascript
new XMLParser(string: string)
parser.parse(): bool    // true if parsing started successfully
```

Callbacks (set before `parse()`):

| Callback | Signature | Fired when |
| --- | --- | --- |
| `didStartDocument` | `fn()` | Parsing begins. |
| `didEndDocument` | `fn()` | Document parsed successfully. |
| `didStartElement` | `fn(name: string, attributes: {string: string})` | A start tag is encountered. |
| `didEndElement` | `fn(name: string)` | An end tag is encountered. |
| `foundCharacters` | `fn(text: string)` | Character data found (may fire multiple times per element). |
| `parseErrorOccurred` | `fn()` | Fatal error; parsing stops. |

```javascript
const parser = new XMLParser(xmlString)
parser.didStartElement = (name, attrs) => log('start ' + name)
parser.foundCharacters = (text) => log('chars ' + text)
parser.didEndElement = (name) => log('end ' + name)
parser.parse()
```

Property `parser.string` holds the XML to parse.

---

## Dictation — speech-to-text

```javascript
Dictation.start(locale: string = deviceLocale): Promise<string>
```

Presents a dictation interface; the user presses "Done" to finish. `locale` like `'en'`, `'it'`, `'da'`.

```javascript
const text = await Dictation.start('en')
```

---

## Pasteboard — clipboard

```javascript
Pasteboard.copy(string: string): void           // alias-style convenience
Pasteboard.paste(): string                      // null if no string
Pasteboard.copyString(string: string): void
Pasteboard.pasteString(): string
Pasteboard.copyImage(image: Image): void
Pasteboard.pasteImage(): Image                  // null if no image
```

```javascript
Pasteboard.copyString('hello')
const clip = Pasteboard.pasteString()
```

---

## DocumentPicker — Files app integration

**Purpose:** open files/folders from the Files app or export files to it.

```javascript
DocumentPicker.open(types: [string] = all): Promise<[string]>  // UTIs e.g. 'public.image'
DocumentPicker.openFile(): Promise<string>    // any file
DocumentPicker.openFolder(): Promise<string>
DocumentPicker.export(path: string): Promise<[string]>
DocumentPicker.exportString(content: string, name: string): Promise<[string]>
DocumentPicker.exportImage(image: Image, name: string): Promise<[string]>
DocumentPicker.exportData(data: Data, name: string): Promise<[string]>
```

```javascript
const paths = await DocumentPicker.open(['public.plain-text'])
const contents = FileManager.local().readString(paths[0])
```

---

## WebView — render HTML/web pages and evaluate JS

Purpose: render HTML, a file, or a URL, and run JavaScript in the page (useful for scraping).

```javascript
new WebView()
webView.shouldAllowRequest: fn(Request) -> bool   // default: allow all; disallow to speed up loading
```

Static present-and-load helpers (promise resolves when the presented view is dismissed):

```javascript
WebView.loadHTML(html: string, baseURL?: string, preferredSize?: Size, fullscreen = false): Promise
WebView.loadFile(fileURL: string, preferredSize?: Size, fullscreen = false): Promise
WebView.loadURL(url: string, preferredSize?: Size, fullscreen = false): Promise
```

Instance methods:

```javascript
loadURL(url: string): Promise
loadRequest(request: Request): Promise
loadHTML(html: string, baseURL?: string): Promise
loadFile(fileURL: string): Promise
evaluateJavaScript(javaScript: string, useCallback = false): Promise<any>
getHTML(): Promise<any>
present(fullscreen = false): Promise
waitForLoad(): Promise<any>
```

`evaluateJavaScript` returns the value of the last line by default. With `useCallback = true`, evaluation waits for a global `completion(value)` call inside the page. `log()`/`logError()` from evaluated JS appear in Scriptable's log.

```javascript
const web = new WebView()
await web.loadURL('https://example.com')
const title = await web.evaluateJavaScript('document.title')
const html = await web.getHTML()
```

`preferredSize` is only honored in Siri/Shortcuts. For large images in memory-constrained contexts, prefer `WebView` over `QuickLook` — the web view runs in a separate process.

`loadRequest` respects the request's method/body/headers but does **not** invoke its `onRedirect`. `waitForLoad()` should only be used when a load is triggered from `evaluateJavaScript`; otherwise the returned promise may never resolve.
