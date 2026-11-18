# System & Automation

This file documents the system-facing and automation APIs: alerts and UI pickers, notifications, device info, calendars/events/reminders, contacts, location, mail/messages, photos, speech, Safari, share sheets, Quick Look, tables, formatters, recurrence rules, UUIDs, URL callbacks, and the script/context globals (`Script`, `config`, `args`, `importModule`, `module`, `console`, `Timer`).

> Widget UI is in [widgets-and-layout.md](widgets-and-layout.md); HTTP/files are in [network-data-and-storage.md](network-data-and-storage.md); visual types are in [images-colors-and-fonts.md](images-colors-and-fonts.md). The complete alphabetical index is [api-quick-index.md](api-quick-index.md).

The globals `Script`, `config`, `args`, `importModule`, `module`, `console`, and `Timer` are fully documented in [core-concepts.md](core-concepts.md); concise summaries are repeated here for completeness.

---

## Alert — modal alerts and sheets

```javascript
new Alert()
alert.title: string
alert.message: string

alert.addAction(title: string): void
alert.addDestructiveAction(title: string): void     // red text
alert.addCancelAction(title: string): void          // selected index = -1; only one allowed
alert.addTextField(placeholder?, text?): TextField
alert.addSecureTextField(placeholder?, text?): TextField
alert.textFieldValue(index: number): string

alert.present(): Promise<number>        // alias for presentAlert
alert.presentAlert(): Promise<number>   // promise carries selected action index
alert.presentSheet(): Promise<number>
```

Text fields are not supported with `presentSheet()`. Promise resolves to the index of the selected action; cancel actions yield `-1`.

```javascript
const a = new Alert()
a.title = 'Save club?'
a.message = 'This will add the club to your calendar.'
a.addCancelAction('Cancel')
a.addAction('Save')
const idx = await a.presentAlert()   // 0 = Save, -1 = Cancel
```

---

## TextField — text field inside an alert

You do not construct this directly; get it from `alert.addTextField()` / `addSecureTextField()`.

| Property | Type | Notes |
| --- | --- | --- |
| `text` | `string` | Current text. |
| `placeholder` | `string` | Placeholder when empty. |
| `isSecure` | `bool` | Hides entered text; default `false`. |
| `textColor` | `Color` | Text color. |
| `font` | `Font` | Text font. |

Keyboard methods: `setDefaultKeyboard()`, `setNumberPadKeyboard()`, `setDecimalPadKeyboard()`, `setNumbersAndPunctuationKeyboard()`, `setPhonePadKeyboard()`, `setWebSearchKeyboard()`, `setEmailAddressKeyboard()`, `setURLKeyboard()`, `setTwitterKeyboard()`.

Alignment: `leftAlignText()` (default), `centerAlignText()`, `rightAlignText()`.

Read values with `alert.textFieldValue(0)` after presenting.

---

## DatePicker — pick a date/time

```javascript
new DatePicker()
picker.minimumDate: Date
picker.maximumDate: Date
picker.countdownDuration: number   // seconds; max 86,399 (23:59)
picker.minuteInterval: number      // 1–30, default 1
picker.initialDate: Date           // initial selection only; NOT the result

picker.pickTime(): Promise<Date>
picker.pickDate(): Promise<Date>
picker.pickDateAndTime(): Promise<Date>
picker.pickCountdownDuration(): Promise<number>
```

`minimumDate`/`maximumDate` are ignored if min > max and in countdown mode.

---

## Notification — schedule and manage notifications

