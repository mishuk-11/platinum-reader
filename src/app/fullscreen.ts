import { getCurrentWindow } from '@tauri-apps/api/window'
import { activeViewer } from './app'
import type { ViewMode } from './store'

let saved: { mode: ViewMode; zoom: number; fit: 'width' | 'page' | null } | null = null

/** F11: distraction-free single page, all chrome hidden. */
export async function toggleFullscreen(force?: boolean) {
  const on = force ?? !document.documentElement.classList.contains('fs')
  const v = activeViewer()
  document.documentElement.classList.toggle('fs', on)
  await getCurrentWindow().setFullscreen(on)
  if (!v) return
  if (on) {
    saved = { mode: v.mode, zoom: v.zoom, fit: v.fit }
    v.setMode('single')
    requestAnimationFrame(() => v.setZoom('page'))
    v.el.focus()
  } else if (saved) {
    const s = saved
    saved = null
    v.setMode(s.mode)
    requestAnimationFrame(() => v.setZoom(s.fit ?? s.zoom))
  }
}

export const isFullscreen = () => document.documentElement.classList.contains('fs')
