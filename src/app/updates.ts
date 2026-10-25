// Update check against GitHub Releases. Always asks before downloading anything.
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Download, Terminal, Clock, X, RefreshCw } from 'lucide'
import { compareVersions } from './semver'
import { setSetting, settings } from './store'
import { dialog, h, icon, toast } from './ui'

export const REPO = 'mishuk-11/platinum-reader'
const DAY = 86_400_000
export const isWindows = navigator.userAgent.includes('Windows')
export const INSTALL_CMD = isWindows
  ? `irm https://raw.githubusercontent.com/${REPO}/main/install.ps1 | iex`
  : `curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | sh`

interface Asset { name: string; size: number; browser_download_url: string }
interface Release { tag_name: string; name: string; body: string; html_url: string; draft: boolean; prerelease: boolean; assets: Asset[] }

export const updatesPaused = () => !settings.autoUpdate || Date.now() < settings.updatePausedUntil

/** Checks on launch and once a day, unless paused. */
export function initUpdates() {
  const tick = () => { if (!updatesPaused()) check(false) }
  setTimeout(tick, 8000)
  setInterval(tick, DAY)
}

/** `manual` also reports "up to date" and ignores a skipped version. */
export async function check(manual: boolean) {
  try {
    const current = await getVersion()
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=15`, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`)
    // Beta users also get prereleases; stable users only stable releases.
    const wantPre = current.includes('-')
    const latest = ((await res.json()) as Release[])
      .filter((r) => !r.draft && (wantPre || !r.prerelease))
      .sort((a, b) => compareVersions(b.tag_name, a.tag_name))[0]
    if (!latest || compareVersions(latest.tag_name, current) <= 0) {
      if (manual) toast(`You're up to date (${current})`)
      return
    }
    if (!manual && settings.skippedVersion === latest.tag_name) return
    offer(latest, current)
  } catch (err: any) {
    if (manual) toast('Update check failed: ' + (err?.message ?? err), 5000)
  }
}

function offer(r: Release, current: string) {
  const setup = r.assets.find((a) => /x64-setup\.exe$/i.test(a.name))
  const sums = r.assets.find((a) => /^SHA256SUMS(\.txt)?$/i.test(a.name))
  const notes = h('pre', { class: 'update-notes' })
  notes.textContent = (r.body || 'No release notes.').slice(0, 2000)
  const progress = h('div', { class: 'update-progress', hidden: true }, h('i'))
  const status = h('p', { class: 'muted small' })
  const buttons = h('div', { class: 'update-actions' },
    isWindows && setup && sums
      ? h('button', { class: 'btn primary', onclick: () => install(setup, sums, progress, status, buttons) }, icon(Download, 16), 'Update now')
      : null,
    h('button', { class: 'btn', onclick: () => openUrl(setup?.browser_download_url ?? r.html_url) }, icon(Download, 16), 'Download installer'),
    h('button', { class: 'btn', onclick: () => { navigator.clipboard.writeText(INSTALL_CMD); toast('Command copied. Paste it in a terminal.') } }, icon(Terminal, 16), 'Copy terminal command'),
    h('button', { class: 'btn', onclick: () => { setSetting('updatePausedUntil', Date.now() + 7 * DAY); close(); toast('Update checks paused for 7 days') } }, icon(Clock, 16), 'Remind me in 7 days'),
    h('button', { class: 'btn', onclick: () => { setSetting('skippedVersion', r.tag_name); close() } }, icon(X, 16), 'Skip this version'))
  const close = dialog('Update available', h('div', { class: 'update' },
    h('p', {}, h('b', {}, r.name || r.tag_name), ` is available. You have ${current}.`),
    notes, progress, status, buttons), 'wide')
}

/** Downloads the installer, checks it against SHA256SUMS, then runs it (the app closes). */
async function install(setup: Asset, sums: Asset, progress: HTMLElement, status: HTMLElement, buttons: HTMLElement) {
  buttons.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true))
  progress.hidden = false
  const bar = progress.firstElementChild as HTMLElement
  const dir = await invoke<string>('update_dir')
  const poll = setInterval(async () => {
    const got = await invoke<number>('file_size', { path: `${dir}/${setup.name}` })
    bar.style.width = Math.min(100, (got / setup.size) * 100) + '%'
    status.textContent = `Downloading… ${(got / 1048576).toFixed(1)} / ${(setup.size / 1048576).toFixed(1)} MB`
  }, 300)
  try {
    const sumsPath = await invoke<string>('download_update', { url: sums.browser_download_url, name: sums.name })
    const exePath = await invoke<string>('download_update', { url: setup.browser_download_url, name: setup.name })
    clearInterval(poll)
    status.textContent = 'Verifying…'
    const expected = new TextDecoder().decode(await invoke<ArrayBuffer>('read_file', { path: sumsPath }))
      .split('\n').find((l) => l.trim().endsWith(setup.name))?.split(/\s+/)[0]?.toLowerCase()
    const digest = await crypto.subtle.digest('SHA-256', await invoke<ArrayBuffer>('read_file', { path: exePath }))
    const actual = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
    if (!expected || expected !== actual) throw new Error('checksum mismatch, the download may be corrupted')
    status.textContent = 'Starting installer…'
    await invoke('run_installer', { path: exePath })
  } catch (err: any) {
    clearInterval(poll)
    status.textContent = 'Update failed: ' + (err?.message ?? err)
    buttons.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = false))
  }
}

/** Settings rows for the Updates section. */
export function updateSettings(row: (label: string, control: Node, hint?: string) => Node, toggle: Node) {
  const paused = Date.now() < settings.updatePausedUntil
  const pauseBtn = h('button', { class: 'btn' }, paused ? 'Resume now' : 'Pause for 7 days')
  pauseBtn.onclick = () => {
    const nowPaused = Date.now() < settings.updatePausedUntil
    setSetting('updatePausedUntil', nowPaused ? 0 : Date.now() + 7 * DAY)
    pauseBtn.textContent = nowPaused ? 'Pause for 7 days' : 'Resume now'
  }
  return [
    row('Check for updates automatically', toggle, 'Turn off to pause update checks until you turn them back on'),
    row('Pause checks', pauseBtn, paused ? `Paused until ${new Date(settings.updatePausedUntil).toLocaleDateString()}` : 'Stop asking for a week'),
    row('Check now', h('button', { class: 'btn', onclick: () => check(true) }, icon(RefreshCw, 15), 'Check for updates')),
    row('Install from a terminal', h('button', { class: 'btn', onclick: () => { navigator.clipboard.writeText(INSTALL_CMD); toast('Command copied') } }, icon(Terminal, 15), 'Copy command')),
  ]
}
