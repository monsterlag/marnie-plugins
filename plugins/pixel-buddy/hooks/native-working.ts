import { crab, dotsFull, during, into, rect, rectO, spr } from './native-kit'
import type { NamedScene, NativeScene } from './native-kit'

// Typing at a low desk: lines of code type in left to right and scroll, the crab taps,
// bobs now and then and blinks, green squares rise off the laptop.
const typing: NativeScene = {
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

// ---------- shared by the scenes below ----------

// Whole ticks into a span that began at `from` seconds.
const ticks = (at: number, from: number) => Math.floor((at - from) / 0.1 + 1e-6)
const BOX = ['BbbbB', 'bbYbb', 'bbbbb', 'BbbbB']
// A speech bubble holding a "!"; the tail hangs from column `tail`.
const bang = (x: number, y: number, tail: number) => spr(['.wwww.', 'ww.www', 'ww.www', 'wwwwww', 'ww.www', '.wwww.'], x, y) + rect(x + tail, y + 6, 1, 1, 'w')
// A helper crab, 8x5 in the mascot's colors: `step` 1 or 2 lifts that leg, `look` shifts
// the eyes a cell, `up` raises the body a cell on planted legs, `tap` lowers the right claw.
function mini(x: number, y: number, o: { step?: number; look?: number; up?: boolean; tap?: boolean } = {}): string {
  const by = o.up ? -1 : 0
  const legs = rect(2, 3 + by, 1, (o.step === 1 ? 1 : 2) - by, 'o') + rect(5, 3 + by, 1, (o.step === 2 ? 1 : 2) - by, 'o')
  const body = rect(1, by, 6, 3, 'o') + rect(0, 1 + by, 1, 1, 'o') + rect(7, 1 + by + (o.tap ? 1 : 0), 1, 1, 'o')
  const eyes = rect(2 + (o.look ?? 0), 1 + by, 1, 1, 'e') + rect(5 + (o.look ?? 0), 1 + by, 1, 1, 'e')
  return `<g transform="translate(${x} ${y})">${legs}${body}${eyes}</g>`
}
// A point moving in straight lines between [second, x, y] keys, on whole cells.
function along(t: number, keys: [number, number, number][]): [number, number] {
  let a = keys[0] as [number, number, number]
  for (const b of keys) {
    if (t < b[0]) {
      const f = (t - a[0]) / (b[0] - a[0])
      return [Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)]
    }
    a = b
  }
  return [a[1], a[2]]
}

// Working through a pile: every 2 s the crab takes a sheet, reads it (eyes going across,
// the sheet dipping) and flings it away over its head; the second one holds a find. The
// pile sinks sheet by sheet until a fresh bundle drops onto it.
const papers: NativeScene = {
  loop: 6,
  draw(t) {
    const at = into(t, 2)
    const n = Math.floor(t / 2 + 1e-6)
    // The pile, two rows a sheet, seen edge on; the sheet being taken stays on it a tick.
    const height = 8 - 2 * (n + 1) + (at < 0.1 - 1e-6 ? 2 : 0)
    const layers = (top: number, rows: number) => {
      let out = ''
      for (let r = 0; r < rows; r++) out += rect(22, top + r, 7, 1, r % 2 ? 'L' : 'P') + (r % 2 ? '' : rect(22 + ((top + r) % 3), top + r, 1, 1, 'l'))
      return out
    }
    let pile = layers(17 - height, height)
    // The bundle of three falls four rows a tick and lands on the last sheet.
    if (t >= 5.5 - 1e-6) pile += layers(Math.min(9, -7 + 4 * ticks(t, 5.5)), 6)
    const SHEET = ['PPPP', 'PggP', 'PPPP', 'PgPP', 'PPPP']
    const TILTED = ['.PPP', 'PPgP', 'PgPP', 'PPP.']
    let sheet = ''
    const reading = at >= 0.2 - 1e-6 && at < 1.4 - 1e-6
    if (at >= 0.1 - 1e-6 && at < 0.2 - 1e-6) sheet = spr(SHEET, 19, 8)
    else if (reading) sheet = spr(SHEET, 17, 9 + (into(at, 0.6, 0.1) < 0.3 ? 0 : 1))
    else if (at >= 1.4 - 1e-6) {
      // Flung: up and back over the crab, turning over, thinning out.
      const k = ticks(at, 1.4)
      const [fx, fy] = ([[16, 6], [14, 4], [12, 2], [10, 1], [8, 0], [6, -1]] as [number, number][])[k] as [number, number]
      sheet = `<g opacity="${[1, 1, 0.8, 0.6, 0.4, 0.2][k]}">${spr(k % 2 ? TILTED : SHEET, fx, fy)}</g>`
    }
    const find = n === 1 && at >= 0.7 - 1e-6 && at < 1.4 - 1e-6
    const mark = find ? rect(18, 2, 2, 3, 'y') + rect(18, 6, 2, 1, 'y') : ''
    const me = crab(1, 9, {
      look: reading ? (into(at, 0.6, 0.1) < 0.3 ? 0 : 1) : 1,
      blink: during(t, [[1.0, 1.2], [4.9, 5.1]]),
      lift: (find && at < 0.9) || (at >= 1.4 - 1e-6 && at < 1.6 - 1e-6),
      armR: at < 0.2 - 1e-6 ? 1 : at >= 1.4 - 1e-6 && at < 1.7 - 1e-6 ? -2 : 0,
    })
    return dotsFull(t) + pile + me + sheet + mark
  },
}

