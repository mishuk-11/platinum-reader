// Settings, History, Properties and About dialogs.
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { ask, open as openPicker } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Trash2, Puzzle, Plus, type IconNode } from 'lucide'
import { recentList, type Tab } from './app'
import { ACCENTS, AI, SEARCH, history, resetSettings, setSetting, settings, type Settings } from './store'
import { dialog, h, icon, toast } from './ui'
import { playEgg, onHold, releaseShowdown } from './eggs'
import { BUILTIN, userExtensions } from './extensions'
import { copyDiagnostics, openDevtools, resetAllData } from './dev'
import { updateSettings } from './updates'
import { openDefaultApps } from './help'

export const VERSION_NAME = 'Honeybee'
export const DEVELOPER = 'Inzamam Islam'
export const GITHUB = 'https://github.com/mishuk-11'
// Lucide 1.x dropped brand icons; this is its former GitHub glyph.
const Github: IconNode = [
  ['path', { d: 'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4' }],
  ['path', { d: 'M9 18c-4.51 2-5-2-7-2' }],
]

// ---------- settings ----------
type Opt = [string, string]
function select(key: keyof Settings, opts: Opt[]) {
  const s = h('select', { onchange: () => setSetting(key, s.value as never) },
    ...opts.map(([v, l]) => h('option', { value: v, selected: String(settings[key]) === v }, l)))
  return s
}
function toggle(key: keyof Settings, after?: () => void) {
  return switchEl(!!settings[key], (on) => { setSetting(key, on as never); after?.() })
}
function switchEl(checked: boolean, onchange: (on: boolean) => void) {
  const c = h('input', { type: 'checkbox', role: 'switch', checked, onchange: () => onchange(c.checked) })
  return h('span', { class: 'switch' }, c, h('i'))
}
const row = (label: string, control: Node, hint?: string) =>
  h('label', { class: 'set-row' }, h('span', {}, label, hint ? h('small', {}, hint) : null), control)

const syncPeek = () => invoke('set_peek_helper', { enabled: settings.holdPreview && settings.holdPreviewExplorer })

