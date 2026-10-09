import { crab, dotsFull, during, into, rect, rectO, spr } from './native-kit'
import type { NamedScene, NativeScene } from './native-kit'

// The value of the last row whose time has come: [from second, value], in order.
const step = <T>(t: number, rows: [number, T][]): T => (rows.filter(([from]) => t >= from - 1e-6).pop() ?? rows[0])?.[1] as T
// Whole 100 ms ticks since `from`.
const ticks = (t: number, from: number) => Math.floor((t - from) / 0.1 + 1e-6)

// Compaction: the crab hops onto a tall leaning stack of paper and bounces it down to a
// short tidy one while loose sheets flutter off; it hops down and new sheets fall back
// onto the pile one by one.
const compaction: NativeScene = {
  loop: 9,
  draw(t) {
    // How many sheets the stack holds, bottom sheet on row 16. Down while the crab is on
    // it, up again sheet by sheet from 6.5 s.
    const height = step(t, [[0, 11], [1.4, 10], [1.5, 9], [1.7, 8], [2.4, 7], [3.0, 6], [3.7, 5], [4.3, 4], [4.8, 3], [6.5, 4], [6.7, 5], [6.9, 6], [7.1, 7], [7.3, 8], [7.5, 9], [7.7, 10], [7.9, 11]])
    // Each sheet's lean to the right in the tall stack; pressing squares it up.
    const LEAN = [0, 0, 0, 1, 0, 1, 1, 2, 1, 2, 3]
    const building = t >= 6.4
    const lean = (i: number) => (building ? (LEAN[i] as number) : Math.round(((LEAN[i] as number) * (height - 3)) / 8))
    const sheet = (i: number, row: number, shift = 0) => rect(18 + lean(i) + shift, row, i === 10 ? 8 : 10, 1, i % 2 ? 'w' : 'l')
    // The top of the tall stack sways a cell now and then before the crab jumps.
    const sway = (i: number) => (i >= 9 && during(t, [[0.5, 0.9], [8.3, 8.6]]) ? -1 : 0)
    let stack = ''
    for (let i = 0; i < height; i++) stack += sheet(i, 16 - i, sway(i))
    // A new sheet is two ticks in the air before it lands: five rows up, then two.
    if (building) {
      for (let i = 3; i < 11; i++) {
        const lands = 6.5 + (i - 3) * 0.2
        const left = Math.round((lands - t) * 10)
        if (left === 2 || left === 1) stack += sheet(i, 16 - i - (left === 2 ? 5 : 2))
      }
    }
    // Sheets squeezed out to the left: [from second, x, y, cells per step right, down].
    // A step every 200 ms, the sheet tipping one way then the other, thinning out.
    const loose = ([[1.6, 13, 7, -1.5, -0.6], [1.9, 13, 10, -1, 0.7], [2.4, 13, 8, -1.2, -0.9], [3.7, 13, 11, -1.4, -0.6], [4.3, 13, 12, -1, -1]] as [number, number, number, number, number][])
      .map(([from, x0, y0, vx, vy]) => {
        if (t < from - 1e-6 || t >= from + 1.4 - 1e-6) return ''
        const s = Math.floor((t - from) / 0.2 + 1e-6)
        const x = Math.round(x0 + vx * s)
        const y = Math.min(16, Math.round(y0 + vy * s))
        const o = s < 4 ? 1 : s < 5 ? 0.7 : s < 6 ? 0.45 : 0.25
        if (s % 3 === 0) return rectO(x, y, 4, 1, 'w', o)
        return s % 3 === 1 ? rectO(x, y, 2, 1, 'w', o) + rectO(x + 2, y - 1, 2, 1, 'l', o) : rectO(x, y - 1, 2, 1, 'l', o) + rectO(x + 2, y, 2, 1, 'w', o)
      })
      .join('')
    // The crab: beside the stack, a hop up, standing on it (y follows the height), a hop down.
    const [x, y] = step<[number, number]>(t, [[0, [1, 9]], [1.3, [4, 5]], [1.4, [9, 1]], [1.5, [13, 0]], [1.6, [15, 0]], [1.7, [15, -1]], [6.0, [11, 4]], [6.1, [7, 4]], [6.2, [3, 7]], [6.3, [1, 9]]])
    const on = y === -1
    // On the stack: rise on the legs, then drop with both claws pushing down.
    const windup = during(t, [[2.2, 2.4], [2.8, 3.0], [3.5, 3.7], [4.1, 4.3], [4.6, 4.8]])
    const push = during(t, [[1.7, 1.9], [2.4, 2.6], [3.0, 3.2], [3.7, 3.9], [4.3, 4.5], [4.8, 5.1]]) ? 1 : 0
    const me = crab(x, on ? 9 - height : y, {
      look: on ? (during(t, [[5.0, 5.9]]) ? 0 : -1) : t < 1.3 || t >= 6.3 ? 1 : 0,
      blink: during(t, [[0.8, 1.0], [5.3, 5.5], [7.2, 7.4], [8.7, 8.9]]),
      lift: (on && windup) || during(t, [[1.2, 1.3], [5.9, 6.0]]),
      armL: on ? push : 0,
      armR: on ? push : 0,
    })
    return dotsFull(t) + stack + loose + me
  },
}

