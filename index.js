// Club Hub — Real Madrid matchday widget for Scriptable (V1)
// ------------------------------------------------------------
// SETUP
//   1. Get a free API token from https://www.football-data.org/client/register
//   2. Run this script in the Scriptable app and enter the token when prompted.
//      The token is saved in the Scriptable Keychain, never in this file.
//   3. Add a Scriptable widget to your Home Screen, size MEDIUM, and select
//      this script. Set its parameter to anything you like (unused in V1).
//
// DEPLOYMENT
//   Copy this file into your iCloud Drive/Scriptable folder, or paste it into
//   a new script in the Scriptable app. No build step or modules are required.
//
// BEHAVIOUR
//   Fetches the latest Real Madrid fixture and last 5 results on every widget
//   refresh. Caches the normalized match + form to disk; if the API is
//   unavailable it shows the last cached match, then bundled sample data.
//   Crest images are cached for 24h; failures fall back to a 3-letter badge.
//   Actual refresh timing is controlled by iOS. refreshAfterDate only sets
//   the earliest allowed refresh (30 minutes here) to respect the free tier's
//   10 calls/minute limit. NOTE: the free plan delivers DELAYED scores and
//   usually no live minute; live minute display needs a livescores plan.
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

const COLOR_BG = new Color('#1a1a1a')
const COLOR_GOLD = new Color('#f1d382')
const COLOR_MUTED = new Color('#8e8e93')
const COLOR_CREST_BG = new Color('#2c2c30')
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

// Normalized render model used when there is no API response and no cache.
const SAMPLE_MODEL = {
  home: { id: TEAM_ID, name: 'Real Madrid', code: 'RMA', logo: null, goals: 2 },
  away: { id: 548, name: 'Barcelona', code: 'BAR', logo: null, goals: 1 },
  score: '2 - 1',
  status: 'FT',
  isLive: false,
  form: ['W', 'W', 'D', 'W', 'L']
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
  // All finished states collapse to FT per the PRD's status convention.
  if (status === 'FINISHED' || status === 'AWARDED') {
    return { label: 'FT', live: false }
  }
  // Scheduled, timed, postponed, suspended, cancelled, etc.
  return { label: status || 'TBD', live: false }
}

function readGoals(match) {
  // In v4, score.fullTime is also the running score while a match is live.
  const fullTime = (match.score && match.score.fullTime) || {}
  return { home: fullTime.home, away: fullTime.away }
}

