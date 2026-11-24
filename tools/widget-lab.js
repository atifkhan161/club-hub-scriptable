#!/usr/bin/env node
'use strict'

// Local Widget Test Lab — zero-dependency Scriptable simulator.
// Runs the real index.js in a node:vm context with stubbed Scriptable APIs,
// asserts widget invariants against the live football-data.org API, and writes
// an HTML approximation of the rendered widget to .cache/widget-preview.html.
//
// Usage:
//   export FOOTBALL_DATA_TOKEN=...
//   node tools/widget-lab.js
//   node tools/widget-lab.js --no-key
//   node tools/widget-lab.js --api-error
//   node tools/widget-lab.js --crest-fail
//   node tools/widget-lab.js --fixture-order
//   node tools/widget-lab.js --bad-cache
//   node tools/widget-lab.js --json --preview /tmp/preview.html
//   node tools/widget-lab.js --help

const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const ROOT = path.resolve(__dirname, '..')
const INDEX = path.join(ROOT, 'index.js')
const DEFAULT_PREVIEW = path.join(ROOT, '.cache', 'widget-preview.html')

const argv = process.argv.slice(2)
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`Local Widget Test Lab

Usage: node tools/widget-lab.js [options]

Options:
  --no-key          Simulate a missing Keychain token (fallback widget).
  --api-error       Simulate API request failures (cached/sample fallback).
  --crest-fail      Simulate crest download failures (initials fallback).
  --fixture-order   Inject matches oldest-first to verify newest-match selection.
  --bad-cache       Seed a cache for another club; must be ignored on fallback.
  --json            Print the rendered model as JSON.
  --preview <path>  Write the HTML preview to a custom path.
  --help            Show this help.

Environment:
  FOOTBALL_DATA_TOKEN  Required for live mode. Never logged or written to disk.
`)
  process.exit(0)
}

const scenario = {
  noKey: argv.includes('--no-key'),
  apiError: argv.includes('--api-error'),
  crestFail: argv.includes('--crest-fail'),
  fixtureOrder: argv.includes('--fixture-order'),
  badCache: argv.includes('--bad-cache'),
  json: argv.includes('--json')
}
const previewIndex = argv.indexOf('--preview')
let previewPath = DEFAULT_PREVIEW
if (previewIndex !== -1 && argv[previewIndex + 1] && !argv[previewIndex + 1].startsWith('--')) {
  previewPath = path.resolve(ROOT, argv[previewIndex + 1])
}

const envToken = process.env.FOOTBALL_DATA_TOKEN
const token = envToken ||
  ((scenario.apiError || scenario.fixtureOrder || scenario.badCache) ? 'SIMULATED_TOKEN' : null)