// Handing out work: a helper trots in from the left, the crab calls it over and lowers a
// parcel onto its back, the helper trots off with it; first a box, then a document.
const delegate: NativeScene = {
  loop: 9,
  draw(t) {
    const at = into(t, 4.5)
    const second = t >= 4.5 - 1e-6
    // The helper: in for 1.9 s, a cell a tick, waits 0.6 s, out again.
    const walking = at < 1.9 - 1e-6 || at >= 2.5 - 1e-6
    const mx = at < 1.9 - 1e-6 ? -14 + ticks(at, 0) : at < 2.5 - 1e-6 ? 5 : 5 - ticks(at, 2.5)
    const loaded = at >= 2.3 - 1e-6
    const helper = mini(mx, 12, { step: walking ? (ticks(at, 0) % 4 < 2 ? 1 : 2) : 0, look: at < 2.5 - 1e-6 ? 1 : -1, up: !walking && !loaded && into(at, 0.4) < 0.2 })
    // The crab's arm: up with the parcel from 0.5 s, bobbing while it waits, down for the
    // handover at 1.9 s.
    const calling = at >= 1.1 - 1e-6 && at < 2.5 - 1e-6
    const hop = at >= 1.1 - 1e-6 && at < 1.3 - 1e-6
    const arm = at < 0.5 - 1e-6 ? 0 : at < 0.6 - 1e-6 ? -1 : at < 1.9 - 1e-6 ? (at > 0.9 && into(at, 0.6) < 0.2 ? -1 : -2) : at < 2.0 - 1e-6 ? -1 : 0
    const parcel = (x: number, y: number) => (second ? rect(x, y - 1, 3, 3, 'P') + rect(x + 1, y, 1, 1, 'g') : rect(x, y, 4, 2, 'b') + rect(x + 1, y, 2, 1, 'Y'))
    let load = ''
    if (at >= 0.5 - 1e-6 && at < 1.9 - 1e-6) load = parcel(14, 9 + arm - (hop ? 1 : 0))
    else if (at >= 1.9 - 1e-6 && at < 2.3 - 1e-6) {
      const [px, py] = ([[12, 8], [10, 9], [8, 9], [7, 10]] as [number, number][])[ticks(at, 1.9)] as [number, number]
      load = parcel(px, py)
    } else if (loaded) load = parcel(mx + 2, 10)
    const me = crab(16, 9, { look: at >= 3.6 - 1e-6 || at < 0.3 - 1e-6 ? 0 : -1, blink: during(t, [[3.9, 4.1], [7.2, 7.4]]), lift: hop, armL: arm })
    return dotsFull(t) + (calling ? bang(8, 0, 4) : '') + helper + me + load
  },
}

// Moving a box between two stacks: it slides off one stack onto the crab's raised arms,
// the crab shuffles across under it and passes it on to the other stack, rests, then
// brings it back.
const boxes: NativeScene = {
  loop: 9,
  draw(t) {
    const at = into(t, 4.5)
    const dir = t < 4.5 - 1e-6 ? 1 : -1
    // The box: waits 0.5 s on its stack, then a cell a tick across the 26 between them.
    const k = at < 0.5 - 1e-6 ? 0 : Math.min(26, ticks(at, 0.5))
    const bx = (dir > 0 ? 1 : 27) + dir * k
    const moving = k > 0 && k < 26
    // The crab takes three steps on the way, each a short rise.
    const STEPS = [6, 12, 18]
    const cx = (dir > 0 ? 7 : 10) + dir * STEPS.filter(s => k >= s).length
    const lift = moving && STEPS.some(s => k === s || k === s + 1)
    const over = bx + 4 >= cx && bx <= cx + 15
    const reach = at >= 0.2 - 1e-6 && k < 26
    const left = reach && bx + 2 < cx + 10
    const right = reach && bx + 2 > cx + 5
    const stacks = spr(BOX, 1, 13) + spr(BOX, 1, 9) + spr(BOX, 27, 13) + spr(BOX, 27, 9)
    const me = crab(cx, 9, {
      look: at < 0.5 - 1e-6 ? -dir : dir,
      blink: during(t, [[3.6, 3.8], [8.3, 8.5]]),
      lift,
      armL: left ? -2 : 0,
      armR: right ? -2 : 0,
    })
    // A puff of dust where the box comes to rest.
    const settled = at - 3.1
    const dust = settled >= -1e-6 && settled < 0.4 - 1e-6 ? rectO(dir > 0 ? 26 : 6, 8 - ticks(settled, 0), 1, 1, 'g', 0.8 - 0.2 * ticks(settled, 0)) : ''
    return dotsFull(t) + stacks + me + spr(BOX, bx, 5 - (lift && over ? 1 : 0)) + dust
  },
}

