// The registry of native scenes: one file per group, each exporting `scenes`.
import type { Mood } from '../types'
import { scenes as done } from './native-done'
import { scenes as events } from './native-events'
import { scenes as idle } from './native-idle'
import type { NamedScene } from './native-kit'
import { scenes as relax } from './native-relax'
import { scenes as working } from './native-working'

// The event scenes, by name. `compaction` and `subagents` cut into the rotation when
// their cue comes (see rotation.ts); `waiting` and `fallback` have no cue and play as
// ordinary rotation scenes below.
export const eventScenes: Record<string, NamedScene> = Object.fromEntries(events.map(s => [s.name, s]))

// What each mood plays in rotation. `waiting` and `fallback` are event scenes by file and
// ordinary idle and working scenes by use.
export const nativeScenes: Record<Mood, NamedScene[]> = {
  idle: [...idle, ...events.filter(s => s.name === 'waiting')],
  working: [...working, ...events.filter(s => s.name === 'fallback')],
  done,
  relax,
}
