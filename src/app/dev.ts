// Developer mode: performance overlay, DevTools, diagnostics, data reset.
import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { ask } from '@tauri-apps/plugin-dialog'
import { activeViewer, state } from './app'
import { onSettings, settings } from './store'
import { stats } from './viewer'
import { h, toast } from './ui'

const overlay = h('div', { class: 'dev-overlay', 'aria-hidden': 'true' })
let timer = 0

function tick() {
  const v = activeViewer()
  const mem = (performance as any).memory
  overlay.textContent = [
    `renders   ${stats.renders}`,
    `last      ${stats.lastMs.toFixed(1)} ms`,
    `average   ${(stats.totalMs / (stats.renders || 1)).toFixed(1)} ms`,
    `queued    ${stats.queued}`,
    `tabs      ${state.tabs.length}`,
    `page      ${v ? `${v.current + 1}/${v.doc.pages}` : '-'}`,
    `zoom      ${v ? Math.round(v.zoom * 100) + '%' : '-'}`,
    `canvases  ${document.querySelectorAll('.page canvas').length}`,
    mem ? `js heap   ${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : '',
  ].filter(Boolean).join('\n')
}

export function applyDev() {
  const on = settings.devMode && settings.devOverlay
  if (on && !overlay.isConnected) { document.body.append(overlay); timer = window.setInterval(tick, 500); tick() }
  if (!on && overlay.isConnected) { overlay.remove(); clearInterval(timer) }
}
onSettings(applyDev)

export const openDevtools = () => invoke('open_devtools').catch((e) => toast('DevTools unavailable: ' + e))

export async function copyDiagnostics() {
  const info = {
    app: 'Quire', version: await getVersion().catch(() => '?'), userAgent: navigator.userAgent,
    dpr: devicePixelRatio, screen: `${screen.width}x${screen.height}`, tabs: state.tabs.map((t) => t.path.split(/[\\/]/).pop()),
    stats, settings,
  }
  await navigator.clipboard.writeText(JSON.stringify(info, null, 2))
  toast('Diagnostics copied')
}

export async function resetAllData() {
  if (!(await ask('Delete all settings, history, highlights and extensions? This cannot be undone.', { title: 'Reset Quire', kind: 'warning' }))) return
  localStorage.clear()
  location.reload()
}
