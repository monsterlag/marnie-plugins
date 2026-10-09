import { BAND_BG, crab, dotsFull, during, into, rect, rectO, spr } from './native-kit'
import type { NamedScene, NativeScene } from './native-kit'

// Native scenes for the idle mood: sweeping, walking, phone, chatting, reading. All sit
// on the dark dotted band.

// Whole steps of `d` seconds in `at`, safe against a tick landing a hair short.
const steps = (at: number, d: number) => Math.floor(at / d + 1e-6)

const SPARK = ['.y.', 'yyy', '.y.']
// A sparkle that grows from a point, holds and shrinks again over `life` seconds.
const sparkle = (x: number, y: number, at: number, life: number) =>
  at < 0 || at >= life ? '' : at < 0.2 || at >= life - 0.2 ? rect(x + 1, y + 1, 1, 1, 'y') : spr(SPARK, x, y) + (into(at, 0.6) < 0.3 ? rect(x + 1, y + 1, 1, 1, 'w') : '')

// Sweeping: four strokes of the broom wear a dust pile down, a puff flying off each one;
// the crab stands back proud over the clean floor, and the dust settles again.
const sweeping: NativeScene = {
  loop: 7.2,
  draw(t0) {
    const t = t0 + 1e-6
    const sweepingNow = t < 4.8
    // One stroke is 1.2 s: back a cell, then forward two, then home. `k` is the lean.
    const at = into(t, 1.2)
    const k = !sweepingNow ? 0 : at < 0.2 ? 0 : at < 0.4 ? -1 : at < 0.5 ? 0 : at < 0.6 ? 1 : at < 0.9 ? 2 : at < 1.1 ? 1 : 0
    const lean = k >= 2 ? 1 : 0
    const grip = 17 + lean
    let broom = ''
    for (let r = 3; r <= 12; r++) broom += rect(grip + Math.round(((k - lean) * (r - 12)) / 5 - 0.01), r, 1, 1, 't')
    const hx = grip - 2 + (k - lean)
    broom += rect(hx, 13, 5, 1, 'B') + spr(['YYYYY', 'YyYyY', 'Y.Y.Y'], hx, 14)
    // The pile: full, then a stage less after each stroke lands (0.6 s into it); it comes
    // back a stage at a time while the crab rests.
    const PILE = [['..gG..', '.gGggG', 'gGgGgg'], ['......', '..gG..', '.gGgGg'], ['......', '......', '..gGg.'], ['......', '......', '...g..'], []]
    const stage = sweepingNow ? steps(t + 0.6, 1.2) : t < 5.6 ? 4 : t < 6.2 ? 3 : t < 6.8 ? 2 : 1
    const pile = spr(PILE[stage] as string[], 23, 14)
    // A puff off each landed stroke: three specks, out and up a cell at a time, thinning.
    let puff = ''
    if (sweepingNow && at >= 0.6) {
      const s = steps(at - 0.6, 0.1)
      const o = s < 2 ? 1 : s < 4 ? 0.65 : 0.35
      puff = rectO(24 + s, 13 - Math.floor(s / 2), 1, 1, 'g', o) + rectO(26 + Math.floor(s / 2), 12 - s, 1, 1, 'l', o) + (s < 4 ? rectO(23 + Math.floor(s / 2), 11 - s, 1, 1, 'g', o) : '')
    }
    // Dust drifting back down: [x, from second]; a row every 200 ms, landing as the pile grows.
    const fall = ([[26, 4.8], [25, 5.4], [27, 5.6], [24, 6.2], [26, 6.4]] as [number, number][])
      .map(([fx, from]) => {
        const s = steps(t - from, 0.2)
        return t < from || s > 3 ? '' : rectO(fx + (s === 2 ? 1 : 0), 10 + s * 1.5, 1, 1, 'g', 0.5 + s * 0.15)
      })
      .join('')
    // The clean floor shines once; two small glints come and go on their own slow cycles.
    const shine = sparkle(24, 10, t - 4.8, 1.0) + sparkle(27, 2, into(t, 3.6, 1.0) - 0.4, 1.4) + sparkle(22, 5, into(t, 2.4, 0.3) - 1.1, 0.9)
    const me = crab(1 + lean, 9, {
      look: t > 5.0 && t < 6.9 && into(t, 0.9) < 0.4 ? 0 : 1,
      blink: during(t, [[2.3, 2.5], [5.2, 5.4], [6.9, 7.1]]),
      lift: during(t, [[4.8, 5.1]]),
      armR: k < 0 ? -1 : k > 1 ? 1 : 0,
      armL: sweepingNow && at >= 0.5 && at < 0.9 ? 1 : 0,
    })
    return dotsFull(t) + shine + pile + fall + me + broom + puff
  },
}