// The office: two helpers at their desks, one behind the other, code changing on their
// screens as they type in bursts; the crab paces beside them, calling out and waving.
const office: NativeScene = {
  loop: 6,
  draw(t) {
    // A desk: [x, y of the screen's top, burst cycle, offset, screen cycle].
    const desks = ([[18, 1, 3, 0, 0.6], [19, 9, 2, 0.7, 1]] as [number, number, number, number, number][])
      .map(([x, y, cycle, offset, flick]) => {
        const busy = into(t, cycle, offset) < cycle * 0.7
        const tap = busy && into(t, 0.4, offset) < 0.2
        const a = into(t, flick, offset) < flick / 2
        const screen = spr(['LLLLL', 'LkkkL', 'LkkkL', 'LLLLL', '..L..'], x + 7, y) + (a ? rect(x + 8, y + 1, 2, 1, 'n') + rect(x + 8, y + 2, 3, 1, 'c') : rect(x + 8, y + 1, 3, 1, 'c') + rect(x + 9, y + 2, 2, 1, 'n'))
        const desk = rect(x + 6, y + 5, 7, 1, 'b') + rect(x + 7, y + 6, 1, 2, 'B') + rect(x + 11, y + 6, 1, 2, 'B')
        return mini(x, y + 3, { look: busy ? 1 : 0, tap }) + screen + desk
      })
      .join('')
    // Pacing: two cells over and back every 3 s, a short rise on each step.
    const at = into(t, 3)
    const x = at < 0.8 - 1e-6 ? 1 : at < 1.1 - 1e-6 ? 2 : at < 2.2 - 1e-6 ? 3 : at < 2.5 - 1e-6 ? 2 : 1
    const calling = at >= 1.1 - 1e-6 && at < 2.2 - 1e-6
    const me = crab(x, 9, {
      look: 1,
      blink: during(t, [[0.4, 0.6], [5.6, 5.8]]),
      lift: during(at, [[0.8, 0.9], [1.1, 1.2], [2.2, 2.3], [2.5, 2.6]]),
      armR: calling ? (into(at, 0.4, 0.1) < 0.2 ? -2 : -1) : 0,
    })
    return dotsFull(t) + desks + me + (calling ? bang(x + 7, 1, 1) : '')
  },
}

// Reading a chart: the bars tick up and down on their own timings, the crab moves a
// magnifier from bar to bar; the third bar falls and turns red, and the crab stops on it
// with a "?" until it climbs back.
const analyze: NativeScene = {
  loop: 6,
  draw(t) {
    const fallen = t < 2.6 - 1e-6 ? 5 : t < 2.7 - 1e-6 ? 4 : t < 2.8 - 1e-6 ? 3 : t < 4.9 - 1e-6 ? 2 : t < 5.0 - 1e-6 ? 3 : t < 5.1 - 1e-6 ? 4 : 5
    const heights = [3 + (into(t, 2) < 1 ? 0 : 1), 6 + (into(t, 3, 1) < 1.5 ? 0 : 1), fallen, 7 + (into(t, 1.5, 0.4) < 0.7 ? 1 : 0)]
    const bars = heights.map((h, i) => rect(19 + 3 * i, 13 - h, 2, h, i === 2 ? (h < 4 ? 'r' : 'n') : i % 2 ? 'c' : 'n')).join('')
    const monitor = rect(17, 2, 15, 12, 'L') + rect(18, 3, 13, 10, 'k') + rect(23, 14, 3, 2, 'L') + rect(21, 16, 7, 1, 'L')
    // The lens's centre; over the fallen bar it trembles a little.
    let [lx, ly] = along(t, [[0, 20, 10], [0.7, 20, 10], [1.2, 23, 8], [2.0, 23, 8], [2.4, 20, 9], [2.9, 20, 9], [3.4, 26, 10], [4.9, 26, 10], [5.2, 26, 8], [5.5, 23, 9], [5.9, 20, 10]])
    const puzzled = t >= 3.4 - 1e-6 && t < 4.9 - 1e-6
    if (puzzled && into(t, 0.5) < 0.2) ly -= 1
    const lens = rectO(lx - 1, ly - 1, 3, 3, 'c', 0.3) + spr(['...lll.', '..l...l', '..l...l', '..l...l', '..blll.', '.bb....', 'bb.....'], lx - 4, ly - 2)
    const query = puzzled && (t >= 3.6 || t < 3.5 - 1e-6) ? spr(['www', '..w', '.ww', '...', '.w.'], 7, 2) : ''
    const me = crab(1, 9, {
      look: 1,
      blink: during(t, [[1.5, 1.7], [5.3, 5.5]]),
      lift: during(t, [[3.4, 3.6]]),
      armR: ly < 9 ? -1 : 0,
    })
    return dotsFull(t) + monitor + bars + me + lens + query
  },
}

export const scenes: NamedScene[] = [
  { name: 'typing', scene: typing },
  { name: 'papers', scene: papers },
  { name: 'delegate', scene: delegate },
  { name: 'boxes', scene: boxes },
  { name: 'office', scene: office },
  { name: 'analyze', scene: analyze },
]
