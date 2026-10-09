// Writes a contact sheet of native scenes, for looking at them outside the app. Not part
// of the plugin: nothing under hooks/ imports it.
//
//   npx tsx plugins/pixel-buddy/tools/preview.ts <group|scene-name> <out.svg>
//
// <group> is idle, working, done, relax or events; `all` is every scene. Each scene gets 8 frames spread evenly
// over its loop in the bleed cut and 4 in the inline cut, with the time under each. The
// page is square, so a thumbnail shows all of it:
//
//   qlmanage -t -s 1800 -o <dir> <out.svg>     then read <dir>/<out.svg>.png
import { writeFileSync } from 'node:fs'

import { eventScenes, nativeScenes } from '../hooks/native'
import type { NamedScene } from '../hooks/native-kit'
import { SCENE_BODY_HEIGHT, SCENE_BODY_WIDTH, SCENE_HEIGHT, SCENE_WIDTH, sceneSvg } from '../hooks/scene'

const [what, out] = process.argv.slice(2)
const groups: Record<string, NamedScene[]> = { ...nativeScenes, events: Object.values(eventScenes) }
const all = Object.values(groups).flat()
// `waiting` is in both the idle rotation and the events; `all` shows each scene once.
const unique = all.filter((s, i) => all.findIndex(o => o.name === s.name) === i)
const picked = what === 'all' ? unique : what && groups[what] ? groups[what] : unique.filter(s => s.name === what)
if (!what || !out || !picked.length) {
  console.error(`usage: preview.ts <group|scene-name> <out.svg>\ngroups: ${Object.keys(groups).join(', ')}, all\nscenes: ${unique.map(s => s.name).join(', ') || '(none)'}`)
  process.exit(1)
}

const GAP = 8
const LABEL = 16
const PER = 4
const text = (x: number, y: number, s: string, size = 11) =>
  `<text x="${x}" y="${y}" font-family="-apple-system, Helvetica, sans-serif" font-size="${size}" fill="#b8b8b8">${s}</text>`

// One scene's block: a title, two rows of four bleed frames, one row of four inline frames.
const BLOCK_W = PER * (SCENE_WIDTH + GAP)
const BLOCK_H = 20 + 2 * (SCENE_HEIGHT + LABEL + GAP) + (SCENE_BODY_HEIGHT + LABEL + GAP) + GAP
function block({ name, scene }: NamedScene, x0: number, y0: number): string {
  let body = text(x0, y0 + 12, `${name}: ${scene.loop} s loop`, 13)
  let y = y0 + 20
  const cuts: ['bleed' | 'inline', number, number, number][] = [['bleed', 8, SCENE_WIDTH, SCENE_HEIGHT], ['inline', 4, SCENE_BODY_WIDTH, SCENE_BODY_HEIGHT]]
  for (const [variant, n, w, h] of cuts) {
    for (let k = 0; k < n; k++) {
      const t = (k * scene.loop) / n
      const x = x0 + (k % PER) * (SCENE_WIDTH + GAP)
      const yy = y + Math.floor(k / PER) * (h + LABEL + GAP)
      const id = `${name}-${variant}-${k}`
      // Each frame carries the same ids; make them the frame's own within the one page.
      body += sceneSvg(scene, t, variant)
        .replace('<svg ', `<svg x="${x}" y="${yy}" `)
        .replaceAll('id="edge"', `id="edge-${id}"`).replaceAll('url(#edge)', `url(#edge-${id})`)
        .replaceAll('id="fade"', `id="fade-${id}"`).replaceAll('url(#fade)', `url(#fade-${id})`)
      body += text(x, yy + h + 12, `${variant} t=${t.toFixed(2)}s`)
      if (w > SCENE_WIDTH) throw new Error('frame wider than its cell')
    }
    y += Math.ceil(n / PER) * (h + LABEL + GAP)
  }
  return body
}

// As many columns of blocks as bring the page closest to square, then padded to square.
let cols = 1
for (let c = 1; c <= picked.length; c++) {
  const ratio = (n: number) => Math.abs(Math.log((n * BLOCK_W) / (Math.ceil(picked.length / n) * BLOCK_H)))
  if (ratio(c) < ratio(cols)) cols = c
}
const side = GAP + Math.max(cols * BLOCK_W, Math.ceil(picked.length / cols) * BLOCK_H)
const body = picked.map((s, i) => block(s, GAP + (i % cols) * BLOCK_W, GAP + Math.floor(i / cols) * BLOCK_H)).join('')
writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}"><rect width="${side}" height="${side}" fill="#212121"/>${body}</svg>`)
console.log(`${picked.map(s => s.name).join(', ')} -> ${out} (${side}x${side})`)
