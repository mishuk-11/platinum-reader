// Help menu: shortcuts, guide, self-test, and feedback to the developer (with a diagnostic report).
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { open as openPicker } from '@tauri-apps/plugin-dialog'
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener'
import { BookOpen, Keyboard, Stethoscope, MessageSquare, Bug, RefreshCw, Info, ImagePlus, Check, AlertTriangle, X } from 'lucide'
import { Doc } from '../engine/client'
import { state } from './app'
import { findInPage } from './search'
import { settings } from './store'
import { stats } from './viewer'
import { check as checkUpdates, REPO } from './updates'
import { showAbout } from './dialogs'
import { dialog, h, icon, toast } from './ui'

export const DEVELOPER_EMAIL = 'trade.inzamam@gmail.com'
/** Windows only lets the user pick default apps; this opens Platinum Reader's page in Settings. */
export const openDefaultApps = () => openUrl('ms-settings:defaultapps?registeredAppMachine=Platinum%20Reader').catch(() => openUrl('ms-settings:defaultapps'))

export function showHelp() {
  const item = (ico: any, label: string, hint: string, run: () => void) =>
    h('button', { class: 'help-item', onclick: () => { close(); run() } }, icon(ico, 18), h('span', {}, h('b', {}, label), h('small', {}, hint)))
  const close = dialog('Help', h('div', { class: 'help-list' },
    item(BookOpen, 'User guide', 'Features, install and FAQ on GitHub', () => openUrl(`https://github.com/${REPO}#readme`)),
    item(Keyboard, 'Keyboard shortcuts', 'All shortcuts at a glance', showShortcuts),
    item(Stethoscope, 'Run self-test', 'Check that everything works on this PC', runSelfTest),
    item(MessageSquare, 'Send feedback', 'Ideas or problems, straight to the developer', () => showFeedback()),
    item(Bug, 'Report a problem', 'Feedback with a diagnostic report attached', () => showFeedback('Problem', true)),
    item(RefreshCw, 'Check for updates', 'Look for a newer version on GitHub', () => checkUpdates(true)),
    item(Info, 'About Platinum Reader', 'Version, license, developer', showAbout)))
}

const SHORTCUTS: [string, string][] = [
  ['Ctrl+O', 'Open'], ['Ctrl+N', 'New window'], ['Ctrl+W', 'Close tab'], ['Ctrl+Tab', 'Next tab'], ['Ctrl+1…9', 'Go to tab'],
  ['Ctrl+F', 'Find'], ['Ctrl+G', 'Go to page'], ['Ctrl+B', 'Outline'], ['Ctrl+H', 'History'], ['Ctrl+,', 'Settings'],
  ['Ctrl+P', 'Print'], ['Ctrl + / −', 'Zoom'], ['Ctrl+0', 'Fit width'], ['F11', 'Full screen'], ['Hold 3 s', 'Preview a file'],
]
function showShortcuts() {
  dialog('Keyboard shortcuts', h('dl', { class: 'props shortcuts' }, ...SHORTCUTS.flatMap(([k, v]) => [h('dt', {}, h('kbd', {}, k)), h('dd', {}, v)])))
}

// ---------- self-test ----------
type Result = { name: string; status: 'pass' | 'warn' | 'fail'; detail: string }
let lastResults: Result[] = []

const CHECK_TIMEOUT = 15000 // the engine is shared with open documents, so a busy one must not hang the test

