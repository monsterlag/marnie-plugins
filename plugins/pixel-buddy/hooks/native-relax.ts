import { FULL_W, FULL_X, backdropFull, crab, during, into, rect, rectO, spr } from './native-kit'
import type { NamedScene, NativeScene } from './native-kit'

// A night by the fire: the flame flickers, sparks rise, the marshmallow browns and is
// swapped for a fresh one, stars twinkle slowly, the crab blinks.
const campfire: NativeScene = {
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

// ---------- shared by the scenes below ----------

// t on its 100 ms tick exactly, so a part never changes a frame early or late.
const onTick = (t: number) => Math.round(t * 10) / 10
// `into`, but a cycle that has just come round reads 0, not a hair under `period`.
const phase = (t: number, period: number, offset = 0) => {
  const at = into(t, period, offset)
  return at > period - 1e-6 ? 0 : at
}
// `during`, with the same allowance at each end for a t that is a hair off its tick.
const within = (t: number, spans: [number, number][]) => spans.some(([a, b]) => t >= a - 1e-6 && t < b - 1e-6)
// Whole steps of `every` seconds gone by at t.
const steps = (t: number, every: number) => Math.floor(t / every + 1e-6)
// The value in force at t, from [from second, value] pairs in time order.
const held = <T,>(t: number, keys: [number, T][]): T => (keys.filter(([from]) => t >= from - 1e-6).pop() ?? keys[0])![1]
// Where a thing that began at x0 is after moving `shift` cells left on a belt `span`
// cells long that starts `lead` cells left of the picture: it leaves on the left and
// comes back on the right. Give the belt a span the loop's shift divides.
const belt = (x0: number, shift: number, span: number, lead = 7) => {
  const from = FULL_X - lead
  return from + ((((x0 - shift - from) % span) + span) % span)
}
// A pattern that repeats every `period` cells across the whole padded width, moved
// `shift` cells left: calls `draw` with each repeat's x.
function tile(period: number, shift: number, draw: (x: number) => string): string {
  let out = ''
  for (let x = FULL_X - period + ((((-shift) % period) + period) % period); x < FULL_X + FULL_W; x += period) out += draw(x)
  return out
}
// Twinkling marks on water or sky: [x, y, width, color, cycle, offset]. Each shows for
// the first 60% of its cycle, at half strength as it comes and goes.
type Glint = [number, number, number, string, number, number]
const glints = (t: number, list: Glint[]) =>
  list
    .map(([x, y, w, c, period, offset]) => {
      const at = phase(t, period, offset)
      const on = period * 0.6
      return at >= on ? '' : rectO(x, y, w, 1, c, at < 0.3 || at >= on - 0.3 ? 0.5 : 1)
    })
    .join('')

const SUN = ['..hhhh..', '.hhhhhh.', 'hhyyyyhh', 'hyyyyyyh', 'hyyyyyyh']
// Sunglasses over the crab at (x, y). `glint` 0..3 is a highlight crossing both lenses;
// anything else leaves it resting at the top left of each.
function shades(x: number, y: number, glint = -1): string {
  const g = glint >= 0 && glint <= 3 ? glint : 0
  const dy = g > 1 ? 1 : 0
  return spr(['kkkkk.kkkkk', 'kkkkkkkkkkk', '.kkk...kkk.'], x + 2, y + 1) + rect(x + 3 + g, y + 1 + dy, 1, 1, 'w') + rect(x + 9 + g, y + 1 + dy, 1, 1, 'w')
}
// A snore: a z that starts with its top at (x, y), small, climbs a cell, grows to full
// size, climbs another and fades, leaning `dir` as it goes; `pace` seconds a step.
// Its highest row is y - 4.
const Z_SMALL = ['zz.', '.z.', '.zz']
const Z_BIG = ['zzzz', '..z.', '.z..', 'zzzz']
function zed(t: number, x: number, y: number, period: number, offset: number, dir: number, color: string, pace = 0.4): string {
  const step = steps(phase(t, period, offset), pace)
  if (step > 4) return ''
  const rows = (step < 2 ? Z_SMALL : Z_BIG).map(r => r.replaceAll('z', color))
  const top = y - ([0, 1, 3, 4, 4][step] as number)
  return `<g opacity="${step === 0 ? 0.6 : step < 4 ? 1 : 0.45}">${spr(rows, x + dir * Math.min(step, 3), top)}</g>`
}

// Sunset from a deck chair: the sun sinks into the sea a row at a time, birds cross in
// front of it, the water glints, a wave washes up the sand, the crab dozes behind its
// shades (a highlight runs over them now and then) and snores.
const sunset: NativeScene = {
  loop: 12,
  draw(at) {
    const t = onTick(at)
    const sky = backdropFull([['s', 2], ['m', 2], ['d', 2], ['f', 2], ['U', 6], ['t', 4]])
    // The sun is a dome on the horizon; a row of it goes under every 3 s.
    const sunk = steps(t, 3)
    const sun = spr(SUN.slice(0, 5 - sunk), 23, 3 + sunk)
    // Two birds cross right to left, a cell every 200 ms, wings down for a third of a beat.
    const bx = belt(52, steps(t, 0.2), 60)
    const bird = (x: number, y: number, offset: number) => spr(phase(t, 0.6, offset) < 0.4 ? ['K.K', '.K.'] : ['...', 'KKK'], x, y)
    const birds = bird(bx, 3, 0) + bird(bx + 4, 5, 0.3)
    // The sun's path on the water under it, and plain glints out to both edges.
    const water = glints(t, [
      [24, 8, 6, 'h', 3, 0], [25, 9, 4, 'f', 2, 0.7], [24, 10, 5, 'h', 4, 1.9], [26, 11, 3, 'f', 3, 1.4], [25, 12, 4, 'h', 2, 0.2], [27, 13, 2, 'f', 4, 3.1],
      [-5, 9, 3, 'u', 4, 0.5], [0, 11, 2, 'u', 3, 2.2], [-3, 13, 2, 'u', 6, 4], [20, 9, 2, 'u', 6, 1], [21, 12, 2, 'u', 4, 2.8],
      [33, 10, 3, 'u', 3, 0.9], [38, 12, 2, 'u', 4, 3.3], [43, 9, 3, 'u', 6, 2], [35, 13, 2, 'u', 6, 5], [41, 11, 2, 'u', 2, 1.1],
    ])
    // A wave every 4 s: foam at the water's edge, then over the first row of sand, which
    // stays dark for a moment after.
    const wash = phase(t, 4, 1.2)
    const shore =
      wash < 0.4 ? rectO(FULL_X, 13, FULL_W, 1, 'C', 0.7)
      : wash < 1.1 ? rect(FULL_X, 14, FULL_W, 1, 'U') + rectO(FULL_X, 14, FULL_W, 1, 'C', wash < 0.8 ? 0.9 : 0.5)
      : wash < 1.9 ? rectO(FULL_X, 14, FULL_W, 1, 'b', wash < 1.5 ? 0.45 : 0.2)
      : ''
    // The chair: a striped back leaning away, a seat under the crab, two legs.
    const up = within(t, [[1.5, 3], [5.5, 7], [9.5, 11]]) ? -1 : 0
    const back = spr(['rw....', 'rw....', '.wr...', '.wr...', '..rw..', '..rw..', '...wr.'], 1, 7)
    const seat = spr(['rrwwrrwwrrwwrrww'], 4, 14) + rect(5, 15, 1, 2, 'b') + rect(18, 15, 1, 2, 'b') + rect(1, 14, 1, 3, 'b')
    const sweep = phase(t, 4, 0.6)
    const me = crab(4, 7, { lift: up < 0 }) + shades(4, 7 + up, sweep < 0.4 ? steps(sweep, 0.1) : -1)
    const drink = spr(['..p..', '.ppp.', 'ppppp', '..t..', 'cccc.', 'cccc.', '.cc..'], 21, 10)
    const snore = zed(t, 17, 4, 3, 0, -1, 'w') + zed(t, 17, 4, 6, 1.5, -1, 'w')
    return sky + sun + rect(FULL_X, 8, FULL_W, 6, 'U') + water + birds + shore + back + me + seat + drink + snore
  },
}

// Night fishing off a pier: ripples slide by, the float bobs, twitches and is pulled
// under, a fish jumps clear and wakes the crab for a moment, stars and the moon's path
// on the water twinkle.
const fishing: NativeScene = {
  loop: 8,
  draw(at) {
    const t = onTick(at)
    const sky = backdropFull([['V', 5], ['s', 4], ['V', 2], ['U', 7]])
    const stars = ([[-4, 0, 8, 1], [0, 2, 4, 2.6], [5, -2, 8, 4.4], [9, 1, 8, 6.9], [14, -1, 4, 0.4], [18, 6, 8, 3.2], [23, -3, 8, 5.5], [24, 4, 4, 1.8], [-2, 6, 8, 7.4], [30, 6, 8, 2.1], [34, 1, 4, 3.3], [39, 4, 8, 0.2]] as [number, number, number, number][])
      .map(([sx, sy, period, offset]) => {
        const at = phase(t, period, offset)
        return rectO(sx, sy, 1, 1, 'w', at < 0.4 ? 0.7 : at < 1.1 ? 0.4 : at < 1.5 ? 0.7 : 1)
      })
      .join('')
    const moon = spr(['.ww.', 'wwww', 'wlww', '.ww.'], 26, 0)
    // Ripples repeat every 16 cells and slide left a cell every half second.
    const ripples = tile(16, steps(t, 0.5), x => rect(x, 13, 3, 1, 'u') + rect(x + 9, 14, 2, 1, 'u') + rect(x + 4, 16, 3, 1, 'u') + rect(x + 12, 17, 2, 1, 'u') + rect(x + 7, 19, 3, 1, 'u') + rect(x + 1, 20, 2, 1, 'u'))
    const moonPath = glints(t, [[26, 12, 4, 'l', 2, 0], [27, 14, 2, 'l', 4, 1.3], [26, 15, 3, 'l', 2, 0.9], [27, 17, 2, 'l', 4, 3]])
    const pier = rect(FULL_X, 11, FULL_X * -1 + 20, 1, 't') + rect(FULL_X, 12, FULL_X * -1 + 20, 1, 'b') + [3, 17].map(px => rect(px, 13, 1, 3, 'B') + rect(px - 1, 16, 3, 1, 'u')).join('')
    // The float: how far it sits under its resting row. Lazy bobs, two quick twitches,
    // then a pull that takes it right under (2) until the fish lets go.
    const dip = held(t, [[0, 0], [0.6, 1], [1, 0], [2.3, 1], [2.6, 0], [3.9, 1], [4.3, 0], [5, 1], [5.1, 0], [5.3, 1], [5.4, 0], [5.6, 2], [6, 0], [6.3, 1], [6.5, 0]] as [number, number][])
    const awake = within(t, [[6, 7.4]])
    const up = within(t, [[0.8, 2.2], [3.6, 5], [6, 6.4]]) ? -1 : 0
    const pulled = dip === 2 ? 1 : 0
    const rod = [0, 1, 2, 3].map(i => rect(17 + i, 5 - i + up, 1, 1, 't')).join('') + rect(21, 1 + up + pulled, 1, 1, 't')
    const lineTop = 2 + up + pulled
    const float =
      dip === 2
        ? rect(22, lineTop, 1, 13 - lineTop, 'g') + rect(20, 13, 2, 1, 'C') + rect(23, 13, 2, 1, 'C')
        : rect(22, lineTop, 1, 12 + dip - lineTop, 'g') + rect(21, 12 + dip, 3, 1, 'r') + rect(21, 13 + dip, 3, 1, 'w') + (dip ? rect(20, 13, 1, 1, 'C') + rect(24, 13, 1, 1, 'C') : '')
    // The fish: out of the water at 6 s, over in an arc, back in 0.8 s later.
    const ARC: [number, number][] = [[27, 10], [27, 8], [26, 7], [26, 6], [25, 6], [25, 7], [24, 8], [24, 10]]
    const leap = steps(t - 6, 0.1)
    const fish = t >= 6 - 1e-6 && leap < ARC.length ? spr(['.uu.u', 'ukuuu', '.CC.u'], (ARC[leap] as [number, number])[0], (ARC[leap] as [number, number])[1]) : ''
    const splash =
      (leap === 0 || leap === 1 ? rect(26, 10 - leap, 1, 1, 'C') + rect(32, 10 - leap, 1, 1, 'C') : '') +
      (leap === 8 || leap === 9 ? rect(23, 18 - leap, 1, 1, 'C') + rect(29, 17 - leap, 1, 1, 'C') : '') +
      (leap >= 8 && leap <= 11 ? rect(24 - (leap - 8), 12, 5 + 2 * (leap - 8), 1, leap < 10 ? 'C' : 'u') : '')
    const me = crab(2, 3, { blink: !awake, look: awake ? 1 : 0, lift: up < 0 })
    return sky + stars + moon + ripples + moonPath + pier + fish + splash + me + rod + float
  },
}

// Asleep in a hammock between two palms: it sways side to side, clouds drift over,
// foam slides along the sea, the fronds stir in the breeze, snores rise, and the crab
// opens its eyes once before dozing off again.
const hammock: NativeScene = {
  loop: 12,
  draw(at) {
    const t = onTick(at)
    const sky = backdropFull([['C', 11], ['c', 2], ['t', 5]])
    // Two clouds 30 cells apart cross a cell every 400 ms.
    const drift = steps(t, 0.4)
    const clouds = [12, 42].map(x0 => spr(['..www..', 'wwwwwww'], belt(x0, drift, 60), 0)).join('')
    const foam = tile(24, steps(t, 0.5), x => rect(x + 2, 11, 3, 1, 'w') + rect(x + 14, 12, 2, 1, 'w') + rect(x + 19, 11, 2, 1, 'C') + rect(x + 8, 12, 3, 1, 'C'))
    // A palm with its trunk's left edge at x; in a gust the outer fronds droop a cell.
    const palm = (x: number, gust: boolean) =>
      rect(x, 4, 2, 13, 'b') + rect(x, 7, 2, 1, 'B') + rect(x, 11, 2, 1, 'B') + rect(x - 1, 16, 4, 1, 'b') +
      spr(gust ? ['.nnn.nnn.', '.nNnnnNn.', 'nn.nNn.nn', 'n..yny..n'] : ['.nnn.nnn.', 'nnNnnnNnn', 'n..nNn..n', '...yny...'], x - 3, 1)
    const palms = palm(2, within(t, [[0.9, 1.4], [4.2, 4.5], [4.8, 5.4], [9.1, 9.8]])) + palm(26, within(t, [[1.1, 1.7], [4.4, 5], [7.3, 7.6], [9.4, 10.1]]))
    // The sway: the low point of the cloth, and the crab in it, a cell left, level, a
    // cell right, level, over 4 s. The ends stay tied to the trunks.
    const sway = held(phase(t, 4), [[0, -1], [1.3, 0], [2, 1], [3.3, 0]] as [number, number][])
    let cloth = ''
    for (let x = 4; x <= 25; x++) {
      const u = (x - 14.5 - sway) / 11.5
      const y = Math.max(7, Math.min(11, Math.round(7 + 6 * (1 - u * u))))
      const stripe = (x - sway + 30) % 3 === 0
      cloth += rect(x, y, 1, 1, stripe ? 'r' : 'w') + rect(x, y + 1, 1, 1, stripe ? 'R' : 'l')
    }
    const shadow = rectO(8 + sway, 15, 14, 1, 'b', 0.35)
    const me = crab(7 + sway, 5, { blink: !within(t, [[7, 7.6]]), armL: within(t, [[3.4, 3.7], [10.2, 10.5]]) ? 1 : 0 })
    const snore = zed(t, 22, 4, 3, 0, -1, 'U', 0.5)
    return sky + clouds + foam + palms + shadow + me + cloth + snore
  },
}

// Grilling by the fence: the coals flicker, smoke rises, a patty browns from underneath,
// is tossed and turned, browns again and is lifted off for a fresh one; the crab in its
// chef's hat watches the grill and blinks.
const barbecue: NativeScene = {
  loop: 8,
  draw(at) {
    const t = onTick(at)
    const sky = backdropFull([['C', 13], ['n', 2], ['N', 3]])
    let fence = rect(FULL_X, 10, FULL_W, 1, 'l')
    for (let x = FULL_X; x < FULL_X + FULL_W; x += 3) fence += rect(x, 9, 2, 4, 'w')
    const grill = spr(['KKKKKKKKKKKK', '.GGGGGGGGGG.', '..GGGGGGGG..', '...G....G...', '...G....G...', '..GG....GG..'], 1, 11)
    // Coals: four patterns on an uneven 1.6 s round.
    const COALS = ['dfddyddf', 'ddfdddfd', 'fddydfdd', 'dydfdddf']
    const ROUND: [number, number][] = [[0, 0.3], [1, 0.1], [2, 0.2], [3, 0.2], [0, 0.1], [2, 0.3], [1, 0.2], [3, 0.2]]
    let left = phase(t, 1.6)
    let glow = 0
    for (const [i, span] of ROUND) {
      glow = i
      if (left < span) break
      left -= span
    }
    const coals = spr([COALS[glow] as string], 3, 12)
    const sausage = rect(3, 10, 4, 1, 'R') + rect(4, 10, 2, 1, 'r')
    // Smoke: [x, cycle, offset]. Up a cell every 400 ms, leaning right, thinning.
    const smoke = ([[4, 4, 0], [7, 4, 2.2], [5, 8, 5.3]] as [number, number, number][])
      .map(([sx, period, offset]) => {
        const at = phase(t, period, offset)
        const step = steps(at, 0.4)
        if (step > 4) return ''
        return `<g opacity="${step < 2 ? 0.85 : step < 4 ? 0.6 : 0.35}">${spr(step % 2 ? ['.g', 'g.'] : ['g.', '.g'], sx + (step >> 1), 8 - step)}</g>`
      })
      .join('')
    // The patty, two rows: [from second, top, bottom]. The side on the grate browns in
    // three steps; the toss at 3.1 s turns it over.
    const RAW = 'p'
    const DONE = ['#b9573c', 'b', 'B']
    const [top, bottom] = held(t, [
      [0, [RAW, RAW]], [1, [RAW, DONE[0]]], [1.9, [RAW, DONE[1]]], [2.6, [RAW, DONE[2]]],
      [3.4, [DONE[2], RAW]], [4.6, [DONE[2], DONE[0]]], [5.4, [DONE[2], DONE[1]]], [6.2, [DONE[2], DONE[2]]], [7.8, [RAW, RAW]],
    ] as [number, [string, string]][])
    // Where it is: its top row, or 'edge' mid-turn, 'gone' between patties; `px` its left.
    const where = held<number | 'edge' | 'gone'>(t, [[0, 9], [2.9, 8], [3.1, 6], [3.2, 4], [3.3, 'edge'], [3.4, 4], [3.5, 6], [3.6, 8], [3.7, 9], [7.2, 8], [7.4, 7], [7.5, 'gone'], [7.8, 9]])
    const px = within(t, [[7.4, 7.5]]) ? 11 : 9
    const patty = where === 'gone' ? '' : where === 'edge' ? rect(10, 3, 1, 3, 'b') : rect(px, where, 3, 1, top) + rect(px, where + 1, 3, 1, bottom)
    const sizzle = within(t, [[3.7, 3.8], [7.8, 7.9]]) ? rect(8, 8, 1, 1, 'w') + rect(12, 8, 1, 1, 'w') : within(t, [[3.8, 3.9], [7.9, 8]]) ? rect(7, 7, 1, 1, 'w') + rect(13, 7, 1, 1, 'w') : ''
    // The spatula arm: rest beside the patty, dip, lean in under it, toss, back.
    const pose = held(t, [[0, 'rest'], [2.8, 'dip'], [2.9, 'scoop'], [3.1, 'toss'], [3.3, 'rest'], [7.1, 'dip'], [7.2, 'scoop'], [7.4, 'rest']] as [number, 'rest' | 'dip' | 'scoop' | 'toss'][])
    const perk = within(t, [[3.3, 3.6], [7.5, 7.8]])
    const cx = pose === 'scoop' || pose === 'toss' ? 15 : 16
    const arm = pose === 'toss' ? -3 : pose === 'rest' ? -2 : -1
    const row = 11 + arm + (perk ? -1 : 0)
    const spatula = rect(cx - 4, row, 2, 1, 'L') + rect(cx - 2, row, 2, 1, 'b')
    const hat = spr(['.wwwwww.', 'wwwwwwww', 'wwwwwwww', '.llllll.'], cx + 4, 5 + (perk ? -1 : 0))
    const me = crab(cx, 9, { look: -1, blink: within(t, [[1.5, 1.7], [5.9, 6.1]]), lift: perk, armL: arm })
    return sky + fence + smoke + grill + coals + sausage + me + hat + spatula + patty + sizzle
  },
}

// A drive into the sunset: palms and bushes rush past, the lane marks faster still, the
// far hills slowly, a bird keeps pace overhead; the car jolts on bumps, its wheels
// spin, dust trails behind, and the crab in shades waves.
const drive: NativeScene = {
  loop: 8,
  draw(at) {
    const t = onTick(at)
    const sky = backdropFull([['s', 2], ['m', 1], ['d', 1], ['f', 2], ['N', 6], ['n', 2], ['G', 4]])
    const sun = spr(SUN, 24, 1)
    // Far hills: repeat every 16 cells, a cell every half second.
    const hills = tile(16, steps(t, 0.5), x => spr(['..NNNN..', '.NNNNNNN'], x, 4) + spr(['.NN.'], x + 10, 5))
    // Roadside palms, a cell every tick on an 80 cell belt; bushes at half that speed.
    const run = steps(t, 0.1)
    const palm = (x: number, tall: number) => rect(x, 4 - tall, 1, 10 + tall, 'b') + spr(['.n.n.', 'nnNnn', 'n.b.n'], x - 2, 2 - tall)
    const palms = palm(belt(30, run, 80), 0) + palm(belt(68, run, 80), 1)
    const bushes = tile(40, steps(t, 0.2), x => spr(['.NN.', 'NNNN'], x + 10, 12) + spr(['.NNN.', 'NNNNN'], x + 29, 12))
    const marks = tile(8, run, x => rect(x, 17, 4, 1, 'y'))
    // The bird holds station over the car, wandering a cell at a time.
    const [bx, by] = held(t, [[0, [0, 2]], [1.2, [1, 2]], [2.3, [2, 3]], [3.5, [3, 3]], [4.4, [2, 2]], [5.6, [1, 3]], [6.9, [0, 3]]] as [number, [number, number]][])
    const bird = spr(phase(t, 0.8) < 0.5 ? ['K.K', '.K.'] : ['...', 'KKK'], bx, by)
    // Bumps lift the body for a tick or two; the wheels stay on the road.
    const dy = within(t, [[1.1, 1.2], [1.4, 1.5], [3.6, 3.8], [5, 5.1], [6.7, 6.9]]) ? -1 : 0
    const spin = steps(phase(t, 0.4), 0.1)
    const wheel = (x: number) => rect(x, 14, 3, 3, 'k') + rect(x + (spin === 1 || spin === 2 ? 2 : 0), 15 + (spin > 1 ? 1 : 0), 1, 1, 'l')
    const car = spr(['..................c...', '..................c...', '.rrrrrrrrrrrrrrrrrrrr.', 'Yrrrrrrrrrrrrrrrrrrrhh', 'RRRRRRRRRRRRRRRRRRRRRR'], 4, 10 + dy)
    const waving = within(t, [[1.8, 3.4], [5.8, 6.6]])
    const sweep = phase(t, 4, 2)
    const me = crab(6, 6 + dy, { armR: waving ? (phase(t, 0.4) < 0.2 ? -2 : -1) : 0 }) + shades(6, 6 + dy, sweep < 0.4 ? steps(sweep, 0.1) : -1)
    // Dust: [offset]. Each puff slides back two cells every 200 ms and thins.
    const dust = [0, 0.4]
      .map(offset => {
        const step = steps(phase(t, 0.8, offset), 0.2)
        return rectO(3 - 2 * step, 16 - (step > 1 ? 1 : 0), 2, 1, 'l', [0.8, 0.6, 0.4, 0.2][step] as number)
      })
      .join('')
    return sky + sun + hills + palms + bushes + marks + bird + wheel(5) + wheel(20) + me + car + dust
  },
}

export const scenes: NamedScene[] = [
  { name: 'campfire', scene: campfire },
  { name: 'sunset', scene: sunset },
  { name: 'fishing', scene: fishing },
  { name: 'hammock', scene: hammock },
  { name: 'barbecue', scene: barbecue },
  { name: 'drive', scene: drive },
]
