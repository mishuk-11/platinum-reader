// Tabs, panes (split view), windows and the home screen.
import { open as openPicker } from '@tauri-apps/plugin-dialog'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { FileText, X, Plus, Columns2, AppWindow, Copy, FolderOpen, CopyPlus, XCircle, Minus, Square, Clock, BookOpen } from 'lucide'
import { Doc, SUPPORTED } from '../engine/client'
import { Viewer } from './viewer'
import { runOpenHooks } from './extensions'
import { history, session, settings, onSettings } from './store'
import { h, icon, menu, toast } from './ui'

export interface Tab { id: number; path: string; title: string; viewer?: Viewer; btn: HTMLElement; error?: boolean }

export const state = {
  tabs: [] as Tab[],
  active: null as Tab | null,
  split: null as Tab | null,
  focus: 'left' as 'left' | 'right',
}
export const changed = new EventTarget()
const emit = () => changed.dispatchEvent(new Event('change'))
const isMain = getCurrentWebviewWindow().label === 'main'

export const focusedTab = () => (state.focus === 'right' && state.split ? state.split : state.active)
export const activeViewer = () => focusedTab()?.viewer

const basename = (p: string) => p.split(/[\\/]/).pop() ?? p

// ---------- DOM ----------
export const tabList = h('div', { class: 'tab-list', role: 'tablist' })
const winControls = h('div', { class: 'win-controls' },
  h('button', { class: 'win-btn', title: 'Minimize', 'aria-label': 'Minimize', onclick: () => getCurrentWindow().minimize() }, icon(Minus, 15)),
  h('button', { class: 'win-btn', title: 'Maximize', 'aria-label': 'Maximize', onclick: () => getCurrentWindow().toggleMaximize() }, icon(Square, 13)),
  h('button', { class: 'win-btn close', title: 'Close', 'aria-label': 'Close', onclick: () => getCurrentWindow().close() }, icon(X, 16)))
export const tabbar = h('div', { class: 'tabbar' },
  h('div', { class: 'brand', 'data-tauri-drag-region': true }, h('span', { class: 'logo' }), 'Quire'),
  tabList,
  h('button', { class: 'tab-new', title: 'Open file (Ctrl+O)', 'aria-label': 'Open file', onclick: () => openDialog() }, icon(Plus, 16)),
  h('div', { class: 'drag', 'data-tauri-drag-region': true }))
export const sidebar = h('aside', { class: 'sidebar' })
const left = h('section', { class: 'pane left', onpointerdown: () => setFocus('left') })
const right = h('section', { class: 'pane right', onpointerdown: () => setFocus('right') })
const divider = h('div', { class: 'divider', role: 'separator' })
export const workspace = h('main', { class: 'workspace' }, sidebar, left, divider, right)

/** Window controls live in whichever bar is on top (tab bar, or toolbar when tabs are on the left). */
export function placeWindowControls(toolbar: HTMLElement) {
  ;(settings.tabs === 'left' ? toolbar : tabbar).append(winControls)
}

divider.addEventListener('pointerdown', (e) => {
  divider.setPointerCapture(e.pointerId)
  const move = (ev: PointerEvent) => {
    const r = workspace.getBoundingClientRect()
    const x = ev.clientX - r.left - (sidebar.offsetWidth || 0)
    left.style.flex = `0 0 ${Math.max(200, Math.min(r.width - 200, x))}px`
  }
  divider.addEventListener('pointermove', move)
  divider.addEventListener('pointerup', () => divider.removeEventListener('pointermove', move), { once: true })
})

