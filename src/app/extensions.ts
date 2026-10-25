// Extensions: small JS modules that add selection actions, menu items and document hooks.
// Built-in ones can be switched off; users can add their own .js files (see EXTENSIONS.md).
import { Languages, BookA, Hash } from 'lucide'
import type { IconNode } from 'lucide'
import { openUrl } from '@tauri-apps/plugin-opener'
import { settings } from './store'
import { h, toast } from './ui'
import type { Viewer } from './viewer'

export interface SelectionAction { ext: string; label: string; icon?: IconNode; run: (text: string) => void }
export interface MenuAction { ext: string; label: string; run: () => void }
type OpenHook = { ext: string; run: (v: Viewer, info: { path: string; pages: number; title: string }) => void }

export const registry = { selection: [] as SelectionAction[], menu: [] as MenuAction[], open: [] as OpenHook[] }

export interface UserExtension { id: string; name: string; code: string; enabled: boolean }
const KEY = 'userExtensions'
export const userExtensions = {
  list(): UserExtension[] { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] } },
  save(list: UserExtension[]) { localStorage.setItem(KEY, JSON.stringify(list)) },
}

/** Whether an extension's contributions should show right now. */
export const isOn = (ext: string) =>
  ext.startsWith('user:') ? !!userExtensions.list().find((u) => u.id === ext)?.enabled : !!settings.extensions[ext]

/** The API object every extension receives. */
function api(ext: string, getViewer: () => Viewer | undefined) {
  return {
    version: '0.4.1-beta',
    addSelectionAction: (a: { label: string; icon?: IconNode; run: (text: string) => void }) => registry.selection.push({ ...a, ext }),
    addMenuItem: (a: { label: string; run: () => void }) => registry.menu.push({ ...a, ext }),
    onDocumentOpen: (run: OpenHook['run']) => registry.open.push({ ext, run }),
    activeViewer: getViewer,
    openUrl: (url: string) => { if (/^https?:\/\//.test(url)) openUrl(url) },
    toast,
  }
}
export type ReaderAPI = ReturnType<typeof api>

export const BUILTIN: { id: string; name: string; description: string; setup: (q: ReaderAPI) => void }[] = [
  {
    id: 'translate', name: 'Translate', description: 'Translate selected text with Google Translate',
    setup: (q) => q.addSelectionAction({ label: 'Translate', icon: Languages, run: (t) => q.openUrl('https://translate.google.com/?sl=auto&tl=en&op=translate&text=' + encodeURIComponent(t)) }),
  },
  {
    id: 'dictionary', name: 'Dictionary', description: 'Look up the meaning of a selected word',
    setup: (q) => q.addSelectionAction({ label: 'Define', icon: BookA, run: (t) => q.openUrl('https://www.google.com/search?q=define+' + encodeURIComponent(t.split(/\s+/).slice(0, 4).join(' '))) }),
  },
  {
    id: 'wordcount', name: 'Word count', description: 'Count words and characters in the selection',
    setup: (q) => q.addSelectionAction({ label: 'Count', icon: Hash, run: (t) => q.toast(`${t.split(/\s+/).filter(Boolean).length} words · ${t.length} characters`) }),
  },
  {
    id: 'progress', name: 'Reading progress', description: 'Thin bar on top of the page view showing how far you are',
    setup: (q) => q.onDocumentOpen((v, info) => {
      const bar = h('div', { class: 'ext-progress', 'data-ext': 'progress' })
      v.el.prepend(bar)
      const update = () => { bar.style.width = ((v.current + 1) / info.pages) * 100 + '%' }
      v.el.addEventListener('scroll', update, { passive: true })
      update()
    }),
  },
]

/** Registers built-ins (shown only while enabled) and loads enabled user extensions. */
export async function loadExtensions(getViewer: () => Viewer | undefined) {
  for (const b of BUILTIN) b.setup(api(b.id, getViewer))
  for (const u of userExtensions.list().filter((x) => x.enabled)) {
    const url = URL.createObjectURL(new Blob([u.code], { type: 'text/javascript' }))
    try {
      const mod = await import(/* @vite-ignore */ url)
      await mod.default?.(api(u.id, getViewer))
    } catch (err: any) {
      toast(`Extension "${u.name}" failed: ${err?.message ?? err}`, 5000)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

/** Runs every document-open hook, guarding the app against extension errors. */
export function runOpenHooks(v: Viewer, info: { path: string; pages: number; title: string }) {
  for (const hk of registry.open) {
    try { hk.run(v, info) } catch (err) { console.error('extension', hk.ext, err) }
  }
}
