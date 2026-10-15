// The mascot picture: one still SVG frame of a native scene per call, cut for the band.
// The scenes are in the native-*.ts files, the choice of scene in rotation.ts; this
// wraps what a scene draws in the picture's viewBox, outline and fade.

import { BAND_BG, CORE_COLS, CORE_ROWS, PAD_COLS, PAD_ROWS, setDotClock } from './native-kit'
import type { NativeScene } from './native-kit'
import { animatedBody } from './animate'

// Screen pixels per grid pixel.
const SCALE = 4
// The picture's right edge fades into the band over this many grid columns.
const FADE_COLUMNS = 16
// CALIBRATE: sceneSvg returns a ruled test card the size of the bleed picture instead
// of a scene, for reading off a screenshot how much the band hides on each side.
const CALIBRATE: boolean = false

// The picture comes in two cuts. 'bleed' is the padded one the band clips on three
// sides: (48+6)*4 = 216 px by (18+8)*4 = 104 px. Its own outline follows the band's left
// edge and rounded corners, measured in the desktop app in CSS pixels of that output
// (one-row band): the band's left edge at x = EDGE_LEFT, its top at y = EDGE_TOP, its
// bottom at y = EDGE_BOTTOM, its corners of radius CORNER_RADIUS. 'inline' is the scene
// without padding, 192x72, for normal flow, all four corners rounded at INLINE_RADIUS.
export type SceneVariant = 'bleed' | 'inline'
const EDGE_LEFT = 8
const EDGE_TOP = 8.5
const EDGE_BOTTOM = 101.5
const CORNER_RADIUS = 10
const INLINE_RADIUS = 6

// The picture's size in CSS pixels: the bleed cut, and the inline cut (the scene itself).
export const SCENE_WIDTH = (CORE_COLS + PAD_COLS) * SCALE
export const SCENE_HEIGHT = (CORE_ROWS + 2 * PAD_ROWS) * SCALE
export const SCENE_BODY_WIDTH = CORE_COLS * SCALE
export const SCENE_BODY_HEIGHT = CORE_ROWS * SCALE

const svgOpen = (x: number, y: number, w: number, h: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w * SCALE}" height="${h * SCALE}" shape-rendering="crispEdges">`
// The band's color under everything, and the gradient into it over the last columns.
const GROUND = `<rect x="${-PAD_COLS - 2}" y="${-PAD_ROWS - 2}" width="${CORE_COLS + PAD_COLS + 4}" height="${CORE_ROWS + 2 * PAD_ROWS + 4}" fill="${BAND_BG}"/>`
const FADE =
  `<defs><linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">` +
  `<stop offset="0" stop-color="${BAND_BG}" stop-opacity="0"/><stop offset="1" stop-color="${BAND_BG}" stop-opacity="1"/>` +
  `</linearGradient></defs>` +
  `<rect x="${CORE_COLS - FADE_COLUMNS}" y="${-PAD_ROWS}" width="${FADE_COLUMNS}" height="${CORE_ROWS + 2 * PAD_ROWS}" fill="url(#fade)"/>`
// The clip shapes. The bleed one is written in output pixels and scaled into the grid.
const BLEED_CLIP = (() => {
  const [L, T, B, r] = [EDGE_LEFT, EDGE_TOP, EDGE_BOTTOM, CORNER_RADIUS]
  const d = `M${L + r},${T} H${SCENE_WIDTH} V${B} H${L + r} A${r} ${r} 0 0 1 ${L},${B - r} V${T + r} A${r} ${r} 0 0 1 ${L + r},${T} Z`
  return `<path transform="translate(${-PAD_COLS} ${-PAD_ROWS}) scale(${1 / SCALE})" d="${d}" shape-rendering="geometricPrecision"/>`
})()
const INLINE_CLIP = `<rect x="0" y="0" width="${CORE_COLS}" height="${CORE_ROWS}" rx="${INLINE_RADIUS / SCALE}" shape-rendering="geometricPrecision"/>`

