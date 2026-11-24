// Club Hub — Real Madrid matchday widget for Scriptable
// ------------------------------------------------------------
// SETUP
//   1. Get a free API token from https://www.football-data.org/client/register
//   2. Run this script in the Scriptable app and enter the token when prompted.
//      The token is saved in the Scriptable Keychain, never in this file.
//   3. Add a Scriptable widget to your Home Screen, size MEDIUM, and select
//      this script. The widget parameter is unused in V1.
//
// DEPLOYMENT
//   Copy this file into your iCloud Drive/Scriptable folder, or paste it into
//   a new script in the Scriptable app. No build step or modules are required.
//
// BEHAVIOUR
//   Two-row medium widget:
//     TOP    — next fixture: both crests, opponent, relative countdown
//     BOTTOM — last result score + five-match W/D/L form
//   Data is fetched from football-data.org on every widget refresh and cached
//   to disk. If the API is unavailable the widget shows the last cached data,
//   then bundled sample data. Crest images are cached for 24h; failures fall
//   back to a 3-letter initials badge.
//
//   Actual refresh timing is controlled by iOS. refreshAfterDate only sets the
//   earliest allowed refresh (30 minutes, or just after the next kickoff when
//   it is sooner) to respect the free tier's 10 calls/minute limit. The free
//   plan delivers delayed scores and usually no live minute.
//
//   The "glass" look is an approximation: translucent fills, a soft gradient
//   and rounded panels. True Apple Liquid Glass is applied by iOS 26 itself
//   (clear/tinted Home Screen modes) and cannot be invoked from Scriptable.
//
// Source docs: https://docs.scriptable.app/ — see the `scriptable` skill in
// .opencode/skills/scriptable/ for the full API reference.

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TEAM_ID = 86                                    // Real Madrid in football-data.org
const API_BASE = 'https://api.football-data.org/v4'
const KEYCHAIN_KEY = 'clubhub.footballdata.token'
const CACHE_DIR_NAME = 'club-hub'
const MATCH_CACHE_FILE = 'match.json'
const CACHE_TTL_MS = 30 * 60 * 1000                   // 30 minutes
const CREST_TTL_MS = 24 * 60 * 60 * 1000              // 24 hours

// Translucent base so iOS 26's own glass/tint can show through.
const COLOR_BG = new Color('#1a1a1a', 0.62)
const COLOR_PANEL = new Color('#2c2c30', 0.42)
const COLOR_SHEEN = new Color('#ffffff', 0.10)
const COLOR_GOLD = new Color('#f1d382')
const COLOR_MUTED = new Color('#b0b0b8')
const COLOR_CREST_BG = new Color('#2c2c30', 0.85)
const FORM_COLORS = {
  W: new Color('#2ecc71'),
  D: new Color('#95a5a6'),
  L: new Color('#e74c3c')
}

// Common La Liga opponents. football-data.org supplies `tla` (3 letters); this
// map is only a fallback when a match response omits it.
const TEAM_CODES = {
  'real madrid': 'RMA',
  'barcelona': 'BAR',
  'fc barcelona': 'BAR',
  'atlético madrid': 'ATM',
  'atletico madrid': 'ATM',
  'athletic club': 'ATH',
  'sevilla': 'SEV',
  'valencia': 'VAL',
  'villarreal': 'VIL',
  'real betis': 'BET',
  'real sociedad': 'RSO',
  'getafe': 'GET',
  'celta vigo': 'CEL',
  'rayo vallecano': 'RAY',
  'mallorca': 'MLL',
  'osasuna': 'OSA',
  'girona': 'GIR',
  'alavés': 'ALA',
  'alaves': 'ALA',
  'espanyol': 'ESP',
  'elche': 'ELC',
  'levante': 'LEV'
}

function team(id, name, code) {
  return { id: id, name: name, code: code, logo: null, goals: null }
}