// A helper crab, about half the mascot: 8 wide, body on rows y..y+2, feet on y+3. `gait`
// alternates the feet, `hop` raises it a cell, `look` shifts the eyes; it carries a
// parcel on its head, green-topped once the work in it is done.
function helper(x: number, y: number, o: { gait?: number; hop?: boolean; look?: number; done?: boolean } = {}): string {
  const up = o.hop ? -1 : 0
  const feet = o.gait === undefined ? rect(x + 2, y + 3 + up, 1, 1 - up, 'o') + rect(x + 5, y + 3 + up, 1, 1 - up, 'o') : o.gait % 2 ? rect(x + 1, y + 3, 1, 1, 'o') + rect(x + 4, y + 3, 1, 1, 'o') : rect(x + 3, y + 3, 1, 1, 'o') + rect(x + 6, y + 3, 1, 1, 'o')
  const body = spr(['.oooooo.', 'oooooooo', '.OOOOOO.'], x, y + up) + rect(x + 2 + (o.look ?? 0), y + 1 + up, 1, 1, 'e') + rect(x + 5 + (o.look ?? 0), y + 1 + up, 1, 1, 'e')
  const parcel = rect(x + 2, y - 2 + up, 4, 1, o.done ? 'n' : 'w') + rect(x + 2, y - 1 + up, 4, 1, 'l')
  return feet + body + parcel
}

// Subagents: the crab at its desk raises a claw and three helpers scurry off in a line
// with a parcel each; it works at the monitor while they are out, and they come back one
// by one, parcels done.
const subagents: NativeScene = {
  loop: 9,
  draw(t) {
    // Where each helper stands in line, when it is back there, and when the crab hands it
    // new work (its parcel loses the green top). All three leave at 1.8 s, two cells a tick.
    const SLOT = [2, 11, 20]
    const BACK = [7.9, 7.2, 6.4]
    const FRESH = [0.5, 0.9, 1.3]
    const HOPS: [number, number][][] = [[[0.5, 0.6], [8.6, 8.7]], [[0.9, 1.0]], [[1.3, 1.4]]]
    const LEAVE = 1.8
    const home = (i: number) => t < LEAVE - 1e-6 || t >= (BACK[i] as number) - 1e-6
    const helpers = SLOT.map((slot, i) => {
      const back = BACK[i] as number
      if (home(i)) return helper(slot, 13, { hop: during(t, [...(HOPS[i] as [number, number][]), [back + 0.1, back + 0.2]]), done: t >= back - 1e-6 || t < (FRESH[i] as number) - 1e-6 })
      const out = ticks(t, LEAVE)
      const left = Math.round((back - t) * 10)
      // Out to the left until it is past the edge; back in over the last ticks before `back`.
      if (slot - 2 * left > -15) return helper(slot - 2 * left, 13, { gait: left, look: 1, done: true })
      return slot - 2 * out > -15 ? helper(slot - 2 * out, 13, { gait: out + i, look: -1 }) : ''
    }).join('')
    const desk = rect(1, 10, 28, 1, 't') + rect(1, 11, 28, 6, 'B') + rect(1, 11, 28, 1, 'b')
    // The monitor: one light per helper, blinking while it is out, green when it is back.
    const lights = SLOT.map((_, i) => rect(22 + 2 * i, 6, 1, 1, home(i) ? 'n' : into(t, 0.4, i * 0.1) < 0.2 ? 'c' : 'U')).join('')
    const line = step(t, [[0, 3], [3.7, 1], [4.0, 2], [4.3, 3], [4.6, 4], [4.9, 5], [5.3, 1], [5.6, 2], [5.9, 3]])
    const monitor = rect(21, 2, 7, 7, 'L') + rect(22, 3, 5, 5, 'V') + rect(22, 4, line, 1, 'u') + lights + rect(23, 9, 3, 1, 'G')
    // The claw: up while the helpers are in line, waving them off, down while it works,
    // up again to greet each one back.
    const working = during(t, [[3.5, 6.3]])
    const wave = during(t, [[1.6, 1.8], [1.9, 2.5], [6.5, 6.7], [7.3, 7.5], [8.0, 8.2]])
    const claw = step(t, [[0, -2], [3.1, -1], [3.2, 0], [6.3, -1], [6.4, -2]]) - (wave ? 1 : 0)
    const me = crab(4, 4, {
      look: working ? 1 : -1,
      blink: during(t, [[1.0, 1.2], [4.7, 4.9], [8.4, 8.6]]),
      armL: claw,
      armR: working && t >= 3.7 && into(t, 0.3) < 0.1 ? 1 : 0,
    })
    return dotsFull(t) + me + monitor + desk + helpers
  },
}