async function selfTests(onResult: (r: Result) => void, onStart: (name: string) => void = () => {}) {
  const run = async (name: string, fn: () => Promise<[Result['status'], string]>) => {
    let r: Result
    onStart(name)
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out after 15 s (busy with open documents?)')), CHECK_TIMEOUT))
    try { const [status, detail] = await Promise.race([fn(), timeout]); r = { name, status, detail } } catch (err: any) { r = { name, status: 'fail', detail: String(err?.message ?? err) } }
    onResult(r)
    return r
  }
  const results: Result[] = []
  let doc: Doc | undefined
  results.push(await run('Document engine', async () => {
    const html = new TextEncoder().encode('<h1>Self test</h1><p>Platinum Reader honeybee check.</p>').buffer
    doc = await Doc.fromBytes(html, 'selftest.html')
    const t0 = performance.now()
    const bmp = await doc.render(0, 1)
    const ok = bmp.width > 0 && bmp.height > 0
    bmp.close()
    return [ok ? 'pass' : 'fail', `rendered a test page in ${Math.round(performance.now() - t0)} ms`]
  }))
  results.push(await run('Text and search', async () => {
    if (!doc) return ['fail', 'engine did not start']
    const hits = findInPage(await doc.text(0), 'honeybee', false)
    doc.close()
    return hits.length ? ['pass', 'text extracted and found'] : ['fail', 'search found nothing']
  }))
  results.push(await run('Settings storage', async () => {
    localStorage.setItem('selftest', '1')
    const ok = localStorage.getItem('selftest') === '1'
    localStorage.removeItem('selftest')
    return ok ? ['pass', 'settings, history and highlights can be saved'] : ['fail', 'storage is blocked']
  }))
  const sys = await invoke<any>('system_info').catch(() => ({ peek: {} }))
  results.push(await run('Installation', async () => ['pass', sys.allUsersInstall ? 'all users (Program Files)' : `just this user (${sys.os})`]))
  if (sys.peek?.supported) {
    results.push(await run('Default PDF app', async () => sys.peek.pdfDefault?.startsWith('PlatinumReader')
      ? ['pass', 'PDFs open with Platinum Reader']
      : ['warn', `PDFs open with ${sys.peek.pdfDefault ?? 'Windows default'}. Use Settings → Make Platinum Reader the default`]))
    results.push(await run('Hold to preview in Explorer', async () => {
      if (!settings.holdPreview || !settings.holdPreviewExplorer) return ['warn', 'turned off in Settings']
      if (!sys.peek.helperRunning) return ['fail', 'the preview helper is not running']
      const cmd: string = sys.peek.startupCommand ?? ''
      if (!cmd.toLowerCase().includes(sys.exe.toLowerCase())) return ['warn', 'helper starts from a different copy of the app; reopen the app to fix']
      return ['pass', 'helper running and starts at sign-in']
    }))
  }
  results.push(await run('Hold to preview in the app', async () => settings.holdPreview ? ['pass', 'on'] : ['warn', 'turned off in Settings']))
  results.push(await run('Update server', async () => {
    const res = await fetch(`https://api.github.com/repos/${REPO}`)
    if (res.ok) return ['pass', `github.com/${REPO} reachable`]
    return ['warn', res.status === 404 ? 'repository not published yet' : `GitHub answered ${res.status}`]
  }))
  return results
}

export async function runSelfTest() {
  const list = h('ul', { class: 'selftest' })
  const summary = h('p', { class: 'muted' }, 'Running checks…')
  const actions = h('div', { class: 'update-actions' })
  dialog('Self-test', h('div', {}, summary, list, actions), 'wide')
  const ICON = { pass: Check, warn: AlertTriangle, fail: X }
  lastResults = await selfTests(
    (r) => list.append(h('li', { class: r.status }, icon(ICON[r.status], 16), h('b', {}, r.name), h('span', {}, r.detail))),
    (name) => { summary.textContent = `Checking ${name.toLowerCase()}…` })
  const fails = lastResults.filter((r) => r.status === 'fail').length
  const warns = lastResults.filter((r) => r.status === 'warn').length
  summary.textContent = fails ? `${fails} check${fails > 1 ? 's' : ''} failed.` : warns ? `All essential checks passed, ${warns} warning${warns > 1 ? 's' : ''}.` : 'Everything works.'
  actions.append(
    h('button', { class: 'btn' + (fails ? ' primary' : ''), onclick: () => showFeedback(fails ? 'Self-test failed' : 'Self-test', true) }, icon(Bug, 16), 'Send report to developer'),
    h('button', { class: 'btn', onclick: async () => { await navigator.clipboard.writeText(await diagnosticReport()); toast('Report copied') } }, 'Copy report'))
}

