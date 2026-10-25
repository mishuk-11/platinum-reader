// Easter eggs: clicking the developer's name 11 times plays a random one.
import { h } from './ui'

interface P { x: number; y: number; vx: number; vy: number; ay: number; rot: number; vr: number; s: number; e: string; age: number; life: number; bounce?: boolean; step?: (p: P, t: number) => void }

const sprites = new Map<string, HTMLCanvasElement>()
function sprite(e: string) {
  let c = sprites.get(e)
  if (!c) {
    // Emoji text is slow to draw every frame, so each one is rendered once.
    c = document.createElement('canvas')
    c.width = c.height = 96
    const x = c.getContext('2d')!
    x.font = '72px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.fillText(e, 48, 52)
    sprites.set(e, c)
  }
  return c
}

/** Runs a full-screen emoji particle animation. `spawn` is called every frame with the elapsed ms. */
function particles(duration: number, spawn: (t: number) => P[], overlay?: (ctx: CanvasRenderingContext2D, t: number) => void) {
  const cv = h('canvas', { class: 'egg-canvas', 'aria-hidden': 'true' })
  document.body.append(cv)
  const dpr = devicePixelRatio
  cv.width = innerWidth * dpr
  cv.height = innerHeight * dpr
  const ctx = cv.getContext('2d')!
  let ps: P[] = []
  const floor = innerHeight - 12
  const t0 = performance.now()
  const frame = (now: number) => {
    const t = now - t0
    if (t < duration) ps.push(...spawn(t))
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cv.width, cv.height)
    for (const p of ps) {
      p.step?.(p, t)
      p.vy += p.ay
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      p.age++
      if (p.bounce && p.y > floor) { p.y = floor; p.vy *= -0.45; p.vx *= 0.8; p.vr *= 0.6 }
      ctx.globalAlpha = Math.max(0, Math.min(1, (p.life - p.age) / 30))
      ctx.setTransform(dpr, 0, 0, dpr, p.x * dpr, p.y * dpr)
      ctx.rotate(p.rot)
      ctx.drawImage(sprite(p.e), -p.s / 2, -p.s / 2, p.s, p.s)
    }
    if (overlay) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; overlay(ctx, t) }
    ps = ps.filter((p) => p.age < p.life && p.y < innerHeight + 80 && p.x > -120 && p.x < innerWidth + 120)
    if (t < duration || ps.length) requestAnimationFrame(frame)
    else cv.remove()
  }
  requestAnimationFrame(frame)
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const base = (x: number, y: number, e: string): P => ({ x, y, vx: 0, vy: 0, ay: 0, rot: 0, vr: 0, s: 28, e, age: 0, life: 300 })

type Egg = (from: DOMRect) => void

const EGGS: Record<string, Egg> = {
  /** Cherries burst out of the name and bounce on the floor. */
  cherries: (r) => particles(1600, () => Array.from({ length: 3 }, () => ({
    ...base(rnd(r.left, r.right), r.top + r.height / 2, '🍒'),
    vx: rnd(-6, 6), vy: rnd(-16, -7), ay: 0.35, rot: rnd(0, 6), vr: rnd(-0.2, 0.2), s: rnd(22, 40), life: 320, bounce: true,
  }))),

  /** Books and pages rain down from the top, swaying. */
  bookRain: () => particles(2600, () => Array.from({ length: 2 }, () => ({
    ...base(rnd(0, innerWidth), -40, pick(['📚', '📖', '📕', '📗', '📘', '📄', '🔖'])),
    vx: rnd(-1, 1), vy: rnd(2, 5), ay: 0.04, rot: rnd(-0.4, 0.4), vr: rnd(-0.05, 0.05), s: rnd(24, 44), life: 420,
  }))),

  /** A fairy rocket launches across the screen, leaving a sparkle trail. */
  fairyRocket: () =>
    particles(2200, (t) => {
      const k = t / 2200
      const x = -60 + k * (innerWidth + 120)
      const y = innerHeight * 0.85 - Math.sin(k * Math.PI) * innerHeight * 0.65
      const out: P[] = [{ ...base(x, y, '🚀'), rot: Math.PI / 4 - Math.cos(k * Math.PI) * 0.9, s: 56, life: 2 }]
      if (Math.random() < 0.7) out.push({ ...base(x - 20, y + 20, pick(['✨', '⭐', '🌟', '🧚'])), vx: rnd(-1.5, 0.5), vy: rnd(-0.5, 1.5), ay: 0.03, vr: rnd(-0.1, 0.1), s: rnd(14, 30), life: 70 })
      return out
    }),

  /** The whole window does a barrel roll. */
  barrelRoll: () => {
    document.body.classList.remove('egg-roll')
    void document.body.offsetWidth
    document.body.classList.add('egg-roll')
    setTimeout(() => document.body.classList.remove('egg-roll'), 1400)
  },

  /** Disco: colors cycle while music notes float up from the name. */
  disco: (r) => {
    document.documentElement.classList.add('egg-disco')
    setTimeout(() => document.documentElement.classList.remove('egg-disco'), 3200)
    particles(3000, () => Math.random() < 0.5 ? [] : [{
      ...base(rnd(r.left, r.right), r.top, pick(['🎵', '🎶', '🪩', '💃', '🕺'])),
      vx: rnd(-1.2, 1.2), vy: rnd(-3.5, -1.5), ay: -0.01, vr: rnd(-0.05, 0.05), s: rnd(20, 36), life: 160,
    }])
  },
}

