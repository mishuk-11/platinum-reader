// Virtualized page view: only pages near the viewport hold a canvas and a text layer.
import type { Doc } from '../engine/client'
import type { PageText } from '../engine/types'
import { highlights, settings, type Highlight, type ViewMode } from './store'
import { h } from './ui'
import { openUrl } from '@tauri-apps/plugin-opener'

const PT = 96 / 72 // CSS px per PDF point at 100%
// Pixel cap per page canvas keeps memory sane at huge zoom (Developer options → Render quality).
const MAX_PIXELS: Record<string, number> = { low: 6e6, normal: 16e6, high: 36e6 }
/** Render timings, shown by the developer performance overlay. */
export const stats = { renders: 0, lastMs: 0, totalMs: 0, queued: 0 }
const measure = document.createElement('canvas').getContext('2d')!

interface PageEl extends HTMLDivElement { _scale?: number; _layer?: HTMLDivElement }

export class Viewer {
  el = h('div', { class: 'viewer', tabindex: '0' })
  pagesEl = h('div', { class: 'pages' })
  pageEls: PageEl[] = []
  zoom = 1
  fit: 'width' | 'page' | null = 'width'
  mode: ViewMode
  current = 0
  hl: Highlight[]
  findHits = new Map<number, number[][][]>()
  findCurrent: { page: number; index: number } | null = null
  onChange = () => {}
  private visible = new Set<number>()
  private queue = new Set<number>()
  private running = 0
  private io: IntersectionObserver
  private ro: ResizeObserver
  private wheelLock = 0