export function showSettings() {
  const accents = h('div', { class: 'accents', role: 'radiogroup', 'aria-label': 'Accent theme' },
    ...Object.entries(ACCENTS).map(([name, color]) => {
      const b = h('button', {
        class: 'accent' + (settings.accent === name ? ' on' : ''), style: { background: color }, title: name[0].toUpperCase() + name.slice(1),
        role: 'radio', 'aria-checked': String(settings.accent === name), 'aria-label': name,
        onclick: () => { setSetting('accent', name); accents.querySelectorAll('.accent').forEach((x) => x.classList.toggle('on', x === b)) },
      })
      return b
    }))
  const gap = h('input', { type: 'range', min: '0', max: '40', value: String(settings.pageGap), oninput: () => setSetting('pageGap', +gap.value) })
  const dev = h('div', { class: 'dev-only' + (settings.devMode ? ' show' : '') },
    row('Performance overlay', toggle('devOverlay'), 'Render times, queue, canvases and memory'),
    row('Show text layer', toggle('devTextLayer'), 'Outlines the invisible text boxes over each page'),
    row('Render quality', select('renderQuality', [['low', 'Low (saves memory)'], ['normal', 'Normal'], ['high', 'High (sharp at big zoom)']])),
    row('Parallel page renders', select('renderThreads', [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']])),
    row('DevTools', h('button', { class: 'btn', onclick: openDevtools }, 'Open DevTools')),
    row('Diagnostics', h('button', { class: 'btn', onclick: copyDiagnostics }, 'Copy to clipboard')),
    row('All app data', h('button', { class: 'btn danger', onclick: resetAllData }, 'Reset everything')))
  const body = h('div', { class: 'settings' },
    h('h3', {}, 'Appearance'),
    row('Mode', select('theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']])),
    row('Theme', accents, 'Sepia also warms the light mode surfaces'),
    row('Dark pages', toggle('invertPages'), 'Invert page colors in dark mode for night reading'),
    row('Density', select('density', [['comfortable', 'Comfortable'], ['compact', 'Compact']])),
    h('h3', {}, 'Layout'),
    row('Tab bar position', select('tabs', [['top', 'Top'], ['left', 'Left (vertical tabs)']])),
    row('Toolbar labels', toggle('toolbarLabels')),
    row('Show outline sidebar', toggle('sidebar')),
    h('h3', {}, 'Reading'),
    row('Default view', select('viewMode', [['continuous', 'Continuous scrolling'], ['facing', 'Facing pages'], ['single', 'Single page']])),
    row('Default zoom', select('zoom', [['width', 'Fit width'], ['page', 'Fit page'], ['75', '75%'], ['100', '100%'], ['125', '125%'], ['150', '150%']])),
    row('Page gap', gap),
    row('Reopen tabs on launch', toggle('restoreTabs')),
    navigator.userAgent.includes('Windows') ? row('Default app', h('button', { class: 'btn', onclick: openDefaultApps }, 'Make Platinum Reader the default…'), 'Windows asks you to confirm each file type; their icons appear once chosen') : null,
    row('Hold to preview', toggle('holdPreview', syncPeek), 'Press and hold a file for 3 s (no drag) to see its first page'),
    row('…also in File Explorer and desktop', toggle('holdPreviewExplorer', syncPeek), 'Windows only. Runs a tiny helper when you sign in'),
    h('h3', {}, 'Web'),
    row('Ask AI with', select('ai', Object.entries(AI).map(([k, [l]]) => [k, l]))),
    row('Search with', select('search', Object.entries(SEARCH).map(([k, [l]]) => [k, l]))),
    h('h3', {}, 'Updates'),
    ...updateSettings(row, toggle('autoUpdate')),
    h('h3', {}, 'Extensions'),
    row('Manage extensions', h('button', { class: 'btn', onclick: () => { close(); showExtensions() } }, icon(Puzzle, 15), 'Open…')),
    h('h3', {}, 'Developer'),
    row('Developer mode', toggle('devMode', () => dev.classList.toggle('show', settings.devMode)), 'Shows advanced options for debugging and tuning'),
    dev,
    h('div', { class: 'set-foot' },
      h('button', { class: 'btn', onclick: () => { resetSettings(); close(); showSettings() } }, 'Reset to defaults')))
  const close = dialog('Settings', body, 'wide')
}

// ---------- history ----------
export function showHistory() {
  const box = h('div', {})
  const close = dialog('History', h('div', { class: 'history' }, box,
    h('div', { class: 'set-foot' }, h('button', { class: 'btn danger', onclick: () => { history.clear(); box.replaceChildren(recentList(() => close())) } }, icon(Trash2, 15), 'Clear history'))), 'wide')
  box.append(recentList(() => close()))
}

// ---------- properties ----------
export async function showProperties(tab: Tab) {
  const doc = tab.viewer!.doc
  const size = await invoke<number>('file_size', { path: tab.path })
  const [w, ht] = doc.sizes[tab.viewer!.current] ?? [0, 0]
  const rows: [string, string][] = [
    ['File', tab.path.split(/[\\/]/).pop()!], ['Location', tab.path],
    ['Size', size > 1048576 ? (size / 1048576).toFixed(1) + ' MB' : (size / 1024).toFixed(0) + ' KB'],
    ['Pages', String(doc.pages)], ['Page size', `${(w / 72 * 25.4).toFixed(0)} × ${(ht / 72 * 25.4).toFixed(0)} mm`],
    ...Object.entries(doc.meta),
  ]
  dialog('Properties', h('dl', { class: 'props' }, ...rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])))
}