// ---------- tabs ----------
export async function openFile(path: string, opts: { page?: number; zoom?: number; forceNew?: boolean; split?: boolean } = {}) {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (!SUPPORTED.includes(ext)) return toast(`Unsupported file: ${basename(path)}`)
  const existing = !opts.forceNew && state.tabs.find((t) => t.path === path)
  if (existing) return opts.split ? setSplit(existing) : activate(existing)

  const tab: Tab = { id: Date.now() + Math.random(), path, title: basename(path), btn: h('div') }
  tab.btn = tabButton(tab)
  state.tabs.push(tab)
  tabList.append(tab.btn)
  if (opts.split) setSplit(tab)
  else activate(tab)

  try {
    const doc = await Doc.open(path)
    const recent = history.get(path)
    const viewer = new Viewer(doc, { page: opts.page ?? recent?.page, zoom: opts.zoom })
    if (!state.tabs.includes(tab)) return viewer.destroy() // closed while loading
    tab.viewer = viewer
    tab.title = doc.meta.Title?.trim() || basename(path)
    let saveTimer = 0
    viewer.onChange = () => {
      if (focusedTab() === tab) emit()
      clearTimeout(saveTimer)
      saveTimer = window.setTimeout(() => history.put({ path, title: tab.title, page: viewer.current, zoom: viewer.zoom, time: Date.now(), pages: doc.pages }), 600)
    }
    viewer.el.addEventListener('focusin', () => setFocus(state.split === tab ? 'right' : 'left'))
    history.put({ path, title: tab.title, page: recent?.page ?? 0, zoom: viewer.zoom, time: Date.now(), pages: doc.pages })
    tab.btn.replaceWith((tab.btn = tabButton(tab)))
    runOpenHooks(viewer, { path, pages: doc.pages, title: tab.title })
    render()
  } catch (err: any) {
    tab.error = true
    toast(`Could not open ${basename(path)}: ${err?.message ?? err}`, 5000)
    closeTab(tab)
  }
}

function tabButton(tab: Tab) {
  const b = h('div', {
    class: 'tab', role: 'tab', title: tab.path, draggable: 'true',
    onclick: () => activate(tab),
    onauxclick: (e: MouseEvent) => e.button === 1 && closeTab(tab),
    oncontextmenu: (e: MouseEvent) => { e.preventDefault(); tabMenu(tab, e.clientX, e.clientY) },
  },
  tab.viewer ? icon(FileText, 14) : h('span', { class: 'spinner' }),
  h('span', { class: 'tab-title' }, tab.title),
  h('button', { class: 'tab-close', title: 'Close (Ctrl+W)', 'aria-label': 'Close tab', onclick: (e: Event) => { e.stopPropagation(); closeTab(tab) } }, icon(X, 13)))
  // Drag to reorder.
  b.addEventListener('dragstart', (e) => e.dataTransfer!.setData('quire/tab', String(tab.id)))
  b.addEventListener('dragover', (e) => e.preventDefault())
  b.addEventListener('drop', (e) => {
    const from = state.tabs.find((t) => String(t.id) === e.dataTransfer!.getData('quire/tab'))
    if (!from || from === tab) return
    state.tabs.splice(state.tabs.indexOf(from), 1)
    state.tabs.splice(state.tabs.indexOf(tab), 0, from)
    tabList.replaceChildren(...state.tabs.map((t) => t.btn))
  })
  return b
}

function tabMenu(tab: Tab, x: number, y: number) {
  menu([
    { label: 'Open in new window', icon: AppWindow, action: () => moveToWindow(tab) },
    state.split === tab
      ? { label: 'Close split view', icon: Columns2, action: () => setSplit(null) }
      : { label: 'Split view (side by side)', icon: Columns2, action: () => setSplit(tab) },
    { label: 'Duplicate tab', icon: CopyPlus, action: () => openFile(tab.path, { forceNew: true, page: tab.viewer?.current }) },
    '-',
    { label: 'Copy path', icon: Copy, action: () => navigator.clipboard.writeText(tab.path) },
    { label: 'Show in folder', icon: FolderOpen, action: () => revealItemInDir(tab.path) },
    '-',
    { label: 'Close other tabs', icon: XCircle, disabled: state.tabs.length < 2, action: () => state.tabs.filter((t) => t !== tab).forEach(closeTab) },
    { label: 'Close', icon: X, kbd: 'Ctrl+W', action: () => closeTab(tab) },
  ], x, y)
}

export function activate(tab: Tab | null) {
  if (tab && tab === state.split) state.split = null
  state.active = tab
  state.focus = 'left'
  render()
}

export function setSplit(tab: Tab | null) {
  if (tab && tab === state.active) {
    // The right-clicked tab is the one on screen: put the previous tab on the left.
    const other = state.tabs.filter((t) => t !== tab).at(-1)
    if (!other) { openDialog(true); return }
    state.active = other
  }
  state.split = tab
  state.focus = tab ? 'right' : 'left'
  render()
}

function setFocus(f: 'left' | 'right') {
  if (state.focus === f) return
  state.focus = f
  render()
}

