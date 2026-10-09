import { crab, dotsFull, rect, rectO, spr } from './native-kit'
import type { NamedScene, NativeScene } from './native-kit'

// This scene counts in whole 100 ms ticks, so nothing lands a frame early or late.
const tickOf = (t: number) => Math.round(t * 10)
// True from tick a up to, not including, tick b.
const span = (k: number, a: number, b: number) => k >= a && k < b
// How high a hop that starts at tick `start` has got: `heights` is cells per tick.
const hop = (k: number, start: number, heights: number[]) => (k >= start ? (heights[k - start] ?? 0) : 0)

// A small friend, 5 wide and 5 tall, in the crab's colors; `up` throws its arms up.
const friend = (x: number, y: number, up: boolean) =>
  rect(x + 1, y, 3, 3, 'o') + rect(x + 1, y + 2, 3, 1, 'O') + rect(x + 1, y + 1, 1, 1, 'e') + rect(x + 3, y + 1, 1, 1, 'e') +
  rect(x, y + (up ? -1 : 1), 1, 1, 'o') + rect(x + 4, y + (up ? -1 : 1), 1, 1, 'o') + rect(x + 1, y + 3, 1, 2, 'o') + rect(x + 3, y + 3, 1, 2, 'o')

// One piece of confetti: thrown up from beside a friend, it slows at the top of its
// arc, tumbles down at its own pace, lies on the floor and fades. Empty before it is
// thrown and once it has gone.
const COLORS = ['r', 'y', 'c', 'n', 'p', 'v', 'f', 'u']
const PIECES = 36
const GRAVITY = 46
function piece(i: number, t: number): string {
  const r = (n: number) => {
    const s = Math.sin((i * 7 + n) * 127.1 + 311.7) * 43758.5453
    return s - Math.floor(s)
  }
  // Two volleys: two pieces in three with the first jump, the rest with the second.
  const second = i % 3 === 2
  const age = t - ((second ? 1.1 : 0.3) + Math.floor(r(1) * 4) * 0.1)
  if (age < -1e-6) return ''
  const fromLeft = i % 2 === 0
  const vx = (fromLeft ? 1 : -1) * (-6 + r(2) * 22)
  const vy = -(21 + r(3) * 13)
  const peakAt = -vy / GRAVITY
  const peakY = 10 + (vy * peakAt) / 2
  const floor = 15 + (i % 3)
  // The way down takes between 1.5 and 2.8 s whatever the height (2.5 at most for the
  // second volley, so the floor is full before it starts to clear).
  const fallFor = 1.5 + r(4) * (second ? 1 : 1.3)
  let x = (fromLeft ? 4 : 27) + vx * Math.min(age, peakAt)
  let y: number
  if (age < peakAt) y = 10 + vy * age + (GRAVITY * age * age) / 2
  else {
    const down = age - peakAt
    x += (r(5) - 0.5) * 2 * Math.min(down, fallFor) + (Math.floor(down / (0.3 + (i % 3) * 0.1)) % 2)
    y = peakY + ((floor - peakY) * down) / fallFor
  }
  const c = COLORS[i % COLORS.length] as string
  const px = Math.round(x)
  if (y >= floor - 1e-6) {
    // Lying flat; the floor clears a piece at a time between 4.7 and 5.5 s.
    const gone = 4.7 + r(6) * 0.5
    return t >= gone + 0.3 - 1e-6 ? '' : rectO(px, floor, i % 2 ? 2 : 1, 1, c, t >= gone - 1e-6 ? 0.4 : 1)
  }
  // In the air it turns: a strip, then end on in its other color.
  const turn = 2 + (i % 3)
  const py = Math.round(y)
  if (Math.floor(age * 10 + 1e-6) % (turn * 2) >= turn) return rect(px, py, 1, 1, COLORS[(i + 3) % COLORS.length] as string)
  return i % 2 ? rect(px, py, 2, 1, c) : rect(px, py, 1, 2, c)
}

// A sparkle that opens and closes twice over a second from tick `start`.
const SPARK = ['.y.', 'yyy', '.y.']
function sparkle(k: number, x: number, y: number, start: number): string {
  const at = k - start
  if (at < 0 || at > 9 || at === 5) return ''
  return at === 0 || at === 4 || at === 6 || at === 9 ? rect(x + 1, y + 1, 1, 1, 'y') : spr(SPARK, x, y)
}

// The turn is finished: a pop, confetti thrown up from both sides, the crab jumps twice
// with its arms up, then dances while two friends hop in turn; the confetti comes down
// behind them, lies and clears, the arms come down one at a time, a blink, and all
// three stand exactly as they began.
const done: NativeScene = {
  loop: 6,
  draw(t) {
    const k = tickOf(t)
    let confetti = ''
    for (let i = 0; i < PIECES; i++) confetti += piece(i, k / 10)
    // A pop beside each friend as a volley goes off.
    const POP = ['w.w', '.w.', 'w.w']
    const pop = span(k, 3, 4) || span(k, 11, 12) ? spr(POP, 2, 7) + spr(POP, 26, 7) : ''
    // The crab: two jumps, a dance on a 1.2 s round (a cell left, centre, a cell right,
    // centre; a bob every other beat; arms pumping out of step; eyes following), one
    // small hop, then stillness.
    const jump = hop(k, 3, [2, 4, 5, 5, 4, 2]) + hop(k, 11, [1, 3, 3, 1]) + hop(k, 45, [1, 2, 1])
    const dancing = span(k, 17, 44)
    const beat = dancing ? Math.floor(((k - 17) % 12) / 3) : -1
    const lean = beat === 0 ? -1 : beat === 2 ? 1 : 0
    const armL = span(k, 3, 17) ? -3 : dancing ? (k % 6 < 3 ? -3 : -1) : span(k, 44, 50) ? -2 : 0
    const armR = span(k, 3, 17) ? -3 : dancing ? ((k + 2) % 6 < 3 ? -3 : -1) : span(k, 44, 52) ? -2 : 0
    const me = crab(8 + lean, 9 - jump, { look: lean, lift: dancing && (k - 17) % 6 >= 3, blink: span(k, 55, 57), armL, armR })
    // The friends: seven hops each on a 600 ms round, the right one 300 ms behind; arms
    // up from the pop until their last landing.
    const HOP = [1, 3, 3, 1, 0, 0]
    const leftUp = span(k, 4, 46) ? (HOP[(k - 4) % 6] as number) : 0
    const rightUp = span(k, 7, 49) ? (HOP[(k - 7) % 6] as number) : 0
    const friends = friend(1, 12 - leftUp, span(k, 3, 46)) + friend(26, 12 - rightUp, span(k, 3, 49))
    const sparkles = sparkle(k, 5, 1, 8) + sparkle(k, 25, 0, 15) + sparkle(k, 14, 0, 24) + sparkle(k, 2, 5, 31) + sparkle(k, 28, 3, 36)
    return dotsFull(t) + sparkles + confetti + pop + friends + me
  },
}

export const scenes: NamedScene[] = [{ name: 'done', scene: done }]