```javascript
new Notification()
n.identifier: string                 // reuse to reschedule
n.title / subtitle / body: string
n.badge: number                      // 0 hides; null leaves unchanged (default null)
n.threadIdentifier: string           // grouping
n.userInfo: {string: any}            // custom data, read via args.notification
n.sound: string                      // null (default) or default/accept/alert/complete/event/
                                     // failure/piano_error/piano_success/popup
n.openURL: string                    // URL opened on tap
n.scriptName: string                 // script to run in a rich notification
n.preferredContentHeight: number
n.deliveryDate: Date (read-only)
n.nextTriggerDate: Date (read-only)
n.actions: {string: string} (read-only)

n.schedule(): Promise<void>
n.remove(): Promise<void>
n.setTriggerDate(date: Date): void
n.setDailyTrigger(hour: number, minute: number, repeats = false): void
n.setWeeklyTrigger(weekday: number, hour: number, minute: number, repeats = false): void
n.addAction(title: string, url: string, destructive = false): void

Notification.current(): Notification   // deprecated -> args.notification
Notification.allPending(): Promise<[Notification]>
Notification.allDelivered(): Promise<[Notification]>
Notification.removeAllPending(): Promise<void>   // removes ALL scripts' pending notifications
Notification.removeAllDelivered(): Promise<void>
Notification.removePending(identifiers: [string]): Promise<void>
Notification.removeDelivered(identifiers: [string]): Promise<void>
Notification.resetCurrent(): void               // sets args.notification to null
```

```javascript
const n = new Notification()
n.title = 'Club night'
n.body = 'Doors open at 7 PM'
n.sound = 'default'
n.userInfo = { clubId: 42 }
n.setTriggerDate(new Date(Date.now() + 3600e3))
await n.schedule()
```

---

## Device — device and screen information

All methods are static.

```javascript
Device.name(): string
Device.systemName(): string                // e.g. "iOS"
Device.systemVersion(): string
Device.model(): string                     // e.g. "iPhone"
Device.isPhone(): bool
Device.isPad(): bool
Device.screenSize(): Size                  // points; accounts for rotation
Device.screenResolution(): Size            // pixels; ignores rotation
Device.screenScale(): number               // 1, 2, or 3
Device.screenBrightness(): number          // 0–1
Device.isInPortrait() / isInPortraitUpsideDown() / isInLandscapeLeft() / isInLandscapeRight(): bool
Device.isFaceUp() / isFaceDown(): bool
Device.batteryLevel(): number              // 0–1
Device.isDischarging() / isCharging() / isFullyCharged(): bool
Device.preferredLanguages(): [string]
Device.locale(): string
Device.language(): string
Device.isUsingDarkAppearance(): bool       // NOT supported in widgets
Device.volume(): number                    // 0–1
Device.setScreenBrightness(percentage: number): void  // 0–1
```

---

## Calendar

**Purpose:** obtain calendars that hold reminders or events. A calendar holds either events or reminders, never both.

| Property | Type | Notes |
| --- | --- | --- |
| `identifier` | `string` (read-only) | Identifier. |
| `title` | `string` | Editable title. |
| `isSubscribed` | `bool` (read-only) | Subscribed calendar. |
| `allowsContentModifications` | `bool` (read-only) | Whether items can be modified. |
| `color` | `Color` | Calendar color. |

```javascript
Calendar.forReminders(): Promise<[Calendar]>
Calendar.forEvents(): Promise<[Calendar]>
Calendar.forRemindersByTitle(title: string): Promise<Calendar>
Calendar.forEventsByTitle(title: string): Promise<Calendar>
Calendar.createForReminders(title: string): Promise<Calendar>
Calendar.findOrCreateForReminders(title: string): Promise<Calendar>
Calendar.defaultForReminders(): Promise<Calendar>
Calendar.defaultForEvents(): Promise<Calendar>
Calendar.presentPicker(allowMultiple = false): Promise<[Calendar]>

calendar.supportsAvailability(availability: string): bool  // busy|free|tentative|unavailable
calendar.save(): void
calendar.remove(): void
```

`createForReminders` / `findOrCreateForReminders` are auto-saved (no `save()` needed).

---

## CalendarEvent

**Purpose:** create, fetch, edit, and remove calendar events.

```javascript
new CalendarEvent()
```

| Property | Type | Notes |
| --- | --- | --- |
| `identifier` | `string` (read-only) | — |
| `title`, `location`, `notes` | `string` | — |
| `startDate`, `endDate` | `Date` | — |
| `isAllDay` | `bool` | — |
| `attendees` | `[any]` (read-only) | `{ isCurrentUser, name, status, type, role }`. |
| `availability` | `string` | busy/free/tentative/unavailable. |
| `timeZone` | `string` | e.g. `"Europe/Copenhagen"`. |
| `calendar` | `Calendar` | Containing calendar. |

