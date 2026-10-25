// Settings, history and highlights, persisted in the webview's localStorage.

export const defaults = {
  theme: 'system' as 'system' | 'light' | 'dark',
  accent: 'graphite',
  tabs: 'top' as 'top' | 'left',
  density: 'comfortable' as 'comfortable' | 'compact',
  toolbarLabels: false,
  invertPages: false,
  viewMode: 'continuous' as ViewMode,
  zoom: 'width' as string, // 'width' | 'page' | percent as string
  pageGap: 12,
  sidebar: false,
  restoreTabs: true,
  ai: 'chatgpt',
  search: 'google',
  // developer
  devMode: false,
  devOverlay: false,
  devTextLayer: false,
  renderQuality: 'normal' as 'low' | 'normal' | 'high',
  renderThreads: 2,
  // extensions (built-in ids → enabled)
  extensions: { translate: true, dictionary: true, progress: false, wordcount: false } as Record<string, boolean>,
}
export type ViewMode = 'continuous' | 'facing' | 'single'
export type Settings = typeof defaults

export const ACCENTS: Record<string, string> = {
  graphite: '#6a7591', ocean: '#2f7bd9', forest: '#2e9d6a', rose: '#e0446a',
  amber: '#d88a12', violet: '#7c5ce0', sepia: '#a0703c',
}

export const AI: Record<string, [string, string]> = {
  chatgpt: ['ChatGPT', 'https://chatgpt.com/?q='],
  claude: ['Claude', 'https://claude.ai/new?q='],
  perplexity: ['Perplexity', 'https://www.perplexity.ai/search?q='],
  aimode: ['Google AI Mode', 'https://www.google.com/search?udm=50&q='],
}
export const SEARCH: Record<string, [string, string]> = {
  google: ['Google', 'https://www.google.com/search?q='],
  bing: ['Bing', 'https://www.bing.com/search?q='],
  duckduckgo: ['DuckDuckGo', 'https://duckduckgo.com/?q='],
}

function load<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? '') ?? fallback } catch { return fallback }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full or blocked */ }
}

const saved = load<Partial<Settings>>('settings', {})
export const settings: Settings = { ...defaults, ...saved, extensions: { ...defaults.extensions, ...saved.extensions } }
const listeners: (() => void)[] = []
export const onSettings = (fn: () => void) => listeners.push(fn)
export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  settings[key] = value
  save('settings', settings)
  listeners.forEach((fn) => fn())
}
export function resetSettings() {
  Object.assign(settings, defaults, { extensions: { ...defaults.extensions } })
  save('settings', settings)
  listeners.forEach((fn) => fn())
}

export function applyTheme() {
  const root = document.documentElement
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  root.dataset.theme = settings.accent === 'sepia' && !dark ? 'sepia' : dark ? 'dark' : 'light'
  root.dataset.tabs = settings.tabs
  root.dataset.density = settings.density
  root.dataset.labels = String(settings.toolbarLabels)
  root.dataset.invert = String(settings.invertPages && dark)
  root.dataset.extProgress = String(!!settings.extensions.progress)
  root.dataset.devtext = String(settings.devMode && settings.devTextLayer)
  root.style.setProperty('--accent', ACCENTS[settings.accent] ?? ACCENTS.graphite)
  root.style.setProperty('--page-gap', settings.pageGap + 'px')
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
onSettings(applyTheme)

// ---- history ----
export interface Recent { path: string; title: string; page: number; zoom: number; time: number; pages: number }
export const history = {
  list: () => load<Recent[]>('history', []),
  get: (path: string) => history.list().find((r) => r.path === path),
  put(r: Recent) {
    save('history', [r, ...history.list().filter((x) => x.path !== r.path)].slice(0, 60))
  },
  remove: (path: string) => save('history', history.list().filter((x) => x.path !== path)),
  clear: () => save('history', []),
}

export const session = {
  get: () => load<string[]>('session', []),
  set: (paths: string[]) => save('session', paths),
}

// ---- highlights ----
export interface Highlight { page: number; rects: number[][]; color: string; text: string }
export const highlights = {
  get: (path: string) => load<Highlight[]>('hl:' + path, []),
  set: (path: string, list: Highlight[]) => save('hl:' + path, list),
}
