import { invoke } from '@tauri-apps/api/core'
import type { OpenResult, PageText } from './types'

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()
let seq = 0

let markReady: () => void
const ready = new Promise<void>((r) => (markReady = r))

worker.onmessage = (e) => {
  if (e.data === 'ready') return markReady()
  const { id, res, err } = e.data
  const p = pending.get(id)
  pending.delete(id)
  if (err) p?.reject(new Error(err))
  else p?.resolve(res)
}

function call<T>(op: string, args: unknown[], transfer: Transferable[] = []): Promise<T> {
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ready.then(() => worker.postMessage({ id, op, args }, transfer))
  })
}

export const SUPPORTED = ['pdf', 'epub', 'mobi', 'azw', 'azw3', 'fb2', 'cbz', 'cbr', 'djvu', 'djv', 'xps', 'oxps', 'md', 'markdown', 'chm']

export class Doc implements OpenResult {
  pages = 0
  sizes: [number, number][] = []
  outline: OpenResult['outline'] = []
  meta: Record<string, string> = {}
  private texts = new Map<number, Promise<PageText>>()
  private constructor(public id: number, public path: string) {}

  static async open(path: string): Promise<Doc> {
    const doc = new Doc(++seq, path)
    const ext = path.split('.').pop()!.toLowerCase()
    let bytes: ArrayBuffer = await invoke('read_file', { path })
    let name = 'file.' + ext
    if (ext === 'cbr') {
      bytes = await (await import('./formats')).cbrToCbz(bytes)
      name = 'file.cbz'
    } else if (ext === 'md' || ext === 'markdown') {
      bytes = await (await import('./formats')).markdownToHtml(bytes)
      name = 'file.html'
    } else if (ext === 'chm') {
      bytes = await (await import('./formats')).chmToHtml(path)
      name = 'file.html'
    } else if (ext === 'azw' || ext === 'azw3') {
      name = 'file.mobi'
    }
    Object.assign(doc, await call<OpenResult>('open', [doc.id, bytes, name], [bytes]))
    return doc
  }

  /** Opens in-memory bytes; `name` only tells the engine the format (e.g. "x.html"). */
  static async fromBytes(bytes: ArrayBuffer, name: string): Promise<Doc> {
    const doc = new Doc(++seq, name)
    Object.assign(doc, await call<OpenResult>('open', [doc.id, bytes, name], [bytes]))
    return doc
  }

  render(index: number, scale: number) {
    return call<ImageBitmap>('render', [this.id, index, scale])
  }

  text(index: number) {
    let t = this.texts.get(index)
    if (!t) this.texts.set(index, (t = call<PageText>('text', [this.id, index])))
    return t
  }

  close() {
    this.texts.clear()
    return call('close', [this.id])
  }
}