export function closeTab(tab: Tab) {
  const i = state.tabs.indexOf(tab)
  if (i < 0) return
  state.tabs.splice(i, 1)
  tab.btn.remove()
  tab.viewer?.destroy()
  if (state.split === tab) state.split = null
  if (state.active === tab) state.active = state.tabs[Math.min(i, state.tabs.length - 1)] ?? null
  if (state.active && state.active === state.split) state.split = null
  render()
}

export function cycleTab(dir: number) {
  if (!state.tabs.length) return
  const i = state.active ? state.tabs.indexOf(state.active) : 0
  activate(state.tabs[(i + dir + state.tabs.length) % state.tabs.length])
}

function moveToWindow(tab: Tab) {
  const page = tab.viewer?.current ?? 0
  const label = 'w' + Date.now()
  const win = new WebviewWindow(label, {
    url: `index.html?open=${encodeURIComponent(tab.path)}&page=${page}`,
    title: `${tab.title} — Quire`, width: 1000, height: 760, decorations: false, minWidth: 520, minHeight: 380,
  })
  win.once('tauri://error', (e) => toast('Could not open window: ' + JSON.stringify(e.payload)))
  closeTab(tab)
}

export async function openDialog(split = false) {
  const picked = await openPicker({ multiple: true, filters: [{ name: 'Documents', extensions: SUPPORTED }, { name: 'All files', extensions: ['*'] }] })
  for (const p of picked ?? []) openFile(p, { split })
}

// ---------- render ----------
export function render() {
  for (const t of state.tabs) {
    t.btn.classList.toggle('active', t === state.active)
    t.btn.classList.toggle('split', t === state.split)
    t.btn.setAttribute('aria-selected', String(t === state.active))
  }
  state.active?.btn.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  const mount = (pane: HTMLElement, tab: Tab | null) => {
    const content = tab ? tab.viewer?.el ?? h('div', { class: 'loading' }, h('span', { class: 'spinner big' }), 'Opening…') : home()
    if (pane.firstChild !== content) pane.replaceChildren(content)
  }
  mount(left, state.active)
  workspace.classList.toggle('is-split', !!state.split)
  if (state.split) mount(right, state.split)
  else right.replaceChildren()
  left.classList.toggle('focused', !!state.split && state.focus === 'left')
  right.classList.toggle('focused', !!state.split && state.focus === 'right')
  document.title = (focusedTab()?.title ? focusedTab()!.title + ' — ' : '') + 'Quire'
  if (isMain) session.set(state.tabs.map((t) => t.path))
  emit()
}

// ---------- home ----------
function ago(t: number) {
  const s = (Date.now() - t) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + ' min ago'
  if (s < 86400) return Math.floor(s / 3600) + ' h ago'
  return Math.floor(s / 86400) + ' d ago'
}

export function recentList(onPick?: () => void) {
  const list = history.list()
  if (!list.length) return h('p', { class: 'muted' }, 'No recent documents yet.')
  const ul = h('ul', { class: 'recent' })
  for (const r of list) {
    const li = h('li', {},
      h('button', { class: 'recent-item', title: r.path, onclick: () => { onPick?.(); openFile(r.path) } },
        icon(BookOpen, 18),
        h('span', { class: 'recent-text' }, h('b', {}, r.title), h('small', {}, r.path)),
        h('span', { class: 'recent-meta' }, `p. ${r.page + 1}${r.pages ? ' / ' + r.pages : ''}`, h('small', {}, ago(r.time)))),
      h('button', { class: 'tb-btn recent-x', title: 'Remove from history', 'aria-label': 'Remove from history', onclick: () => { history.remove(r.path); li.remove() } }, icon(X, 14)))
    ul.append(li)
  }
  return ul
}

function home() {
  return h('div', { class: 'home' },
    h('div', { class: 'home-card' },
      h('div', { class: 'home-hero' }, h('span', { class: 'logo big' }),
        h('div', {}, h('h1', {}, 'Quire'), h('p', { class: 'muted' }, 'PDF · EPUB · MOBI · CBZ/CBR · DjVu · XPS · Markdown · CHM'))),
      h('button', { class: 'btn primary', onclick: () => openDialog() }, icon(FolderOpen, 17), 'Open document', h('kbd', {}, 'Ctrl+O')),
      h('p', { class: 'muted drop-hint' }, 'or drop files anywhere'),
      h('h3', {}, icon(Clock, 15), 'Recent'),
      recentList()))
}

onSettings(() => render())
