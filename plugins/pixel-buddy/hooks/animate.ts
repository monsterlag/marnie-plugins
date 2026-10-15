// A whole scene loop as one self-animating SVG body: every frame of the loop, sampled on
// the scenes' 100 ms tick, folded into a static layer and layers that SMIL switches on and
// off. The desktop app (2.37337 and later) keeps an interactive Svg's frame across band
// redraws while its markup is unchanged, so the band sends a scene once and the app plays
// it, instead of being sent a new picture every tick.
//
// How the frames fold: each frame is the list of top-level elements its draw returns. The
// lists are merged, in order, into one sequence in which every frame is a subsequence (an
// element drawn in different orders in different frames appears twice), so painting order
// holds in every frame. Each element of the sequence is then on in some set of frames;
// neighbours on in the same set share one group and one animation. An element on in every
// frame is drawn plainly.

import { setDotMode } from './native-kit'
import type { NativeScene } from './native-kit'

// The scenes' tick, in seconds.
export const STEP = 0.1

// Splits markup into its top-level elements, each with its own closing tag or self-closed.
export function topLevel(markup: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  const tag = /<(\/?)[a-zA-Z][^>]*?(\/?)>/g
  for (let m = tag.exec(markup); m; m = tag.exec(markup)) {
    const closing = m[1] === '/'
    const selfClosing = m[2] === '/'
    if (depth === 0 && !closing) start = m.index
    if (closing) depth--
    else if (!selfClosing) depth++
    if (depth === 0) out.push(markup.slice(start, tag.lastIndex))
    if (depth < 0) throw new Error('unbalanced markup')
  }
  if (depth !== 0) throw new Error('unbalanced markup')
  return out
}

// A plain pixel rect as the kit writes it, with an optional fill-opacity.
const RECT = /^<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="([^"]+)"(?: fill-opacity="([\d.]+)")?\/>$/
const TRANSLATED = /^<g transform="translate\((-?[\d.]+) (-?[\d.]+)\)">(.*)<\/g>$/s

// A group that only moves plain rects (the crab) becomes those rects, moved: the same
// pixels in the same order, and parts that do not change between frames can be shared.
export function flatten(el: string): string[] {
  const m = TRANSLATED.exec(el)
  if (!m) return [el]
  const dx = Number(m[1])
  const dy = Number(m[2])
  const inner = topLevel(m[3] as string)
  const moved: string[] = []
  for (const r of inner) {
    const p = RECT.exec(r)
    if (!p) return [el]
    const op = p[6] === undefined ? '' : ` fill-opacity="${p[6]}"`
    moved.push(`<rect x="${num(Number(p[1]) + dx)}" y="${num(Number(p[2]) + dy)}" width="${p[3]}" height="${p[4]}" fill="${p[5]}"${op}/>`)
  }
  return moved
}

// The frames of one loop: the top-level elements of draw(t) at each `step` seconds.
export function sampleFrames(scene: NativeScene, step = STEP): string[][] {
  const n = Math.max(1, Math.round(scene.loop / step))
  const frames: string[][] = []
  const restore = setDotMode('smil')
  try {
    for (let i = 0; i < n; i++) frames.push(topLevel(scene.draw(Math.round(i * step * 1000) / 1000)).flatMap(flatten))
  } finally {
    setDotMode(restore)
  }
  return frames
}

type Box = { x: number; y: number; w: number; h: number }
type Item = { raw: string; box?: Box } | { key: string; fill: string; opacity?: string; boxes: Box[] }
// The box of an element that starts as a rect (a twinkling dot), for the overlap test.
const RECT_OPEN = /^<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

// Elements drawn in order, written shorter: a plain rect joins the latest path of its
// color when nothing drawn since that path could cover it, so every pixel ends up the
// color it was. Anything that is not a plain rect is kept as it is and blocks merging.
export function compact(elements: string[]): string {
  const items: Item[] = []
  for (const el of elements) {
    const p = RECT.exec(el)
    if (!p) {
      const o = RECT_OPEN.exec(el)
      items.push(o ? { raw: el, box: { x: Number(o[1]), y: Number(o[2]), w: Number(o[3]), h: Number(o[4]) } } : { raw: el })
      continue
    }
    const box = { x: Number(p[1]), y: Number(p[2]), w: Number(p[3]), h: Number(p[4]) }
    const key = `${p[5]}|${p[6] ?? ''}`
    let target: Item | undefined
    for (let k = items.length - 1; k >= 0; k--) {
      const it = items[k] as Item
      if ('raw' in it) {
        if (it.box && !overlaps(it.box, box)) continue
        break
      }
      if (it.key === key) {
        target = it
        break
      }
      if (it.boxes.some(b => overlaps(b, box))) break
    }
    if (target && 'boxes' in target) target.boxes.push(box)
    else items.push({ key, fill: p[5] as string, ...(p[6] === undefined ? {} : { opacity: p[6] }), boxes: [box] })
  }
  return items
    .map(it => {
      if ('raw' in it) return it.raw
      const d = it.boxes.map(b => `M${num(b.x)} ${num(b.y)}h${num(b.w)}v${num(b.h)}h-${num(b.w)}z`).join('')
      return `<path d="${d}" fill="${it.fill}"${it.opacity === undefined ? '' : ` fill-opacity="${it.opacity}"`}/>`
    })
    .join('')
}

type Entry = { el: string; on: boolean[] }

// Merges the frames into one sequence of which each frame is a subsequence.
function merge(frames: string[][]): Entry[] {
  const seq: Entry[] = []
  frames.forEach((frame, f) => {
    let pos = -1
    for (const el of frame) {
      let found = -1
      for (let i = pos + 1; i < seq.length; i++) {
        const s = seq[i] as Entry
        if (s.el === el && !s.on[f]) {
          found = i
          break
        }
      }
      if (found === -1) {
        found = pos + 1
        seq.splice(found, 0, { el, on: frames.map(() => false) })
      }
      ;(seq[found] as Entry).on[f] = true
      pos = found
    }
  })
  return seq
}

const num = (x: number) => String(Math.round(x * 10000) / 10000)

// The SMIL that shows a group in the frames of `on` and hides it in the rest: discrete
// display values at the frames where it changes, over the loop.
function switcher(on: boolean[], loop: number): string {
  const values: string[] = []
  const times: string[] = []
  on.forEach((v, i) => {
    if (i === 0 || v !== on[i - 1]) {
      values.push(v ? 'inline' : 'none')
      times.push(num(i / on.length))
    }
  })
  return `<animate attributeName="display" values="${values.join(';')}" keyTimes="${times.join(';')}" dur="${num(loop)}s" calcMode="discrete" repeatCount="indefinite"/>`
}

// One loop of `scene` as SVG body markup that animates itself, sampled every `step` seconds.
export function animatedBody(scene: NativeScene, step = STEP): string {
  const frames = sampleFrames(scene, step)
  const seq = merge(frames)
  let out = ''
  let i = 0
  while (i < seq.length) {
    const on = (seq[i] as Entry).on
    const key = on.join()
    let j = i
    const run: string[] = []
    while (j < seq.length && (seq[j] as Entry).on.join() === key) run.push((seq[j++] as Entry).el)
    const body = compact(run)
    out += on.every(Boolean) ? body : `<g display="${on[0] ? 'inline' : 'none'}">${switcher(on, scene.loop)}${body}</g>`
    i = j
  }
  return out
}
