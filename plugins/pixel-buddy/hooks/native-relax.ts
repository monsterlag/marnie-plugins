import { backdropFull, crab, during, into, rect, rectO, spr } from './native-kit'
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

export const scenes: NamedScene[] = [{ name: 'campfire', scene: campfire }]
