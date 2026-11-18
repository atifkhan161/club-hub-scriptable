# API Quick Index

Compact alphabetical index of **all 60 classes/globals** in the official Scriptable API. Click through to the reference file that documents each one in full. (Source: `https://docs.scriptable.app/`.)

Files: [core-concepts.md](core-concepts.md) · [widgets-and-layout.md](widgets-and-layout.md) · [network-data-and-storage.md](network-data-and-storage.md) · [images-colors-and-fonts.md](images-colors-and-fonts.md) · [system-and-automation.md](system-and-automation.md)

| API | One-line purpose | Reference file |
| --- | --- | --- |
| `Alert` | Modal alert or sheet with actions and text fields. | [system-and-automation.md](system-and-automation.md#alert--modal-alerts-and-sheets) |
| `args` | Inputs from share sheet, Shortcuts, URL scheme, widget parameter, notification. | [core-concepts.md](core-concepts.md#args--inputs-to-the-script) |
| `Calendar` | Fetch/create calendars that hold events or reminders. | [system-and-automation.md](system-and-automation.md#calendar) |
| `CalendarEvent` | Create, fetch, edit, remove calendar events. | [system-and-automation.md](system-and-automation.md#calendarevent) |
| `CallbackURL` | Open x-callback-url apps and await their response. | [system-and-automation.md](system-and-automation.md#speech-safari-sharesheet-quicklook-callbackurl) |
| `Color` | Color from hex/system colors, alpha, light/dark dynamic variants. | [images-colors-and-fonts.md](images-colors-and-fonts.md#color) |
| `config` | Read-only execution context flags (in app/widget, widget family). | [core-concepts.md](core-concepts.md#config--execution-context) |
| `console` | Log messages (`log`, `warn`, `error`). | [core-concepts.md](core-concepts.md#console--logging) |
| `Contact` | Read/create/update/delete address-book contacts. | [system-and-automation.md](system-and-automation.md#contact--contactscontainer--contactsgroup) |
| `ContactsContainer` | A contacts source/account containing contacts and groups. | [system-and-automation.md](system-and-automation.md#contact--contactscontainer--contactsgroup) |
| `ContactsGroup` | Group of contacts within a container. | [system-and-automation.md](system-and-automation.md#contact--contactscontainer--contactsgroup) |
| `Data` | Raw byte data; conversions to/from string, file, image, base64. | [network-data-and-storage.md](network-data-and-storage.md#data--raw-bytes) |
| `DateFormatter` | Convert between dates and strings; date/time styles. | [system-and-automation.md](system-and-automation.md#dateformatter--relativedatetimeformatter) |
| `DatePicker` | Present a modal picker for time, date, date+time, countdown. | [system-and-automation.md](system-and-automation.md#datepicker--pick-a-datetime) |
| `Device` | Device name, model, screen, orientation, battery, locale, brightness. | [system-and-automation.md](system-and-automation.md#device--device-and-screen-information) |
| `Dictation` | Present speech-to-text dictation interface. | [network-data-and-storage.md](network-data-and-storage.md#dictation--speech-to-text) |
| `DocumentPicker` | Open/export files and folders via the Files app. | [network-data-and-storage.md](network-data-and-storage.md#documentpicker--files-app-integration) |
| `DrawContext` | Canvas for custom drawing images, shapes, and text. | [images-colors-and-fonts.md](images-colors-and-fonts.md#drawcontext--custom-bitmap-drawing) |
| `FileManager` | Read/write local or iCloud files and directories; caching. | [network-data-and-storage.md](network-data-and-storage.md#filemanager--files-and-directories) |
| `Font` | Font and size for styling text. | [images-colors-and-fonts.md](images-colors-and-fonts.md#font) |
| `Image` | Image data; load from file/data, size in pixels. | [images-colors-and-fonts.md](images-colors-and-fonts.md#image) |
| `importModule` | Import a JS module (alias `require`); returns `module.exports`. | [core-concepts.md](core-concepts.md#importmodule--module--shared-code) |
| `Keychain` | Encrypted storage for secrets. | [network-data-and-storage.md](network-data-and-storage.md#keychain--secure-storage) |
| `LinearGradient` | Gradient for widget/stack backgrounds. | [widgets-and-layout.md](widgets-and-layout.md#lineargradient) |
| `ListWidget` | Root widget; add elements, padding, refresh date, previews. | [widgets-and-layout.md](widgets-and-layout.md#listwidget) |
| `Location` | Current GPS location and reverse geocoding. | [system-and-automation.md](system-and-automation.md#location) |
| `Mail` | Compose and send an email with attachments. | [system-and-automation.md](system-and-automation.md#mail) |
| `Message` | Compose and send an iMessage/SMS with attachments. | [system-and-automation.md](system-and-automation.md#message) |
| `module` | Current module's `exports` and `filename`. | [core-concepts.md](core-concepts.md#importmodule--module--shared-code) |
| `Notification` | Schedule/manage local notifications and rich notifications. | [system-and-automation.md](system-and-automation.md#notification--schedule-and-manage-notifications) |
| `Pasteboard` | Copy/paste strings and images. | [network-data-and-storage.md](network-data-and-storage.md#pasteboard--clipboard) |
| `Path` | Describe a shape for drawing with `DrawContext`. | [images-colors-and-fonts.md](images-colors-and-fonts.md#path--describe-a-shape) |
| `Photos` | Pick/capture/save/read/remove photos and screenshots. | [system-and-automation.md](system-and-automation.md#photos) |
| `Point` | 2D coordinate `{x, y}`. | [images-colors-and-fonts.md](images-colors-and-fonts.md#size-point-rect--geometry-structs) |
| `QuickLook` | Present a file/image/text with the system preview. | [system-and-automation.md](system-and-automation.md#speech-safari-sharesheet-quicklook-callbackurl) |
| `Rect` | Rectangle with origin `Point` and `Size`. | [images-colors-and-fonts.md](images-colors-and-fonts.md#size-point-rect--geometry-structs) |
| `RecurrenceRule` | Repeating rules for events/reminders (daily…complex yearly). | [system-and-automation.md](system-and-automation.md#recurrencerule--repeating-eventsreminders) |
| `RelativeDateTimeFormatter` | "yesterday", "in 1 week" style relative time strings. | [system-and-automation.md](system-and-automation.md#dateformatter--relativedatetimeformatter) |
| `Reminder` | Create/fetch/remove reminders in calendars. | [system-and-automation.md](system-and-automation.md#reminder) |
| `Request` | HTTP request; load data/string/JSON/image, multipart. | [network-data-and-storage.md](network-data-and-storage.md#request--http-client) |
| `Safari` | Open a URL in-app or in the Safari app. | [system-and-automation.md](system-and-automation.md#speech-safari-sharesheet-quicklook-callbackurl) |
| `Script` | `setWidget`, `complete`, `name`, `setShortcutOutput`. | [core-concepts.md](core-concepts.md#script--script-lifecycle) |
| `SFSymbol` | Apple SF Symbol icon converted to an `Image`. | [images-colors-and-fonts.md](images-colors-and-fonts.md#sfsymbol--apple-sf-symbols) |
| `ShareSheet` | Present the system activity/share picker. | [system-and-automation.md](system-and-automation.md#speech-safari-sharesheet-quicklook-callbackurl) |
| `Size` | 2D size `{width, height}`. | [images-colors-and-fonts.md](images-colors-and-fonts.md#size-point-rect--geometry-structs) |
| `Speech` | Speak text (Siri when run from a Shortcut). | [system-and-automation.md](system-and-automation.md#speech-safari-sharesheet-quicklook-callbackurl) |
| `TextField` | Text field inside an `Alert`. | [system-and-automation.md](system-and-automation.md#textfield--text-field-inside-an-alert) |
| `Timer` | Delayed/repeating callback timer. | [core-concepts.md](core-concepts.md#timer--delayed-and-repeating-callbacks) |
| `UITable` | Structured table view. | [system-and-automation.md](system-and-automation.md#uitable--uitablerow--uitablecell--structured-lists) |
| `UITableCell` | Cell in a `UITableRow` (text/image/button). | [system-and-automation.md](system-and-automation.md#uitable--uitablerow--uitablecell--structured-lists) |
| `UITableRow` | Row in a `UITable`, containing cells. | [system-and-automation.md](system-and-automation.md#uitable--uitablerow--uitablecell--structured-lists) |
| `URLScheme` | Build `scriptable://` deep links; read query params. | [core-concepts.md](core-concepts.md#urlscheme--deep-links-into-scriptable) |
| `UUID` | Generate a universally unique identifier string. | [system-and-automation.md](system-and-automation.md#uuid) |
| `WebView` | Render HTML/files/URLs and evaluate JavaScript in a page. | [network-data-and-storage.md](network-data-and-storage.md#webview--render-htmlweb-pages-and-evaluate-js) |
| `WidgetDate` | Auto-updating date element for widgets. | [widgets-and-layout.md](widgets-and-layout.md#widgetdate) |
| `WidgetImage` | Image element with sizing/corner/tint/relative-shape options. | [widgets-and-layout.md](widgets-and-layout.md#widgetimage) |
| `WidgetSpacer` | Fixed or flexible space between widget elements. | [widgets-and-layout.md](widgets-and-layout.md#widgetspacer) |
| `WidgetStack` | Container; horizontal/vertical nested layout, alignment, backgrounds. | [widgets-and-layout.md](widgets-and-layout.md#widgetstack) |
| `WidgetText` | Styled text element for widgets. | [widgets-and-layout.md](widgets-and-layout.md#widgettext) |
| `XMLParser` | Event-driven XML parsing via callbacks. | [network-data-and-storage.md](network-data-and-storage.md#xmlparser--event-driven-xml-parsing) |

## Reading map by task

- **Build a widget UI** → `widgets-and-layout.md` → `images-colors-and-fonts.md` (styling).
- **Network-backed / cached widget** → `widgets-and-layout.md` (WidgetImage) + `network-data-and-storage.md` (Request, FileManager).
- **Debug why a widget is blank** → `core-concepts.md` (gotchas), `widgets-and-layout.md` (gotchas), `network-data-and-storage.md` (error handling around Image/Request).
- **Shortcuts / notification / calendar automations** → `system-and-automation.md`.
- **Find a specific API quickly** → this file.