// ---------- about ----------
export async function showAbout() {
  const version = await getVersion().catch(() => '0.4.1-beta')
  let clicks = 0
  const name = h('button', {
    class: 'dev-name', title: DEVELOPER,
    onclick: () => { if (++clicks === 11) { clicks = 0; playEgg(name) } },
  }, DEVELOPER)
  const logo = h('span', { class: 'logo big', title: 'Platinum Reader', style: { cursor: 'pointer', touchAction: 'none' } })
  // Hold the Pt. icon 3 s (or the name 5 s): every release's emoji, one burst per codename.
  onHold(logo, 3000, () => releaseShowdown(logo))
  onHold(name, 5000, () => releaseShowdown(name))
  dialog('About', h('div', { class: 'about' },
    logo,
    h('h1', {}, 'Platinum Reader'),
    h('p', { class: 'version' }, `Version ${version} · “${VERSION_NAME}”`),
    h('p', { class: 'muted' }, 'An ultra-lightweight, open-source reader for PDF, EPUB, MOBI, CBZ/CBR, DjVu, XPS, Markdown and CHM.'),
    h('div', { class: 'dev' }, h('small', { class: 'muted' }, 'Developed by'), name),
    h('button', { class: 'btn', onclick: () => openUrl(GITHUB) }, icon(Github, 16), 'mishuk-11'),
    h('p', { class: 'muted small' }, 'Licensed under AGPL-3.0 · Built with Tauri, MuPDF, djvu-rs, marked, lucide')), 'about-modal')
}

// ---------- extensions ----------
export function showExtensions() {
  const list = h('div', { class: 'ext-list' })
  const render = () => {
    const users = userExtensions.list()
    list.replaceChildren(
      h('h3', {}, 'Built-in'),
      ...BUILTIN.map((b) => row(b.name, switchEl(!!settings.extensions[b.id], (on) => setSetting('extensions', { ...settings.extensions, [b.id]: on })), b.description)),
      h('h3', {}, 'Installed'),
      users.length ? h('div', {}, ...users.map((u) => row(u.name,
        h('span', { class: 'ext-actions' },
          switchEl(u.enabled, (on) => { userExtensions.save(users.map((x) => x.id === u.id ? { ...x, enabled: on } : x)); toast('Restart Platinum Reader to apply') }),
          h('button', { class: 'tb-btn', title: 'Remove', 'aria-label': `Remove ${u.name}`, onclick: () => { userExtensions.save(users.filter((x) => x.id !== u.id)); render(); toast('Removed. Restart Platinum Reader to unload it.') } }, icon(Trash2, 15))),
        'Your extension'))) : h('p', { class: 'muted' }, 'No extensions installed yet.'),
    )
  }
  render()
  dialog('Extensions', h('div', { class: 'settings' }, list,
    h('p', { class: 'muted small' }, 'Extensions are JavaScript files that can add selection actions, menu items and document hooks. Only install extensions you trust. See EXTENSIONS.md in the project for the API.'),
    h('div', { class: 'set-foot' }, h('button', { class: 'btn primary', onclick: () => addExtension(render) }, icon(Plus, 16), 'Add extension (.js)…'))), 'wide')
}

async function addExtension(done: () => void) {
  const path = await openPicker({ filters: [{ name: 'Platinum Reader extension', extensions: ['js', 'mjs'] }] })
  if (!path) return
  const name = path.split(/[\\/]/).pop()!.replace(/\.m?js$/, '')
  if (!(await ask(`"${name}" will run with full access to Platinum Reader. Install it only if you trust where it came from.`, { title: 'Install extension?', kind: 'warning' }))) return
  const code = new TextDecoder().decode(await invoke<ArrayBuffer>('read_file', { path }))
  const list = userExtensions.list().filter((x) => x.name !== name)
  userExtensions.save([...list, { id: 'user:' + name, name, code, enabled: true }])
  done()
  toast(`Installed "${name}". Restart Platinum Reader to load it.`, 4000)
}
