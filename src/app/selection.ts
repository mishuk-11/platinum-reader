// Floating menu over selected text: 6 highlight colors, copy, web search, ask AI.
import { Copy, Search, Sparkles, Trash2, Puzzle } from 'lucide'
import { openUrl } from '@tauri-apps/plugin-opener'
import { activeViewer, state } from './app'
import { AI, SEARCH, settings, type Highlight } from './store'
import { h, icon, toast } from './ui'
import type { Viewer } from './viewer'
import { isOn, registry } from './extensions'

export const COLORS = [
  ['Yellow', '#ffd84d'], ['Green', '#7ee08a'], ['Blue', '#6cb8ff'],
  ['Pink', '#ff7eb6'], ['Orange', '#ffad5c'], ['Purple', '#b98cff'],
]

const bar = h('div', { class: 'selmenu', role: 'toolbar', 'aria-label': 'Selection' })
document.body.append(bar)

function hide() { bar.classList.remove('open') }

function place(x: number, top: number, bottom: number) {
  bar.classList.add('open')
  const r = bar.getBoundingClientRect()
  bar.style.left = Math.max(6, Math.min(x - r.width / 2, innerWidth - r.width - 6)) + 'px'
  bar.style.top = (top - r.height - 10 > 40 ? top - r.height - 10 : bottom + 10) + 'px'
}

const web = (base: string, text: string) => openUrl(base + encodeURIComponent(text.slice(0, 1500)))

function showFor(viewer: Viewer, range: Range) {
  const text = range.toString().trim()
  if (!text) return hide()
  const ai = AI[settings.ai] ?? AI.chatgpt
  const se = SEARCH[settings.search] ?? SEARCH.google
  bar.replaceChildren(
    ...COLORS.map(([name, c]) => h('button', {
      class: 'swatch', style: { background: c }, title: `Highlight ${name}`, 'aria-label': `Highlight ${name}`,
      onclick: () => { viewer.addHighlight(range, c); getSelection()?.removeAllRanges(); hide() },
    })),
    h('span', { class: 'sep' }),
    h('button', { class: 'tb-btn', title: 'Copy (Ctrl+C)', 'aria-label': 'Copy', onclick: () => { navigator.clipboard.writeText(text); toast('Copied'); hide() } }, icon(Copy, 16)),
    h('button', { class: 'tb-btn', title: `Search ${se[0]}`, 'aria-label': `Search ${se[0]}`, onclick: () => { web(se[1], text); hide() } }, icon(Search, 16)),
    h('button', { class: 'tb-btn ai', title: `Ask AI (${ai[0]})`, 'aria-label': 'Ask AI', onclick: () => { web(ai[1], text); hide() } }, icon(Sparkles, 16), h('span', {}, 'Ask AI')),
    ...registry.selection.filter((a) => isOn(a.ext)).map((a) => h('button', {
      class: 'tb-btn', title: a.label, 'aria-label': a.label,
      onclick: () => { hide(); try { a.run(text) } catch (err) { console.error('extension', a.ext, err) } },
    }, icon(a.icon ?? Puzzle, 16))),
  )
  const r = range.getBoundingClientRect()
  place(r.left + r.width / 2, r.top, r.bottom)
}

/** Clicking an existing highlight offers to remove it. */
export function showHighlightMenu(viewer: Viewer, hl: Highlight, e: MouseEvent) {
  bar.replaceChildren(
    h('span', { class: 'swatch static', style: { background: hl.color } }),
    h('button', { class: 'tb-btn', title: 'Copy text', 'aria-label': 'Copy text', onclick: () => { navigator.clipboard.writeText(hl.text); toast('Copied'); hide() } }, icon(Copy, 16)),
    h('button', { class: 'tb-btn danger', title: 'Remove highlight', 'aria-label': 'Remove highlight', onclick: () => { viewer.removeHighlight(hl); hide() } }, icon(Trash2, 16), h('span', {}, 'Remove')),
  )
  place(e.clientX, e.clientY - 8, e.clientY + 8)
}

document.addEventListener('mouseup', (e) => {
  if (bar.contains(e.target as Node)) return
  setTimeout(() => {
    const sel = getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount) return
    const node = sel.anchorNode?.parentElement
    if (!node?.closest('.text')) return hide()
    const viewer = [state.active?.viewer, state.split?.viewer].find((v) => v?.el.contains(node)) ?? activeViewer()
    if (viewer) showFor(viewer, sel.getRangeAt(0))
  })
})
document.addEventListener('mousedown', (e) => { if (!bar.contains(e.target as Node)) hide() })
document.addEventListener('scroll', hide, true)
addEventListener('keydown', (e) => { if (e.key === 'Escape') hide() })
