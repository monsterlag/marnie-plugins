// Pixel-art scenes for the mascot. Each call draws ONE still frame of a mood at
// time `t` (seconds since the mood began): every pixel is a <rect> in a 100x18 grid
// drawn at 3x, and the motion comes from keyframe tracks evaluated here, so a
// redraw of the band can never restart the animation.

import type { Mood } from '../types'

// The band's own color, painted behind the scene.
export const BAND_BG = '#212121'

const W = 100
const H = 18
// PORTRAIT: the picture is the left PORTRAIT_COLS columns of the (mirrored) scene at
// PORTRAIT_SCALE, with PAD_ROWS extra rows above and below and PAD_COLS extra columns
// on the left for the band to clip: (48+6)*4 = 216 px by (18+8)*4 = 104 px. Off, it is
// the whole 100x18 scene at STRIP_SCALE: 300x54.
const PORTRAIT: boolean = true
const PORTRAIT_COLS = 48
const PORTRAIT_SCALE = 4
const PAD_ROWS = 4
const PAD_COLS = 6
const STRIP_SCALE = 3
// GRADIENT_FADE: the picture's right edge fades into the band through a linear
// gradient; off, through the Bayer dither. Either way over the last FADE_COLUMNS
// visible grid columns.
const GRADIENT_FADE: boolean = true
const FADE_COLUMNS = 16

// CALIBRATE: sceneSvg returns a ruled test card the size of the picture instead of a
// scene, for reading off a screenshot how much the band hides on each side.
const CALIBRATE: boolean = false

// PILOT: the band shows only the two scenes drawn natively for the portrait frame
// (typingP while working or idle, campfireP while done or relaxing). Needs PORTRAIT.
const PILOT: boolean = true

const SCALE = PORTRAIT ? PORTRAIT_SCALE : STRIP_SCALE
// The grid columns on show, and the extra ones around them.
const VIEW_COLS = PORTRAIT ? PORTRAIT_COLS : W
const PAD_X = PORTRAIT ? PAD_COLS : 0
const PAD_Y = PORTRAIT ? PAD_ROWS : 0

const PAL: Record<string, string> = {
  o: '#d97757', // claude orange
  O: '#b65a3c', // orange shade
  e: '#1a1a1a', // eyes
  K: '#262626',
  k: '#121212',
  w: '#f4efe4',
  y: '#f7dc6f',
  Y: '#e8a33d',
  t: '#c9a46a',
  b: '#8a5a2b',
  B: '#5b3a1c',
  g: '#8a8a8a',
  G: '#4a4a4a',
  c: '#7fd6e8',
  C: '#9fd8f0',
  n: '#5fbf6a',
  N: '#2f7d3a',
  r: '#e5534b',
  R: '#a8322c',
  p: '#f08fb0',
  u: '#5a8fe6',
  U: '#2d4f9e',
  V: '#1b2c5c',
  l: '#c3c7cf',
  L: '#7d838c',
  P: '#efe8d6',
  s: '#3a2a52',
  m: '#7d3b63',
  d: '#d9673f',
  f: '#f2a14a',
  h: '#ffd27a',
  v: '#9b6be0',
}

const fill = (c: string) => PAL[c] ?? c
const rect = (x: number, y: number, w: number, h: number, c: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill(c)}"/>`

// An ASCII sprite: one char per pixel, '.' is transparent; runs merge into one rect.
function spr(rows: string[], x = 0, y = 0): string {
  let out = ''
  rows.forEach((row, j) => {
    let i = 0
    while (i < row.length) {
      const c = row[i]
      if (c === '.' || c === ' ') {
        i++
        continue
      }
      let k = i
      while (k < row.length && row[k] === c) k++
      out += rect(x + i, y + j, k - i, 1, c)
      i = k
    }
  })
  return out
}

// Deterministic noise so the art is the same on every frame.
const rnd = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

// ---------- keyframe tracks ----------

type Pose = { tx?: number; ty?: number; o?: number; sx?: number; sy?: number }
type Track = [number, Pose][]
const BASE: Required<Pose> = { tx: 0, ty: 0, o: 1, sx: 1, sy: 1 }

const KF: Record<string, Track> = {
  bob: [[0, { ty: 0 }], [50, { ty: -1 }], [100, { ty: 0 }]],
  hop: [[0, { ty: 0 }], [50, { ty: -3 }], [100, { ty: 0 }]],
  wave: [[0, { ty: 0 }], [50, { ty: -2 }], [100, { ty: 0 }]],
  blink: [[0, { o: 1 }], [92, { o: 1 }], [94, { o: 0 }], [97, { o: 0 }], [100, { o: 1 }]],
  sweep: [[0, { tx: 0 }], [50, { tx: -2 }], [100, { tx: 0 }]],
  dust: [[0, { tx: 0, ty: 0, o: 1 }], [100, { tx: -9, ty: -3, o: 0 }]],
  tw: [[0, { o: 0 }], [30, { o: 1 }], [60, { o: 1 }], [100, { o: 0 }]],
  rise: [[0, { tx: 0, ty: 0, o: 0 }], [15, { o: 1 }], [100, { tx: 0, ty: -10, o: 0 }]],
  riseR: [[0, { tx: 0, ty: 0, o: 0 }], [15, { o: 1 }], [100, { tx: 4, ty: -9, o: 0 }]],
  walk: [[0, { tx: -36 }], [45, { tx: 0 }], [50, { tx: 0 }], [95, { tx: -36 }], [100, { tx: -36 }]],
  look: [[0, { tx: 1 }], [50, { tx: -1 }], [100, { tx: -1 }]],
  scan: [[0, { tx: -1 }], [50, { tx: 1 }], [100, { tx: -1 }]],
  grow: [[0, { sx: 0 }], [70, { sx: 1 }], [100, { sx: 1 }]],
  growY: [[0, { sy: 0 }], [60, { sy: 1 }], [100, { sy: 1 }]],
  pull: [[0, { ty: 9 }], [12, { ty: 0 }], [100, { ty: 0 }]],
  fly: [[0, { tx: 0, ty: 0, o: 1 }], [100, { tx: -14, ty: -12, o: 0 }]],
  dispatch: [[0, { tx: 0, o: 0 }], [6, { o: 1 }], [88, { o: 1 }], [100, { tx: -48, o: 0 }]],
  fall: [[0, { tx: 0, ty: -4 }], [50, { tx: 2, ty: 10 }], [100, { tx: -1, ty: 24 }]],
  dance: [
    [0, { tx: 0, ty: 0 }], [12, { tx: 0, ty: -4 }], [25, { tx: 0, ty: 0 }], [37, { tx: 0, ty: -4 }], [50, { tx: 0, ty: 0 }],
    [62, { tx: -2, ty: -1 }], [75, { tx: 2, ty: 0 }], [87, { tx: -2, ty: -1 }], [100, { tx: 0, ty: 0 }],
  ],
  sink: [[0, { ty: 0 }], [100, { ty: 3 }]],
  swing: [[0, { tx: -1 }], [50, { tx: 1 }], [100, { tx: -1 }]],
  on: [[0, { o: 1 }], [50, { o: 0 }], [100, { o: 0 }]],
  off: [[0, { o: 0 }], [50, { o: 1 }], [100, { o: 1 }]],
  leap: [
    [0, { tx: 0, ty: 0, o: 0 }], [78, { tx: 0, ty: 0, o: 0 }], [82, { tx: -2, ty: -4, o: 1 }],
    [88, { tx: -4, ty: -5, o: 1 }], [94, { tx: -6, ty: 0, o: 0 }], [100, { tx: 0, ty: 0, o: 0 }],
  ],
  drift: [[0, { tx: 0, ty: 0 }], [100, { tx: -70, ty: -2 }]],
  zoom: [[0, { tx: 0 }], [100, { tx: -72 }]],
  flip: [[0, { sx: 1 }], [60, { sx: 1 }], [70, { sx: 0.5 }], [80, { sx: -0.5 }], [90, { sx: -1 }], [100, { sx: -1 }]],
  carry: [[0, { tx: 0 }], [8, { tx: 0 }], [45, { tx: -22 }], [55, { tx: -22 }], [92, { tx: 0 }], [100, { tx: 0 }]],
  pace: [[0, { tx: 0 }], [50, { tx: -6 }], [100, { tx: 0 }]],
  magscan: [[0, { tx: 0, ty: 0 }], [25, { tx: -14, ty: -2 }], [50, { tx: -8, ty: 3 }], [75, { tx: -18, ty: 2 }], [100, { tx: 0, ty: 0 }]],
  dash: [[0, { tx: 0 }], [100, { tx: -8 }]],
  flipfood: [[0, { ty: 0 }], [70, { ty: 0 }], [80, { ty: -3 }], [90, { ty: -2 }], [100, { ty: 0 }]],
  vis2: [[0, { o: 1 }], [50, { o: 0 }], [100, { o: 0 }]],
}
const visTrack = (n: number): Track => [[0, { o: 1 }], [100 / n, { o: 0 }], [100, { o: 0 }]]

