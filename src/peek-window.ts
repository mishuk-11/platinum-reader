// Hold-to-preview window used by the Explorer/desktop helper (see src-tauri/src/peek.rs).
import './styles.css'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow, monitorFromPoint, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window'
import { peekCard } from './app/peek'
import { applyTheme } from './app/store'
import { invoke } from '@tauri-apps/api/core'

const report = (msg: string) => invoke('peek_log', { msg }).catch(() => {})

applyTheme()
document.documentElement.classList.add('peek-mode')
const win = getCurrentWindow()
let token = 0

listen<{ path: string; x: number; y: number }>('peek-show', async ({ payload: p }) => {
  const my = ++token
  let card: HTMLElement
  try { card = await peekCard(p.path) } catch (err) { report('render failed: ' + err); return }
  if (my !== token) return
  document.body.replaceChildren(card)
  await new Promise(requestAnimationFrame)
  const r = card.getBoundingClientRect()
  const w = Math.ceil((r.width + 16) * devicePixelRatio)
  const h = Math.ceil((r.height + 16) * devicePixelRatio)
  // Below-right of the pointer, flipped and clamped to stay on the same monitor.
  let x = p.x + 24, y = p.y + 24
  const m = await monitorFromPoint(p.x, p.y)
  if (m) {
    const right = m.position.x + m.size.width, bottom = m.position.y + m.size.height
    if (x + w > right) x = p.x - w - 24
    if (y + h > bottom) y = Math.max(m.position.y, bottom - h - 8)
    x = Math.max(m.position.x, x)
  }
  if (my !== token) return
  try {
    await win.setSize(new PhysicalSize(w, h))
    await win.setPosition(new PhysicalPosition(x, y))
    await win.show()
  } catch (err) { report('show failed: ' + err) }
})

listen('peek-hide', () => {
  token++
  win.hide()
  document.body.replaceChildren()
})