// Walking: the crab follows a butterfly across, one cell a step with its legs lifting in
// pairs; the butterfly turns back over its head and the crab follows it home.
const walking: NativeScene = {
  loop: 8,
  draw(t0) {
    const t = t0 + 1e-6
    const out = t >= 0.4 && t < 2.8
    const back = t >= 3.8 && t < 6.2
    const x = t < 0.4 ? 1 : out ? 2 + steps(t - 0.4, 0.2) : t < 3.8 ? 13 : back ? 12 - steps(t - 3.8, 0.2) : 1
    // A step is 200 ms: one pair of feet off the ground for the first half of it. The
    // lifted feet are painted out in the band's colour (row 16 holds no dots).
    let feet = ''
    if ((out || back) && into(t, 0.2) < 0.1) {
      const pair = steps(t, 0.2) % 2 ? [3, 10] : [5, 12]
      feet = pair.map(fx => rect(x + fx, 16, 1, 1, BAND_BG)).join('')
    }
    // The butterfly's path: [second, x], a straight run between each two.
    const PATH: [number, number][] = [[0, 19], [0.4, 20], [2.8, 27], [3.2, 27], [4.6, 8], [6.2, 1], [6.6, 1], [8, 19]]
    let bx = 19
    for (let i = 0; i < PATH.length - 1; i++) {
      const [a, ax] = PATH[i] as [number, number]
      const [b, nx] = PATH[i + 1] as [number, number]
      if (t >= a && t < b) bx = Math.round(ax + ((nx - ax) * (t - a)) / (b - a))
    }
    const by = 3 + ([0, 0, -1, -1, 0, 1, 1, 0][steps(into(t, 1.6), 0.2)] as number)
    // Quick wings in flight, slower when it hovers at either end.
    const hover = during(t, [[2.8, 3.2], [6.2, 6.6]])
    const up = hover ? into(t, 0.4) < 0.2 : into(t, 0.2) < 0.1
    const butterfly = spr(up ? ['vv.vv', '.vlv.', '.....'] : ['.....', 'vvlvv', '.v.v.'], bx, by)
    const me = crab(x, 9, {
      look: t < 3.4 || t >= 7.2 ? 1 : -1,
      blink: during(t, [[3.4, 3.6], [6.7, 6.9]]),
      lift: during(t, [[3.0, 3.2], [7.0, 7.2]]),
    })
    return dotsFull(t) + me + feet + butterfly
  },
}

// On the phone: the feed scrolls in bursts under a tapping claw, little icons float off
// the screen, and one message lights it up pink and makes the crab perk up.
const phone: NativeScene = {
  loop: 6,
  draw(t0) {
    const t = t0 + 1e-6
    // Twelve flicks of the feed, in bursts with reading pauses; the feed is six rows long.
    const FLICKS = [0.3, 0.5, 0.7, 1.6, 1.8, 2.0, 2.2, 3.1, 3.3, 4.7, 4.9, 5.1]
    const FEED: [number, number, string][] = [[0, 3, 'w'], [0, 0, 'w'], [0, 2, 'c'], [0, 0, 'w'], [1, 2, 'l'], [0, 0, 'w']]
    const scrolled = FLICKS.filter(at => t >= at).length
    const alert = t >= 3.6 && t < 4.5
    let screen = rect(9, 8, 5, 7, 'L') + rect(10, 9, 3, 5, alert ? (into(t, 0.3) < 0.2 ? 'p' : 'm') : 'k') + rect(11, 14, 1, 1, 'l')
    if (alert) screen += rect(11, 10, 1, 2, 'w') + rect(11, 13, 1, 1, 'w')
    else for (let r = 0; r < 5; r++) {
      const [ix, len, c] = FEED[(r + scrolled) % FEED.length] as [number, number, string]
      if (len) screen += rect(10 + ix, 9 + r, len, 1, c)
    }
    // Icons off the screen: [sprite, x, from second, seconds a row]; up six rows, thinning.
    const ICONS: [string[], number, number, number][] = [
      [['y', 'y', '.', 'y'], 12, 0.7, 0.3],
      [['nnn', 'n.n', 'nnn'], 2, 2.0, 0.4],
      [['p.p', 'ppp', '.p.'], 6, 3.7, 0.3],
    ]
    const icons = ICONS.map(([rows, ix, from, pace], i) => {
      const s = steps(t - from, pace)
      if (t < from || s > 5) return ''
      const o = s < 3 ? 1 : s < 5 ? 0.6 : 0.3
      return `<g fill-opacity="${o}">${spr(rows, ix + (s > 2 && i % 2 ? 1 : s > 3 ? -1 : 0), 5 - s)}</g>`
    }).join('')
    const me = crab(14, 9, {
      look: -1,
      blink: during(t, [[1.1, 1.3], [5.5, 5.7]]),
      lift: during(t, [[3.7, 4.0], [4.2, 4.4]]),
      armL: FLICKS.some(at => t >= at && t < at + 0.1) ? 1 : 0,
      armR: during(t, [[2.6, 2.9]]) ? -1 : 0,
    })
    return dotsFull(t) + me + screen + icons
  },
}