type Timing = { kind: 'step' } | { kind: 'linear' } | { kind: 'steps'; n: number }
type Anim = { track: Track; dur: number; delay: number; timing: Timing; count: number; fwd: boolean; back: boolean }

const animCache = new Map<string, Anim>()
// Reads a CSS-style shorthand: "bob 1s step-end infinite -0.5s", "fall 2s steps(12) 0.4s 2 both".
function parseAnim(def: string): Anim {
  const hit = animCache.get(def)
  if (hit) return hit
  const parts = def.trim().split(/\s+/)
  const name = parts[0]
  const track = KF[name] ?? (name.startsWith('vis') ? visTrack(Number(name.slice(3))) : [[0, {}], [100, {}]] as Track)
  const times: number[] = []
  let timing: Timing = { kind: 'linear' }
  let count = 1
  let fwd = false
  let back = false
  for (const p of parts.slice(1)) {
    if (/^-?[\d.]+s$/.test(p)) times.push(parseFloat(p))
    else if (p === 'step-end') timing = { kind: 'step' }
    else if (p === 'linear') timing = { kind: 'linear' }
    else if (p.startsWith('steps(')) timing = { kind: 'steps', n: parseInt(p.slice(6), 10) }
    else if (p === 'infinite') count = Infinity
    else if (/^\d+$/.test(p)) count = Number(p)
    else if (p === 'forwards') fwd = true
    else if (p === 'backwards') back = true
    else if (p === 'both') fwd = back = true
  }
  const a: Anim = { track, dur: times[0] ?? 1, delay: times[1] ?? 0, timing, count, fwd, back }
  animCache.set(def, a)
  return a
}

function sampleProp(track: Track, key: keyof Pose, pct: number, timing: Timing): number {
  const pts = track.filter(([, p]) => p[key] !== undefined).map(([at, p]) => [at, p[key] as number] as const)
  if (!pts.length) return BASE[key]
  if (pts[0][0] > 0) pts.unshift([0, BASE[key]])
  if (pts[pts.length - 1][0] < 100) pts.push([100, BASE[key]])
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, va] = pts[i]
    const [b, vb] = pts[i + 1]
    if (pct >= a && pct < b) {
      let f = (pct - a) / (b - a)
      if (timing.kind === 'step') f = 0
      else if (timing.kind === 'steps') f = Math.floor(f * timing.n) / timing.n
      return va + (vb - va) * f
    }
  }
  return pts[pts.length - 1][1]
}

// The pose of an animation at time t, or null where it has no effect (before or after its run).
function poseAt(def: string, t: number): Required<Pose> | null {
  const a = parseAnim(def)
  const el = t - a.delay
  let pct: number
  if (el < 0) {
    if (!a.back) return null
    pct = 0
  } else if (el >= a.dur * a.count) {
    if (!a.fwd) return null
    pct = 100
  } else {
    pct = ((el % a.dur) / a.dur) * 100
  }
  const keys: (keyof Pose)[] = ['tx', 'ty', 'o', 'sx', 'sy']
  const out = { ...BASE }
  for (const k of keys) out[k] = pct === 100 ? lastValue(a.track, k) : sampleProp(a.track, k, pct, a.timing)
  return out
}
function lastValue(track: Track, key: keyof Pose): number {
  for (let i = track.length - 1; i >= 0; i--) if (track[i][1][key] !== undefined) return track[i][1][key] as number
  return BASE[key]
}

const n2 = (v: number) => Math.round(v * 100) / 100

// The order a mood's n scenes play in for one entry into it: a Fisher-Yates shuffle
// drawn from `seed` alone, so every redraw of the same entry gets the same order.
export function sceneOrder(n: number, seed: number): number[] {
  let a = (Math.floor(Math.abs(seed)) % 0x100000000 ^ Math.imul(n, 0x9e3779b1)) >>> 0
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = Math.imul(a ^ (a >>> 15), a | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 0x100000000
  }
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const held = order[i] as number
    order[i] = order[j] as number
    order[j] = held
  }
  return order
}

class Frame {
  readonly t: number
  readonly seed: number
  constructor(t: number, seed: number) {
    this.t = t
    this.seed = seed
  }
  // A group posed by `anim` at this frame, placed at (x, y); `origin` is where it scales from.
  g(anim: string | null, inner: string, x = 0, y = 0, origin: [number, number] = [0, 0]): string {
    let body = inner
    if (anim) {
      const p = poseAt(anim, this.t)
      if (p) {
        if (p.o <= 0.02) return ''
        const tf: string[] = []
        if (p.tx || p.ty) tf.push(`translate(${n2(p.tx)} ${n2(p.ty)})`)
        if (p.sx !== 1 || p.sy !== 1) {
          tf.push(`translate(${origin[0]} ${origin[1]}) scale(${n2(p.sx) || 0.001} ${n2(p.sy) || 0.001}) translate(${-origin[0]} ${-origin[1]})`)
        }
        const attrs = (tf.length ? ` transform="${tf.join(' ')}"` : '') + (p.o < 1 ? ` opacity="${n2(p.o)}"` : '')
        if (attrs) body = `<g${attrs}>${inner}</g>`
      }
    }
    return x || y ? `<g transform="translate(${x} ${y})">${body}</g>` : body
  }
  // Shows one sub-scene of n for its slice of a T-second cycle, building only the one on
  // screen. The slices play in this entry's shuffled order: each scene once per cycle.
  cycle(scenes: (() => string)[], T: number): string {
    const n = scenes.length
    const i = Math.min(n - 1, Math.floor((((this.t % T) + T) % T) / (T / n)))
    return (scenes[sceneOrder(n, this.seed)[i] as number] as () => string)()
  }
}

// ---------- the mascot ----------

