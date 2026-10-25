// Press and hold (3 s, without moving) on a file to peek at its first page.
import { Doc } from '../engine/client'
import { settings } from './store'
import { h } from './ui'

export const HOLD_MS = 3000
const MOVE_TOLERANCE = 6 // px; more than this is a drag, not a hold
const CARD_W = 280

/** Renders page 1 of a file into a preview card. `doc` reuses an already open document. */
export async function peekCard(path: string, doc?: Doc): Promise<HTMLElement> {
  const own = !doc
  const d = doc ?? (await Doc.open(path))
  try {
    const [w, ht] = d.sizes[0] ?? [612, 792]
    const scale = (CARD_W / w) * devicePixelRatio
    const bmp = await d.render(0, scale)
    const c = h('canvas', { width: bmp.width, height: bmp.height, style: { width: CARD_W + 'px', height: (CARD_W * ht) / w + 'px' } })
    c.getContext('2d')!.drawImage(bmp, 0, 0)
    bmp.close()
    return h('div', { class: 'peek-card' }, c,
      h('div', { class: 'peek-info' }, h('b', {}, d.meta.Title?.trim() || path.split(/[\\/]/).pop()!), h('small', {}, `${d.pages} page${d.pages === 1 ? '' : 's'}`)))
  } finally {
    if (own) d.close()
  }
}

const layer = h('div', { class: 'peek-layer', 'aria-live': 'polite' })
document.body.append(layer)

/** Makes `el` show a first-page preview while held. `getDoc` may return an already open document. */
export function holdPreview(el: HTMLElement, path: string, getDoc?: () => Doc | undefined) {
  let timer = 0, x = 0, y = 0, token = 0, shown = false
  const cancel = () => {
    clearTimeout(timer)
    token++
    if (shown) layer.replaceChildren()
  }
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !settings.holdPreview) return
    x = e.clientX; y = e.clientY; shown = false
    const my = ++token
    timer = window.setTimeout(async () => {
      shown = true
      layer.replaceChildren(h('div', { class: 'peek-card loading', style: place(x, y, 360) }, h('span', { class: 'spinner big' })))
      try {
        const card = await peekCard(path, getDoc?.())
        if (my !== token) return
        Object.assign(card.style, place(x, y, card.querySelector('canvas')!.offsetHeight || 380))
        layer.replaceChildren(card)
      } catch {
        if (my === token) layer.replaceChildren()
      }
    }, HOLD_MS)
  })
  el.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - x, e.clientY - y) > MOVE_TOLERANCE) cancel() })
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave', 'dragstart']) el.addEventListener(ev, cancel)
  // Releasing after a peek must not also open the file.
  el.addEventListener('click', (e) => { if (shown) { e.stopPropagation(); e.preventDefault(); shown = false } }, true)
}

function place(x: number, y: number, hgt: number) {
  const left = Math.min(x + 18, innerWidth - CARD_W - 28)
  const top = Math.max(8, Math.min(y + 18, innerHeight - hgt - 60))
  return { left: left + 'px', top: top + 'px' }
}
