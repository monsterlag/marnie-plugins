// The kit for native scenes: everything a scene file needs, and the canvas rules.
//
// - Draw in core coordinates: 48 columns by 18 rows, x 0..47, y 0..17. That is all the
//   inline cut (192x72) shows. The bleed cut (216x104) adds 6 columns on the left and
//   4 rows above and below: x from -6, y from -4 to 21.
// - The crab and every prop stay within columns 1..31. Columns 32..47 are under the
//   fade: background only.
// - The padding only continues what is behind the scene: sky or wall upward, ground
//   downward, background to the left (backdropFull and dotsFull do this).
// - Feet end at row 16 (the crab at y = 9), so the inline cut keeps a row beneath.
// - `draw(t)` gets seconds into the loop, 0 <= t < loop, on a 100 ms tick. Give every
//   moving part a period that divides `loop`, so the loop ends on the frame it starts on.
// - A scene file exports `scenes: NamedScene[]`; hooks/native.ts lists the files. Use
//   `import` declarations only (the loader refuses a module holding `import()`), and
//   nothing from Node: these files run inside the plugin.
// - To look at a scene: npx tsx plugins/pixel-buddy/tools/preview.ts <group|scene> out.svg
//   then, on this Mac, qlmanage -t -s 1800 -o <dir> out.svg and read <dir>/out.svg.png.

// The band's own color, painted behind every scene.
export const BAND_BG = '#212121'

// The core grid, and the padding the bleed cut adds around it.
export const CORE_COLS = 48
export const CORE_ROWS = 18
export const PAD_ROWS = 4
export const PAD_COLS = 6

export const PAL: Record<string, string> = {
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

export const fill = (c: string) => PAL[c] ?? c
export const rect = (x: number, y: number, w: number, h: number, c: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill(c)}"/>`

// An ASCII sprite: one char per pixel, '.' is transparent; runs merge into one rect.
export function spr(rows: string[], x = 0, y = 0): string {
  let out = ''
  rows.forEach((row, j) => {
    let i = 0
    while (i < row.length) {
      const c = row[i] as string
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
export const rnd = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

// The share of the dotted field's cells that hold a dot, the same across the width.
export const DOT_DENSITY = 0.25

// The whole padded picture, in core coordinates.
export type NativeScene = { loop: number; draw: (t: number) => string }
// A scene as a group file lists it; `name` is what the preview tool and events ask for.
export type NamedScene = { name: string; scene: NativeScene }

export const FULL_X = -PAD_COLS
export const FULL_Y = -PAD_ROWS
export const FULL_W = CORE_COLS + PAD_COLS
export const FULL_H = CORE_ROWS + 2 * PAD_ROWS

// A rect at part opacity (a fading spark, a dim star).
export const rectO = (x: number, y: number, w: number, h: number, c: string, o: number) =>
  o >= 1 ? rect(x, y, w, h, c) : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill(c)}" fill-opacity="${o}"/>`
// Seconds into a cycle of `period` that began `offset` seconds before the loop did.
export const into = (t: number, period: number, offset = 0) => (((t + offset) % period) + period) % period
// True during any of the [start, end) spans, in seconds.
export const during = (t: number, spans: [number, number][]) => spans.some(([a, b]) => t >= a && t < b)

// Horizontal colour bands over the whole padded picture: heights are core rows from the
// top; the first band runs on upward and the last downward.
export function backdropFull(bands: [string, number][]): string {
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
export function dotsFull(t: number): string {
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
export function crab(x: number, y: number, o: { look?: number; blink?: boolean; lift?: boolean; armL?: number; armR?: number } = {}): string {
  const up = o.lift ? -1 : 0
  const eye = (ex: number) => (o.blink ? rect(ex, 2 + up, 1, 1, 'e') : rect(ex, 1 + up, 1, 2, 'e'))
  const legs = [3, 5, 10, 12].map(lx => rect(lx, 6 + up, 1, 2 - up, 'o')).join('')
  const body = rect(2, up, 12, 6, 'o') + rect(2, 5 + up, 12, 1, 'O')
  const arms = rect(0, 2 + up + (o.armL ?? 0), 2, 2, 'o') + rect(14, 2 + up + (o.armR ?? 0), 2, 2, 'o')
  return `<g transform="translate(${x} ${y})">${legs}${body}${arms}${eye(4 + (o.look ?? 0))}${eye(11 + (o.look ?? 0))}</g>`
}