// ---------- codename eggs ----------

/** Every release's codename and emoji. Add a line here with each new release. */
export const RELEASES: { version: string; name: string; emoji: string[] }[] = [
  { version: '0.1.0', name: 'Cherry Lava', emoji: ['🍒'] },
  { version: '0.2.0', name: 'FairyRocket', emoji: ['🧚', '🚀'] },
  { version: '0.3.0', name: 'Carrotbunny', emoji: ['🥕', '🐰'] },
  { version: '0.4.0', name: 'Honeybee', emoji: ['🐝', '🍯'] },
  { version: '0.4.2', name: 'BabyKoala', emoji: ['🐨', '🌿'] },
]

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Hold the About icon 3 s (or the developer name 5 s): a 5-second showdown, one burst per release with its codename. */
export function releaseShowdown(from: HTMLElement) {
  if (reduced()) return
  const r = from.getBoundingClientRect()
  const slot = 5000 / RELEASES.length
  particles(5000, (t) => {
    const rel = RELEASES[Math.min(RELEASES.length - 1, Math.floor(t / slot))]
    return Array.from({ length: 3 }, () => ({
      ...base(rnd(r.left, r.right), r.top + r.height / 2, pick(rel.emoji)),
      vx: rnd(-9, 9), vy: rnd(-14, -4), ay: 0.28, rot: rnd(0, 6), vr: rnd(-0.15, 0.15), s: rnd(22, 42), life: 140,
    }))
  }, (ctx, t) => {
    if (t >= 5000) return
    const i = Math.min(RELEASES.length - 1, Math.floor(t / slot))
    const k = (t % slot) / slot
    ctx.globalAlpha = Math.sin(Math.PI * k)
    ctx.font = '600 44px "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#5ab8f5'
    ctx.fillText(`${RELEASES[i].emoji.join(' ')}  ${RELEASES[i].name}`, innerWidth / 2, innerHeight * 0.28)
    ctx.font = '500 16px "Segoe UI", sans-serif'
    ctx.fillStyle = '#9aa3ad'
    ctx.fillText(`v${RELEASES[i].version}`, innerWidth / 2, innerHeight * 0.28 + 30)
  })
}

/** Type "hop": bunnies hop across the screen chasing carrots (Carrotbunny brought hold-to-preview). */
export function bunnyChase() {
  if (reduced()) return
  const floor = innerHeight - 40
  let n = 0
  particles(3200, () => {
    if (n++ % 9) return []
    const y = floor - rnd(0, innerHeight * 0.5)
    // Hop around a fixed baseline; vy stays 0 so the engine doesn't drift y.
    const hop = (amp: number, speed: number, phase: number) => (p: P, t: number) => { p.y = y - Math.abs(Math.sin((t + phase) / speed)) * amp }
    const vx = rnd(4, 6)
    return [
      { ...base(-40, y, '🥕'), vx, s: 26, life: 500, step: hop(18, 140, rnd(0, 900)) },
      { ...base(-110, y, '🐰'), vx, s: 40, life: 520, step: hop(46, 180, rnd(0, 900)) },
    ]
  })
}

/** Type "buzz": honeybees swarm after the pointer for a few seconds (Honeybee brought help and feedback). */
let pointer = { x: innerWidth / 2, y: innerHeight / 2 }
addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY } }, { passive: true })
export function beeSwarm() {
  if (reduced()) return
  let spawned = false
  particles(6000, () => {
    if (spawned) return []
    spawned = true
    return Array.from({ length: 22 }, () => ({
      ...base(rnd(0, innerWidth), rnd(0, innerHeight), '🐝'), s: rnd(20, 30), life: 400,
      step: (p: P) => {
        p.vx = p.vx * 0.92 + (pointer.x - p.x) * 0.006 + rnd(-0.9, 0.9)
        p.vy = p.vy * 0.92 + (pointer.y - p.y) * 0.006 + rnd(-0.9, 0.9)
        p.rot = Math.atan2(p.vy, p.vx) * 0.25
      },
    }))
  })
}

/** Calls `fn` when `el` is pressed and held still for `ms`. */
export function onHold(el: HTMLElement, ms: number, fn: () => void) {
  let timer = 0, x = 0, y = 0
  el.addEventListener('pointerdown', (e) => { x = e.clientX; y = e.clientY; timer = window.setTimeout(fn, ms) })
  el.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - x, e.clientY - y) > 6) clearTimeout(timer) })
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => clearTimeout(timer))
}

// Words typed anywhere outside a text field.
const WORDS: Record<string, () => void> = { buzz: beeSwarm, hop: bunnyChase }
let typed = ''
addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).matches?.('input, textarea, select') || e.key.length !== 1) return
  typed = (typed + e.key.toLowerCase()).slice(-6)
  const word = Object.keys(WORDS).find((w) => typed.endsWith(w))
  if (word) { typed = ''; WORDS[word]() }
})

let last = ''
/** Plays a random easter egg, never the same one twice in a row. */
export function playEgg(from: HTMLElement) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const names = Object.keys(EGGS).filter((n) => n !== last)
  last = pick(names)
  EGGS[last](from.getBoundingClientRect())
}
