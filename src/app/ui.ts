// Tiny DOM helpers: icons, elements, popup menus, dialogs, toasts.
import { createElement, type IconNode } from 'lucide'

export function icon(node: IconNode, size = 17) {
  const svg = createElement(node)
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('stroke-width', '1.6')
  svg.setAttribute('aria-hidden', 'true')
  return svg
}

type Child = Node | string | null | undefined | false
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, any> = {}, ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (k === 'class') el.className = v
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v)
    else el.setAttribute(k, v === true ? '' : String(v))
  }
  for (const c of children) if (c) el.append(c)
  return el
}

export const button = (ico: IconNode, title: string, onclick: (e: MouseEvent) => void, label?: string) =>
  h('button', { class: 'tb-btn', title, 'aria-label': title, onclick }, icon(ico), label ? h('span', { class: 'tb-label' }, label) : null)

export type MenuItem =
  | '-'
  | { label: string; icon?: IconNode; kbd?: string; checked?: boolean; disabled?: boolean; danger?: boolean; action: () => void }

let openMenu: HTMLElement | null = null
export function closeMenu() {
  openMenu?.remove()
  openMenu = null
}

/** Popup menu at a point (context menus, dropdowns). */
export function menu(items: MenuItem[], x: number, y: number) {
  closeMenu()
  const el = h('div', { class: 'menu', role: 'menu' })
  for (const it of items) {
    if (it === '-') { el.append(h('div', { class: 'menu-sep' })); continue }
    el.append(h('button', {
      class: 'menu-item' + (it.danger ? ' danger' : ''), role: 'menuitem', disabled: it.disabled,
      onclick: () => { closeMenu(); it.action() },
    },
    h('span', { class: 'menu-ico' }, it.checked ? icon(CHECK, 15) : it.icon ? icon(it.icon, 15) : null),
    h('span', { class: 'menu-label' }, it.label),
    it.kbd ? h('kbd', {}, it.kbd) : null))
  }
  document.body.append(el)
  const r = el.getBoundingClientRect()
  el.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px'
  el.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px'
  openMenu = el
  ;(el.querySelector('button:not([disabled])') as HTMLElement | null)?.focus()
}
// Lucide "check" icon node, inlined to avoid importing for one glyph.
const CHECK: IconNode = [['path', { d: 'M20 6 9 17l-5-5' }]]

addEventListener('pointerdown', (e) => { if (openMenu && !openMenu.contains(e.target as Node)) closeMenu() }, true)
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu() })
addEventListener('blur', closeMenu)

/** Modal dialog. Returns a close function. */
export function dialog(title: string, body: Node, className = '') {
  const close = () => { back.remove(); removeEventListener('keydown', onKey) }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
  const back = h('div', { class: 'modal-back', onpointerdown: (e: Event) => e.target === back && close() },
    h('div', { class: 'modal ' + className, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', {}, h('h2', {}, title),
        h('button', { class: 'tb-btn', title: 'Close', 'aria-label': 'Close', onclick: close }, icon(X_ICON))),
      h('div', { class: 'modal-body' }, body)))
  document.body.append(back)
  addEventListener('keydown', onKey)
  return close
}
const X_ICON: IconNode = [['path', { d: 'M18 6 6 18' }], ['path', { d: 'm6 6 12 12' }]]

export function toast(msg: string, ms = 2600) {
  const t = h('div', { class: 'toast', role: 'status' }, msg)
  document.body.append(t)
  setTimeout(() => t.remove(), ms)
}
