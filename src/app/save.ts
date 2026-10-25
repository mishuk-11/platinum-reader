// Save / Save As: writes highlights into the PDF itself, and asks before closing unsaved work.
import { invoke } from '@tauri-apps/api/core'
import { save as savePicker } from '@tauri-apps/plugin-dialog'
import { Save, X } from 'lucide'
import { closeTab, render, type Tab } from './app'
import { highlights, history } from './store'
import { dialog, h, icon, toast } from './ui'

const basename = (p: string) => p.split(/[\\/]/).pop() ?? p
// The path travels in a header, which must be ASCII; hex keeps any file name (Bengali, emoji, …) intact.
const hex = (s: string) => [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, '0')).join('')

export function markDirty(tab: Tab, dirty: boolean) {
  tab.dirty = dirty
  tab.btn.classList.toggle('dirty', dirty)
}

/** Returns false if the user cancelled or saving failed. */
export async function saveTab(tab: Tab | null | undefined, as = false): Promise<boolean> {
  const v = tab?.viewer
  if (!tab || !v) return false
  if (!v.doc.editable) {
    toast('Only PDF files can be saved. Highlights in other formats stay in Platinum Reader.', 4500)
    return false
  }
  let target = tab.path
  if (as) {
    const picked = await savePicker({ defaultPath: tab.path.replace(/\.pdf$/i, ' (highlighted).pdf'), filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    if (!picked) return false
    target = /\.pdf$/i.test(picked) ? picked : picked + '.pdf'
  }
  try {
    // App highlights become real PDF annotations; from here on they live in the document.
    if (v.hl.length) {
      await v.doc.addHighlights(v.hl)
      highlights.set(tab.path, [])
      v.hl = []
      v.pageEls.forEach((_, i) => v.drawHighlights(i))
      v.rerender()
    }
    await invoke('write_file', await v.doc.save(), { headers: { path: hex(target) } })
  } catch (err: any) {
    toast('Could not save: ' + (err?.message ?? err), 6000)
    markDirty(tab, true)
    return false
  }
  if (target !== tab.path) {
    tab.path = v.doc.path = target
    tab.title = basename(target)
    tab.btn.title = target
    tab.btn.querySelector('.tab-title')!.textContent = tab.title
    history.put({ path: target, title: tab.title, page: v.current, zoom: v.zoom, time: Date.now(), pages: v.doc.pages })
    render()
  }
  markDirty(tab, false)
  toast(`Saved ${basename(target)}`)
  return true
}

/** Asks what to do with unsaved tabs. Resolves true when it's fine to close them. */
export function confirmClose(tabs: Tab[]): Promise<boolean> {
  const dirty = tabs.filter((t) => t.dirty)
  if (!dirty.length) return Promise.resolve(true)
  return new Promise((resolve) => {
    let done = false
    const finish = (ok: boolean) => { if (!done) { done = true; close(); resolve(ok) } }
    const names = dirty.length === 1 ? `“${dirty[0].title}”` : `${dirty.length} documents`
    const close = dialog('Unsaved changes', h('div', {},
      h('p', {}, `Save your highlights in ${names} before closing?`),
      h('div', { class: 'update-actions' },
        h('button', { class: 'btn primary', onclick: async () => {
          for (const t of dirty) if (!(await saveTab(t))) return finish(false)
          finish(true)
        } }, icon(Save, 16), 'Save'),
        h('button', { class: 'btn', onclick: () => finish(true) }, "Don't save"),
        h('button', { class: 'btn', onclick: () => finish(false) }, icon(X, 16), 'Cancel'))))
    // Closing the dialog with Esc or ✕ means cancel.
    const observer = new MutationObserver(() => { if (!document.contains(dialogEl)) { observer.disconnect(); finish(false) } })
    const all = document.querySelectorAll('.modal-back')
    const dialogEl = all[all.length - 1]
    observer.observe(document.body, { childList: true })
  })
}

/** Closes tabs the way a user expects: asks first if any have unsaved changes. */
export async function requestClose(...tabs: Tab[]) {
  if (await confirmClose(tabs)) tabs.forEach(closeTab)
}
