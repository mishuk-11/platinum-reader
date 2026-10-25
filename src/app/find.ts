// Find bar: match case, n / total, previous / next. Highlights are temporary.
import { ChevronUp, ChevronDown, X, CaseSensitive } from 'lucide'
import { activeViewer, changed } from './app'
import { findInPage } from './search'
import type { Viewer } from './viewer'
import { h, icon } from './ui'

const input = h('input', { class: 'find-input', type: 'search', placeholder: 'Find in document', 'aria-label': 'Find in document' })
const count = h('span', { class: 'find-count' })
const caseBtn = h('button', { class: 'tb-btn', title: 'Match case', 'aria-label': 'Match case', 'aria-pressed': 'false', onclick: () => toggleCase() }, icon(CaseSensitive))
export const findBar = h('div', { class: 'findbar', role: 'search' },
  input, count, caseBtn,
  h('button', { class: 'tb-btn', title: 'Previous (Shift+Enter)', 'aria-label': 'Previous match', onclick: () => step(-1) }, icon(ChevronUp)),
  h('button', { class: 'tb-btn', title: 'Next (Enter)', 'aria-label': 'Next match', onclick: () => step(1) }, icon(ChevronDown)),
  h('button', { class: 'tb-btn', title: 'Close (Esc)', 'aria-label': 'Close find', onclick: () => closeFind() }, icon(X)))

let matchCase = false
let viewer: Viewer | undefined
let hits: { page: number; index: number }[] = []
let byPage = new Map<number, number[][][]>()
let cur = -1
let run = 0
let timer = 0

export function openFind() {
  findBar.classList.add('open')
  const sel = getSelection()?.toString().trim()
  if (sel && sel.length < 80) input.value = sel
  input.focus()
  input.select()
  if (input.value) search()
}

export function closeFind() {
  findBar.classList.remove('open')
  run++
  viewer?.setFind(new Map(), null)
  hits = []
  byPage = new Map()
  count.textContent = ''
  viewer?.el.focus()
}

function toggleCase() {
  matchCase = !matchCase
  caseBtn.classList.toggle('on', matchCase)
  caseBtn.setAttribute('aria-pressed', String(matchCase))
  search()
}

/** Scans pages in the background, starting at the current page, updating the counter as it goes. */
async function search() {
  const my = ++run
  viewer?.setFind(new Map(), null)
  viewer = activeViewer()
  hits = []
  byPage = new Map()
  cur = -1
  const q = input.value
  if (!viewer || !q) { count.textContent = ''; return }
  const v = viewer
  const n = v.doc.pages
  for (let k = 0; k < n; k++) {
    const i = (v.current + k) % n
    let page
    try { page = await v.doc.text(i) } catch { continue }
    if (my !== run) return
    const m = findInPage(page, q, matchCase)
    if (m.length) byPage.set(i, m)
    if (k % 20 === 0 || k === n - 1) {
      hits = [...byPage.entries()].sort((a, b) => a[0] - b[0]).flatMap(([p, ms]) => ms.map((_, index) => ({ page: p, index })))
      if (cur < 0 && hits.length) cur = Math.max(0, hits.findIndex((x) => x.page >= v.current))
      show()
    }
  }
  count.textContent = hits.length ? `${cur + 1} / ${hits.length}` : 'No results'
}

function show() {
  count.textContent = hits.length ? `${cur + 1} / ${hits.length}…` : 'Searching…'
  viewer?.setFind(byPage, hits[cur] ?? null)
}

function step(d: number) {
  if (!hits.length) return search()
  cur = (cur + d + hits.length) % hits.length
  viewer?.setFind(byPage, hits[cur])
  count.textContent = `${cur + 1} / ${hits.length}`
}

input.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(search, 250) })
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1) }
  else if (e.key === 'Escape') closeFind()
})
// Switching tab or pane ends the search on the old document.
changed.addEventListener('change', () => { if (viewer && viewer !== activeViewer() && findBar.classList.contains('open')) search() })