type Eyes = 'normal' | 'look' | 'lookL' | 'lookR' | 'down' | 'focus' | 'happy' | 'shades' | 'closed' | 'scan'
type ClawdOpts = {
  eyes?: Eyes
  bob?: string | null
  armL?: string | null
  armR?: string | null
  armLUp?: boolean
  armRUp?: boolean
  walk?: boolean
  sit?: boolean
  extra?: string
}

function eyes(f: Frame, kind: Eyes): string {
  const pair = rect(4, 1, 1, 2, 'e') + rect(11, 1, 1, 2, 'e')
  switch (kind) {
    case 'normal':
      return f.g('blink 4s step-end infinite', pair)
    case 'look':
      return f.g('look 8s step-end infinite', pair)
    case 'scan':
      return f.g('scan .9s step-end infinite', pair)
    case 'lookL':
      return f.g('blink 3.5s step-end infinite', rect(3, 1, 1, 2, 'e') + rect(10, 1, 1, 2, 'e'))
    case 'lookR':
      return f.g('blink 3.1s step-end infinite', rect(5, 1, 1, 2, 'e') + rect(12, 1, 1, 2, 'e'))
    case 'down':
      return rect(3, 2, 1, 2, 'e') + rect(10, 2, 1, 2, 'e')
    case 'focus':
      return rect(3, 2, 2, 1, 'e') + rect(10, 2, 2, 1, 'e') + rect(3, 1, 2, 1, 'O') + rect(10, 1, 2, 1, 'O')
    case 'happy':
      return spr(['.e......e.', 'e.e....e.e'], 3, 1)
    case 'closed':
      return rect(3, 2, 2, 1, 'e') + rect(10, 2, 2, 1, 'e')
    case 'shades':
      return spr(['kkkkk.kkkkk', 'kkkkkkkkkkk', '.kkk...kkk.'], 2, 1) + rect(3, 1, 1, 1, 'w') + rect(9, 1, 1, 1, 'w')
  }
}

// 16x8: body 12x6, arms 2x2 at the sides, four 1x2 legs.
function clawd(f: Frame, x: number, y: number, o: ClawdOpts = {}): string {
  const body = rect(2, 0, 12, 6, 'o') + rect(2, 5, 12, 1, 'O')
  const armL = f.g(o.armL ?? null, o.armLUp ? rect(0, 0, 2, 2, 'o') + rect(1, 2, 1, 1, 'o') : rect(0, 2, 2, 2, 'o'))
  const armR = f.g(o.armR ?? null, o.armRUp ? rect(14, 0, 2, 2, 'o') + rect(14, 2, 1, 1, 'o') : rect(14, 2, 2, 2, 'o'))
  let legs = ''
  if (!o.sit) {
    const a = rect(3, 6, 1, 2, 'o') + rect(10, 6, 1, 2, 'o')
    const c = rect(5, 6, 1, 2, 'o') + rect(12, 6, 1, 2, 'o')
    legs = o.walk ? f.g('bob .3s step-end infinite', a) + f.g('bob .3s step-end infinite -.15s', c) : a + c
  }
  return f.g(o.bob ?? null, legs + body + armL + armR + eyes(f, o.eyes ?? 'normal') + (o.extra ?? ''), x, y)
}

// 8x5 helper mascot.
function mini(f: Frame, x: number, y: number, carry = '', walk = true): string {
  const body = rect(1, 0, 6, 3, 'o') + rect(0, 1, 1, 1, 'o') + rect(7, 1, 1, 1, 'o') + rect(2, 1, 1, 1, 'e') + rect(5, 1, 1, 1, 'e')
  const la = rect(2, 3, 1, 2, 'o')
  const lb = rect(5, 3, 1, 2, 'o')
  const legs = walk ? f.g('bob .3s step-end infinite', la) + f.g('bob .3s step-end infinite -.15s', lb) : la + lb
  return `<g transform="translate(${x} ${y})">${legs}${body}${carry}</g>`
}

// sceneSvg mirrors the whole scene; this mirrors `inner` back about the centre of the
// w columns from x, so a glyph or a screen's contents reads the right way round in place.
const unflip = (x: number, w: number, inner: string) => `<g transform="translate(${2 * x + w} 0) scale(-1 1)">${inner}</g>`

const SPARK = ['.y.', 'yyy', '.y.']
const sparkle = (f: Frame, x: number, y: number, d: number, dur = 1.6) => f.g(`tw ${dur}s step-end infinite ${-d}s`, spr(SPARK), x, y)

const BANG = ['.wwww.', 'ww.www', 'ww.www', 'wwwwww', 'ww.www', '.wwww.', '.w....']
const BOX = ['BbbbB', 'bbYbb', 'bbbbb', 'BbbbB']
const SUN = ['..hhhh..', '.hhhhhh.', 'hhyyyyhh', 'hyyyyyyh', 'hyyyyyyh']

// A horizontally banded backdrop across the whole scene, solid from the first column:
// the only fade is the one sceneSvg lays over the right edge. It runs on into the
// picture's padding: the top band upward, the bottom band downward, and every band
// past the scene's far edge (the picture's left, once mirrored).
function backdrop(bands: [string, number][]): string {
  let out = ''
  let y = 0
  bands.forEach(([c, h], i) => {
    const top = i === 0 ? y - PAD_Y : y
    const bottom = i === bands.length - 1 ? y + h + PAD_Y : y + h
    out += rect(0, top, W + PAD_X, bottom - top, c)
    y += h
  })
  return out
}

// The share of the dotted field's cells that hold a dot, the same across the width.
const DOT_DENSITY = 0.25

// The dotted field behind every scene, even from edge to edge.
function dots(f: Frame): string {
  let out = ''
  const p = DOT_DENSITY
  for (let x = 0; x < W; x += 2) {
    for (let y = 1; y < H; y += 2) {
      const r = rnd(x * 31 + y)
      if (r < p) {
        out += r < p * 0.12
          ? f.g(`tw ${(2 + rnd(x + y * 7) * 3).toFixed(2)}s step-end infinite ${(-rnd(x * y + 1) * 4).toFixed(2)}s`, rect(x, y, 1, 1, '#555'))
          : rect(x, y, 1, 1, r < p * 0.35 ? '#3c3c3c' : '#2c2c2c')
      }
    }
  }
  return out
}

const stars = (f: Frame, n: number, seed: number) =>
  Array.from({ length: n }, (_, i) => {
    const x = 36 + Math.floor(rnd(seed + i * 4.3) * 62)
    const y = Math.floor(rnd(seed + i * 8.9) * 8)
    return f.g(`tw ${(1.5 + rnd(i + seed) * 2).toFixed(2)}s step-end infinite -${(rnd(i * 2 + seed) * 2).toFixed(2)}s`, rect(x, y, 1, 1, 'w'))
  }).join('')

const palm = (x: number) =>
  rect(x, 4, 2, 14, 'b') + rect(x, 6, 2, 1, 'B') + rect(x, 10, 2, 1, 'B') + spr(['.nnn.nnn.', 'nnNnnnNnn', 'n..nNn..n', '...yny...'], x - 3, 1)

// ---------- idle: sweeping, walking, phone, chatting, reading ----------