const BUBBLE = ['.wwwwwww.', 'wwwwwwwww', 'wwwwwwwww', 'wwwwwwwww', '.wwwwwww.']
// A speech bubble 9 wide with its tail under column `tail`; it pops in small for a tick.
const bubble = (x: number, tail: number, age: number, inner: string) =>
  age < 0.1 ? rect(x + tail - 1, 4, 3, 2, 'w') + rect(x + tail, 6, 1, 1, 'w') : spr(BUBBLE, x, 1) + rect(x + tail, 6, 2, 1, 'w') + rect(x + tail, 7, 1, 1, 'w') + inner

// Chatting: one crab says something (three dots typed out), the other answers with a
// heart, then both bounce at the joke. Each waves the claw nearer the other as it talks.
const chatting: NativeScene = {
  loop: 8,
  draw(t0) {
    const t = t0 + 1e-6
    const aTalks = t >= 0.4 && t < 2.7
    const bTalks = t >= 3.1 && t < 5.3
    const laugh = t >= 5.7 && t < 7.1
    let says = ''
    if (aTalks) {
      const age = t - 0.4
      // The dots come one at a time, then the last one keeps winking.
      const n = age < 0.3 ? 0 : age < 0.6 ? 1 : age < 0.9 ? 2 : 3
      let dots = ''
      for (let i = 0; i < n; i++) if (i < 2 || age < 1.4 || into(age, 0.4) < 0.3) dots += rect(4 + i * 2, 3, 1, 1, 'K')
      says = bubble(2, 2, age, dots)
    }
    if (bTalks) {
      const age = t - 3.1
      // The heart draws in from the top, then beats.
      const HEART = ['p.p', 'ppp', '.p.']
      const shown = age < 0.3 ? 0 : age < 0.5 ? 1 : age < 0.7 ? 2 : 3
      const beat = shown === 3 && into(age, 0.6) < 0.2
      const heart = `<g>${spr(HEART.slice(0, shown).map(r => (beat ? r.replaceAll('p', 'r') : r)), 24, 2)}</g>`
      says = bubble(21, 5, age, heart)
    }
    // The two inner claws share a column, so they are kept at least two rows apart:
    // the talker's waves high, the listener's hangs low.
    const wave = (age: number) => (into(age, 0.6) < 0.3 ? -2 : -1)
    const a = crab(1, 9, {
      look: 1,
      blink: during(t, [[3.6, 3.8], [7.4, 7.6]]),
      lift: during(t, [[1.0, 1.2], [1.9, 2.1], [4.4, 4.7]]) || (laugh && into(t, 0.4) < 0.2),
      armR: aTalks ? wave(t - 0.4) : bTalks ? 2 : 0,
      armL: aTalks && into(t, 0.9) < 0.2 ? 1 : 0,
    })
    const b = crab(16, 9, {
      look: -1,
      blink: during(t, [[1.5, 1.7], [5.4, 5.6]]),
      lift: during(t, [[2.3, 2.5], [3.5, 3.7], [4.9, 5.1]]) || (laugh && into(t, 0.4, 0.2) < 0.2),
      armL: bTalks ? wave(t - 3.1) : 2,
      armR: bTalks && into(t, 0.8, 0.3) < 0.2 ? -1 : 0,
    })
    // The joke lands: a sparkle between them, and two small ones either side.
    const glee = sparkle(15, 3, t - 5.7, 1.4) + sparkle(8, 5, t - 6.0, 0.8) + sparkle(23, 5, t - 6.3, 0.8)
    return dotsFull(t) + says + glee + a + b
  },
}