```javascript
event.addRecurrenceRule(rule: RecurrenceRule): void
event.removeAllRecurrenceRules(): void
event.save(): void
event.remove(): void
event.presentEdit(): Promise<CalendarEvent>
CalendarEvent.presentCreate(): Promise<CalendarEvent>
CalendarEvent.today(calendars?: [Calendar]): Promise<[CalendarEvent]>
CalendarEvent.tomorrow(calendars?): Promise<[CalendarEvent]>
CalendarEvent.yesterday(calendars?): Promise<[CalendarEvent]>
CalendarEvent.thisWeek(calendars?): Promise<[CalendarEvent]>
CalendarEvent.nextWeek(calendars?): Promise<[CalendarEvent]>
CalendarEvent.lastWeek(calendars?): Promise<[CalendarEvent]>
CalendarEvent.between(startDate: Date, endDate: Date, calendars?: [Calendar]): Promise<[CalendarEvent]>
```

Omitting `calendars` fetches from all calendars.

---

## Reminder

**Purpose:** create, fetch, and remove reminders.

```javascript
new Reminder()
```

| Property | Type | Notes |
| --- | --- | --- |
| `identifier` | `string` (read-only) | — |
| `title`, `notes` | `string` | — |
| `isCompleted` | `bool` | — |
| `isOverdue` | `bool` (read-only) | — |
| `priority` | `number` | 0 = undefined, 1 = highest, 9 = lowest. |
| `dueDate` | `Date` | — |
| `dueDateIncludesTime` | `bool` | default `true`; if false, time part ignored. |
| `completionDate`, `creationDate` | `Date` (read-only) | — |
| `calendar` | `Calendar` | Containing calendar. |

```javascript
reminder.addRecurrenceRule(rule: RecurrenceRule): void
reminder.removeAllRecurrenceRules(): void
reminder.save(): void
reminder.remove(): void
```

Fetch helpers (each takes optional `calendars: [Calendar]` and returns `Promise<[Reminder]>`):

`Reminder.scheduled()`, `all()`, `allCompleted()`, `allIncomplete()`, `allDueToday()`, `completedDueToday()`, `incompleteDueToday()`, `allDueTomorrow()`, `completedDueTomorrow()`, `incompleteDueTomorrow()`, `allDueYesterday()`, `completedDueYesterday()`, `incompleteDueYesterday()`, `allDueThisWeek()`, `completedDueThisWeek()`, `incompleteDueThisWeek()`, `allDueNextWeek()`, `completedDueNextWeek()`, `incompleteDueNextWeek()`, `allDueLastWeek()`, `completedDueLastWeek()`, `incompleteDueLastWeek()`, `completedToday()`, `completedThisWeek()`, `completedLastWeek()`.

`completed*` helpers ignore due date (they return reminders completed in that period). Range helpers:

```javascript
Reminder.allDueBetween(startDate, endDate, calendars?): Promise<[Reminder]>
Reminder.completedDueBetween(startDate, endDate, calendars?): Promise<[Reminder]>
Reminder.incompleteDueBetween(startDate, endDate, calendars?): Promise<[Reminder]>
Reminder.completedBetween(startDate, endDate, calendars?): Promise<[Reminder]>
```

iOS limits fetched results to a four-year timespan.

---

## RecurrenceRule — repeating events/reminders

All factories are static and return `RecurrenceRule`. `interval > 0`; `1` = every day/week/month/year.