function idle(f: Frame): string {
  const sweeping = () =>
    clawd(f, 60, 10, { bob: 'bob 1.2s step-end infinite' }) +
    f.g('sweep .6s step-end infinite', rect(76, 4, 1, 11, 't') + rect(75, 14, 4, 1, 'B') + spr(['YYYYY', 'YyYyY', 'Y.Y.Y'], 74, 15)) +
    [0, 0.4, 0.8].map((d, i) => f.g(`dust 1.2s linear infinite ${-d}s`, rect(0, 0, 1 + (i % 2), 1, 'g'), 73, 16 - i)).join('') +
    sparkle(f, 86, 3, 0) + sparkle(f, 92, 9, 0.6) + sparkle(f, 83, 12, 1.1) +
    f.g('tw 1.2s step-end infinite -.3s', spr(['yyy', '.y.']), 90, 1)

  const walking = () => {
    const butterfly = f.g('on .3s step-end infinite', spr(['v.v', '.k.'])) + f.g('off .3s step-end infinite', spr(['...', 'vkv']))
    return (
      f.g('walk 8s steps(18) infinite', clawd(f, 70, 10, { walk: true, eyes: 'look' })) +
      f.g('walk 8s steps(18) infinite -.5s', f.g('bob .9s step-end infinite', butterfly), 82, 4)
    )
  }

  const phone = () =>
    clawd(f, 66, 10, { eyes: 'down', bob: 'bob 2.4s step-end infinite' }) +
    spr(['KKKK', 'KccK', 'KccK', 'KccK', 'KKKK'], 62, 9) +
    f.g('on .6s step-end infinite', rect(63, 10, 2, 1, 'w') + rect(63, 12, 1, 1, 'w')) +
    f.g('off .6s step-end infinite', rect(63, 11, 2, 1, 'w') + rect(64, 13, 1, 1, 'w')) +
    f.g('rise 2.4s linear infinite', spr(['p.p', 'ppp', '.p.']), 60, 6) +
    f.g('rise 2.4s linear infinite -1.2s', spr(['y', 'y', '.', 'y']), 64, 5) +
    f.g('rise 2.4s linear infinite -.6s', spr(['nnn', 'n.n', 'nnn']), 56, 7)

  const chatting = () =>
    clawd(f, 40, 10, { eyes: 'lookR', bob: 'bob .6s step-end infinite', armR: 'wave 1.2s step-end infinite' }) +
    clawd(f, 64, 10, { eyes: 'lookL', bob: 'bob .6s step-end infinite -.3s', armL: 'wave 1.2s step-end infinite -.6s' }) +
    f.g('on 2.4s step-end infinite', spr(['.wwwwwww.', 'wwwwwwwww', 'wwKwKwKww', 'wwwwwwwww', '.wwwwwww.', '..ww.....', '..w......'], 48, 1)) +
    f.g('off 2.4s step-end infinite', spr(['.wwwwwww.', 'wwwpwpwww', 'wwwpppwww', 'wwwwpwwww', '.wwwwwww.', '.....ww..', '......w..'], 60, 1)) +
    f.g('tw 4.8s step-end infinite -2s', spr(['y.y', '.y.', 'y.y']), 58, 9)

  const reading = () =>
    clawd(f, 64, 10, { eyes: 'down', bob: 'bob 3s step-end infinite' }) +
    spr(['UwwwwUwwwwU', 'UwgggUwgggU', 'UwwwwUwwwwU', 'UwgggUwggwU', 'UUUUUUUUUUU'], 55, 11) +
    f.g('flip 3s step-end infinite', spr(['wwww', 'wggw', 'wwww', 'wgww']), 61, 11) +
    f.g('tw 3s step-end infinite -1s', spr(['.y.', 'yyy', 'yyy', '.w.']), 80, 3)

  return f.cycle([sweeping, walking, phone, chatting, reading], 40)
}

// ---------- working: laptop, papers, delegating, boxes, office, analysis ----------

function working(f: Frame): string {
  const typing = () => {
    const lines = [4, 6, 3, 5]
      .map((w, i) => f.g(`grow 1.6s steps(${w}) infinite ${-i * 0.4}s`, rect(54, 9 + i, w, 1, i % 2 ? 'c' : 'n'), 0, 0, [54, 9 + i]))
      .join('')
    const laptop = f.g('pull 6s steps(3) infinite', rect(52, 8, 10, 6, 'L') + rect(53, 8, 8, 5, 'k') + unflip(53, 8, lines) + rect(50, 14, 14, 1, 'l') + rect(51, 15, 12, 1, 'L'))
    const bits = [0, 0.5, 1, 1.5].map((d, i) => f.g(`rise 2s linear infinite ${-d}s`, i % 2 ? spr(['n', 'n', 'n']) : spr(['nn', 'nn', 'nn']), 54 + i * 2, 6)).join('')
    return laptop + bits + clawd(f, 64, 10, { eyes: 'focus', bob: 'bob .6s step-end infinite', armL: 'bob .3s step-end infinite', armR: 'bob .3s step-end infinite -.15s' })
  }

  const papers = () => {
    const sheet = spr(['PPP', 'PgP', 'PPP', 'PgP'])
    return (
      spr(['PPPPPP', 'PggggP', 'PPPPPP', 'PgggPP', 'PPPPPP', 'PggggP'], 50, 12) +
      [0, 0.5, 1].map(d => f.g(`fly 1.5s steps(7) infinite ${-d}s`, sheet, 52, 10)).join('') +
      clawd(f, 66, 10, { eyes: 'scan' }) +
      f.g('bob 1.2s step-end infinite', spr(['PPPP', 'PggP', 'PPPP', 'PgPP', 'PPPP']), 63, 11) +
      f.g('tw 2s step-end infinite', spr(['y', 'y', '.', 'y']), 72, 5)
    )
  }

  const delegate = () => {
    const box = rect(2, -2, 4, 2, 'b') + rect(3, -2, 2, 1, 'Y')
    const doc = rect(2, -3, 3, 3, 'P') + rect(3, -2, 1, 1, 'g')
    return (
      clawd(f, 74, 10, { armLUp: true, armL: 'wave .6s step-end infinite' }) +
      spr(BANG, 66, 2) +
      [0, 2, 4].map((d, i) => f.g(`dispatch 6s steps(24) infinite ${-d}s`, mini(f, 0, 0, i === 1 ? doc : box), 66, 13)).join('')
    )
  }

  const boxes = () =>
    spr(BOX, 32, 14) + spr(BOX, 38, 14) + spr(BOX, 35, 10) + spr(BOX, 86, 14) + spr(BOX, 92, 14) +
    f.g('off 6s step-end infinite', spr(BOX, 41, 10)) +
    f.g('carry 6s steps(24) infinite',
      clawd(f, 66, 10, { walk: true, armLUp: true, armRUp: true, extra: f.g('on 6s step-end infinite', spr(BOX, 5, -4)) }))

  const office = () =>
    [28, 43, 58].map((x, i) =>
      f.g(`bob .3s step-end infinite ${-i * 0.15}s`, mini(f, x, 13, '', false)) +
      spr(['LLLLL', 'LkkkL', 'LkkkL', 'LLLLL', '..L..'], x + 8, 9) +
      f.g(`on .6s step-end infinite ${-i * 0.3}s`, rect(x + 9, 10, 2, 1, 'n') + rect(x + 9, 11, 3, 1, 'c')) +
      f.g(`off .6s step-end infinite ${-i * 0.3}s`, rect(x + 9, 10, 3, 1, 'c') + rect(x + 10, 11, 2, 1, 'n')) +
      rect(x + 7, 14, 7, 1, 'b') + rect(x + 8, 15, 1, 3, 'B') + rect(x + 12, 15, 1, 3, 'B'),
    ).join('') +
    f.g('pace 4s steps(6) infinite', clawd(f, 80, 10, { walk: true, armLUp: true, armL: 'wave .6s step-end infinite' })) +
    f.g('tw 2s step-end infinite', spr(BANG), 86, 1)

  const analyze = () =>
    rect(36, 2, 22, 13, 'L') + rect(37, 3, 20, 11, 'k') + rect(45, 15, 4, 2, 'L') + rect(42, 17, 10, 1, 'L') +
    unflip(37, 20, [2, 5, 3, 7, 4, 8]
      .map((h, i) => f.g(`growY 3s steps(${h}) infinite ${-i * 0.3}s`, rect(39 + i * 3, 13 - h, 2, h, i % 2 ? 'c' : 'n'), 0, 0, [40 + i * 3, 13]))
      .join('')) +
    clawd(f, 68, 10, { eyes: 'focus', armLUp: true }) +
    f.g('magscan 5s steps(10) infinite', spr(['.lll...', 'lcccl..', 'lcccl..', 'lcccl..', '.lllb..', '....bb.', '.....bb']), 58, 5) +
    f.g('tw 5s step-end infinite', unflip(0, 3, spr(['www', '..w', '.ww', '...', '.w.'])), 78, 1)

  return f.cycle([typing, papers, delegate, boxes, office, analyze], 36)
}