// Reading: the crab's eyes go down the open book, a page turns over (twice a loop, so the
// text comes back round), and half way through an idea lights up overhead.
const reading: NativeScene = {
  loop: 9,
  draw(t0) {
    const t = t0 + 1e-6
    // Two spreads of text; a turn takes 300 ms and starts at 2.7 s and 7.2 s.
    const SPREADS = [
      ['UwwwwUwwwwU', 'UwgggUwgggU', 'UwwwwUwwwwU', 'UwggwUwgggU', 'UwwwwUwwwwU', 'UUUUUUUUUUU'],
      ['UwwwwUwwwwU', 'UwggwUwgggU', 'UwwwwUwwgwU', 'UwgggUwwwwU', 'UwwwwUwwwwU', 'UUUUUUUUUUU'],
    ]
    const TURNS = [2.7, 7.2]
    const turned = TURNS.filter(at => t >= at + 0.2).length % 2
    let book = spr(SPREADS[turned] as string[], 3, 11)
    for (const at of TURNS) {
      const s = steps(t - at, 0.1)
      if (t < at || s > 2) continue
      // The right page lifts, stands on the spine, then falls to the left.
      if (s === 0) book += rect(9, 11, 4, 5, 'w') + rect(12, 10, 1, 5, 'P') + rect(13, 11, 1, 5, 'l')
      if (s === 1) book += rect(9, 11, 4, 5, 'w') + rect(4, 11, 4, 5, 'w') + rect(8, 9, 1, 7, 'P')
      if (s === 2) book += rect(4, 11, 4, 5, 'w') + rect(4, 10, 1, 5, 'P') + rect(3, 11, 1, 5, 'l')
    }
    // Where the crab is in the text: a marker stepping down the lines of each page.
    const sinceTurn = t < 2.9 ? t + 1.6 : t < 7.4 ? t - 2.9 : t - 7.4
    const line = Math.min(3, steps(sinceTurn, 1.1))
    const mark = during(t, [[2.7, 3.0], [7.2, 7.5]]) ? '' : rect(line < 2 ? 4 : 10, 12 + (line % 2) * 2, 1, 1, 'Y')
    // The idea: a bulb that flickers on, glows with rays, and fades.
    const idea = t - 4.4
    let bulb = ''
    if (idea >= 0 && idea < 2.2) {
      const lit = idea >= 0.3 && idea < 1.9 && !(idea >= 0.5 && idea < 0.6)
      const o = idea < 0.3 || idea >= 1.9 ? 0.5 : 1
      bulb = `<g fill-opacity="${o}">${spr(lit ? ['.y.', 'yyy', 'yyy', '.w.'] : ['.Y.', 'YYY', 'YYY', '.l.'], 25, 3)}</g>`
      if (lit && into(idea, 0.4) < 0.2) bulb += rect(23, 4, 1, 1, 'y') + rect(29, 4, 1, 1, 'y') + rect(26, 1, 1, 1, 'y')
      else if (lit) bulb += rect(23, 2, 1, 1, 'y') + rect(29, 2, 1, 1, 'y')
    }
    const me = crab(12, 9, {
      look: idea >= 0.3 && idea < 1.5 ? 1 : line >= 2 && !(idea >= 0 && idea < 2.2) ? 0 : -1,
      blink: during(t, [[1.6, 1.8], [6.4, 6.6], [8.3, 8.5]]),
      lift: during(t, [[4.7, 5.0]]),
      armR: during(t, [[4.7, 5.3]]) ? -1 : 0,
    })
    return dotsFull(t) + bulb + me + book + mark
  },
}

export const scenes: NamedScene[] = [
  { name: 'sweeping', scene: sweeping },
  { name: 'walking', scene: walking },
  { name: 'phone', scene: phone },
  { name: 'chatting', scene: chatting },
  { name: 'reading', scene: reading },
]
