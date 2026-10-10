// Which scene the band shows at a moment of a mood: the mood's rotation, and the event
// scenes that cut into it. Pure: the same mood, time, seed and cues give the same scene.
import type { Mood } from '../types'
import { eventScenes, nativeScenes } from './native'
import type { NamedScene, NativeScene } from './native-kit'

// A scene plays whole loops, as many as fit in this many seconds (at least one), before
// the next takes over.
export const SLOT_SECONDS = 16
// The compaction scene plays this many loops, then the rotation goes on where it was.
export const COMPACTION_LOOPS = 2

// Whether the mascot gets a new frame now. Each frame is a whole new picture for the
// desktop app to take in, from every open session at once, so only a session someone is
// likely watching animates: one that is working, or `animateMs` into a quiet mood (the
// party and the start of the rest). After that the picture holds still and is drawn
// again once every `stillMs`.
export function frameDue(mood: Mood, sinceMood: number, sinceFrame: number, animateMs: number, stillMs: number): boolean {
  return mood === 'working' || sinceMood < animateMs || sinceFrame >= stillMs
}

// The order a mood's n scenes play in for one entry into it: a Fisher-Yates shuffle
// drawn from `seed` alone, so every redraw of the same entry gets the same order.
export function sceneOrder(n: number, seed: number): number[] {
  let a = (Math.floor(Math.abs(seed)) % 0x100000000 ^ Math.imul(n, 0x9e3779b1)) >>> 0
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = Math.imul(a ^ (a >>> 15), a | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 0x100000000
  }
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const held = order[i] as number
    order[i] = order[j] as number
    order[j] = held
  }
  return order
}

// What cuts into a rotation, in seconds into the mood: when each compaction happened,
// and the spans during which a sub-agent was running.
export type Cues = { compactions?: number[]; agents?: { from: number; until: number }[] }
export type Shown = { name: string; scene: NativeScene; local: number }

const EPS = 1e-6
const loops = (s: NamedScene) => Math.max(1, Math.floor(SLOT_SECONDS / s.scene.loop + EPS))
const ordered = (mood: Mood, seed: number) => {
  const list = nativeScenes[mood]
  return sceneOrder(list.length, seed).map(i => list[i] as NamedScene)
}
const show = (s: NamedScene, local: number): Shown => ({ name: s.name, scene: s.scene, local: Math.max(0, Math.round(local * 1000) / 1000) })

// How long the done mood lasts for this entry: one loop of the scene it shows.
export function doneSeconds(seed: number): number {
  return (ordered('done', seed)[0] as NamedScene).scene.loop
}

// True when the published compaction value says another compaction has happened since
// `seen`: its count went up, or its latest one has a new time.
export function compactionFired(seen: { count: number; lastAt: number | null }, now: { count: number; lastAt: number | null }): boolean {
  return now.count > seen.count || (now.lastAt !== null && now.lastAt !== seen.lastAt)
}

// The scene `t` seconds into `mood`, and that scene's own clock. The mood's scenes play
// in this entry's shuffled order, each for its slot of whole loops. Scenes only ever
// change on a loop boundary:
// - a compaction plays `compaction` from the next boundary for COMPACTION_LOOPS loops,
//   then the interrupted slot goes on;
// - while working with a sub-agent running, `subagents` takes the next boundary and
//   then every other slot until none is running.
export function pick(mood: Mood, t: number, seed: number, cues: Cues = {}): Shown {
  const order = ordered(mood, seed)
  if (mood === 'done') return show(order[0] as NamedScene, t % (order[0] as NamedScene).scene.loop)

  const compaction = eventScenes.compaction
  const subagents = eventScenes.subagents
  const compactions = compaction ? (cues.compactions ?? []).filter(at => at >= 0).sort((a, b) => a - b) : []
  const agents = mood === 'working' && subagents ? (cues.agents ?? []) : []
  const running = (at: number) => agents.some(a => a.from <= at + EPS && at < a.until - EPS)

  // Whole rotations pass untouched before the first cue.
  const round = order.reduce((sum, s) => sum + loops(s) * s.scene.loop, 0)
  const first = Math.min(t, ...compactions, ...agents.map(a => a.from))
  let at = Math.floor(Math.max(0, first) / round + EPS) * round
  let next = 0
  let current: NamedScene | undefined
  let left = 0
  let slotAt = 0
  let fired = 0
  let agentsLast = false
  for (let guard = 0; guard < 200_000; guard++) {
    // `at` is a loop boundary.
    if (compaction && fired < compactions.length && (compactions[fired] as number) <= at + EPS) {
      fired++
      const span = COMPACTION_LOOPS * compaction.scene.loop
      if (t < at + span - EPS) return show(compaction, (t - at) % compaction.scene.loop)
      at += span
      continue
    }
    const busy = running(at)
    // A sub-agent that started during this slot ends it here.
    if (busy && current && current !== subagents && left > 0 && agents.some(a => a.from > slotAt + EPS && a.from <= at + EPS)) left = 0
    if (!current || left <= 0) {
      if (busy && subagents && !agentsLast) {
        current = subagents
        agentsLast = true
      } else {
        current = order[next++ % order.length] as NamedScene
        agentsLast = false
      }
      left = loops(current)
      slotAt = at
    }
    if (t < at + current.scene.loop - EPS) return show(current, t - at)
    at += current.scene.loop
    left--
  }
  return show(order[0] as NamedScene, 0)
}