// ---------- task complete: one burst of confetti, jumping and dancing ----------

export const DONE_SECONDS = 6.5

function done(f: Frame): string {
  const colors = ['r', 'y', 'c', 'n', 'p', 'v', 'f', 'u']
  let confetti = ''
  for (let i = 0; i < 34; i++) {
    const x = 26 + Math.floor(rnd(i * 3.7) * 72)
    const dur = (1.6 + rnd(i * 5.1) * 1.2).toFixed(2)
    const d = (rnd(i * 9.3) * 1.2).toFixed(2)
    const c = colors[i % colors.length]
    const piece =
      f.g(`on ${(0.3 + Math.round(rnd(i) * 2) * 0.15).toFixed(2)}s step-end infinite`, rnd(i) > 0.5 ? rect(0, 0, 1, 2, c) : rect(0, 0, 2, 1, c)) +
      f.g(`off ${(0.3 + Math.round(rnd(i) * 2) * 0.15).toFixed(2)}s step-end infinite`, rect(0, 0, 1, 1, colors[(i + 3) % colors.length]))
    confetti += f.g(`fall ${dur}s steps(12) ${d}s 2 both`, piece, x, 0)
  }
  return (
    confetti +
    f.g('dance 2.4s step-end 0s 2 forwards', clawd(f, 66, 10, { eyes: 'happy', armL: 'wave .3s step-end infinite', armR: 'wave .3s step-end infinite -.15s', walk: true })) +
    f.g('hop .6s step-end 0s 9', mini(f, 52, 13, '', false)) +
    f.g('hop .6s step-end -.3s 9', mini(f, 86, 13, '', false)) +
    sparkle(f, 60, 2, 0, 0.9) + sparkle(f, 88, 4, 0.45, 0.9) + sparkle(f, 46, 6, 0.3, 0.9)
  )
}

// ---------- relaxing: sunset chair, fishing, hammock, campfire, barbecue, sunset drive ----------