// Fallback: the grey monitor is dark with a red light blinking; the crab turns from it,
// picks the cable up off the ground and plugs it into the teal machine, whose screen
// comes up pale green and busy. The whole picture dips out and back in to start over.
const fallback: NativeScene = {
  loop: 9,
  draw(t) {
    const TEAL = '#3f8f96'
    const TEAL_DARK = '#2b676d'
    const PALE = '#b9ecb0'
    const dead = rect(3, 7, 2, 9, 'G') + rect(1, 16, 6, 1, 'G') + rect(1, 1, 7, 6, 'g') + rect(1, 6, 7, 1, 'L') + rect(2, 2, 5, 4, 'k') + rect(4, 3, 1, 2, into(t, 1) < 0.5 ? 'r' : '#5a1f1c') + rect(3, 3, 1, 2, into(t, 1) < 0.5 ? 'r' : '#5a1f1c')
    // The crab walks three cells in all; the claw goes down for the plug and back up.
    const x = step(t, [[0, 5], [2.8, 6], [3.0, 7], [3.3, 8]])
    const arm = step(t, [[0, 0], [1.8, 1], [1.9, 2], [2.0, 3], [2.3, 2], [2.4, 1], [2.5, 0]])
    const held = t >= 2.0 - 1e-6
    // The cable runs along the ground from the dead monitor; its plug lies free, then
    // rides in the claw with the cable hanging from it.
    const px = held ? x + 16 : 21
    const py = held ? 11 + arm : 15
    const cable = rect(7, 16, px - 7 + (held ? 1 : 0), 1, 'L') + (held && py < 14 ? rect(px, py + 2, 1, 14 - py, 'L') : '') + rect(px, py, 2, 2, 'l') + rect(px + 2, py, 1, 1, 'w')
    // The backup: dark, a flicker as the plug goes in, then lit, with two bars and a
    // light each on its own beat.
    const power = step(t, [[0, 0], [3.4, 1], [3.5, 0], [3.6, 1], [3.7, 2]])
    const BARS_A = [2, 4, 3, 5, 1, 4]
    const BARS_B = [4, 1, 3, 2, 5]
    const busy =
      rect(26, 7, BARS_A[Math.floor(into(t - 3.7, 2.4) / 0.4 + 1e-6) % 6] as number, 1, 'N') +
      rect(26, 9, BARS_B[Math.floor(into(t - 3.7, 2.5) / 0.5 + 1e-6) % 5] as number, 1, '#4f9a58')
    const screen = rect(26, 6, 5, 5, power === 2 ? PALE : power === 1 ? '#4d7a52' : 'k') + (power === 2 ? busy : '')
    const led = rect(30, 12, 1, 1, power === 2 ? (into(t, 0.6) < 0.4 ? 'n' : 'N') : 'k')
    const backup = rect(25, 4, 7, 13, TEAL) + rect(25, 4, 7, 1, '#58aab1') + rect(25, 16, 7, 1, TEAL_DARK) + screen + led + rect(25, 11, 1, 2, 'k') + rect(27, 14, 4, 1, TEAL_DARK)
    const lit = power === 2
    const me = crab(x, 9, {
      look: t < 1.3 ? -1 : t < 1.5 ? 0 : during(t, [[5.6, 7.0]]) ? 0 : 1,
      blink: during(t, [[0.6, 0.8], [5.0, 5.2], [6.2, 6.4], [8.0, 8.2]]),
      lift: lit && during(t, [[3.9, 4.1], [4.3, 4.5], [7.4, 7.6]]),
      armR: arm,
    })
    // The dip that resets the scene: out over the last ticks, in over the first.
    const shown = step(t, [[0, 0.35], [0.1, 0.7], [0.2, 1], [8.6, 0.8], [8.7, 0.55], [8.8, 0.3], [8.9, 0.12]])
    return dotsFull(t) + `<g opacity="${shown}">${dead}${cable}${backup}${me}</g>`
  },
}

