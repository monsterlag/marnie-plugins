import { crab, dotsFull, during, into, rect, rectO } from './native-kit'
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

export const scenes: NamedScene[] = [{ name: 'typing', scene: typing }]