```javascript
RecurrenceRule.daily(interval: number): RecurrenceRule
RecurrenceRule.dailyEndDate(interval, endDate: Date): RecurrenceRule
RecurrenceRule.dailyOccurrenceCount(interval, occurrenceCount: number): RecurrenceRule
RecurrenceRule.weekly(interval): RecurrenceRule
RecurrenceRule.weeklyEndDate(interval, endDate): RecurrenceRule
RecurrenceRule.weeklyOccurrenceCount(interval, occurrenceCount): RecurrenceRule
RecurrenceRule.monthly(interval): RecurrenceRule
RecurrenceRule.monthlyEndDate(interval, endDate): RecurrenceRule
RecurrenceRule.monthlyOccurrenceCount(interval, occurrenceCount): RecurrenceRule
RecurrenceRule.yearly(interval): RecurrenceRule
RecurrenceRule.yearlyEndDate(interval, endDate): RecurrenceRule
RecurrenceRule.yearlyOccurrenceCount(interval, occurrenceCount): RecurrenceRule
```

Complex forms:

```javascript
RecurrenceRule.complexWeekly(interval, daysOfTheWeek: [number], setPositions: [number]): RecurrenceRule
RecurrenceRule.complexWeeklyEndDate(interval, daysOfTheWeek, setPositions, endDate): RecurrenceRule
RecurrenceRule.complexWeeklyOccurrenceCount(interval, daysOfTheWeek, setPositions, occurrenceCount): RecurrenceRule

RecurrenceRule.complexMonthly(interval, daysOfTheWeek, daysOfTheMonth: [number], setPositions): RecurrenceRule
RecurrenceRule.complexMonthlyEndDate(interval, daysOfTheWeek, daysOfTheMonth, setPositions, endDate): RecurrenceRule
RecurrenceRule.complexMonthlyOccurrenceCount(interval, daysOfTheWeek, daysOfTheMonth, setPositions, occurrenceCount): RecurrenceRule

RecurrenceRule.complexYearly(interval, daysOfTheWeek, monthsOfTheYear: [number],
                             weeksOfTheYear: [number], daysOfTheYear: [number], setPositions): RecurrenceRule
RecurrenceRule.complexYearlyEndDate(...same..., endDate): RecurrenceRule
RecurrenceRule.complexYearlyOccurrenceCount(...same..., occurrenceCount): RecurrenceRule
```

`daysOfTheWeek`: 1–7 (Sunday = 1). `daysOfTheMonth`: 1–31 or -1…-31. `monthsOfTheYear`: 1–12. `weeksOfTheYear`: 1–53 or negatives. `daysOfTheYear`: 1–366 or negatives. `setPositions` filters occurrences (e.g. `[2, -1]` = second and last).

```javascript
reminder.addRecurrenceRule(RecurrenceRule.weekly(1))
```

---

## Contact / ContactsContainer / ContactsGroup

Changes are queued and persisted in batches via `Contact.persistChanges()`. A contact belongs to one container but can be in many groups.

### Contact

```javascript
new Contact()
contact.identifier: string (read-only)
contact.namePrefix / givenName / middleName / familyName / nickname: string
contact.birthday: Date
contact.image: Image
contact.emailAddresses: [{string: string}]       // needs "value" key when updating
contact.phoneNumbers: [{string: string}]         // needs "value" key
contact.postalAddresses: [{string: string}]
contact.socialProfiles: [{string: string}]
contact.urlAddresses: [{string: string}]
contact.dates: [{string: any}]
contact.organizationName / departmentName / jobTitle: string
contact.note: string                              // deprecated 1.7.5 (notes removed)
// is*Available read-only bool flags for each field (e.g. isGivenNameAvailable, isImageAvailable, ...)

Contact.all(containers?: [ContactsContainer]): Promise<[Contact]>
Contact.inGroups(groups: [ContactsGroup]): Promise<[Contact]>
Contact.add(contact: Contact, containerIdentifier?: string): void
Contact.update(contact: Contact): void
Contact.delete(contact: Contact): void
Contact.persistChanges(): Promise<void>
```

Email/phone object shape: `{ identifier, label, localizedLabel, value }`. Postal: adds `street`, `city`, `state`, `postalCode`, `country`. Social: `{ service, url, userIdentifier, username, ... }`.

### ContactsContainer

```javascript
container.identifier / name: string (read-only)
ContactsContainer.default(): Promise<ContactsContainer>
ContactsContainer.all(): Promise<[ContactsContainer]>
ContactsContainer.withIdentifier(identifier: string): Promise<ContactsContainer>
```

### ContactsGroup

