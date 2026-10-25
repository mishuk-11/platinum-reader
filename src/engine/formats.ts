// Converters that turn the formats MuPDF can't read into ones it can.
import { invoke } from '@tauri-apps/api/core'
import { zipSync } from 'fflate'
import { marked } from 'marked'
import { ArchiveReader, libarchiveWasm } from 'libarchive-wasm'
import archiveWasm from 'libarchive-wasm/dist/libarchive.wasm?url'

const IMG = /\.(jpe?g|png|gif|webp|bmp)$/i

/** CBR (RAR 4/5, via libarchive) → CBZ (ZIP, stored) so MuPDF opens it as a comic. */
export async function cbrToCbz(data: ArrayBuffer): Promise<ArrayBuffer> {
  const mod = await libarchiveWasm({ locateFile: () => archiveWasm })
  const reader = new ArchiveReader(mod, new Int8Array(data))
  const files: Record<string, [Uint8Array, { level: 0 }]> = {}
  try {
    for (const entry of reader.entries()) {
      const name = entry.getPathname()
      if (!IMG.test(name)) continue
      const bytes = entry.readData()
      if (bytes) files[name] = [new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)), { level: 0 }]
    }
  } finally {
    reader.free()
  }
  if (!Object.keys(files).length) throw new Error('No images found in this CBR')
  return zipSync(files).buffer as ArrayBuffer
}

const BOOK_CSS = `body{font-family:serif;line-height:1.5;margin:0}
h1,h2,h3{font-family:sans-serif;line-height:1.2}
pre,code{font-family:monospace;font-size:.9em;background:#f3f3f3}
pre{padding:6px;white-space:pre-wrap}
blockquote{border-left:3px solid #ccc;margin-left:0;padding-left:10px;color:#555}
table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:2px 6px}
img{max-width:100%}`

const html = (body: string) =>
  new TextEncoder().encode(`<!doctype html><html><head><meta charset="utf-8"><style>${BOOK_CSS}</style></head><body>${body}</body></html>`).buffer

/** Markdown → HTML book (MuPDF paginates it). Never inserted into the app DOM. */
export async function markdownToHtml(data: ArrayBuffer) {
  return html(await marked.parse(new TextDecoder().decode(data)))
}

function decode(b: ArrayBuffer) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b) } catch { return new TextDecoder('windows-1252').decode(b) }
}

/** CHM → one HTML book: pages in table-of-contents order, images inlined. */
export async function chmToHtml(path: string) {
  const [dir, files] = await invoke<[string, string[]]>('extract_chm', { path })
  const read = (rel: string) => invoke<ArrayBuffer>('read_file', { path: `${dir}/${rel}` })
  const lower = new Map(files.map((f) => [f.toLowerCase(), f]))
  const resolve = (base: string, ref: string) => {
    const parts = (base.split('/').slice(0, -1).join('/') + '/' + ref.split('#')[0]).split('/')
    const out: string[] = []
    for (const p of parts) p === '..' ? out.pop() : p && p !== '.' && out.push(p)
    return lower.get(decodeURIComponent(out.join('/')).toLowerCase())
  }

  let order: string[] = []
  const hhc = files.find((f) => f.toLowerCase().endsWith('.hhc'))
  if (hhc) {
    const toc = new DOMParser().parseFromString(decode(await read(hhc)), 'text/html')
    for (const p of toc.querySelectorAll('param[name="Local" i]')) {
      const f = resolve(hhc, p.getAttribute('value') ?? '')
      if (f && !order.includes(f)) order.push(f)
    }
  }
  if (!order.length) order = files.filter((f) => /\.html?$/i.test(f)).sort()

  const parts: string[] = []
  for (const file of order) {
    const doc = new DOMParser().parseFromString(decode(await read(file)), 'text/html')
    doc.querySelectorAll('script,style,link,iframe,object').forEach((n) => n.remove())
    for (const img of doc.querySelectorAll('img')) {
      const f = resolve(file, img.getAttribute('src') ?? '')
      if (!f || !IMG.test(f)) { img.remove(); continue }
      const b64 = btoa(Array.from(new Uint8Array(await read(f)), (c) => String.fromCharCode(c)).join(''))
      img.setAttribute('src', `data:image/${f.split('.').pop()!.toLowerCase().replace('jpg', 'jpeg')};base64,${b64}`)
    }
    parts.push(`<div style="page-break-before:always">${doc.body?.innerHTML ?? ''}</div>`)
  }
  return html(parts.join('\n'))
}