// The test card, in CSS pixels (1 unit = 1 px): a 1 px line every 8 px, vertical ones
// red at x = 0, 16, 32... and green at x = 8, 24, 40...; horizontal ones blue at
// y = 0, 16, 32... and yellow at y = 8, 24, 40...; 3 px white lines centred on x = 40
// and y = 40 (pixels 39 to 41), and a 3 px magenta line centred on y = 88. No fade.
const CARD = (() => {
  const [w, h] = [SCENE_WIDTH, SCENE_HEIGHT]
  const line = (x: number, y: number, lw: number, lh: number, c: string) => `<rect x="${x}" y="${y}" width="${lw}" height="${lh}" fill="${c}"/>`
  let out = line(0, 0, w, h, '#303030')
  for (let x = 0; x < w; x += 8) out += line(x, 0, 1, h, x % 16 ? '#34c759' : '#ff3b30')
  for (let y = 0; y < h; y += 8) out += line(0, y, w, 1, y % 16 ? '#ffd60a' : '#0a84ff')
  out += line(39, 0, 3, h, '#ffffff') + line(0, 39, w, 3, '#ffffff') + line(0, 87, w, 3, '#ff2d95')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">${out}</svg>`
})()

const wrap = (variant: SceneVariant, body: string) => {
  const [open, clip] =
    variant === 'bleed'
      ? [svgOpen(-PAD_COLS, -PAD_ROWS, CORE_COLS + PAD_COLS, CORE_ROWS + 2 * PAD_ROWS), BLEED_CLIP]
      : [svgOpen(0, 0, CORE_COLS, CORE_ROWS), INLINE_CLIP]
  return `${open}<defs><clipPath id="edge">${clip}</clipPath></defs><g clip-path="url(#edge)">${GROUND}${body}${FADE}</g></svg>`
}

// One still frame of `scene`, `t` seconds into its loop, in the given cut. `clock` is a
// time in seconds that never restarts (the background dots twinkle on it); left out, the
// loop time stands in, as in the preview tool.
export function sceneSvg(scene: NativeScene, t: number, variant: SceneVariant = 'bleed', clock = t): string {
  if (CALIBRATE && variant === 'bleed') return CARD
  setDotClock(clock)
  const local = Math.round((((t % scene.loop) + scene.loop) % scene.loop) * 1000) / 1000
  return wrap(variant, scene.draw(local))
}

// The most an Svg's markup may hold (the engine's and the desktop's bound).
export const SVG_SOURCE_MAX = 131072
const ANIMATION_STEPS = [0.1, 0.2]

// The whole loop of `scene` as one picture that animates itself, in the given cut: the
// same string for the same scene and cut, so the app keeps playing it across redraws.
// Built once per scene and cut and kept. Sampled on the scenes' 100 ms tick, or every
// 200 ms where that does not fit SVG_SOURCE_MAX; null where neither does. animationStep
// says which step a scene and cut got.
const animated = new Map<NativeScene, Partial<Record<SceneVariant, string | null>>>()
const steps = new Map<NativeScene, Partial<Record<SceneVariant, number>>>()
export const animationStep = (scene: NativeScene, variant: SceneVariant = 'bleed'): number | undefined => {
  animatedSceneSvg(scene, variant)
  return steps.get(scene)?.[variant]
}
export function animatedSceneSvg(scene: NativeScene, variant: SceneVariant = 'bleed'): string | null {
  if (CALIBRATE && variant === 'bleed') return CARD
  const cuts = animated.get(scene) ?? {}
  let svg = cuts[variant]
  if (svg === undefined) {
    svg = null
    for (const step of ANIMATION_STEPS) {
      const built = wrap(variant, animatedBody(scene, step))
      if (built.length <= SVG_SOURCE_MAX) {
        svg = built
        steps.set(scene, { ...steps.get(scene), [variant]: step })
        break
      }
    }
    cuts[variant] = svg
    animated.set(scene, cuts)
  }
  return svg
}