// Sample payload with a kickoff generated at runtime, used only when there is
// neither a live response nor a cached match.
function samplePayload() {
  const kickoff = new Date(Date.now() + (3 * 24 + 5) * 60 * 60 * 1000).toISOString()
  return {
    model: {
      home: team(TEAM_ID, 'Real Madrid', 'RMA'),
      away: team(524, 'Barcelona', 'BAR'),
      score: '2 - 1',
      status: 'FT',
      isLive: false
    },
    form: ['W', 'W', 'D', 'W', 'L'],
    next: {
      home: team(TEAM_ID, 'Real Madrid', 'RMA'),
      away: team(524, 'Barcelona', 'BAR'),
      opponent: team(524, 'Barcelona', 'BAR'),
      isHome: true,
      kickoff: kickoff,
      label: 'SCHEDULED'
    }
  }
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function cacheDir() {
  const fm = FileManager.local()
  const dir = fm.joinPath(fm.cacheDirectory(), CACHE_DIR_NAME)
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true)
  return dir
}

function matchCachePath() {
  return FileManager.local().joinPath(cacheDir(), MATCH_CACHE_FILE)
}

function crestCachePath(teamId) {
  return FileManager.local().joinPath(cacheDir(), 'crest-' + teamId + '.png')
}

function loadCachedMatch() {
  try {
    const path = matchCachePath()
    if (!FileManager.local().fileExists(path)) return null
    const parsed = JSON.parse(FileManager.local().readString(path))
    if (!parsed || !parsed.model || !parsed.model.home) return null
    const home = parsed.model.home
    const away = parsed.model.away || {}
    // Defend against a stale cache written by an older/buggy build that
    // captured a match not involving Real Madrid.
    if (home.id && away.id && home.id !== TEAM_ID && away.id !== TEAM_ID) {
      console.warn('Ignoring match cache for a different club')
      return null
    }
    return parsed
  } catch (e) {
    console.warn('Could not read match cache: ' + e)
    return null
  }
}

function saveCachedMatch(payload) {
  try {
    FileManager.local().writeString(matchCachePath(), JSON.stringify(payload))
  } catch (e) {
    console.warn('Could not write match cache: ' + e)
  }
}

// ---------------------------------------------------------------------------
// API token / setup
// ---------------------------------------------------------------------------

function storedApiKey() {
  return Keychain.contains(KEYCHAIN_KEY) ? Keychain.get(KEYCHAIN_KEY) : null
}

