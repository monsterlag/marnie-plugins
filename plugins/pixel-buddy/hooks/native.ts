// The registry of native scenes: one file per group, each exporting `scenes`.
import type { Mood } from '../types'
import { scenes as done } from './native-done'
import { scenes as events } from './native-events'
import { scenes as idle } from './native-idle'
import type { NamedScene } from './native-kit'
import { scenes as relax } from './native-relax'
import { scenes as working } from './native-working'

// What each mood plays. A mood with none yet falls back to the old mirrored scenes.
export const nativeScenes: Record<Mood, NamedScene[]> = { idle, working, done, relax }

// The event scenes, by name.
export const eventScenes: Record<string, NamedScene> = Object.fromEntries(events.map(s => [s.name, s]))
