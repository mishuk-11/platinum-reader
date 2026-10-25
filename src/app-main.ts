import './styles.css'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { activate, activeViewer, closeTab, cycleTab, focusedTab, openDialog, openFile, placeWindowControls, state, tabbar, workspace } from './app/app'
import { toolbar, refresh, toggleSidebar, focusPageBox, newWindow } from './app/toolbar'
import { findBar, openFind, closeFind } from './app/find'
import { showHighlightMenu } from './app/selection'
import { showHistory, showSettings } from './app/dialogs'
import { toggleFullscreen, isFullscreen } from './app/fullscreen'
import { printDoc } from './app/print'
import { applyTheme, onSettings, session, settings } from './app/store'
import { Viewer } from './app/viewer'
import { loadExtensions } from './app/extensions'
import { applyDev } from './app/dev'
import { initUpdates } from './app/updates'

// Read before the first render, which saves the (still empty) tab list.
const lastSession = session.get()
applyTheme()
document.body.append(tabbar, toolbar, workspace)
workspace.append(findBar)
placeWindowControls(toolbar)
onSettings(() => placeWindowControls(toolbar))
Viewer.onHighlightClick = showHighlightMenu
toggleSidebar(settings.sidebar)
refresh()
applyDev()
await loadExtensions(activeViewer)

// ---------- keyboard ----------
addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey
  const typing = (e.target as HTMLElement).matches?.('input, select, textarea')
  const v = activeViewer()
  const key = e.key.toLowerCase()
  const run = (fn: () => unknown) => { e.preventDefault(); fn() }

  if (e.key === 'F11') return run(() => toggleFullscreen())
  if (e.key === 'Escape' && isFullscreen()) return run(() => toggleFullscreen(false))
  if (mod) {
    if (key === 'o') return run(() => openDialog())
    if (key === 'n') return run(newWindow)
    if (key === 'w') return run(() => { const t = focusedTab(); if (t) closeTab(t) })
    if (key === 'tab') return run(() => cycleTab(e.shiftKey ? -1 : 1))
    if (key === 'f') return run(openFind)
    if (key === 'g') return run(focusPageBox)
    if (key === 'b') return run(() => toggleSidebar())
    if (key === 'h') return run(showHistory)
    if (key === ',') return run(showSettings)
    if (key === 'p') return run(() => v && printDoc(v.doc))
    if (key === '=' || key === '+') return run(() => v?.zoomBy(1.15))
    if (key === '-') return run(() => v?.zoomBy(1 / 1.15))
    if (key === '0') return run(() => v?.setZoom('width'))
    if (/^[1-9]$/.test(key) && state.tabs.length) return run(() => activate(state.tabs[Math.min(+key, state.tabs.length) - 1]))
    return
  }
  if (typing || !v) return
  const single = v.mode === 'single'
  if (e.key === 'ArrowRight' || (single && (e.key === 'PageDown' || e.key === ' ' || e.key === 'ArrowDown') && v.el.scrollTop + v.el.clientHeight >= v.el.scrollHeight - 2)) return run(() => v.next())
  if (e.key === 'ArrowLeft' || (single && (e.key === 'PageUp' || e.key === 'ArrowUp') && v.el.scrollTop <= 0)) return run(() => v.prev())
  if (e.key === 'Home' && !single) return run(() => v.goTo(0))
  if (e.key === 'End' && !single) return run(() => v.goTo(v.doc.pages - 1))
  if (e.key === 'Escape') closeFind()
})

// Ctrl+wheel outside a page must not zoom the whole webview.
addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault() }, { passive: false })
addEventListener('contextmenu', (e) => { if (!(e.target as HTMLElement).closest('input, .text')) e.preventDefault() })

// ---------- files from the OS ----------
getCurrentWebview().onDragDropEvent((e) => {
  document.body.classList.toggle('dropping', e.payload.type === 'over' || e.payload.type === 'enter')
  if (e.payload.type === 'drop') e.payload.paths.forEach((p) => openFile(p))
})

const params = new URLSearchParams(location.search)
if (params.get('open')) {
  openFile(params.get('open')!, { page: +(params.get('page') ?? 0) })
} else if (getCurrentWebviewWindow().label === 'main') {
  listen<string[]>('open-files', (e) => e.payload.forEach((p) => openFile(p)))
  invoke('set_peek_helper', { enabled: settings.holdPreview && settings.holdPreviewExplorer })
  initUpdates()
  const pending = await invoke<string[]>('pending_files')
  const restore = settings.restoreTabs ? lastSession.filter((p) => !pending.includes(p)) : []
  ;[...restore, ...pending].forEach((p) => openFile(p))
}