async function promptForApiKey() {
  const alert = new Alert()
  alert.title = 'Club Hub — API token'
  alert.message = 'Enter your football-data.org API token to load match data. It is stored in the Scriptable Keychain.'
  alert.addCancelAction('Not now')       // index -1
  alert.addAction('Save')                // index 0
  alert.addSecureTextField('API token')
  const index = await alert.presentAlert()
  if (index === 0) {
    const value = (alert.textFieldValue(0) || '').trim()
    if (value.length > 0) {
      Keychain.set(KEYCHAIN_KEY, value)
      return value
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Network + normalization
// ---------------------------------------------------------------------------

async function fetchJson(path, apiKey) {
  const req = new Request(API_BASE + path)
  req.headers = { 'X-Auth-Token': apiKey }
  req.timeoutInterval = 15
  const json = await req.loadJSON()
  const status = req.response ? req.response.statusCode : 200
  if (status === 401 || status === 403) {
    const err = new Error('Invalid API token (HTTP ' + status + ')')
    err.authFailed = true
    throw err
  }
  return json
}

async function safeFetch(path, apiKey) {
  try {
    const json = await fetchJson(path, apiKey)
    return { json: json, authFailed: false }
  } catch (e) {
    console.warn('API request failed for ' + path + ': ' + e)
    return { authFailed: !!(e && e.authFailed) }
  }
}

function mapStatus(match) {
  const status = String(match.status || '').toUpperCase()
  const minute = match.minute

  if (status === 'IN_PLAY') {
    // Free tier often omits the minute; show a generic live marker instead.
    return { label: minute ? minute + "'" : 'LIVE', live: true }
  }
  if (status === 'PAUSED') {
    return { label: 'HT', live: true }
  }
  if (status === 'FINISHED' || status === 'AWARDED') {
    return { label: 'FT', live: false }
  }
  return { label: status || 'TBD', live: false }
}

function readGoals(match) {
  // In v4, score.fullTime is also the running score while a match is live.
  const fullTime = (match.score && match.score.fullTime) || {}
  return { home: fullTime.home, away: fullTime.away }
}

function abbreviation(teamObj) {
  if (!teamObj) return '---'
  const code = String(teamObj.code || '').trim().toUpperCase()
  if (code.length >= 2 && code.length <= 4) return code
  let name = String(teamObj.name || '').toLowerCase()
  if (typeof name.normalize === 'function') {
    name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
  }
  name = name.trim()
  if (TEAM_CODES[name]) return TEAM_CODES[name]
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length > 1 && words[0].length <= 3) {
    return (words[0] + words[1].charAt(0)).toUpperCase().slice(0, 3)
  }
  return name.replace(/[^a-z]/g, '').slice(0, 3).toUpperCase() || '?'
}

function pngCrest(url) {
  if (!url) return null
  // Some crest URLs are SVG; Scriptable's Image cannot reliably render SVG.
  return String(url).replace(/\.svg(?=\?|$)/i, '.png')
}

function teamModel(rawTeam, goals) {
  return {
    id: rawTeam && rawTeam.id ? rawTeam.id : 0,
    name: rawTeam && (rawTeam.shortName || rawTeam.name) ? (rawTeam.shortName || rawTeam.name) : '',
    code: rawTeam && rawTeam.tla ? rawTeam.tla : null,
    logo: pngCrest(rawTeam && rawTeam.crest),
    goals: goals !== undefined ? goals : null
  }
}

function formatScore(home, away) {
  if (home === null || home === undefined || away === null || away === undefined) return '–'
  return home + ' - ' + away
}

function normalizeMatch(match) {
  const status = mapStatus(match)
  const goals = readGoals(match)
  return {
    home: teamModel(match.homeTeam, goals.home),
    away: teamModel(match.awayTeam, goals.away),
    score: formatScore(goals.home, goals.away),
    status: status.label,
    isLive: status.live
  }
}

function normalizeNextMatch(match) {
  if (!match) return null
  const isHome = !!(match.homeTeam && match.homeTeam.id === TEAM_ID)
  const opponent = isHome ? match.awayTeam : match.homeTeam
  let kickoff = null
  if (match.utcDate) {
    const date = new Date(match.utcDate)
    if (!isNaN(date.getTime()) && date.getTime() > Date.now()) {
      kickoff = date.toISOString()
    }
  }
  return {
    home: teamModel(match.homeTeam),
    away: teamModel(match.awayTeam),
    opponent: teamModel(opponent),
    isHome: isHome,
    kickoff: kickoff,
    label: String(match.status || '').toUpperCase()
  }
}

function deriveForm(matches, teamId) {
  const finished = (matches || []).filter(function (match) {
    return String(match.status || '').toUpperCase() === 'FINISHED'
  }).slice(0, 5)

  // fetchMatchData sorts newest-first; the PRD wants oldest -> newest.
  return finished.reverse().map(function (match) {
    const fullTime = (match.score && match.score.fullTime) || {}
    const homeGoals = fullTime.home
    const awayGoals = fullTime.away
    if (homeGoals === null || homeGoals === undefined ||
        awayGoals === null || awayGoals === undefined) return 'D'

    const isHome = !!(match.homeTeam && match.homeTeam.id === TEAM_ID)
    const mine = isHome ? homeGoals : awayGoals
    const theirs = isHome ? awayGoals : homeGoals
    if (mine > theirs) return 'W'
    if (mine === theirs) return 'D'
    return 'L'
  })
}

function dateDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// football-data.org returns a team's matches in ascending date order, so
// matches[0] is the OLDEST item in the window. Always sort ourselves.
function sortedMatches(collection) {
  const matches = (collection && collection.matches) || []
  const relevant = matches.filter(function (match) {
    return !!(match && match.homeTeam && match.awayTeam &&
      (match.homeTeam.id === TEAM_ID || match.awayTeam.id === TEAM_ID))
  })
  if (relevant.length !== matches.length) {
    console.warn('Ignored ' + (matches.length - relevant.length) +
      ' match(es) not involving team ' + TEAM_ID)
  }
  return relevant.sort(function (a, b) {
    const ad = new Date(a.utcDate || 0).getTime()
    const bd = new Date(b.utcDate || 0).getTime()
    return bd - ad // newest first
  })
}

async function fetchMatchData(apiKey) {
  const lastResult = await safeFetch(
    '/teams/' + TEAM_ID + '/matches?status=FINISHED&dateFrom=' + dateDaysAgo(120) + '&limit=50',
    apiKey)
  const liveResult = await safeFetch('/teams/' + TEAM_ID + '/matches?status=LIVE&limit=1', apiKey)
  const nextResult = await safeFetch('/teams/' + TEAM_ID + '/matches?status=SCHEDULED&limit=1', apiKey)

  const finishedMatches = sortedMatches(lastResult.json)
  const liveMatches = sortedMatches(liveResult.json)
  const scheduledMatches = sortedMatches(nextResult.json)
  const form = finishedMatches.length ? deriveForm(finishedMatches, TEAM_ID) : []

  const chosen = liveMatches[0] || finishedMatches[0] || null
  const model = chosen ? normalizeMatch(chosen) : null

  // Descending list -> the last future item is the soonest kickoff. This also
  // skips stale SCHEDULED entries whose date has already passed.
  const upcoming = scheduledMatches.filter(function (match) {
    const kickoff = new Date(match.utcDate || 0).getTime()
    return kickoff > Date.now()
  })
  let next = normalizeNextMatch(upcoming[upcoming.length - 1])
  if (!next) {
    // Keep a still-future cached kickoff when the endpoint returns nothing.
    const cached = loadCachedMatch()
    if (cached && cached.next && cached.next.kickoff &&
        new Date(cached.next.kickoff).getTime() > Date.now()) {
      next = cached.next
    }
  }

  if (model || next) {
    saveCachedMatch({ model: model, form: form, next: next, fetchedAt: Date.now() })
  }

  return {
    model: model,
    form: form,
    next: next,
    authFailed: lastResult.authFailed || liveResult.authFailed || nextResult.authFailed
  }
}

// ---------------------------------------------------------------------------
// Crest images
// ---------------------------------------------------------------------------

async function loadCrest(team) {
  if (!team || !team.logo) return null
  // Fall back to the team code so two teams without an id cannot share
  // crest-0.png and display each other's badge.
  const path = crestCachePath(team.id || team.code || 'unknown')
  const fm = FileManager.local()
  try {
    const fresh = fm.fileExists(path) &&
      fm.modificationDate(path) > new Date(Date.now() - CREST_TTL_MS)
    if (fresh) {
      const cached = Image.fromFile(path)
      if (cached) return cached
    }
    const request = new Request(team.logo)
    request.timeoutInterval = 15
    const image = await request.loadImage()
    fm.writeImage(path, image)
    return image
  } catch (e) {
    console.warn('Crest load failed for ' + (team.name || team.id) + ': ' + e)
    return null
  }
}

function initialsImage(code) {
  const text = String(code || '?').slice(0, 3).toUpperCase()
  const ctx = new DrawContext()
  ctx.size = new Size(80, 80)
  ctx.respectScreenScale = true
  ctx.opaque = false

  const path = new Path()
  path.addRoundedRect(new Rect(0, 0, 80, 80), 12, 12)
  ctx.setFillColor(COLOR_CREST_BG)
  ctx.addPath(path)
  ctx.fillPath()

  ctx.setFont(Font.boldSystemFont(32))
  ctx.setTextColor(Color.white())
  ctx.setTextAlignedCenter()
  ctx.drawTextInRect(text, new Rect(0, 16, 80, 48))
  return ctx.getImage()
}

// ---------------------------------------------------------------------------
// Widget UI
// ---------------------------------------------------------------------------

function styledLabel(parent, text, font, color) {
  const label = parent.addText(text)
  label.font = font
  label.textColor = color
  return label
}

function glassPanel(widget, paddingTop, paddingLeading, paddingBottom, paddingTrailing) {
  const panel = widget.addStack()
  panel.layoutHorizontally()
  panel.centerAlignContent()
  panel.spacing = 6
  panel.backgroundColor = COLOR_PANEL
  panel.cornerRadius = 14
  panel.setPadding(paddingTop, paddingLeading, paddingBottom, paddingTrailing)
  return panel
}

function addTeamBadge(parent, team, crestImage) {
  const side = parent.addStack()
  side.layoutVertically()
  side.centerAlignContent()
  side.spacing = 3

  const badge = side.addImage(crestImage || initialsImage(team ? team.code : '?'))
  badge.imageSize = new Size(40, 40)
  badge.resizable = true
  badge.cornerRadius = 8

  styledLabel(side, abbreviation(team), Font.semiboldSystemFont(11), Color.white())
  return side
}

function addCountdown(parent, kickoff) {
  if (!kickoff) {
    styledLabel(parent, 'Kickoff TBD', Font.regularSystemFont(10), COLOR_MUTED)
    return
  }
  const date = new Date(kickoff)
  if (isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    styledLabel(parent, 'Kickoff TBD', Font.regularSystemFont(10), COLOR_MUTED)
    return
  }
  // WidgetDate updates itself periodically — no widget rerun required.
  const countdown = parent.addDate(date)
  countdown.applyRelativeStyle()
  countdown.font = Font.regularSystemFont(10)
  countdown.textColor = COLOR_MUTED
}

function addMiniTeam(parent, team, crestImage) {
  const item = parent.addStack()
  item.layoutHorizontally()
  item.centerAlignContent()
  item.spacing = 3
  // Reserve enough width for badge + 3-letter code so SwiftUI cannot squeeze
  // the label and wrap "RMA" into two lines on a crowded row.
  item.size = new Size(48, 24)

  const badge = item.addImage(crestImage || initialsImage(team ? team.code : '?'))
  badge.imageSize = new Size(24, 24)
  badge.resizable = true
  badge.cornerRadius = 5

  const name = styledLabel(item, abbreviation(team),
    Font.semiboldSystemFont(9), Color.white())
  name.lineLimit = 1
  name.minimumScaleFactor = 0.8
  return item
}

function addFormBlocks(parent, form) {
  const results = (form && form.length) ? form : ['D', 'D', 'D', 'D', 'D']
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const box = parent.addStack()
    box.size = new Size(15, 15)
    box.cornerRadius = 3
    box.backgroundColor = FORM_COLORS[result] || FORM_COLORS.D
    box.centerAlignContent()
    box.addSpacer(null)
    styledLabel(box, result, Font.boldSystemFont(9), Color.white())
    box.addSpacer(null)
  }
}

function refreshDateFor(model) {
  let delay = CACHE_TTL_MS
  if (model.next && model.next.kickoff) {
    const kickoff = new Date(model.next.kickoff).getTime()
    if (!isNaN(kickoff) && kickoff > Date.now() && kickoff - Date.now() < delay) {
      delay = kickoff - Date.now() + 60 * 1000
    }
  }
  return new Date(Date.now() + delay)
}

function buildWidget(model, nextHomeImage, nextAwayImage, lastHomeImage, lastAwayImage) {
  const widget = new ListWidget()
  widget.backgroundColor = COLOR_BG
  widget.setPadding(15, 15, 15, 15)
  widget.spacing = 0                     // vertical rhythm comes from explicit spacers
  widget.refreshAfterDate = refreshDateFor(model)

  // Glass-like sheen: translucent dark gradient plus a faint white highlight.
  const glass = new LinearGradient()
  glass.colors = [new Color('#2a2a31', 0.70), new Color('#101014', 0.58)]
  glass.locations = [0, 1]
  glass.startPoint = new Point(0, 0)
  glass.endPoint = new Point(1, 1)
  widget.backgroundGradient = glass

  const sheen = widget.addStack()
  sheen.size = new Size(0, 1)
  sheen.backgroundColor = COLOR_SHEEN

  const header = widget.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()
  styledLabel(header, 'REAL MADRID', Font.semiboldSystemFont(11), COLOR_GOLD)
  header.addSpacer(null)
  styledLabel(header, model.hint || '', Font.regularSystemFont(9), COLOR_MUTED)

  widget.addSpacer(3)

  if (!model.last && !model.next) {
    // Explicit empty state — never render a blank widget.
    const badge = widget.addImage(initialsImage('RMA'))
    badge.imageSize = new Size(40, 40)
    badge.resizable = true
    badge.cornerRadius = 8
    widget.addSpacer(4)
    styledLabel(widget, 'REAL MADRID', Font.boldSystemFont(16), Color.white())
    styledLabel(widget, model.status || 'No fixture scheduled',
      Font.semiboldSystemFont(12), COLOR_GOLD)
    styledLabel(widget, model.hint || '', Font.regularSystemFont(10), COLOR_MUTED)
    return widget
  }

  // TOP ROW — next fixture -------------------------------------------------
  if (model.next) {
    const top = glassPanel(widget, 4, 9, 4, 9)
    addTeamBadge(top, model.next.home, nextHomeImage)
    top.addSpacer(null)

    const center = top.addStack()
    center.layoutVertically()
    center.centerAlignContent()
    center.spacing = 1
    styledLabel(center, 'NEXT', Font.semiboldSystemFont(9), COLOR_GOLD)
    const prefix = model.next.isHome ? 'vs ' : 'at '
    styledLabel(center, prefix + abbreviation(model.next.opponent),
      Font.boldSystemFont(15), Color.white())
    addCountdown(center, model.next.kickoff)

    top.addSpacer(null)
    addTeamBadge(top, model.next.away, nextAwayImage)
  } else {
    const top = glassPanel(widget, 8, 10, 8, 10)
    styledLabel(top, 'NEXT', Font.semiboldSystemFont(9), COLOR_GOLD)
    top.addSpacer(null)
    styledLabel(top, 'No fixture scheduled', Font.regularSystemFont(12), Color.white())
  }

  widget.addSpacer(4)

  // BOTTOM ROW — last result (both badges + names) + form ------------------
  const bottom = glassPanel(widget, 4, 8, 4, 8)
  styledLabel(bottom, 'LAST', Font.semiboldSystemFont(8), COLOR_GOLD)
  if (model.last) {
    addMiniTeam(bottom, model.last.home, lastHomeImage)
    const scoreText = styledLabel(bottom, model.last.score,
      Font.boldSystemFont(15), Color.white())
    scoreText.minimumScaleFactor = 0.7
    addMiniTeam(bottom, model.last.away, lastAwayImage)
    styledLabel(bottom, model.last.status, Font.semiboldSystemFont(9), COLOR_GOLD)
  } else {
    styledLabel(bottom, 'No result', Font.regularSystemFont(10), Color.white())
  }

  bottom.addSpacer(null)
  const formGroup = bottom.addStack()
  formGroup.layoutHorizontally()
  formGroup.centerAlignContent()
  formGroup.spacing = 3
  addFormBlocks(formGroup, model.form)
  return widget
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function renderModelFrom(payload, source, hint, empty) {
  const last = payload && payload.model ? payload.model : null
  const next = payload && payload.next ? payload.next : null
  return {
    // Legacy flat fields are kept for cache/test compatibility.
    home: last ? last.home : null,
    away: last ? last.away : null,
    score: last ? last.score : '–',
    status: last ? last.status : '',
    isLive: last ? !!last.isLive : false,
    last: last,
    next: next,
    form: payload && payload.form ? payload.form : [],
    hint: hint,
    source: source,
    empty: !!empty
  }
}

async function resolveModel() {
  let apiKey = storedApiKey()
  let needsSetup = !apiKey
  let fresh = null

  if (!apiKey && config.runsInApp) {
    apiKey = await promptForApiKey()
    needsSetup = !apiKey
  }

  if (apiKey) {
    fresh = await fetchMatchData(apiKey)
    needsSetup = fresh.authFailed
    if (fresh.model || fresh.next) {
      const hint = needsSetup ? 'Set API token'
        : fresh.model && fresh.model.isLive ? 'Live'
        : 'Matchday'
      return renderModelFrom(fresh, 'live', hint, false)
    }
  }

  const cached = loadCachedMatch()
  if (cached) {
    return renderModelFrom(cached, 'cached',
      needsSetup ? 'Set API token' : 'Last match', false)
  }

  const sample = renderModelFrom(samplePayload(), 'sample',
    needsSetup ? 'Set API token' : 'Sample data', false)
  return sample
}

async function run() {
  const model = await resolveModel()

  const nextHomeImage = model.next ? await loadCrest(model.next.home) : null
  const nextAwayImage = model.next ? await loadCrest(model.next.away) : null
  const lastHomeImage = model.last ? await loadCrest(model.last.home) : null
  const lastAwayImage = model.last ? await loadCrest(model.last.away) : null

  const widget = buildWidget(model, nextHomeImage, nextAwayImage, lastHomeImage, lastAwayImage)
  Script.setWidget(widget)

  // Preview during development / when run manually in the app.
  if (config.runsInApp) {
    await widget.presentMedium()
  }
}

;(async function main() {
  try {
    await run()
  } catch (e) {
    console.error('Club Hub failed: ' + e)
    try {
      Script.setWidget(buildWidget({
        last: null,
        next: null,
        status: 'Widget unavailable',
        hint: 'Check the Scriptable log',
        form: []
      }, null, null, null, null))
    } catch (inner) {
      console.error('Could not render fallback widget: ' + inner)
    }
  } finally {
    Script.complete()
  }
})()
