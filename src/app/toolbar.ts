// Toolbar under the tab bar. Always drives the focused pane's viewer.
import {
  PanelLeft, FolderOpen, ZoomIn, ZoomOut, MoveHorizontal, ChevronLeft, ChevronRight, Search, Printer,
  EllipsisVertical, RefreshCw, LifeBuoy, Rows3, BookOpenText, File, Maximize, Settings, History, Info, AppWindow, Columns2, FileSearch, Expand, X, Puzzle,
} from 'lucide'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { activeViewer, changed, closeTab, focusedTab, openDialog, setSplit, sidebar, state } from './app'
import { openFind } from './find'
import { printDoc } from './print'
import { showAbout, showExtensions, showHistory, showProperties, showSettings } from './dialogs'
import { isOn, registry } from './extensions'
import { check } from './updates'
import { showHelp } from './help'
import { toggleFullscreen } from './fullscreen'
import { settings, setSetting, type ViewMode } from './store'
import { button, h, icon, menu } from './ui'

const pageInput = h('input', { class: 'page-input', type: 'text', inputmode: 'numeric', 'aria-label': 'Page number', title: 'Page number (Ctrl+G)' })
const pageTotal = h('span', { class: 'page-total' }, '/ 0')
const zoomBtn = h('button', { class: 'zoom-btn', title: 'Zoom presets', onclick: (e: MouseEvent) => zoomMenu(e) }, '100%')
const fitBtn = button(MoveHorizontal, 'Fit width', () => activeViewer()?.setZoom('width'))
const modeBtn = h('button', { class: 'tb-btn', title: 'View mode', 'aria-label': 'View mode', onclick: (e: MouseEvent) => modeMenu(e) }, icon(Rows3))

pageInput.addEventListener('focus', () => pageInput.select())
pageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const v = activeViewer()
    const n = parseInt(pageInput.value, 10)
    if (v && n) v.goTo(n - 1)
    v?.el.focus()
  } else if (e.key === 'Escape') { refresh(); activeViewer()?.el.focus() }
})
pageInput.addEventListener('blur', () => refresh())

export const toolbar = h('div', { class: 'toolbar', 'data-tauri-drag-region': true },
  button(PanelLeft, 'Outline (Ctrl+B)', () => toggleSidebar()),
  button(FolderOpen, 'Open (Ctrl+O)', () => openDialog(), 'Open'),
  h('span', { class: 'sep' }),
  button(ZoomOut, 'Zoom out (Ctrl+-)', () => activeViewer()?.zoomBy(1 / 1.15)),
  zoomBtn,
  button(ZoomIn, 'Zoom in (Ctrl++)', () => activeViewer()?.zoomBy(1.15)),
  fitBtn,
  h('span', { class: 'sep' }),
  h('div', { class: 'page-box' }, pageInput, pageTotal),
  button(ChevronLeft, 'Previous page', () => activeViewer()?.prev()),
  button(ChevronRight, 'Next page', () => activeViewer()?.next()),
  h('span', { class: 'sep' }),
  modeBtn,
  button(Maximize, 'Full screen (F11)', () => toggleFullscreen()),
  h('div', { class: 'drag', 'data-tauri-drag-region': true }),
  button(Search, 'Find (Ctrl+F)', () => openFind()),
  button(Printer, 'Print (Ctrl+P)', () => { const v = activeViewer(); if (v) printDoc(v.doc) }),
  button(EllipsisVertical, 'More', (e) => moreMenu(e)),
)

const MODES: [ViewMode, string, any][] = [
  ['continuous', 'Continuous scrolling', Rows3], ['facing', 'Facing pages', BookOpenText], ['single', 'Single page', File],
]

function modeMenu(e: MouseEvent) {
  const v = activeViewer()
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  menu(MODES.map(([m, label, ico]) => ({
    label, icon: ico, checked: (v?.mode ?? settings.viewMode) === m,
    action: () => { v ? v.setMode(m) : setSetting('viewMode', m) },
  })), r.left, r.bottom + 4)
}

function zoomMenu(e: MouseEvent) {
  const v = activeViewer()
  if (!v) return
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  menu([
    { label: 'Fit width', icon: MoveHorizontal, checked: v.fit === 'width', action: () => v.setZoom('width') },
    { label: 'Fit page', icon: Expand, checked: v.fit === 'page', action: () => v.setZoom('page') },
    '-',
    ...[50, 75, 100, 125, 150, 200, 300, 400].map((z) => ({
      label: z + '%', checked: !v.fit && Math.round(v.zoom * 100) === z, action: () => v.setZoom(z / 100),
    })),
  ], r.left, r.bottom + 4)
}

