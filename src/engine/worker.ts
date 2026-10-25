// Rendering engine. Runs off the UI thread so heavy documents never freeze the app.
// MuPDF handles PDF, XPS, EPUB, MOBI, FB2, CBZ and HTML; djvu-rs handles DjVu.
import * as mupdf from 'mupdf'
import initDjvu, { WasmDocument } from 'djvu-rs'
import type { OpenResult, PageText, Link, OutlineItem, HighlightSpec } from './types'

type Doc =
  | { kind: 'mu'; doc: mupdf.Document }
  | { kind: 'djvu'; doc: WasmDocument }

const docs = new Map<number, Doc>()
let djvuReady: Promise<unknown> | undefined

function get(id: number) {
  const d = docs.get(id)
  if (!d) throw new Error('Document is closed')
  return d
}

type MuOutline = { title?: string; page?: number; uri?: string; down?: MuOutline[] }
function flatOutline(doc: mupdf.Document, items: MuOutline[] | null, depth = 0, out: OutlineItem[] = []) {
  for (const it of items ?? []) {
    let page = it.page ?? -1
    // E-books give a link instead of a page number.
    if (page < 0 && it.uri) try { page = doc.resolveLink(it.uri) } catch { /* dangling link */ }
    out.push({ title: it.title ?? '', page, depth })
    if (it.down) flatOutline(doc, it.down, depth + 1, out)
  }
  return out
}

function pdfOf(id: number) {
  const d = get(id)
  const pdf = d.kind === 'mu' ? d.doc.asPDF() : null
  if (!pdf) throw new Error('Only PDF files can be edited')
  return pdf
}

const hexToRgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]