// Waiting: the crab sits on a stool under an empty speech bubble that bobs; the hourglass
// beside it runs out grain by grain and is flicked over; the crab taps a claw, glances out
// at the viewer and blinks.
const waiting: NativeScene = {
  loop: 9,
  draw(t) {
    const stool = rect(4, 13, 12, 1, 't') + rect(5, 14, 1, 3, 'b') + rect(14, 14, 1, 3, 'b') + rect(6, 15, 8, 1, 'B')
    const by = into(t, 3, 0.4) < 1.5 ? 0 : 1
    const bubble = rect(7, by, 10, 1, 'w') + rect(6, by + 1, 12, 2, 'w') + rect(7, by + 3, 10, 1, 'P') + rect(8, by + 4, 2, 1, 'P')
    // The hourglass: 14 grains, one through the neck every 500 ms from 0.4 s. The top
    // empties from its surface, middle first; the bottom piles up from its floor.
    const TOP: [number, number][] = [[25, 7], [24, 7], [26, 7], [23, 7], [27, 7], [25, 8], [24, 8], [26, 8], [23, 8], [27, 8], [24, 9], [26, 9], [25, 9], [25, 10]]
    const BOTTOM: [number, number][] = [[25, 15], [24, 15], [26, 15], [25, 14], [23, 15], [27, 15], [24, 14], [26, 14], [23, 14], [27, 14], [25, 13], [24, 13], [26, 13], [25, 12]]
    const flipping = t >= 7.8 - 1e-6 && t < 8.3 - 1e-6
    const fallen = t >= 8.3 - 1e-6 ? 0 : Math.max(0, Math.min(14, ticks(t, 0.4) < 0 ? 0 : Math.floor(ticks(t, 0.4) / 5) + 1))
    const glass = spr(['CCCCC', 'CCCCC', '.CCC.', '..C..', '..C..', '..C..', '.CCC.', 'CCCCC', 'CCCCC'], 23, 7)
    const sand = TOP.slice(fallen).map(([sx, sy]) => rect(sx, sy, 1, 1, 'Y')).join('') + BOTTOM.slice(0, fallen).map(([sx, sy]) => rect(sx, sy, 1, 1, 'Y')).join('')
    // The grain in the air, between the neck and the pile.
    const drop = fallen > 0 && fallen < 14 ? rect(25, 11 + (ticks(t, 0.4) % 5 < 2 ? 0 : fallen < 11 ? 1 : 0), 1, 1, 'Y') : ''
    const frame = rect(22, 6, 7, 1, 'L') + rect(22, 16, 7, 1, 'L')
    // Flicked over in five ticks, tossed up a cell or two so its corners clear the ground;
    // half a turn of the run-out glass is the full one.
    const turn = flipping ? (ticks(t, 7.8) + 1) * 30 : 0
    const toss = turn === 0 ? 0 : turn === 30 || turn === 150 ? -1 : -2
    const hourglass = `<g transform="translate(0 ${toss}) rotate(${turn} 25.5 11.5)">${frame}${glass}${sand}${drop}</g>`
    const tapping = during(t, [[1.2, 2.0], [4.6, 5.2], [6.4, 6.8]])
    const me = crab(2, 6, {
      look: during(t, [[2.4, 3.8]]) ? 0 : 1,
      blink: during(t, [[2.9, 3.1], [5.7, 5.9], [8.6, 8.8]]),
      armL: tapping && into(t, 0.2) < 0.1 ? 1 : 0,
      armR: step(t, [[0, 0], [7.6, -1], [7.7, -2], [8.0, -1], [8.2, 0]]),
    })
    return dotsFull(t) + me + stool + bubble + hourglass
  },
}

// Native scenes for one-off events, asked for by name.
export const scenes: NamedScene[] = [
  { name: 'compaction', scene: compaction },
  { name: 'subagents', scene: subagents },
  { name: 'fallback', scene: fallback },
  { name: 'waiting', scene: waiting },
]
