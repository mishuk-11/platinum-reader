import type { Doc } from '../engine/client'
import { h, toast } from './ui'

/** Renders every page to an image at ~150 dpi, then opens the system print dialog. */
export async function printDoc(doc: Doc) {
  // shortcut: renders all pages up front (memory grows with page count), add page ranges if 1000+ page prints matter
  const root = h('div', { id: 'print-root' })
  const urls: string[] = []
  const t = h('div', { class: 'toast', role: 'status' }, 'Preparing print…')
  document.body.append(t)
  try {
    for (let i = 0; i < doc.pages; i++) {
      t.textContent = `Preparing print… ${i + 1} / ${doc.pages}`
      const bmp = await doc.render(i, 150 / 72)
      const c = h('canvas', { width: bmp.width, height: bmp.height })
      c.getContext('2d')!.drawImage(bmp, 0, 0)
      bmp.close()
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.92))
      if (!blob) continue
      urls.push(URL.createObjectURL(blob))
      root.append(h('img', { src: urls.at(-1)!, alt: `Page ${i + 1}` }))
    }
    document.body.append(root)
    await Promise.all([...root.querySelectorAll('img')].map((img) => img.decode().catch(() => {})))
    t.remove()
    window.print()
  } catch (err: any) {
    toast('Print failed: ' + (err?.message ?? err))
  } finally {
    t.remove()
    root.remove()
    urls.forEach(URL.revokeObjectURL)
  }
}