function moreMenu(e: MouseEvent) {
  const tab = focusedTab()
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  menu([
    { label: 'New window', icon: AppWindow, kbd: 'Ctrl+N', action: newWindow },
    { label: 'Open…', icon: FolderOpen, kbd: 'Ctrl+O', action: () => openDialog() },
    { label: 'History', icon: History, kbd: 'Ctrl+H', action: showHistory },
    '-',
    { label: state.split ? 'Close split view' : 'Split view…', icon: Columns2, action: () => state.split ? setSplit(null) : openDialog(true) },
    { label: 'Full screen', icon: Maximize, kbd: 'F11', action: () => toggleFullscreen() },
    { label: 'Show in folder', icon: FolderOpen, disabled: !tab, action: () => tab && revealItemInDir(tab.path) },
    { label: 'Document properties', icon: FileSearch, disabled: !tab?.viewer, action: () => tab?.viewer && showProperties(tab) },
    '-',
    ...registry.menu.filter((m) => isOn(m.ext)).map((m) => ({ label: m.label, icon: Puzzle, action: () => { try { m.run() } catch (err) { console.error('extension', m.ext, err) } } })),
    { label: 'Extensions', icon: Puzzle, action: showExtensions },
    { label: 'Settings', icon: Settings, kbd: 'Ctrl+,', action: showSettings },
    { label: 'Help', icon: LifeBuoy, kbd: 'F1', action: showHelp },
    { label: 'Check for updates', icon: RefreshCw, action: () => check(true) },
    { label: 'About Platinum Reader', icon: Info, action: showAbout },
    '-',
    { label: 'Close tab', icon: X, kbd: 'Ctrl+W', disabled: !tab, action: () => tab && closeTab(tab) },
  ], r.right - 240, r.bottom + 4)
}

export function newWindow() {
  new WebviewWindow('w' + Date.now(), { url: 'index.html', title: 'Platinum Reader', width: 1100, height: 780, decorations: false, minWidth: 520, minHeight: 380 })
}

export function toggleSidebar(force?: boolean) {
  setSetting('sidebar', force ?? !settings.sidebar)
  refreshSidebar()
}

function refreshSidebar() {
  sidebar.classList.toggle('open', settings.sidebar)
  if (!settings.sidebar) return
  const v = activeViewer()
  const items = v?.doc.outline ?? []
  sidebar.replaceChildren(
    h('div', { class: 'sidebar-head' }, 'Outline'),
    items.length
      ? h('nav', { class: 'outline' }, ...items.map((it) => h('button', {
        class: 'outline-item' + (it.page === v!.current ? ' current' : ''),
        style: { paddingLeft: 12 + it.depth * 14 + 'px' }, title: it.title,
        onclick: () => it.page >= 0 && v!.goTo(it.page),
      }, h('span', {}, it.title), h('small', {}, it.page >= 0 ? String(it.page + 1) : ''))))
      : h('p', { class: 'muted pad' }, v ? 'This document has no outline.' : 'Open a document to see its outline.'))
}

let lastDoc: unknown
export function refresh() {
  const v = activeViewer()
  toolbar.classList.toggle('no-doc', !v)
  if (document.activeElement !== pageInput) pageInput.value = v ? String(v.current + 1) : ''
  pageTotal.textContent = '/ ' + (v?.doc.pages ?? 0)
  zoomBtn.textContent = v ? Math.round(v.zoom * 100) + '%' : '—'
  fitBtn.classList.toggle('on', v?.fit === 'width')
  const mode = MODES.find((m) => m[0] === (v?.mode ?? settings.viewMode))!
  modeBtn.replaceChildren(icon(mode[2]))
  modeBtn.title = 'View mode: ' + mode[1]
  // Rebuild the outline only when the document changes, otherwise just move the marker.
  if (v?.doc !== lastDoc) { lastDoc = v?.doc; refreshSidebar() }
  else sidebar.querySelectorAll('.outline-item').forEach((b, i) => b.classList.toggle('current', v?.doc.outline[i]?.page === v?.current))
}
changed.addEventListener('change', refresh)

export function focusPageBox() { pageInput.focus() }
