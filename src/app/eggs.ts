// Easter eggs: clicking the developer's name 11 times plays a random one; the About logo has its own (click or hold).
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
  cherries: (r) => particles(900, () => Math.random() < 0.28 ? [{
    ...base(rnd(r.left, r.right), r.top + r.height / 2, '🍒'),
    vx: rnd(-6, 6), vy: rnd(-16, -7), ay: 0.35, rot: rnd(0, 6), vr: rnd(-0.2, 0.2), s: rnd(22, 40), life: 320, bounce: true,
  }] : []),

  /** Books and pages rain down from the top, swaying. */
  bookRain: () => particles(2600, () => Math.random() < 0.15 ? [{
    ...base(rnd(0, innerWidth), -40, pick(['📚', '📖', '📕', '📗', '📘', '📄', '🔖'])),
    vx: rnd(-1, 1), vy: rnd(2, 5), ay: 0.04, rot: rnd(-0.4, 0.4), vr: rnd(-0.05, 0.05), s: rnd(24, 44), life: 420,
  }] : []),

  /** A fairy rocket launches across the screen, leaving a sparkle trail. */
  fairyRocket: () =>
    particles(2200, (t) => {
      const k = t / 2200
      const x = -60 + k * (innerWidth + 120)
      const y = innerHeight * 0.85 - Math.sin(k * Math.PI) * innerHeight * 0.65
      const out: P[] = [{ ...base(x, y, '🚀'), rot: Math.PI / 4 - Math.cos(k * Math.PI) * 0.9, s: 56, life: 2 }]
      if (Math.random() < 0.25) out.push({ ...base(x - 20, y + 20, pick(['✨', '⭐', '🌟', '🧚'])), vx: rnd(-1.5, 0.5), vy: rnd(-0.5, 1.5), ay: 0.03, vr: rnd(-0.1, 0.1), s: rnd(14, 30), life: 70 })
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
    particles(3000, () => Math.random() < 0.8 ? [] : [{
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
  { version: '0.5.0', name: 'DonutDino', emoji: ['🍩', '🦖'] },
]

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Type "hop": bunnies hop across the screen chasing carrots (Carrotbunny brought hold-to-preview). */
export function bunnyChase() {
  if (reduced()) return
  const floor = innerHeight - 40
  let n = 0
  particles(3200, () => {
    if (n++ % 24) return []
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
    return Array.from({ length: 8 }, () => ({
      ...base(rnd(0, innerWidth), rnd(0, innerHeight), '🐝'), s: rnd(20, 30), life: 400,
      step: (p: P) => {
        p.vx = p.vx * 0.92 + (pointer.x - p.x) * 0.006 + rnd(-0.9, 0.9)
        p.vy = p.vy * 0.92 + (pointer.y - p.y) * 0.006 + rnd(-0.9, 0.9)
        p.rot = Math.atan2(p.vy, p.vx) * 0.25
      },
    }))
  })
}

/** Calls `fn` when `el` is pressed and held still for `ms`; the click after a hold is swallowed. */
export function onHold(el: HTMLElement, ms: number, fn: () => void) {
  let timer = 0, x = 0, y = 0, held = false
  const stop = () => clearTimeout(timer)
  el.addEventListener('pointerdown', (e) => {
    if (e.button) return
    x = e.clientX; y = e.clientY; held = false
    el.setPointerCapture(e.pointerId)
    timer = window.setTimeout(() => { held = true; fn() }, ms)
  })
  el.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - x, e.clientY - y) > 10) stop() })
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, stop)
  el.addEventListener('click', (e) => { if (held) { held = false; e.stopImmediatePropagation(); e.preventDefault() } }, true)
}

// ---------- About logo eggs ----------

let busy = false
/** Starts a logo egg of `ms` unless one is playing or the OS asks for reduced motion. */
function claim(ms: number) {
  if (busy || reduced()) return false
  busy = true
  setTimeout(() => { busy = false }, ms)
  return true
}

/** An emoji behind the About logo; `play` removes it when its animation ends. */
function actor(stage: HTMLElement, emoji: string, size = 26) {
  const el = h('span', { class: 'logo-actor', 'aria-hidden': 'true', style: { fontSize: `${size}px` } }, emoji)
  stage.append(el)
  return el
}
const at = (x: number, y: number, extra = '') => ({ transform: `translate(${x}px, ${y}px) ${extra}` })
const on = (k: Keyframe, offset: number): Keyframe => ({ ...k, offset })
function play(el: HTMLElement, frames: Keyframe[], ms: number) {
  el.animate(frames, { duration: ms, easing: 'ease-in-out', fill: 'both' }).onfinish = () => el.remove()
}