function relax(f: Frame): string {
  const sunset = () =>
    backdrop([['s', 3], ['m', 3], ['d', 3], ['f', 3], ['U', 3], ['t', 3]]) +
    f.g('sink 8s steps(3) infinite', spr(SUN), 76, 7) +
    rect(34, 12, 66, 3, 'U') +
    [0, 0.4, 0.8, 1.2].map((d, i) => f.g(`tw 1.6s step-end infinite ${-d}s`, rect(0, 0, 2 + (i % 2), 1, 'h'), 72 + i * 4, 12 + (i % 3))).join('') +
    f.g('drift 16s linear infinite', spr(['K.K', '.K.']) + spr(['K.K', '.K.'], 5, 2), 96, 2) +
    spr(['r......', 'wr.....', 'rwr....', 'wrwrwrw', 'b.....b', 'b.....b'], 46, 10) +
    clawd(f, 46, 8, { eyes: 'shades', bob: 'bob 3s step-end infinite' }) +
    spr(['..p..', '.ppp.', '..t..', 'cccc.', 'cccc.', '.cc..'], 63, 10) +
    f.g('riseR 3s linear infinite', unflip(0, 3, spr(['.ww', '.w.', 'ww.'])), 58, 5) +
    f.g('riseR 3s linear infinite -1.5s', unflip(0, 2, spr(['ww', 'w.', 'w.'])), 52, 5)

  const fishing = () =>
    backdrop([['V', 4], ['s', 4], ['V', 3], ['U', 7]]) +
    stars(f, 14, 3) +
    spr(['.ww.', 'wwww', 'wwww', '.ww.'], 90, 1) +
    [0, 1, 2].map(i => f.g(`tw 2s step-end infinite ${-i * 0.6}s`, rect(0, 0, 3, 1, 'u'), 40 + i * 15, 13 + i)).join('') +
    rect(38, 10, 26, 2, 'b') + rect(38, 10, 26, 1, 't') + rect(40, 12, 1, 6, 'B') + rect(60, 12, 1, 6, 'B') +
    clawd(f, 46, 4, { eyes: 'closed', bob: 'bob 3s step-end infinite' }) +
    spr(['.......t', '......t.', '.....t..', '....t...', '...t....', '..t.....', '.t......'], 60, 0) +
    rect(68, 1, 1, 12, 'g') +
    f.g('bob 1.2s step-end infinite', rect(67, 12, 3, 1, 'r') + rect(67, 13, 3, 1, 'w')) +
    f.g('leap 8s steps(10) infinite', spr(['.uu.u', 'uuuuu', '.uu.u']), 86, 13)

  const hammockScene = () => {
    // The hammock sags between the palms: tied high at the trunks, lowest in the middle.
    let hammock = ''
    for (let x = 48; x <= 82; x++) {
      const t = (x - 65) / 17
      hammock += rect(x, Math.round(9 + 4 * (1 - t * t)), 1, 1, x % 3 ? 'w' : 'r')
    }
    return (
      backdrop([['C', 11], ['c', 2], ['t', 5]]) +
      palm(46) + palm(83) +
      f.g('swing 3s step-end infinite', clawd(f, 57, 7, { eyes: 'closed', sit: true }) + hammock) +
      f.g('riseR 3s linear infinite', spr(['www', '.w.', 'www']), 70, 2) +
      f.g('riseR 3s linear infinite -1.5s', spr(['ww', 'ww']), 74, 3)
    )
  }

  const campfire = () =>
    backdrop([['V', 5], ['s', 5], ['m', 2], ['N', 6]]) +
    stars(f, 12, 11) +
    f.g('on .3s step-end infinite', spr(['..r...', '.rfr..', '.rfyr.', 'rfyyfr']), 70, 10) +
    f.g('off .3s step-end infinite', spr(['...r..', '..rfr.', '.ryfr.', 'rfyyfr']), 70, 10) +
    spr(['BB..BB', '.BBBB.', 'BB..BB'], 70, 14) +
    [0, 0.7, 1.4].map((d, i) => f.g(`rise 2.1s linear infinite ${-d}s`, rect(0, 0, 1, 1, 'h'), 71 + i * 2, 8)).join('') +
    f.g('on .6s step-end infinite', rect(64, 16, 18, 1, 'O')) +
    rect(46, 15, 14, 3, 'B') +
    clawd(f, 47, 9, { eyes: 'closed', bob: 'bob 3.6s step-end infinite' }) +
    spr(['www.', 'wwwP', 'www.'], 61, 12) +
    f.g('rise 2.4s linear infinite', spr(['g', '.', 'g']), 62, 9) +
    f.g('rise 2.4s linear infinite -1.2s', spr(['g', 'g']), 63, 9)

  const barbecue = () => {
    let fence = ''
    for (let x = 2; x < W + PAD_X; x += 3) fence += rect(x, 7, 2, 6, 'w')
    return (
      backdrop([['C', 13], ['n', 2], ['N', 3]]) +
      fence + rect(0, 9, W + PAD_X, 1, 'w') +
      spr(['KKKKKKKKKKKK', '.GGGGGGGGGG.', '..GGGGGGGG..', '...G....G...', '...G....G...', '..GG....GG..'], 46, 11) +
      f.g('on .6s step-end infinite', rect(49, 12, 6, 1, 'd') + rect(56, 12, 1, 1, 'f')) +
      f.g('off .6s step-end infinite', rect(48, 12, 2, 1, 'f') + rect(51, 12, 6, 1, 'd')) +
      f.g('flipfood 2s steps(4) infinite', rect(47, 10, 3, 1, 'B')) +
      rect(51, 10, 3, 1, 'r') +
      f.g('flipfood 2s steps(4) infinite -1s', rect(55, 10, 2, 1, 'B')) +
      [0, 0.8, 1.6].map((d, i) => f.g(`rise 2.4s linear infinite ${-d}s`, spr(['g.', '.g']), 48 + i * 3, 6)).join('') +
      clawd(f, 64, 10, { eyes: 'happy', extra: spr(['.wwwwww.', 'wwwwwwww', '.wwwwww.'], 4, -3) }) +
      f.g('wave .6s step-end infinite', rect(60, 11, 4, 1, 't') + rect(58, 10, 2, 2, 'l'))
    )
  }

  const drive = () => {
    const palmSmall = rect(0, 4, 1, 8, 'B') + spr(['.N.N.', 'NNNNN', 'N.N.N'], -2, 2)
    let dashes = ''
    for (let x = 0; x < W + PAD_X + 8; x += 8) dashes += rect(x, 16, 4, 1, 'y')
    const car = spr([
      '.................c....',
      '.................c....',
      'rrrrrrrrrrrrrrrrrrrrrr',
      'rrrrrrrrrrrrrrrrrrrrhh',
      'RRRRRRRRRRRRRRRRRRRRRR',
    ])
    const wheels =
      spr(['.KKK............KKK...', '.KKK............KKK...'], 0, 5) +
      f.g('on .3s step-end infinite', rect(2, 5, 1, 1, 'g') + rect(18, 5, 1, 1, 'g')) +
      f.g('off .3s step-end infinite', rect(2, 6, 1, 1, 'g') + rect(18, 6, 1, 1, 'g'))
    return (
      backdrop([['s', 3], ['m', 3], ['d', 3], ['f', 3], ['N', 2], ['G', 4]]) +
      spr(SUN, 74, 8) + rect(34, 12, 66, 2, 'N') + rect(34, 14, 66, 4, 'G') +
      f.g('dash .6s steps(4) infinite', dashes) +
      f.g('zoom 2.4s steps(24) infinite', palmSmall, 100, 0) +
      f.g('zoom 2.4s steps(24) infinite -1.2s', palmSmall, 100, 0) +
      f.g('drift 16s linear infinite', spr(['K.K', '.K.']), 96, 2) +
      f.g('bob .6s step-end infinite', clawd(f, 48, 6, { eyes: 'shades', sit: true, armRUp: true, armR: 'wave 1.2s step-end infinite' }) + `<g transform="translate(46 9)">${car}${wheels}</g>`) +
      [0, 0.3].map(d => f.g(`dust .6s linear infinite ${-d}s`, rect(0, 0, 2, 1, 'g'), 45, 13)).join('')
    )
  }

  return f.cycle([sunset, fishing, hammockScene, campfire, barbecue, drive], 48)
}

// ---------- native portrait scenes ----------
//
// A native scene is composed for the portrait frame itself: nothing is mirrored or
// cropped. It draws in core coordinates, 48 columns by 18 rows (x 0..47, y 0..17: what
// the inline cut shows), and may fill the padding the bleed cut adds, x from -6 and y
// from -4 to 21, with background only. The crab and every prop stay in columns 1..31;
// columns 32..47 lie under the fade. `draw(t)` gets seconds into the loop, 0 <= t < loop,
// and every part repeats in a whole fraction of the loop, so the loop point never jumps.
type NativeScene = { loop: number; draw: (t: number) => string }

const FULL_X = -PAD_COLS
const FULL_Y = -PAD_ROWS
const FULL_W = PORTRAIT_COLS + PAD_COLS
const FULL_H = H + 2 * PAD_ROWS

// A rect at part opacity (a fading spark, a dim star).
const rectO = (x: number, y: number, w: number, h: number, c: string, o: number) =>
  o >= 1 ? rect(x, y, w, h, c) : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill(c)}" fill-opacity="${o}"/>`
// Seconds into a cycle of `period` that began `offset` seconds before the loop did.
const into = (t: number, period: number, offset = 0) => (((t + offset) % period) + period) % period
// True during any of the [start, end) spans, in seconds.
const during = (t: number, spans: [number, number][]) => spans.some(([a, b]) => t >= a && t < b)

// Horizontal colour bands over the whole padded picture: heights are core rows from the
// top; the first band runs on upward and the last downward.
function backdropFull(bands: [string, number][]): string {
  let out = ''
  let y = 0
  bands.forEach(([c, h], i) => {
    const top = i === 0 ? FULL_Y : y
    const bottom = i === bands.length - 1 ? FULL_Y + FULL_H : y + h
    out += rect(FULL_X, top, FULL_W, bottom - top, c)
    y += h
  })
  return out
}

// The dotted field of the dark scenes over the whole padded picture; a few dots twinkle
// on a 3 s cycle, each from its own moment.
function dotsFull(t: number): string {
  let out = ''
  for (let x = FULL_X; x < FULL_X + FULL_W; x += 2) {
    for (let y = FULL_Y + 1; y < FULL_Y + FULL_H; y += 2) {
      const r = rnd(x * 31 + y + 400)
      if (r >= DOT_DENSITY) continue
      if (r < DOT_DENSITY * 0.2) {
        const at = into(t, 3, rnd(x * y + 7) * 3)
        out += rect(x, y, 1, 1, at < 0.9 ? '#555' : at < 1.2 || at > 2.7 ? '#3c3c3c' : '#2c2c2c')
      } else out += rect(x, y, 1, 1, r < DOT_DENSITY * 0.45 ? '#3c3c3c' : '#2c2c2c')
    }
  }
  return out
}