/** Everything a developer needs to reproduce a problem. No document contents, only names. */
export async function diagnosticReport() {
  if (!lastResults.length) lastResults = await selfTests(() => {})
  const { extensions, ...rest } = settings
  return JSON.stringify({
    app: 'Platinum Reader', version: await getVersion().catch(() => '?'), time: new Date().toISOString(),
    system: await invoke('system_info'), userAgent: navigator.userAgent, screen: `${screen.width}x${screen.height} @${devicePixelRatio}x`,
    selfTest: lastResults, render: stats, openTabs: state.tabs.map((t) => t.path.split(/[\\/]/).pop()), settings: rest, extensions,
  }, null, 2)
}

// ---------- feedback ----------
const TOPICS = ['Problem', 'Hold to preview', 'Rendering', 'Feature idea', 'Self-test failed', 'Other']

export function showFeedback(topic = 'Feature idea', withReport = false) {
  let shot: string | null = null
  const sel = h('select', {}, ...TOPICS.concat(TOPICS.includes(topic) ? [] : [topic]).map((t) => h('option', { value: t, selected: t === topic }, t)))
  const msg = h('textarea', { class: 'feedback-text', rows: '6', placeholder: 'What happened, or what would you like? Steps to reproduce help a lot.' })
  const report = h('input', { type: 'checkbox', checked: withReport })
  const shotLabel = h('span', { class: 'muted small' }, 'No screenshot (tip: Win+Shift+S, then save it)')
  const err = h('p', { class: 'form-error', role: 'alert' })
  const body = h('div', { class: 'settings feedback' },
    h('label', { class: 'set-row' }, h('span', {}, 'Topic'), sel),
    msg, err,
    h('label', { class: 'set-row' }, h('span', {}, 'Attach diagnostic report', h('small', {}, 'Versions, settings, self-test results. No document contents.')), h('span', { class: 'switch' }, report, h('i'))),
    h('div', { class: 'set-row' }, h('span', {}, 'Screenshot', shotLabel),
      h('button', { class: 'btn', onclick: async () => {
        const p = await openPicker({ filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }] })
        if (p) { shot = p; shotLabel.textContent = p.split(/[\\/]/).pop()! }
      } }, icon(ImagePlus, 15), 'Add…')),
    h('p', { class: 'muted small' }, `Opens your email app addressed to ${DEVELOPER_EMAIL}. Attachments are saved to a folder that opens next to it, so you can drag them into the email.`),
    h('div', { class: 'set-foot' }, h('button', { class: 'btn primary', onclick: send }, icon(MessageSquare, 16), 'Send feedback')))
  msg.addEventListener('input', () => { err.textContent = '' })
  const close = dialog('Send feedback', body, 'wide')

  async function send() {
    const text = msg.value.trim()
    if (!text) { err.textContent = 'Write a few words first'; msg.focus(); return }
    let folderFile = ''
    try {
      if (report.checked || shot) folderFile = await invoke<string>('save_feedback', { report: report.checked ? await diagnosticReport() : '{}', screenshot: shot })
    } catch (e: any) { err.textContent = 'Could not save attachments: ' + (e?.message ?? e); return }
    const version = await getVersion().catch(() => '?')
    const lines = [text, '', '—', `Platinum Reader ${version} · ${navigator.platform}`]
    if (folderFile) lines.push(`Attachments: ${report.checked ? 'diagnostic-report.json' : ''}${shot ? ' + screenshot' : ''} (please attach from the opened folder)`)
    const subject = `Needs Pt. Reader: ${sel.value}`
    await openUrl(`mailto:${DEVELOPER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`)
    if (folderFile) await revealItemInDir(folderFile)
    close()
    toast('Email drafted. Attach the files and press send.', 5000)
  }
}