/** Click the logo: the current release's own scene; without one, its emoji peeks out and slides back. */
export function logoSneak(stage: HTMLElement) {
  const scene = HOLD_EGGS[RELEASES[RELEASES.length - 1].name]
  if (scene) { if (claim(scene.ms)) scene.run(stage); return }
  if (!claim(1800)) return
  const side = Math.random() < 0.5 ? -1 : 1
  const out = at(26 * side, -40, `rotate(${12 * side}deg)`)
  const home = at(0, 0, 'rotate(0deg)')
  play(actor(stage, RELEASES[RELEASES.length - 1].emoji[0], 28), [home, on(out, 0.25), on(out, 0.8), home], 1800)
}

/** Release scenes. The current release's plays on click; the four releases before it play on hold. */
const HOLD_EGGS: Record<string, { ms: number; run: (s: HTMLElement) => void }> = {
  /** The bunny hops out to a carrot, nibbles it, and hops back. */
  Carrotbunny: {
    ms: 2800,
    run: (s) => {
      const c = (k: number) => at(48, 14, `scale(${k})`)
      play(actor(s, '🥕', 20), [c(0), on(c(1), 0.12), on(c(1), 0.45), on(c(0), 0.75), c(0)], 2800)
      const b = (x: number, y: number, r = 0) => at(x, y, `rotate(${r}deg)`)
      play(actor(s, '🐰'), [b(0, 0), on(b(12, -30), 0.12), on(b(30, 8), 0.22), on(b(30, 4, 8), 0.3), on(b(30, 8), 0.38),
        on(b(30, 4, 8), 0.46), on(b(30, 8), 0.54), on(b(14, -26), 0.7), b(0, 0)], 2800)
    },
  },
  /** A bee buzzes around the logo and lands back behind it. */
  Honeybee: {
    ms: 3200,
    run: (s) => {
      const b = (x: number, y: number, r = 0) => at(x, y, `rotate(${r}deg)`)
      play(actor(s, '🐝', 22), [b(0, 0), ...Array.from({ length: 5 }, () => b(rnd(-90, 90), rnd(-70, 40), rnd(-20, 20))), b(0, 0)], 3200)
    },
  },
  /** The koala climbs to a leaf and chews on it. */
  BabyKoala: {
    ms: 3000,
    run: (s) => {
      const l = (k: number) => at(52, -4, `scale(${k})`)
      play(actor(s, '🌿', 22), [l(0), on(l(1), 0.15), on(l(1), 0.85), l(0)], 3000)
      play(actor(s, '🐨'), [at(0, 0), on(at(0, 0), 0.15), on(at(30, -6), 0.35), on(at(30, -12), 0.45), on(at(30, -6), 0.55),
        on(at(30, -12), 0.65), on(at(30, -6), 0.75), at(0, 0)], 3000)
    },
  },
  /** A donut rolls up to the dino, which gulps it down and bounces. */
  DonutDino: {
    ms: 3000,
    run: (s) => {
      const d = (x: number, y: number, k = 1) => at(x, y, `scale(${k})`)
      play(actor(s, '🦖', 28), [d(0, 0), on(d(-50, 8), 0.15), on(d(-50, 8), 0.5), on(d(-50, 8, 1.15), 0.58), on(d(-50, 8), 0.66),
        on(d(-50, 0), 0.74), on(d(-50, 8), 0.82), d(0, 0)], 3000)
      const n = (x: number, r: number, k: number) => at(x, 12, `rotate(${r}deg) scale(${k})`)
      play(actor(s, '🍩', 20), [n(90, 0, 0), on(n(90, 0, 1), 0.15), on(n(30, -360, 1), 0.5), on(n(-30, -360, 0), 0.66), n(-30, -360, 0)], 3000)
    },
  },
}

let lastHold = ''
/** Plays a scene from one of the four releases before the current one, never the same one twice in a row.
 *  A new release moves the old current one into this pool and pushes the oldest out. */
export function holdEgg(stage: HTMLElement) {
  const names = RELEASES.slice(-5, -1).map((r) => r.name).filter((n) => HOLD_EGGS[n] && n !== lastHold)
  const name = pick(names)
  if (!name || !claim(HOLD_EGGS[name].ms)) return
  lastHold = name
  HOLD_EGGS[name].run(stage)
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