// The mascot for native scenes, the same 16x8 sprite as clawd: `look` shifts the eyes a
// cell toward a prop (-1 left, 1 right), `blink` closes them, `lift` raises the body a
// cell on legs that stay planted, `armL`/`armR` lower that arm by cells.
function crab(x: number, y: number, o: { look?: number; blink?: boolean; lift?: boolean; armL?: number; armR?: number } = {}): string {
  const up = o.lift ? -1 : 0
  const eye = (ex: number) => (o.blink ? rect(ex, 2 + up, 1, 1, 'e') : rect(ex, 1 + up, 1, 2, 'e'))
  const legs = [3, 5, 10, 12].map(lx => rect(lx, 6 + up, 1, 2 - up, 'o')).join('')
  const body = rect(2, up, 12, 6, 'o') + rect(2, 5 + up, 12, 1, 'O')
  const arms = rect(0, 2 + up + (o.armL ?? 0), 2, 2, 'o') + rect(14, 2 + up + (o.armR ?? 0), 2, 2, 'o')
  return `<g transform="translate(${x} ${y})">${legs}${body}${arms}${eye(4 + (o.look ?? 0))}${eye(11 + (o.look ?? 0))}</g>`
}

// Typing at a low desk: lines of code type in left to right and scroll, the crab taps,
// bobs now and then and blinks, green squares rise off the laptop.
const typingP: NativeScene = {
  loop: 6,
  draw(t) {
    // Eight lines, one every 0.75 s: [indent, length, color]. The screen shows three, a
    // blank row between them. A new line first scrolls the others up (one row, then the
    // next, 100 ms apart), then types a cell every 100 ms, then rests with its cursor.
    const LINES: [number, number, string][] = [[0, 5, 'c'], [1, 4, 'n'], [1, 3, 'C'], [0, 2, 'y'], [0, 6, 'n'], [1, 5, 'c'], [2, 3, 'C'], [0, 4, 'n']]
    const line = (i: number) => LINES[((i % LINES.length) + LINES.length) % LINES.length] as [number, number, string]
    const current = Math.floor(t / 0.75 + 1e-6)
    const at = into(t, 0.75)
    const scrolling = at < 0.1 - 1e-6
    const typed = scrolling ? 0 : Math.floor((at - 0.1) / 0.1 + 1e-6) + 1
    const [indent, length, color] = line(current)
    const shown = Math.min(length, typed)
    const older = (i: number, row: number) => rect(20 + line(i)[0], row, line(i)[1], 1, line(i)[2])
    let code = scrolling ? older(current - 2, 8) + older(current - 1, 10) : older(current - 2, 7) + older(current - 1, 9) + rect(20 + indent, 11, shown, 1, color)
    // The cursor, one cell past what is typed, blinking once the line rests.
    if (!scrolling && (typed <= length || into(at, 0.2) < 0.1)) code += rect(20 + indent + shown, 11, 1, 1, 'l')
    const typing = !scrolling && typed <= length
    const laptop = rect(19, 6, 9, 7, 'L') + rect(20, 7, 7, 5, 'k') + code + rect(17, 13, 13, 1, 'l') + rect(17, 13, 1, 1, 'L') + rect(29, 13, 1, 1, 'L')
    const desk = rect(15, 14, 17, 1, 't') + rect(16, 15, 1, 2, 'B') + rect(30, 15, 1, 2, 'B')
    // Three squares, each on its own 2 s cycle: up a cell every 300 ms, thinning out, gone.
    const bits = ([[22, 0, 'n'], [25, 0.7, 'N'], [23, 1.3, 'n']] as [number, number, string][])
      .map(([bx, offset, c], i) => {
        const at = into(t, 2, offset)
        if (at >= 1.5) return ''
        const step = Math.floor(at / 0.3 + 1e-6)
        return rectO(bx + (step > 2 && i % 2 ? 1 : 0), 4 - step, 1, 1, c, step < 2 ? 1 : step < 4 ? 0.65 : 0.35)
      })
      .join('')
    const me = crab(1, 9, {
      look: 1,
      blink: during(t, [[2.6, 2.8], [5.3, 5.5]]),
      lift: during(t, [[1.9, 2.2], [4.7, 5.0]]),
      armR: typing && into(t, 0.3, 0.05) < 0.15 ? 1 : 0,
      armL: typing && into(t, 0.5, 0.2) < 0.1 ? 1 : 0,
    })
    return dotsFull(t) + desk + laptop + bits + me
  },
}

// A night by the fire: the flame flickers, sparks rise, the marshmallow browns and is
// swapped for a fresh one, stars twinkle slowly, the crab blinks.
const campfireP: NativeScene = {
  loop: 8,
  draw(t) {
    const sky = backdropFull([['#16295f', 9], ['s', 5], ['m', 1], ['N', 3]])
    // Stars over the left two thirds: [x, y, cycle seconds, offset]; each dims for a while.
    const stars = ([[-3, -1, 8, 0], [2, 3, 4, 1.3], [8, 0, 8, 2.9], [13, 5, 8, 5.2], [19, -1, 4, 3.1], [24, 2, 8, 6.4], [29, 6, 4, 0.6], [6, 6, 8, 4.1], [17, 3, 8, 7.3], [27, -2, 4, 2.2]] as [number, number, number, number][])
      .map(([sx, sy, period, offset]) => {
        const at = into(t, period, offset)
        return rectO(sx, sy, 1, 1, 'w', at < 0.4 ? 0.7 : at < 1.1 ? 0.4 : at < 1.5 ? 0.7 : 1)
      })
      .join('')
    // Four flame shapes on an uneven 1.6 s round, so no two changes fall the same way.
    const FLAMES = [
      ['..d...', '.ff...', '.fyf..', 'ffyyf.'],
      ['...d..', '..ff..', '.fyyf.', '.fyyff'],
      ['..d...', '..fff.', '.fyyf.', 'ffyyf.'],
      ['......', '..df..', '.fyff.', '.fyyf.'],
    ]
    const ROUND: [number, number][] = [[0, 0.2], [1, 0.1], [2, 0.3], [3, 0.2], [1, 0.2], [0, 0.1], [2, 0.2], [3, 0.3]]
    let left = into(t, 1.6)
    let shape = 0
    for (const [i, span] of ROUND) {
      shape = i
      if (left < span) break
      left -= span
    }
    const fire = spr(FLAMES[shape] as string[], 6, 10) + spr(['BB..BB', '.BBBB.', 'BB..BB'], 6, 14) + rect(8, 14, 2, 1, 'y')
    // Sparks: [x, cycle, offset]. Up a cell every 200 ms, drifting once, fading out.
    const sparks = ([[8, 2, 0.3], [9, 4, 2.5]] as [number, number, number][])
      .map(([sx, period, offset]) => {
        const at = into(t, period, offset)
        if (at >= 1.2) return ''
        const step = Math.floor(at / 0.2 + 1e-6)
        return rectO(sx + (step > 2 ? 1 : 0), 9 - step, 1, 1, step < 3 ? 'f' : 'd', step < 2 ? 1 : step < 4 ? 0.7 : 0.4)
      })
      .join('')
    // The marshmallow browns in small steps, the side toward the fire first; at 5 s the
    // crab turns it over; at 7.4 s it is taken off the stick (the crab perks up) and a
    // fresh one is on from 7.7 s. [from second, top color, bottom color].
    const TOAST: [number, string, string][] = [[0, 'w', 'w'], [1.4, 'w', '#ecdcc0'], [2.7, '#ecdcc0', '#dfc299'], [3.9, '#ecdcc0', '#d2a877'], [5.0, '#d2a877', '#ecdcc0'], [6.1, '#d2a877', '#dfc299'], [6.8, '#d2a877', '#d2a877']]
    const [, top, bottom] = TOAST.filter(([from]) => t >= from).pop() as [number, string, string]
    const stick = rect(14, 10, 1, 1, 't') + rect(15, 11, 1, 1, 'b') + (during(t, [[7.4, 7.7]]) ? '' : rect(12, 9, 2, 1, top) + rect(12, 10, 2, 1, bottom))
    const me = crab(16, 9, { look: -1, blink: during(t, [[3.1, 3.3], [6.6, 6.8]]), lift: during(t, [[7.4, 7.7]]) })
    return sky + stars + fire + sparks + me + stick
  },
}