const ops = {
  async open(id: number, bytes: ArrayBuffer, name: string): Promise<OpenResult> {
    if (/\.djvu?$/i.test(name)) {
      djvuReady ??= initDjvu()
      await djvuReady
      const doc = WasmDocument.from_bytes(new Uint8Array(bytes))
      docs.set(id, { kind: 'djvu', doc })
      const sizes: [number, number][] = []
      for (let i = 0; i < doc.page_count(); i++) {
        const p = doc.page(i)
        sizes.push([p.width_at(72), p.height_at(72)])
        p.free()
      }
      return { pages: sizes.length, sizes, outline: [], meta: {}, editable: false }
    }
    const doc = mupdf.Document.openDocument(bytes, name)
    // Reflowable books (EPUB, MOBI, FB2, HTML) get laid out as A5-like pages; no-op for fixed layouts.
    doc.layout(420, 595, 11)
    docs.set(id, { kind: 'mu', doc })
    const n = doc.countPages()
    const sizes: [number, number][] = []
    for (let i = 0; i < n; i++) {
      const page = doc.loadPage(i)
      const [x0, y0, x1, y1] = page.getBounds()
      sizes.push([x1 - x0, y1 - y0])
      page.destroy()
    }
    let outline: OutlineItem[] = []
    try { outline = flatOutline(doc, doc.loadOutline()) } catch { /* broken outline: show none */ }
    const meta: Record<string, string> = {}
    for (const k of ['Title', 'Author', 'Subject', 'Creator', 'Producer']) {
      const v = doc.getMetaData('info:' + k)
      if (v) meta[k] = v
    }
    const fmt = doc.getMetaData('format')
    if (fmt) meta.Format = fmt
    return { pages: n, sizes, outline, meta, editable: !!doc.asPDF() && /\.pdf$/i.test(name) }
  },

  async render(id: number, index: number, scale: number): Promise<ImageBitmap> {
    const d = get(id)
    if (d.kind === 'djvu') {
      const p = d.doc.page(index)
      const dpi = 72 * scale
      const w = p.width_at(dpi), h = p.height_at(dpi)
      const px = p.render(dpi)
      p.free()
      return createImageBitmap(new ImageData(new Uint8ClampedArray(px), w, h))
    }
    const page = d.doc.loadPage(index)
    const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, true, true)
    // getPixels() is a view into WASM memory, copy before the pixmap is freed.
    const img = new ImageData(new Uint8ClampedArray(pix.getPixels()), pix.getWidth(), pix.getHeight())
    pix.destroy()
    page.destroy()
    return createImageBitmap(img)
  },

  async text(id: number, index: number): Promise<PageText> {
    const d = get(id)
    const out: PageText = { lines: [], links: [] }
    if (d.kind === 'djvu') return out // shortcut: DjVu text layer not extracted, add via text_zones_json later
    const page = d.doc.loadPage(index)
    let line: PageText['lines'][number] | null = null
    page.toStructuredText('preserve-whitespace').walk({
      beginLine(bbox) {
        line = { x: bbox[0], y: bbox[1], w: bbox[2] - bbox[0], h: bbox[3] - bbox[1], text: '', boxes: [] }
      },
      onChar(c, _o, _f, _s, q) {
        if (!line) return
        line.text += c
        line.boxes.push(Math.min(q[0], q[4]), Math.min(q[1], q[3]), Math.max(q[2], q[6]), Math.max(q[5], q[7]))
      },
      endLine() {
        if (line && line.text.trim()) out.lines.push(line)
        line = null
      },
    })
    for (const l of page.getLinks()) {
      const [x0, y0, x1, y1] = l.getBounds()
      const link: Link = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
      if (l.isExternal()) link.uri = l.getURI()
      else try { link.page = d.doc.resolveLink(l) } catch { continue }
      out.links.push(link)
    }
    page.destroy()
    return out
  },

  /** Writes highlights into the PDF as real Highlight annotations (in memory until saved). */
  async addHighlights(id: number, items: HighlightSpec[]) {
    const pdf = pdfOf(id)
    for (const it of items) {
      const page = pdf.loadPage(it.page) as mupdf.PDFPage
      const a = page.createAnnotation('Highlight')
      a.setColor(hexToRgb(it.color))
      a.setQuadPoints(it.rects.map(([x, y, w, h]) => [x, y, x + w, y, x, y + h, x + w, y + h] as mupdf.Quad))
      a.update()
      page.update()
    }
    return items.length
  },

  /** Deletes stored Highlight annotations touching any of the rects on that page. Returns how many. */
  async removeHighlightsIn(id: number, pageIndex: number, rects: number[][]) {
    const page = pdfOf(id).loadPage(pageIndex) as mupdf.PDFPage
    let removed = 0
    for (const a of page.getAnnotations()) {
      if (a.getType() !== 'Highlight') continue
      const hit = a.getQuadPoints().some((q) => {
        const qx0 = Math.min(q[0], q[4]), qx1 = Math.max(q[2], q[6]), qy0 = Math.min(q[1], q[3]), qy1 = Math.max(q[5], q[7])
        return rects.some(([x, y, w, h]) => x < qx1 && x + w > qx0 && y < qy1 && y + h > qy0)
      })
      if (hit) { page.deleteAnnotation(a); removed++ }
    }
    if (removed) page.update()
    return removed
  },

  async save(id: number): Promise<ArrayBuffer> {
    const bytes = pdfOf(id).saveToBuffer('garbage=compact').asUint8Array()
    return bytes.slice().buffer
  },

  async close(id: number) {
    const d = docs.get(id)
    docs.delete(id)
    if (d?.kind === 'mu') d.doc.destroy()
    else d?.doc.free()
  },
}

self.onmessage = async (e: MessageEvent) => {
  const { id, op, args } = e.data
  try {
    const res = await (ops as any)[op](...args)
    self.postMessage({ id, res }, { transfer: res instanceof ImageBitmap || res instanceof ArrayBuffer ? [res] : [] })
  } catch (err: any) {
    postMessage({ id, err: String(err?.message ?? err) })
  }
}

// Module workers drop messages that arrive before top-level imports finish; tell the client we're live.
self.postMessage('ready')