if (!token && !scenario.noKey) {
  console.error('FOOTBALL_DATA_TOKEN is not set. Export a football-data.org token,')
  console.error('or use --no-key / --api-error to exercise the fallback states.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Scriptable stubs
// ---------------------------------------------------------------------------

const CREST_LABELS = {
  86: 'RMA', 524: 'BAR', 532: 'VAL', 536: 'SEV', 540: 'GET',
  548: 'ATM', 530: 'BET', 543: 'RSO', 538: 'CEL', 558: 'MLL'
}

function crestLabel(url) {
  const match = String(url).match(/(\d+)\.(png|svg)/i)
  return match ? (CREST_LABELS[match[1]] || match[1].slice(-3)) : '?'
}

function makeEl(kind, text) {
  const node = {
    kind,
    text,
    children: [],
    font: null,
    textColor: null,
    textOpacity: 1,
    lineLimit: 0,
    minimumScaleFactor: 1,
    axis: 'h',
    align: null,
    spacing: 0,
    size: null,
    cornerRadius: 0,
    backgroundColor: null,
    backgroundGradient: null,
    date: null,
    style: null,
    image: null,
    imageSize: null,
    resizable: true,
    length: undefined,
    padding: null
  }
  node.addText = t => { const c = makeEl('text', t); node.children.push(c); return c }
  node.addImage = i => { const c = makeEl('image'); c.image = i; node.children.push(c); return c }
  node.addDate = d => { const c = makeEl('date'); c.date = d; node.children.push(c); return c }
  node.addSpacer = l => { const c = makeEl('spacer'); c.length = l; node.children.push(c); return c }
  node.addStack = () => { const c = makeEl('stack'); node.children.push(c); return c }
  node.layoutHorizontally = () => { node.axis = 'h'; return node }
  node.layoutVertically = () => { node.axis = 'v'; return node }
  node.centerAlignContent = () => { node.align = 'center'; return node }
  node.topAlignContent = () => { node.align = 'top'; return node }
  node.bottomAlignContent = () => { node.align = 'bottom'; return node }
  node.setPadding = (t, l, b, tr) => { node.padding = [t, l, b, tr]; return node }
  node.useDefaultPadding = () => { node.padding = null; return node }
  node.leftAlignText = node.centerAlignText = node.rightAlignText = () => node
  node.leftAlignImage = node.centerAlignImage = node.rightAlignImage = () => node
  node.applyFittingContentMode = node.applyFillingContentMode = () => node
  node.applyRelativeStyle = () => { node.style = 'relative'; return node }
  node.applyTimerStyle = () => { node.style = 'timer'; return node }
  node.applyOffsetStyle = () => { node.style = 'offset'; return node }
  node.applyDateStyle = () => { node.style = 'date'; return node }
  node.applyTimeStyle = () => { node.style = 'time'; return node }
  return node
}

class ListWidget { constructor() { return makeEl('widget') } }
class WidgetStack { constructor() { return makeEl('stack') } }

class Color {
  constructor(hex, alpha) { this.hex = hex; this.alpha = alpha }
  static white() { return new Color('#ffffff') }
  static black() { return new Color('#000000') }
  static clear() { return new Color('transparent') }
  static gray() { return new Color('#808080') }
  static lightGray() { return new Color('#d1d1d6') }
  static darkGray() { return new Color('#3a3a3c') }
  static red() { return new Color('#ff453a') }
  static green() { return new Color('#30d158') }
  static blue() { return new Color('#0a84ff') }
  static yellow() { return new Color('#ffd60a') }
  static orange() { return new Color('#ff9f0a') }
  static dynamic(light, dark) { return light || dark }
}

class Font {
  constructor(name, size) { this.name = name; this.size = size }
}
const FONT_FACTORIES = [
  'systemFont', 'ultraLightSystemFont', 'thinSystemFont', 'lightSystemFont',
  'regularSystemFont', 'mediumSystemFont', 'semiboldSystemFont', 'boldSystemFont',
  'heavySystemFont', 'blackSystemFont', 'italicSystemFont',
  'boldMonospacedSystemFont', 'semiboldMonospacedSystemFont',
  'regularMonospacedSystemFont', 'boldRoundedSystemFont', 'semiboldRoundedSystemFont'
]
FONT_FACTORIES.forEach(name => { Font[name] = size => new Font(name, size) })
;['largeTitle', 'title1', 'title2', 'title3', 'headline', 'subheadline',
  'body', 'callout', 'footnote', 'caption1', 'caption2'].forEach(name => {
  Font[name] = () => new Font(name, null)
})

class LinearGradient {
  constructor() { this.colors = []; this.locations = []; this.startPoint = null; this.endPoint = null }
}
class Size { constructor(width, height) { this.width = width; this.height = height } }
class Point { constructor(x, y) { this.x = x; this.y = y } }
class Rect {
  constructor(x, y, width, height) { this.x = x; this.y = y; this.width = width; this.height = height }
}
class Path {
  move() {} addLine() {} addRect() {} addRoundedRect() {}
  addEllipse() {} addCurve() {} addQuadCurve() {} closeSubpath() {}
}
class DrawContext {
  constructor() { this.size = null; this.text = null }
  setFillColor() {} setStrokeColor() {} setLineWidth() {}
  setFont() {} setTextColor() {} setTextAlignedCenter() {}
  addPath() {} fillPath() {} strokePath() {} fill() {} fillRect() {}
  drawTextInRect(text) { this.text = text }
  getImage() { return { stub: 'initials', label: this.text || '?' } }
}
class Image {}
Image.fromFile = p => ({ stub: 'cached', label: crestLabel(p), path: p })
Image.fromData = () => ({ stub: 'data' })

const recorded = []
class Request {
  constructor(url) {
    this.url = url
    this.method = 'GET'
    this.headers = {}
    this.body = null
    this.timeoutInterval = 60
    this.response = null
  }
  async loadJSON() {
    recorded.push({ url: this.url, kind: 'json' })
    if (scenario.apiError) throw new Error('Simulated API failure')
    const res = await fetch(this.url, {
      headers: this.headers,
      signal: AbortSignal.timeout(15000)
    })
    this.response = { statusCode: res.status, headers: Object.fromEntries(res.headers) }
    try {
      return await res.json()
    } catch (e) {
      throw new Error('Invalid JSON returned by ' + this.url)
    }
  }
  async loadImage() {
    recorded.push({ url: this.url, kind: 'image' })
    if (scenario.crestFail) throw new Error('Simulated crest failure')
    return { stub: 'png', label: crestLabel(this.url), url: this.url }
  }
  async loadString() { return String(await this.loadJSON()) }
  async load() { return await this.loadJSON() }
}

const fileStore = Object.create(null)
class FileManager {
  static local() { return new FileManager() }
  cacheDirectory() { return '/cache' }
  documentsDirectory() { return '/documents' }
  temporaryDirectory() { return '/tmp' }
  joinPath(a, b) { return a + '/' + b }
  fileExists(p) { return Object.prototype.hasOwnProperty.call(fileStore, p) }
  createDirectory() {}
  readString(p) { return fileStore[p] }
  writeString(p, content) { fileStore[p] = content }
  readImage(p) { return Image.fromFile(p) }
  writeImage(p) { fileStore[p] = 'image-bytes' }
  modificationDate() { return new Date(Date.now()) }
  remove(p) { delete fileStore[p] }
}

class Keychain {
  static contains() { return !scenario.noKey }
  static get() { return token }
  static set() {}
  static remove() {}
}
class Alert {
  constructor() { this.title = ''; this.message = '' }
  addAction() {} addCancelAction() {} addDestructiveAction() {}
  addTextField() { return { text: '' } }
  addSecureTextField() { return { text: '', isSecure: true } }
  textFieldValue() { return '' }
  async presentAlert() { return -1 }
  async present() { return -1 }
}

let setWidgetCalls = 0
let completeCalls = 0
let capturedWidget = null
let resolveDone
const completed = new Promise(resolve => { resolveDone = resolve })
const Script = {
  setWidget(widget) { setWidgetCalls++; capturedWidget = widget },
  complete() { completeCalls++; resolveDone() },
  name() { return 'Club Hub' },
  setShortcutOutput() {}
}

const logs = []
const vmConsole = {
  log: (...args) => logs.push(['log', args.join(' ')]),
  warn: (...args) => logs.push(['warn', args.join(' ')]),
  error: (...args) => logs.push(['error', args.join(' ')])
}

const context = {
  Color, Font, Size, Point, Rect, Path, DrawContext, Image, LinearGradient,
  ListWidget, WidgetStack, Request, FileManager, Keychain, Alert,
  Script, config: {
    runsInApp: false,
    runsInWidget: true,
    runsInAccessoryWidget: false,
    widgetFamily: 'medium'
  },
  args: {},
  console: vmConsole,
  Date, Math, JSON, String, Object, Array, Promise, Error, RegExp,
  Number, Boolean, Infinity, NaN, isNaN, parseInt, parseFloat
}
vm.createContext(context)

// ---------------------------------------------------------------------------
// Fixture: API data in the order football-data.org actually uses
// ---------------------------------------------------------------------------

function fixtureTeam(id, name, code) {
  return { id: id, name: name, shortName: name, tla: code, crest: null }
}

function fixtureMatch(daysFromNow, home, away, homeGoals, awayGoals, status) {
  return {
    utcDate: new Date(Date.now() + daysFromNow * 86400000).toISOString(),
    status: status || 'FINISHED',
    homeTeam: home,
    awayTeam: away,
    score: { fullTime: { home: homeGoals, away: awayGoals } }
  }
}

function installFixtureFetch() {
  const rma = fixtureTeam(86, 'Real Madrid', 'RMA')
  const barca = fixtureTeam(81, 'FC Barcelona', 'FCB')
  const atm = fixtureTeam(548, 'Atlético Madrid', 'ATM')
  // Oldest first, with the most recent match last — the widget must not
  // simply take matches[0] from the API response.
  const finished = [
    fixtureMatch(-55, rma, fixtureTeam(532, 'Valencia', 'VAL'), 1, 0),
    fixtureMatch(-48, fixtureTeam(536, 'Sevilla', 'SEV'), rma, 2, 2),
    fixtureMatch(-40, rma, fixtureTeam(540, 'Getafe', 'GET'), 3, 0),
    fixtureMatch(-30, fixtureTeam(530, 'Real Betis', 'BET'), rma, 1, 2),
    fixtureMatch(-12, barca, rma, 4, 1) // newest: FCB 4-1 RMA
  ]
  // Later kickoff first; the sooner one must still be selected.
  const scheduled = [
    fixtureMatch(10, rma, fixtureTeam(543, 'Real Sociedad', 'RSO'), null, null, 'SCHEDULED'),
    fixtureMatch(3, atm, rma, null, null, 'SCHEDULED')
  ]
  globalThis.fetch = async function (url) {
    let matches = []
    if (String(url).includes('status=FINISHED')) matches = finished
    else if (String(url).includes('status=SCHEDULED')) matches = scheduled
    return {
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({ matches: matches })
    }
  }
}

function installBadCache() {
  fileStore['/cache/club-hub/match.json'] = JSON.stringify({
    model: {
      home: fixtureTeam(81, 'FC Barcelona', 'FCB'),
      away: fixtureTeam(548, 'Atlético Madrid', 'ATM'),
      score: '5 - 0',
      status: 'FT'
    },
    form: ['W', 'W', 'W', 'W', 'W'],
    fetchedAt: Date.now()
  })
  globalThis.fetch = async function () {
    throw new Error('Simulated API failure with a foreign match cached')
  }
}

// ---------------------------------------------------------------------------
// Run the real script
// ---------------------------------------------------------------------------

async function runScript() {
  const code = fs.readFileSync(INDEX, 'utf8')
  vm.runInContext(code, context, { filename: 'index.js' })
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timed out waiting for Script.complete()')), 20000)
  })
  try {
    await Promise.race([completed, timeout])
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

function collect(node, out = []) {
  out.push(node)
  ;(node.children || []).forEach(child => collect(child, out))
  return out
}

const STATUS_RE = /^(FT|HT|LIVE|\d+'|SCHEDULED|TIMED|IN_PLAY|PAUSED|POSTPONED|SUSPENDED|CANCELLED|AWARDED|TBD)$/
const HINTS = ['Set API token', 'Sample data', 'Last match', 'Matchday', 'Live']

function findNodes() {
  const nodes = capturedWidget ? collect(capturedWidget) : []
  const texts = nodes.filter(n => n.kind === 'text')
  const goldTexts = texts.filter(n => n.textColor && n.textColor.hex === '#f1d382' && n.text !== 'REAL MADRID')
  return {
    nodes,
    texts,
    score: texts.find(n => /^(\d+\s-\s\d+|–)$/.test(n.text || '')),
    status: goldTexts.find(n => STATUS_RE.test(n.text)),
    form: texts.filter(n => n.font && n.font.size === 9 && ['W', 'D', 'L'].includes(n.text)),
    codes: texts.filter(n => n.font && n.font.size === 11 &&
      n.font.name === 'semiboldSystemFont' && n.textColor && n.textColor.hex === '#ffffff'),
    badges: nodes.filter(n => n.kind === 'image' && n.imageSize &&
      n.imageSize.width === 40 && n.imageSize.height === 40),
    miniBadges: nodes.filter(n => n.kind === 'image' && n.imageSize &&
      n.imageSize.width === 24 && n.imageSize.height === 24),
    miniNames: texts.filter(n => n.font && n.font.size === 9 &&
      n.font.name === 'semiboldSystemFont' && n.textColor && n.textColor.hex === '#ffffff'),
    hint: texts.find(n => HINTS.includes(n.text)),
    dates: nodes.filter(n => n.kind === 'date'),
    nextLabel: texts.find(n => n.text === 'NEXT'),
    lastLabel: texts.find(n => n.text === 'LAST'),
    opponent: texts.find(n => n.font && n.font.size === 15)
  }
}

function assertInvariants() {
  const results = []
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail: detail || '' })
  const found = findNodes()
  const { score, status, form, codes, badges, miniBadges, miniNames, hint,
    dates, nextLabel, lastLabel, opponent } = found
  const imageRequests = recorded.filter(r => r.kind === 'image')
  const apiRequests = recorded.filter(r => r.kind === 'json').map(r => r.url)
  const countdown = dates.find(n => n.style === 'relative') ||
    found.texts.find(n => n.text === 'Kickoff TBD')

  check('widget was rendered', setWidgetCalls === 1, `setWidget calls: ${setWidgetCalls}`)
  check('script completed', completeCalls === 1, `complete calls: ${completeCalls}`)
  check('translucent #1a1a1a background', capturedWidget && capturedWidget.backgroundColor &&
    capturedWidget.backgroundColor.hex === '#1a1a1a' &&
    capturedWidget.backgroundColor.alpha > 0 && capturedWidget.backgroundColor.alpha < 1)
  check('glass gradient present', capturedWidget && capturedWidget.backgroundGradient &&
    capturedWidget.backgroundGradient.colors.length === 2)
  check('padding is (15,15,15,15)', capturedWidget &&
    JSON.stringify(capturedWidget.padding) === JSON.stringify([15, 15, 15, 15]))
  check('refreshAfterDate is set', capturedWidget && capturedWidget.refreshAfterDate instanceof Date)
  check('last score is present', !!score && /^(\d+\s-\s\d+|–)$/.test(score.text), score && score.text)
  check('status is valid', !!status && STATUS_RE.test(status.text), status && status.text)
  check('two 40x40 crests in next row', badges.length === 2, `found ${badges.length}`)
  check('two 24x24 crests in last row', miniBadges.length === 2, `found ${miniBadges.length}`)
  check('two last-match team names', miniNames.length === 2, miniNames.map(n => n.text).join(', '))
  check('last-match names cannot wrap',
    miniNames.length === 2 && miniNames.every(n => n.lineLimit === 1))
  check('two team codes in next row', codes.length === 2, codes.map(n => n.text).join(', '))
  check('five form squares', form.length === 5 && form.every(n => ['W', 'D', 'L'].includes(n.text)), form.map(n => n.text).join(''))
  check('data-state hint present', !!hint, hint && hint.text)
  check('NEXT row present', !!nextLabel && !!opponent, opponent && opponent.text)
  check('LAST row present', !!lastLabel)
  check('relative countdown present', !!countdown, countdown && (countdown.style || countdown.text))
  check('no SVG crest URLs requested', imageRequests.every(r => !r.url.includes('.svg')),
    imageRequests.map(r => r.url).join(', '))

  if (scenario.noKey) {
    check('no-key hint is shown', hint && hint.text === 'Set API token', hint && hint.text)
  }
  if (scenario.apiError) {
    check('api-error falls back to sample', hint && hint.text === 'Sample data', hint && hint.text)
  }
  if (!scenario.noKey && !scenario.apiError) {
    check('all three API endpoints were called',
      ['status=FINISHED', 'status=LIVE', 'status=SCHEDULED'].every(part =>
        apiRequests.some(u => u.includes(part))),
      apiRequests.join(', '))
    check('finished query is bounded to a recent window',
      apiRequests.some(u => u.includes('status=FINISHED') && u.includes('dateFrom=')),
      apiRequests.find(u => u.includes('status=FINISHED')) || '')
  }
  if (scenario.badCache) {
    check('foreign cached match is ignored',
      hint && hint.text === 'Sample data' && score && score.text !== '5 - 0',
      hint && hint.text)
  }
  if (scenario.fixtureOrder) {
    check('newest finished match is shown', score && score.text === '4 - 1', score && score.text)
    check('newest finished teams are shown',
      miniNames.map(n => n.text).join(' vs ') === 'FCB vs RMA',
      miniNames.map(n => n.text).join(' vs '))
    check('form is the latest five, oldest to newest',
      form.map(n => n.text).join('') === 'WDWWL', form.map(n => n.text).join(''))
    check('soonest scheduled fixture is shown',
      opponent && opponent.text === 'at ATM', opponent && opponent.text)
  }
  return results
}

// ---------------------------------------------------------------------------
// HTML preview
// ---------------------------------------------------------------------------

function esc(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function cssColor(color) {
  if (!color) return 'transparent'
  const hex = color.hex || 'transparent'
  if (hex === 'transparent') return hex
  if (typeof color.alpha === 'number' && color.alpha < 1 && /^#[0-9a-f]{6}$/i.test(hex)) {
    return hex + Math.round(color.alpha * 255).toString(16).padStart(2, '0')
  }
  return hex
}

function gradientCss(gradient) {
  if (!gradient || !gradient.colors || !gradient.colors.length) return ''
  const stops = gradient.colors.map((color, index) => {
    const at = gradient.locations && gradient.locations[index] !== undefined
      ? gradient.locations[index] * 100 : index * 100
    return cssColor(color) + ' ' + at + '%'
  }).join(', ')
  return `linear-gradient(135deg, ${stops})`
}

function relativeLabel(node) {
  const date = node.date ? new Date(node.date) : null
  if (!date || isNaN(date.getTime())) return 'Kickoff TBD'
  const minutes = Math.max(0, Math.round((date.getTime() - Date.now()) / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `${days} day${days === 1 ? '' : 's'}, ${hours} hour${hours === 1 ? '' : 's'}`
  if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'}, ${minutes % 60} minutes`
  return `${minutes} minutes`
}

function fontCss(font) {
  if (!font) return ''
  const size = font.size ? `font-size:${font.size}px;` : 'font-size:13px;'
  const weight = /bold/.test(font.name) ? '700'
    : /semibold/.test(font.name) ? '600'
    : /medium/.test(font.name) ? '500' : '400'
  return size + `font-weight:${weight};`
}

function renderNode(node) {
  const children = (node.children || []).map(renderNode).join('')
  if (node.kind === 'widget') {
    const p = node.padding || [0, 0, 0, 0]
    const background = gradientCss(node.backgroundGradient) || cssColor(node.backgroundColor)
    return `<div class="widget" style="width:322px;height:148px;box-sizing:border-box;display:flex;flex-direction:column;gap:${node.spacing || 0}px;padding:${p.map(x => x + 'px').join(' ')};background:${background};border:1px solid rgba(255,255,255,0.10);border-radius:16px;overflow:hidden;">${children}</div>`
  }
  if (node.kind === 'stack') {
    const direction = node.axis === 'v' ? 'column' : 'row'
    const align = node.align === 'center' ? 'center'
      : node.align === 'top' ? 'flex-start'
      : node.align === 'bottom' ? 'flex-end' : 'stretch'
    let extra = ''
    if (node.size) {
      extra += `width:${node.size.width}px;height:${node.size.height}px;flex:none;`
    }
    const panelBackground = gradientCss(node.backgroundGradient) ||
      (node.backgroundColor ? cssColor(node.backgroundColor) : '')
    if (panelBackground) extra += `background:${panelBackground};`
    if (node.cornerRadius) extra += `border-radius:${node.cornerRadius}px;`
    return `<div style="display:flex;flex-direction:${direction};align-items:${align};gap:${node.spacing || 0}px;${extra}">${children}</div>`
  }
  if (node.kind === 'spacer') {
    const style = node.length === null || node.length === undefined
      ? 'flex:1 1 0;min-width:1px;min-height:1px;'
      : `width:${node.length}px;height:${node.length}px;flex:none;`
    return `<div style="${style}"></div>`
  }
  if (node.kind === 'date') {
    return `<div style="${fontCss(node.font)}color:${cssColor(node.textColor)};opacity:${node.textOpacity};white-space:nowrap;line-height:1.15;">${esc(relativeLabel(node))}</div>`
  }
  if (node.kind === 'text') {
    return `<div style="${fontCss(node.font)}color:${cssColor(node.textColor)};opacity:${node.textOpacity};white-space:nowrap;line-height:1.15;">${esc(node.text)}</div>`
  }
  if (node.kind === 'image') {
    const s = node.imageSize || { width: 40, height: 40 }
    // Real crest URLs render as neutral placeholders; only the initials
    // fallback (drawn with DrawContext) shows its letters in the preview.
    const label = node.image && node.image.stub === 'initials'
      ? esc(node.image.label || '?') : ''
    return `<div style="width:${s.width}px;height:${s.height}px;flex:none;border-radius:${node.cornerRadius || 0}px;background:#2c2c30;display:flex;align-items:center;justify-content:center;color:#fff;font-size:${Math.round(s.width / 3)}px;font-weight:700;">${label}</div>`
  }
  return `<div>${children}</div>`
}

function writePreview(results) {
  const mode = scenario.noKey ? '--no-key'
    : scenario.apiError ? '--api-error'
    : scenario.crestFail ? '--crest-fail'
    : scenario.fixtureOrder ? '--fixture-order'
    : scenario.badCache ? '--bad-cache' : 'live'
  const passed = results.filter(r => r.ok).length
  const total = results.length
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Club Hub widget preview</title>
<style>
  body { margin:0; min-height:100vh; background:#101014; color:#8e8e93;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; }
  .caption { font-size:12px; }
  .caption b { color:#f1d382; }
</style></head><body>
<div class="caption">Club Hub — <b>${esc(mode)}</b> · ${new Date().toISOString()} · ${passed}/${total} checks passed · approximation only, not iOS-rendered</div>
${capturedWidget ? renderNode(capturedWidget) : '<div class="caption">No widget captured</div>'}
</body></html>
`
  fs.mkdirSync(path.dirname(previewPath), { recursive: true })
  fs.writeFileSync(previewPath, html, 'utf8')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (scenario.fixtureOrder) installFixtureFetch()
  if (scenario.badCache) installBadCache()
  await runScript()
  const results = assertInvariants()

  console.log('Widget tree:')
  if (capturedWidget) {
    const walk = (node, depth) => {
      const label = node.kind === 'date'
        ? ` style=${node.style} ${relativeLabel(node)}`
        : node.text !== undefined ? ` text=${JSON.stringify(node.text)}` : ''
      console.log('  '.repeat(depth) + node.kind + (node.axis !== 'h' ? `[${node.axis}]` : '') + label)
      ;(node.children || []).forEach(child => walk(child, depth + 1))
    }
    walk(capturedWidget, 0)
  }

  console.log('\nChecks:')
  results.forEach(r => {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ' — ' + r.detail : ''}`)
  })

  if (logs.length) {
    console.log('\nScript log:')
    logs.forEach(([level, message]) => console.log(`  [${level}] ${message}`))
  }

  if (scenario.json) {
    const found = findNodes()
    console.log('\nRendered model:')
    const countdownNode = found.dates.find(n => n.style === 'relative')
    console.log(JSON.stringify({
      next: found.opponent && found.opponent.text,
      countdown: countdownNode ? relativeLabel(countdownNode) : null,
      lastScore: found.score && found.score.text,
      status: found.status && found.status.text,
      hint: found.hint && found.hint.text,
      form: found.form.map(n => n.text),
      teams: found.codes.map(n => n.text),
      apiRequests: recorded.filter(r => r.kind === 'json').map(r => r.url)
    }, null, 2))
  }

  writePreview(results)
  console.log(`\nPreview written to ${previewPath}`)

  const failed = results.filter(r => !r.ok)
  if (failed.length) {
    process.exitCode = 1
    console.error(`\n${failed.length} check(s) failed.`)
  }
}

main().catch(error => {
  console.error('Widget lab failed: ' + (error && error.stack ? error.stack : error))
  process.exitCode = 1
})