// The fade: band-colored pixels over the finished scene, denser toward the right edge
// by an ordered 4x4 Bayer threshold until the last column is solid. Built once, so it
// is the same on every frame and never shimmers.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]
const FADE = (() => {
  const x0 = VIEW_COLS - FADE_COLUMNS
  if (GRADIENT_FADE) {
    return (
      `<defs><linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">` +
      `<stop offset="0" stop-color="${BAND_BG}" stop-opacity="0"/><stop offset="1" stop-color="${BAND_BG}" stop-opacity="1"/>` +
      `</linearGradient></defs>` +
      `<rect x="${x0}" y="${-PAD_Y}" width="${FADE_COLUMNS}" height="${H + 2 * PAD_Y}" fill="url(#fade)"/>`
    )
  }
  let px = ''
  for (let k = 0; k < FADE_COLUMNS; k++) {
    const x = x0 + k
    const level = (16 * (k + 1)) / FADE_COLUMNS
    for (let y = -PAD_Y; y < H + PAD_Y; y++) {
      if (((BAYER[((y % 4) + 4) % 4] as number[])[x % 4] as number) < level) px += `<rect x="${x}" y="${y}" width="1" height="1" fill="${BAND_BG}"/>`
    }
  }
  return px
})()

// The picture comes in two cuts. 'bleed' is the padded one the band clips on three
// sides; its own outline follows the band's left edge and rounded corners, measured
// in the desktop app in CSS pixels of the 216x104 output (one-row band): the band's
// left edge at x = EDGE_LEFT, its top at y = EDGE_TOP, its bottom at y = EDGE_BOTTOM,
// its corners of radius CORNER_RADIUS. 'inline' is the scene without padding, for
// normal flow, all four corners rounded at INLINE_RADIUS.
export type SceneVariant = 'bleed' | 'inline'
const EDGE_LEFT = 8
const EDGE_TOP = 8.5
const EDGE_BOTTOM = 101.5
const CORNER_RADIUS = 10
const INLINE_RADIUS = 6

const svgOpen = (x: number, y: number, w: number, h: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w * SCALE}" height="${h * SCALE}" shape-rendering="crispEdges">`
// The clip shapes. The bleed one is written in output pixels and scaled into the grid.
const BLEED_CLIP = (() => {
  const [L, T, B, r] = [EDGE_LEFT, EDGE_TOP, EDGE_BOTTOM, CORNER_RADIUS]
  const d = `M${L + r},${T} H${(VIEW_COLS + PAD_X) * SCALE} V${B} H${L + r} A${r} ${r} 0 0 1 ${L},${B - r} V${T + r} A${r} ${r} 0 0 1 ${L + r},${T} Z`
  return `<path transform="translate(${-PAD_X} ${-PAD_Y}) scale(${1 / SCALE})" d="${d}" shape-rendering="geometricPrecision"/>`
})()
const INLINE_CLIP = `<rect x="0" y="0" width="${VIEW_COLS}" height="${H}" rx="${INLINE_RADIUS / SCALE}" shape-rendering="geometricPrecision"/>`

// One still frame of `mood`, `t` seconds after it began. The art was composed for the
// right end of the band, so the whole scene is mirrored to sit against the left edge;
// the fade is laid over it unmirrored. `seed` is fixed for one entry
// into the mood (its timestamp) and picks the order its scenes play in.
export function sceneSvg(mood: Mood, t: number, seed = 0, variant: SceneVariant = 'bleed'): string {
  if (CALIBRATE && variant === 'bleed') return CARD
  const ground = `<rect x="${-PAD_X - 2}" y="${-PAD_Y - 2}" width="${W + PAD_X + 4}" height="${H + 2 * PAD_Y + 4}" fill="${BAND_BG}"/>`
  let drawn: string
  if (PILOT && PORTRAIT) {
    // Native scenes: drawn as composed, the time wrapped to the scene's own loop.
    const scene = mood === 'working' || mood === 'idle' ? typingP : campfireP
    drawn = ground + scene.draw(Math.round(into(t, scene.loop) * 1000) / 1000) + FADE
  } else {
    const f = new Frame(t, seed)
    const body = mood === 'working' ? working(f) : mood === 'done' ? done(f) : mood === 'relax' ? relax(f) : idle(f)
    drawn = `${ground}<g transform="translate(${W} 0) scale(-1 1)">${dots(f)}${body}</g>${FADE}`
  }
  if (!PORTRAIT) return `${svgOpen(0, 0, W, H)}${drawn}</svg>`
  const [open, clip] =
    variant === 'bleed' ? [svgOpen(-PAD_X, -PAD_Y, VIEW_COLS + PAD_X, H + 2 * PAD_Y), BLEED_CLIP] : [svgOpen(0, 0, VIEW_COLS, H), INLINE_CLIP]
  return `${open}<defs><clipPath id="edge">${clip}</clipPath></defs><g clip-path="url(#edge)">${drawn}</g></svg>`
}

// The test card, in CSS pixels (1 unit = 1 px): a 1 px line every 8 px, vertical ones
// red at x = 0, 16, 32... and green at x = 8, 24, 40...; horizontal ones blue at
// y = 0, 16, 32... and yellow at y = 8, 24, 40...; 3 px white lines centred on x = 40
// and y = 40 (pixels 39 to 41), and a 3 px magenta line centred on y = 88. No fade.
const CARD = (() => {
  const w = (VIEW_COLS + PAD_X) * SCALE
  const h = (H + 2 * PAD_Y) * SCALE
  const line = (x: number, y: number, lw: number, lh: number, c: string) => `<rect x="${x}" y="${y}" width="${lw}" height="${lh}" fill="${c}"/>`
  let out = line(0, 0, w, h, '#303030')
  for (let x = 0; x < w; x += 8) out += line(x, 0, 1, h, x % 16 ? '#34c759' : '#ff3b30')
  for (let y = 0; y < h; y += 8) out += line(0, y, w, 1, y % 16 ? '#ffd60a' : '#0a84ff')
  out += line(39, 0, 3, h, '#ffffff') + line(0, 39, w, 3, '#ffffff') + line(0, 87, w, 3, '#ff2d95')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">${out}</svg>`
})()

// The picture's size in CSS pixels, and the part of it that is scene, not padding.
export const SCENE_WIDTH = (VIEW_COLS + PAD_X) * SCALE
export const SCENE_HEIGHT = (H + 2 * PAD_Y) * SCALE
export const SCENE_BODY_WIDTH = VIEW_COLS * SCALE
export const SCENE_BODY_HEIGHT = H * SCALE