```javascript
new ContactsGroup()
group.identifier: string (read-only)
group.name: string
group.addMember(contact: Contact): void
group.removeMember(contact: Contact): void
ContactsGroup.all(containers: [ContactsContainer]): Promise<[ContactsGroup]>
ContactsGroup.add(group: ContactsGroup, containerIdentifier?: string): void
ContactsGroup.update(group: ContactsGroup): void
ContactsGroup.delete(group: ContactsGroup): void
```

```javascript
const c = new Contact()
c.givenName = 'Ada'
c.phoneNumbers = [{ value: '+45 1234 5678', label: 'mobile' }]
Contact.add(c)
await Contact.persistChanges()
```

---

## Location

```javascript
Location.current(): Promise<{string: number}>   // latitude, longitude, altitude, accuracies
Location.setAccuracyToBest()                    // default
Location.setAccuracyToTenMeters()
Location.setAccuracyToHundredMeters()
Location.setAccuracyToKilometer()
Location.setAccuracyToThreeKilometers()
Location.reverseGeocode(latitude: number, longitude: number, locale?: string): [{string: any}]
```

First use prompts for authorization; denial requires enabling it in Settings.

---

## Mail

```javascript
new Mail()
mail.toRecipients / ccRecipients / bccRecipients: [string]
mail.subject / body: string
mail.isBodyHTML: bool           // default false
mail.preferredSendingEmailAddress: string
mail.send(): Promise<void>
mail.addImageAttachment(image: Image): void
mail.addFileAttachment(filePath: string): void
mail.addDataAttachment(data: Data, mimeType: string, filename: string): void
```

Presents a compose screen; the user confirms before sending.

---

## Message

```javascript
new Message()
message.recipients: [string]    // phone numbers
message.body: string
message.send(): Promise<void>
message.addImageAttachment(image: Image): void
message.addFileAttachment(filePath: string): void
message.addDataAttachment(data: Data, uti: string, filename: string): void
```

---

## Photos

Requires photo library permission.

```javascript
Photos.fromLibrary(): Promise<Image>
Photos.fromCamera(): Promise<Image>
Photos.latestPhoto(): Promise<Image>
Photos.latestPhotos(count: number): Promise<[Image]>
Photos.latestScreenshot(): Promise<Image>
Photos.latestScreenshots(count: number): Promise<[Image]>
Photos.removeLatestPhoto(): void
Photos.removeLatestPhotos(count: number): void
Photos.removeLatestScreenshot(): void
Photos.removeLatestScreenshots(count: number): void
Photos.save(image: Image): void
```

Removal methods show a confirmation alert first. `latest*` promises reject if nothing is available.

---

## Speech, Safari, ShareSheet, QuickLook, CallbackURL

### Speech

```javascript
Speech.speak(text: string): void   // Siri speaks when triggered from a Siri Shortcut
```

### Safari

```javascript
Safari.openInApp(url: string, fullscreen = true): Promise<void>
Safari.open(url: string): void     // leaves the app, opens Safari
```

### ShareSheet

```javascript
ShareSheet.present(activityItems: [any]): Promise<{string: any}>
```

Presents the system activity picker; promise resolves when dismissed and reports the chosen activity.

### QuickLook

```javascript
QuickLook.present(item: any, fullscreen = false): Promise<void>
```

Presents a file, image, or text with the best-suited preview. Prefer `WebView` for very large images in memory-constrained contexts (Siri/Shortcuts).

### CallbackURL — x-callback-url

```javascript
new CallbackURL(baseURL: string)   // e.g. "my-app://x-callback-url/action"
cb.addParameter(name: string, value: string): void   // auto-encoded; don't add x-source/x-success/x-error/x-cancel
cb.open(): Promise<{string: string}>   // rejects on failure, cancel, or timeout
cb.getURL(): string
```

---

## UITable / UITableRow / UITableCell — structured lists

### UITable

```javascript
new UITable()
table.showSeparators: bool       // default false
table.addRow(row: UITableRow): void
table.removeRow(row: UITableRow): void
table.removeAllRows(): void
table.reload(): void             // required after modifying rows while presented
table.present(fullscreen = false): Promise<void>
```