  constructor(public doc: Doc, opts: { page?: number; zoom?: number; mode?: ViewMode } = {}) {
    this.mode = opts.mode ?? settings.viewMode
    this.hl = highlights.get(doc.path)
    if (opts.zoom) { this.zoom = opts.zoom; this.fit = null }
    else if (settings.zoom === 'page') this.fit = 'page'
    else if (settings.zoom !== 'width') { this.zoom = +settings.zoom / 100 || 1; this.fit = null }

    this.el.append(this.pagesEl)
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const i = +(e.target as HTMLElement).dataset.i!
        if (e.isIntersecting) this.visible.add(i)
        else { this.visible.delete(i); this.release(i) }
      }
      this.schedule()
    }, { root: this.el, rootMargin: '150% 0px' })

    doc.sizes.forEach(([w, ht], i) => {
      const p = h('div', { class: 'page', 'data-i': i }) as PageEl
      p.style.setProperty('--w', String(w))
      p.style.setProperty('--h', String(ht))
      this.pageEls.push(p)
      this.pagesEl.append(p)
      this.io.observe(p)
    })

    this.ro = new ResizeObserver(() => { if (this.fit) this.setZoom(this.fit) })
    this.ro.observe(this.el)
    this.el.addEventListener('scroll', () => requestAnimationFrame(() => this.trackPage()), { passive: true })
    this.el.addEventListener('wheel', (e) => this.onWheel(e), { passive: false })
    this.el.addEventListener('click', (e) => this.onClick(e))
    this.setMode(this.mode)
    requestAnimationFrame(() => {
      this.setZoom(this.fit ?? this.zoom)
      if (opts.page) this.goTo(opts.page)
    })
  }

  // ---------- zoom & layout ----------
  private get k() { return this.zoom * PT }

  setZoom(z: number | 'width' | 'page') {
    const el = this.el
    const cx = (el.scrollLeft + el.clientWidth / 2) / (el.scrollWidth || 1)
    const cy = (el.scrollTop + el.clientHeight / 2) / (el.scrollHeight || 1)
    const pad = 48
    const cols = this.mode === 'facing' ? 2 : 1
    const [pw, ph] = this.doc.sizes[this.current] ?? [612, 792]
    const maxW = Math.max(...this.doc.sizes.slice(0, 200).map((s) => s[0]))
    const byWidth = (el.clientWidth - pad - (cols - 1) * settings.pageGap) / (cols * maxW * PT)
    if (z === 'width') { this.fit = 'width'; z = byWidth }
    else if (z === 'page') { this.fit = 'page'; z = Math.min(byWidth, (el.clientHeight - pad) / (ph * PT), (el.clientWidth - pad) / (cols * pw * PT)) }
    else this.fit = null
    this.zoom = Math.min(8, Math.max(0.1, z))
    this.pagesEl.style.setProperty('--k', String(this.k))
    // Keep the point at the viewport center fixed; the top of the document stays at the top.
    if (el.scrollLeft) el.scrollLeft = cx * el.scrollWidth - el.clientWidth / 2
    if (el.scrollTop && this.mode !== 'single') el.scrollTop = cy * el.scrollHeight - el.clientHeight / 2
    this.schedule()
    this.onChange()
  }

  zoomBy(f: number) { this.setZoom(Math.round(this.zoom * f * 100) / 100) }

  setMode(mode: ViewMode) {
    const page = this.current
    this.mode = mode
    this.pagesEl.dataset.mode = mode
    this.pageEls.forEach((p, i) => p.classList.toggle('current', i === page))
    if (this.fit) this.setZoom(this.fit)
    requestAnimationFrame(() => this.goTo(page))
    this.onChange()
  }

  goTo(i: number, yPt = 0) {
    i = Math.max(0, Math.min(this.doc.pages - 1, i))
    if (this.mode === 'single') {
      this.pageEls[this.current]?.classList.remove('current')
      this.pageEls[i].classList.add('current')
      this.current = i
      this.el.scrollTop = yPt ? yPt * this.k - 40 : 0
      this.onChange()
    } else {
      this.el.scrollTop = this.pageEls[i].offsetTop - settings.pageGap + yPt * this.k
    }
    if (this.mode !== 'single') { this.current = i; this.onChange() }
  }

  next() { this.goTo(this.current + (this.mode === 'facing' ? 2 : 1)) }
  prev() { this.goTo(this.current - (this.mode === 'facing' ? 2 : 1)) }

  private trackPage() {
    if (this.mode === 'single') return this.schedule()
    const y = this.el.scrollTop + this.el.clientHeight * 0.35
    let lo = 0, hi = this.pageEls.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.pageEls[mid].offsetTop <= y) lo = mid
      else hi = mid - 1
    }
    if (lo !== this.current) { this.current = lo; this.onChange() }
  }

  private onWheel(e: WheelEvent) {
    if (e.ctrlKey) {
      e.preventDefault()
      this.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1)
      return
    }
    // Single page mode: scrolling past the edge flips the page.
    if (this.mode !== 'single' || Date.now() < this.wheelLock) return
    const el = this.el
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2
    if (e.deltaY > 0 && atBottom) { this.next(); this.wheelLock = Date.now() + 350 }
    else if (e.deltaY < 0 && el.scrollTop <= 0 && this.current > 0) {
      this.goTo(this.current - 1)
      el.scrollTop = el.scrollHeight
      this.wheelLock = Date.now() + 350
    }
  }

  // ---------- rendering ----------
  private schedule() {
    for (const i of this.visible) {
      const p = this.pageEls[i]
      if (p.offsetParent && p._scale !== this.renderScale(i)) this.queue.add(i)
    }
    this.pump()
  }

  private renderScale(i: number) {
    const [w, ht] = this.doc.sizes[i]
    let s = this.k * devicePixelRatio
    const max = MAX_PIXELS[settings.renderQuality] ?? MAX_PIXELS.normal
    if (w * ht * s * s > max) s = Math.sqrt(max / (w * ht))
    return Math.round(s * 1000) / 1000
  }

  private pump() {
    stats.queued = this.queue.size
    while (this.running < +settings.renderThreads && this.queue.size) {
      // Nearest page to the current one first.
      const i = [...this.queue].sort((a, b) => Math.abs(a - this.current) - Math.abs(b - this.current))[0]
      this.queue.delete(i)
      if (!this.visible.has(i)) continue
      const scale = this.renderScale(i)
      this.running++
      const t0 = performance.now()
      this.doc.render(i, scale).then((bmp) => {
        stats.renders++
        stats.lastMs = performance.now() - t0
        stats.totalMs += stats.lastMs
        const p = this.pageEls[i]
        if (!this.visible.has(i)) return bmp.close()
        const c = h('canvas', { width: bmp.width, height: bmp.height })
        c.getContext('2d')!.drawImage(bmp, 0, 0)
        bmp.close()
        p.querySelector('canvas')?.remove()
        p.prepend(c)
        p._scale = scale
        if (!p._layer) this.buildLayer(i)
      }).catch((err) => console.error('render', i, err)).finally(() => { this.running--; this.pump() })
    }
  }

  private release(i: number) {
    const p = this.pageEls[i]
    p.querySelector('canvas')?.remove()
    p._layer?.remove()
    p._layer = undefined
    p._scale = undefined
  }

  /** Text, links, highlights and find marks, all in page points (scaled by CSS). */
  private async buildLayer(i: number) {
    const p = this.pageEls[i]
    const layer = h('div', { class: 'layer' })
    p._layer = layer
    p.append(layer)
    let t: PageText
    try { t = await this.doc.text(i) } catch { return }
    if (p._layer !== layer) return
    const text = h('div', { class: 'text' })
    for (const l of t.lines) {
      measure.font = `${l.h}px sans-serif`
      const span = h('span', { style: { left: l.x + 'px', top: l.y + 'px', fontSize: l.h + 'px' } }, l.text)
      const mw = measure.measureText(l.text).width
      if (mw > 0) span.style.transform = `scaleX(${l.w / mw})`
      text.append(span, h('br'))
    }
    const links = h('div', { class: 'links' })
    for (const ln of t.links) {
      links.append(h('a', {
        style: { left: ln.x + 'px', top: ln.y + 'px', width: ln.w + 'px', height: ln.h + 'px' },
        title: ln.uri ?? `Page ${(ln.page ?? 0) + 1}`,
        onclick: (e: Event) => { e.preventDefault(); ln.uri ? openUrl(ln.uri) : this.goTo(ln.page!) },
      }))
    }
    layer.append(h('div', { class: 'hl' }), h('div', { class: 'find' }), text, links)
    this.drawHighlights(i)
    this.drawFind(i)
  }

  // ---------- highlights ----------
  drawHighlights(i: number) {
    const box = this.pageEls[i]._layer?.querySelector('.hl')
    if (!box) return
    box.replaceChildren(...this.hl.filter((x) => x.page === i).flatMap((x) =>
      x.rects.map(([l, t, w, ht]) => h('div', { style: { left: l + 'px', top: t + 'px', width: w + 'px', height: ht + 'px', background: x.color } }))))
  }

  /** Page-space rects (points) covered by a text selection, grouped by page. */
  rectsOf(range: Range) {
    const byPage = new Map<number, Map<string, number[]>>()
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2
      for (const i of this.visible) {
        const pr = this.pageEls[i].getBoundingClientRect()
        if (cx < pr.left || cx > pr.right || cy < pr.top || cy > pr.bottom) continue
        const rect = [(r.left - pr.left) / this.k, (r.top - pr.top) / this.k, r.width / this.k, r.height / this.k]
        if (!byPage.has(i)) byPage.set(i, new Map())
        byPage.get(i)!.set(rect.map(Math.round).join(), rect) // drop duplicate span/text rects
        break
      }
    }
    return new Map([...byPage].map(([p, m]) => [p, [...m.values()]]))
  }

  /** Turns the current text selection into a highlight (kept by the app until the PDF is saved). */
  addHighlight(range: Range, color: string) {
    for (const [page, rects] of this.rectsOf(range)) {
      this.hl.push({ page, rects, color, text: range.toString() })
      this.drawHighlights(page)
    }
    highlights.set(this.doc.path, this.hl)
    this.onEdit()
  }

  /** Removes every highlight under the selection, including ones already saved inside the PDF. */
  async unhighlight(range: Range) {
    const hits = (a: number[], b: number[]) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1]
    let removed = 0
    for (const [page, rects] of this.rectsOf(range)) {
      const before = this.hl.length
      this.hl = this.hl.filter((x) => x.page !== page || !x.rects.some((r) => rects.some((s) => hits(r, s))))
      removed += before - this.hl.length
      this.drawHighlights(page)
      if (this.doc.editable && (await this.doc.removeHighlightsIn(page, rects))) {
        removed++
        this.rerender(page)
      }
    }
    highlights.set(this.doc.path, this.hl)
    if (removed) this.onEdit()
    return removed
  }

  /** Redraws page images (after the PDF itself changed). */
  rerender(page?: number) {
    for (const p of page == null ? this.pageEls : [this.pageEls[page]]) p._scale = undefined
    this.schedule()
  }

  /** Set by the app: highlights changed, so the document has unsaved changes. */
  onEdit = () => {}

  highlightAt(e: MouseEvent): Highlight | undefined {
    const p = (e.target as HTMLElement).closest('.page') as PageEl | null
    if (!p) return
    const pr = p.getBoundingClientRect()
    const x = (e.clientX - pr.left) / this.k, y = (e.clientY - pr.top) / this.k
    const i = +p.dataset.i!
    return this.hl.find((hl) => hl.page === i && hl.rects.some(([l, t, w, ht]) => x >= l && x <= l + w && y >= t && y <= t + ht))
  }

  removeHighlight(hl: Highlight) {
    this.hl = this.hl.filter((x) => x !== hl)
    highlights.set(this.doc.path, this.hl)
    this.drawHighlights(hl.page)
    this.onEdit()
  }

  /** Set by the app: what clicking a saved highlight does. */
  static onHighlightClick: (v: Viewer, hl: Highlight, e: MouseEvent) => void = () => {}
  private onClick(e: MouseEvent) {
    if (!getSelection()?.isCollapsed) return
    const hl = this.highlightAt(e)
    if (hl) Viewer.onHighlightClick(this, hl, e)
  }

  // ---------- find ----------
  drawFind(i: number) {
    const box = this.pageEls[i]._layer?.querySelector('.find')
    if (!box) return
    const hits = this.findHits.get(i) ?? []
    box.replaceChildren(...hits.flatMap((rects, n) => rects.map(([l, t, w, ht]) => h('div', {
      class: this.findCurrent?.page === i && this.findCurrent.index === n ? 'cur' : '',
      style: { left: l + 'px', top: t + 'px', width: w + 'px', height: ht + 'px' },
    }))))
  }

  setFind(hits: Map<number, number[][][]>, cur: { page: number; index: number } | null) {
    const pages = new Set([...this.findHits.keys(), ...hits.keys()])
    this.findHits = hits
    this.findCurrent = cur
    pages.forEach((i) => this.drawFind(i))
    if (cur) {
      const r = hits.get(cur.page)?.[cur.index]?.[0]
      if (this.mode === 'single') this.goTo(cur.page)
      const p = this.pageEls[cur.page]
      const top = (this.mode === 'single' ? 0 : p.offsetTop) + (r ? r[1] * this.k : 0)
      const left = p.offsetLeft + (r ? r[0] * this.k : 0)
      this.el.scrollTo({ top: top - this.el.clientHeight / 3, left: left - this.el.clientWidth / 3 })
    }
  }

  destroy() {
    this.io.disconnect()
    this.ro.disconnect()
    this.el.remove()
    this.doc.close()
  }
}