function abbreviation(team) {
  if (!team) return '---'
  const code = String(team.code || '').trim().toUpperCase()
  if (code.length >= 2 && code.length <= 4) return code
  let name = String(team.name || '').toLowerCase()
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

function teamModel(team, goals) {
  return {
    id: team && team.id ? team.id : 0,
    name: team && (team.shortName || team.name) ? (team.shortName || team.name) : '',
    code: team && team.tla ? team.tla : null,
    logo: pngCrest(team && team.crest),
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

function deriveForm(matches, teamId) {
  const finished = (matches || []).filter(function (match) {
    return String(match.status || '').toUpperCase() === 'FINISHED'
  }).slice(0, 5)

  // The API returns most-recent-first; the PRD wants oldest -> newest.
  return finished.reverse().map(function (match) {
    const fullTime = (match.score && match.score.fullTime) || {}
    const homeGoals = fullTime.home
    const awayGoals = fullTime.away
    if (homeGoals === null || homeGoals === undefined ||
        awayGoals === null || awayGoals === undefined) return 'D'

    const isHome = !!(match.homeTeam && match.homeTeam.id === teamId)
    const mine = isHome ? homeGoals : awayGoals
    const theirs = isHome ? awayGoals : homeGoals
    if (mine > theirs) return 'W'
    if (mine === theirs) return 'D'
    return 'L'
  })
}

async function fetchMatchData(apiKey) {
  const lastResult = await safeFetch('/teams/' + TEAM_ID + '/matches?status=FINISHED&limit=5', apiKey)
  const liveResult = await safeFetch('/teams/' + TEAM_ID + '/matches?status=LIVE&limit=1', apiKey)

  const finishedMatches = (lastResult.json && lastResult.json.matches) || []
  const liveMatches = (liveResult.json && liveResult.json.matches) || []
  const form = finishedMatches.length ? deriveForm(finishedMatches, TEAM_ID) : []

  const chosen = liveMatches[0] || finishedMatches[0] || null
  const model = chosen ? normalizeMatch(chosen) : null
  if (model) saveCachedMatch({ model: model, form: form, fetchedAt: Date.now() })

  return {
    model: model,
    form: form,
    authFailed: lastResult.authFailed || liveResult.authFailed
  }
}

// ---------------------------------------------------------------------------
// Crest images
// ---------------------------------------------------------------------------

async function loadCrest(team) {
  if (!team || !team.logo) return null
  const path = crestCachePath(team.id || 0)
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

function addTeamSide(parent, team, crestImage) {
  const side = parent.addStack()
  side.layoutVertically()
  side.centerAlignContent()
  side.spacing = 4

  const badge = side.addImage(crestImage || initialsImage(team ? team.code : '?'))
  badge.imageSize = new Size(40, 40)
  badge.resizable = true
  badge.cornerRadius = 6

  styledLabel(side, abbreviation(team), Font.semiboldSystemFont(12), Color.white())
  return side
}

function addFormRow(widget, form) {
  const row = widget.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()
  row.spacing = 5

  row.addSpacer(null)
  styledLabel(row, 'FORM', Font.regularSystemFont(9), COLOR_MUTED)
  row.addSpacer(4)

  const results = (form && form.length) ? form : ['D', 'D', 'D', 'D', 'D']
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const box = row.addStack()
    box.size = new Size(16, 16)
    box.cornerRadius = 3
    box.backgroundColor = FORM_COLORS[result] || FORM_COLORS.D
    box.centerAlignContent()
    box.addSpacer(null)
    styledLabel(box, result, Font.boldSystemFont(9), Color.white())
    box.addSpacer(null)
  }
  row.addSpacer(null)
}

function buildWidget(model, homeImage, awayImage) {
  const widget = new ListWidget()
  widget.backgroundColor = COLOR_BG
  widget.setPadding(15, 15, 15, 15)
  widget.spacing = 0                     // vertical rhythm comes from explicit spacers
  widget.refreshAfterDate = new Date(Date.now() + CACHE_TTL_MS)

  // Header: club name on the left, data-state hint on the right.
  const header = widget.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()
  styledLabel(header, 'REAL MADRID', Font.semiboldSystemFont(11), COLOR_GOLD)
  header.addSpacer(null)
  styledLabel(header, model.hint || '', Font.regularSystemFont(9), COLOR_MUTED)

  widget.addSpacer(6)

  if (!model.home || !model.away) {
    // Explicit empty state — never render a blank widget.
    const badge = widget.addImage(initialsImage('RMA'))
    badge.imageSize = new Size(48, 48)
    badge.resizable = true
    badge.cornerRadius = 8
    widget.addSpacer(4)
    styledLabel(widget, 'REAL MADRID', Font.boldSystemFont(16), Color.white())
    styledLabel(widget, model.status || 'No fixture scheduled',
      Font.semiboldSystemFont(12), COLOR_GOLD)
    styledLabel(widget, model.hint || '', Font.regularSystemFont(10), COLOR_MUTED)
    return widget
  }

  // Scoreline row: [home crest/abbr] [flex] [score/status] [flex] [away abbr/crest]
  const row = widget.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()
  row.spacing = 6

  addTeamSide(row, model.home, homeImage)
  row.addSpacer(null)

  const center = row.addStack()
  center.layoutVertically()
  center.centerAlignContent()
  center.spacing = 1
  const score = styledLabel(center, model.score, Font.boldSystemFont(32), Color.white())
  score.minimumScaleFactor = 0.7
  styledLabel(center, model.status, Font.semiboldSystemFont(12), COLOR_GOLD)
  if (model.isLive) {
    styledLabel(center, 'LIVE', Font.regularSystemFont(8), COLOR_MUTED)
  }

  row.addSpacer(null)
  addTeamSide(row, model.away, awayImage)

  widget.addSpacer(8)
  addFormRow(widget, model.form)
  return widget
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function renderModelFrom(payload, source, hint, empty) {
  const model = payload && payload.model ? payload.model : null
  return {
    home: model ? model.home : null,
    away: model ? model.away : null,
    score: model ? model.score : '–',
    status: model ? model.status : '',
    isLive: model ? !!model.isLive : false,
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
    if (fresh.model) {
      const hint = needsSetup ? 'Set API token'
        : fresh.model.isLive ? 'Live'
        : 'Matchday'
      return renderModelFrom(fresh, 'live', hint, false)
    }
  }

  const cached = loadCachedMatch()
  if (cached) {
    return renderModelFrom(cached, 'cached',
      needsSetup ? 'Set API token' : 'Last match', false)
  }

  const sample = renderModelFrom({ model: SAMPLE_MODEL, form: SAMPLE_MODEL.form },
    'sample', needsSetup ? 'Set API token' : 'Sample data', false)
  return sample
}

async function run() {
  const model = await resolveModel()

  const homeImage = model.empty ? null : await loadCrest(model.home)
  const awayImage = model.empty ? null : await loadCrest(model.away)

  const widget = buildWidget(model, homeImage, awayImage)
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
        home: null,
        away: null,
        status: 'Widget unavailable',
        hint: 'Check the Scriptable log',
        form: []
      }, null, null))
    } catch (inner) {
      console.error('Could not render fallback widget: ' + inner)
    }
  } finally {
    Script.complete()
  }
})()