Rows render top-to-bottom in add order. `fullscreen` only affects the app.

### UITableRow

```javascript
new UITableRow()
row.cellSpacing: number
row.height: number               // default 44
row.isHeader: bool               // default false
row.dismissOnSelect: bool        // default true (only if onSelect set)
row.onSelect: fn()               // default null; rows cannot be tapped in Siri
row.backgroundColor: Color
row.addCell(cell: UITableCell): void
row.addText(title?: string, subtitle?: string): UITableCell
row.addImage(image: Image): UITableCell
row.addImageAtURL(url: string): UITableCell
row.addButton(title: string): UITableCell
```

### UITableCell

```javascript
cell.widthWeight: number         // relative width among cells in the row
cell.onTap: fn()                 // buttons can't be tapped in Siri
cell.dismissOnTap: bool          // default false
cell.titleColor / subtitleColor: Color  // null = automatic theme color
cell.titleFont / subtitleFont: Font

UITableCell.text(title?: string, subtitle?: string): UITableCell
UITableCell.image(image: Image): UITableCell
UITableCell.imageAtURL(url: string): UITableCell
UITableCell.button(title: string): UITableCell
cell.leftAligned() / centerAligned() / rightAligned(): void
```

```javascript
const table = new UITable()
table.showSeparators = true
const row = new UITableRow()
row.addText('Club Hub', '12 members').widthWeight = 200
row.addImage(SFSymbol.named('chevron.right').image).widthWeight = 20
row.onSelect = () => log('opened')
table.addRow(row)
await table.present()
```

---

## DateFormatter / RelativeDateTimeFormatter

### DateFormatter

```javascript
new DateFormatter()
formatter.dateFormat: string   // e.g. "yyyy-MM-dd HH:mm"
formatter.locale: string       // e.g. "en", "it", "da"
formatter.string(date: Date): string
formatter.date(str: string): Date   // null if unparsable
formatter.useNoDateStyle() / useShortDateStyle() / useMediumDateStyle() /
useLongDateStyle() / useFullDateStyle(): void
formatter.useNoTimeStyle() / useShortTimeStyle() / useMediumTimeStyle() /
useLongTimeStyle() / useFullTimeStyle(): void
```

Format tokens include `y`/`yy`/`yyyy`, `Q`/`QQQQ`, `M`–`MMMMM`, `d`/`dd`/`E`/`EEEE`, `h`/`H`/`HH`/`a`, `m`/`mm`, `s`/`ss`/`SSS`, `zzz`/`zzzz`/`Z`/`ZZZZ`/`ZZZZZ`. Prefer the predefined date/time styles for display strings.

### RelativeDateTimeFormatter

```javascript
new RelativeDateTimeFormatter()
formatter.locale: string
formatter.string(date: Date, referenceDate: Date): string   // "now", "yesterday", "in 1 week"
formatter.useNamedDateTimeStyle(): void   // prefers "now"/"yesterday" (default behavior)
formatter.useNumericDateTimeStyle(): void // prefers "in 0 seconds"/"1 day ago"
```

---

## UUID

```javascript
UUID.string(): string   // new universally unique identifier string
```

```javascript
const id = UUID.string()
```

---

## Script / config / args / importModule / module / console / Timer (summary)

These are core globals documented in full in [core-concepts.md](core-concepts.md):

- **Script** — `Script.setWidget(widget)`, `Script.complete()`, `Script.name()`, `Script.setShortcutOutput(value)`.
- **config** — read-only `runsInApp`, `runsInWidget`, `runsInAccessoryWidget`, `widgetFamily`, etc.
- **args** — `widgetParameter`, `shortcutParameter`, `plainTexts`, `urls`, `images`, `queryParameters`, `notification`.
- **importModule** / `require` — load `module.exports` from a JS file; `module.exports`, `module.filename`.
- **console** — `log`/`warn`/`error` (aliases `log`, `logWarning`, `logError`).
- **Timer** — `Timer.schedule(interval, repeats, callback)`, `timer.invalidate()`; interval in ms.
