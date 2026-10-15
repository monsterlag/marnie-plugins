import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRun, Compaction, Ctx, Limit, Mood } from '../types'
import { compactionFired, doneSeconds, pick } from './rotation'
import type { Shown } from './rotation'
import { SCENE_BODY_HEIGHT, SCENE_BODY_WIDTH, SCENE_HEIGHT, SCENE_WIDTH, animatedSceneSvg, sceneSvg } from './scene'

const mood = atom({ plugin: 'pixel-buddy', key: 'mood' } as const, 'idle' as Mood)
const moodAt = atom({ plugin: 'pixel-buddy', key: 'moodAt' } as const, 0)
// When the scene on show last changed: the band picks its scene at this time. The scene
// animates itself, so this is written only when another scene is due (see refreshScene).
const frame = atom({ plugin: 'pixel-buddy', key: 'frame' } as const, 0)
const cacheAt = atom({ plugin: 'pixel-buddy', key: 'cacheAt' } as const, null as number | null)
const now = atom({ plugin: 'pixel-buddy', key: 'now' } as const, 0)
const minute = atom({ plugin: 'pixel-buddy', key: 'minute' } as const, 0)
const ctx = atom({ plugin: 'pixel-buddy', key: 'ctx' } as const, null as Ctx | null)
const limits = atom({ plugin: 'pixel-buddy', key: 'limits' } as const, [] as Limit[])
// The compaction value as last looked at, when each compaction since this mood began was
// noticed, and the sub-agents spawned and not yet forgotten: the cues for event scenes.
const compSeen = atom({ plugin: 'pixel-buddy', key: 'compSeen' } as const, null as { count: number; lastAt: number | null } | null)
const compactions = atom({ plugin: 'pixel-buddy', key: 'compactions' } as const, [] as number[])
const agents = atom({ plugin: 'pixel-buddy', key: 'agents' } as const, [] as AgentRun[])
// monster-compact's value, read only: undefined while that plugin is not installed.
const compaction = { plugin: 'monster-compact', key: 'compaction' } as const

// The "task complete" party plays once, then Claude relaxes for a while before idling.
const RELAX_MS = 4 * 60_000
// The scene is looked at again at its next loop boundary (when the next scene may be due),
// and at least this often, so a missed change shows within this long.
const SCENE_CHECK_MAX_MS = 5_000
// From this engine release a Text may set `tabular` (figures of one width), which keeps
// the stat columns from shifting as their numbers change; earlier engines refuse a tree
// that sets it.
const TABULAR_FROM: [number, number, number] = [2, 1, 299]
// A sub-agent the engine gave no id (so its end is never reported) counts as running
// for this long after its spawn; one with an id that never reports an end, for
// SUBAGENT_STALE_S.
const SUBAGENT_LINGER_S = 45
const SUBAGENT_STALE_S = 30 * 60
// A compaction noticed up to this long before a mood began still plays, at its start.
const COMPACTION_CARRY_S = 20

// Layout, tuned by eye in the desktop app. Box gaps are in character
// cells; the bar is in CSS pixels.
// BLEED: the mascot picture leaves the flow and is pinned by its top-left corner above
// and left of the band's content, so the band's own edge clips it; a blank the size of the
// picture's scene part holds its room in the row. Offsets are whole character cells
// from the root row's edges, negative outward. Off, the narrow layout is always used.
const BLEED: boolean = true
// The bleed layout is used from this many band cells (bodyColumns); below, or with
// BLEED off, the narrow layout.
const WIDE_MIN_COLUMNS = 84
const BLEED_TOP = -1
const BLEED_LEFT = -2
// The blank that holds the bled picture's room, in CSS pixels.
const BLEED_SPACER_WIDTH = SCENE_BODY_WIDTH
const BLEED_SPACER_HEIGHT = SCENE_BODY_HEIGHT
// Between the mascot and the stats beside it (or, wrapped, the rows under it).
const MASCOT_GAP = 2
// Between stat columns, and between the two rows they wrap to.
const STAT_GAP = 2
const STAT_ROW_GAP = 1
// Between a value and its unit label.
const UNIT_GAP = 1
const BAR_WIDTH = 72
const BAR_HEIGHT = 7
const BAR_THICKNESS = 3
const TICK_WIDTH = 2
const BAR_TRACK = '#3a3a38'
const BAR_TICK = '#e8e6df'

const GREEN = '#4cc35a'
const AMBER = '#e5a33a'
const RED = '#e5534b'
const levelColor = (p: number) => (p >= 90 ? RED : p >= 70 ? AMBER : GREEN)

function span(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m % 60}m`
  return `${m}m`
}

function clockText(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// A stat column's bar: a 3 px track with a fill to `percent`, and for the context
// column a tick at `tick` percent. A pure function of its arguments, so an unchanged
// reading gives the identical string.
function barSvg(percent: number, color: string, tick?: number): string {
  const y = (BAR_HEIGHT - BAR_THICKNESS) / 2
  const r = BAR_THICKNESS / 2
  const w = (BAR_WIDTH * Math.min(100, Math.max(0, percent))) / 100
  const x = tick === undefined ? 0 : Math.min(BAR_WIDTH - TICK_WIDTH, Math.max(0, (BAR_WIDTH * tick) / 100 - TICK_WIDTH / 2))
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BAR_WIDTH} ${BAR_HEIGHT}" width="${BAR_WIDTH}" height="${BAR_HEIGHT}">` +
    `<rect x="0" y="${y}" width="${BAR_WIDTH}" height="${BAR_THICKNESS}" rx="${r}" fill="${BAR_TRACK}"/>` +
    (w > 0 ? `<rect x="0" y="${y}" width="${w.toFixed(2)}" height="${BAR_THICKNESS}" rx="${r}" fill="${color}"/>` : '') +
    (tick === undefined ? '' : `<rect x="${x.toFixed(2)}" y="0" width="${TICK_WIDTH}" height="${BAR_HEIGHT}" fill="${BAR_TICK}"/>`) +
    `</svg>`
  )
}
// A real drawing, fully transparent: the desktop gives an empty document no room.
const MASCOT_SPACER =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BLEED_SPACER_WIDTH} ${BLEED_SPACER_HEIGHT}" width="${BLEED_SPACER_WIDTH}" height="${BLEED_SPACER_HEIGHT}">` +
  `<rect x="0" y="0" width="${BLEED_SPACER_WIDTH}" height="${BLEED_SPACER_HEIGHT}" fill="#000000" fill-opacity="0"/></svg>`
// Holds the bar's room in a column that has none, so its lines sit level with the rest.
const BAR_SPACER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BAR_WIDTH} ${BAR_HEIGHT}" width="${BAR_WIDTH}" height="${BAR_HEIGHT}"/>`

// A pixel hourglass: sand on top drains as the cache TTL runs out.
function hourglassSvg(frac: number): string {
  const sand = frac > 0 ? (frac > 0.2 ? GREEN : AMBER) : '#555'
  const frame = '#9a9a9a'
  let px = ''
  const r = (x: number, y: number, w: number, h: number, c: string) => {
    px += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`
  }
  r(0, 0, 7, 1, frame)
  r(0, 8, 7, 1, frame)
  r(1, 1, 1, 2, frame); r(5, 1, 1, 2, frame); r(2, 3, 1, 1, frame); r(4, 3, 1, 1, frame)
  r(3, 4, 1, 1, frame)
  r(2, 5, 1, 1, frame); r(4, 5, 1, 1, frame); r(1, 6, 1, 2, frame); r(5, 6, 1, 2, frame)
  const top = Math.ceil(2 * frac)
  if (top > 0) r(2, 3 - top, 3, top, sand)
  r(2, 7, 3, 1, sand)
  if (frac < 1 && frac > 0) r(2, 6, 3, 1, sand)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 9" width="14" height="18" shape-rendering="crispEdges">${px}</svg>`
}

function ctxBarSvg(percent: number): string {
  let px = ''
  const lit = Math.round(percent / 10)
  for (let i = 0; i < 10; i++) {
    px += `<rect x="${i * 4}" y="0" width="3" height="8" fill="${i < lit ? levelColor(percent) : '#3a3a3a'}"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 39 8" width="39" height="8" shape-rendering="crispEdges">${px}</svg>`
}

// A new entry into a mood: its clock starts, and the cues of the last one are dropped
// (a sub-agent still running stays, and a compaction only just noticed).
async function setMood($: EngineInterface, m: Mood) {
  const t = await $.clock.now()
  await update($, compactions, list => list.filter(at => t - at < COMPACTION_CARRY_S * 1000))
  await update($, agents, list => list.filter(a => a.until === null && t - a.from < SUBAGENT_STALE_S * 1000))
  await update($, moodAt, () => t)
  await update($, mood, () => m)
}

// Looks at what monster-compact publishes; another compaction since the last look is
// noted with its time, and the scene looked at again. The value there at the first look is only
// remembered.
async function watchCompaction($: EngineInterface) {
  const k = published(await read($, compaction))
  const seen = await read($, compSeen)
  const current = k ? { count: k.count, lastAt: k.lastAt } : null
  if (current && seen && compactionFired(seen, current)) {
    const t = await $.clock.now()
    await update($, compactions, list => [...list, t])
    await refreshScene($)
  }
  if (current?.count !== seen?.count || current?.lastAt !== seen?.lastAt || !current !== !seen) await update($, compSeen, () => current)
}

// Which mood's scene shows `elapsed` seconds into a mood, and how far into that mood:
// done hands off to relax after its one loop, relax to idle. `seed` is the entry's.
function sceneFor(m: Mood, elapsed: number, seed: number): { mood: Mood; t: number } {
  const relaxS = RELAX_MS / 1000
  if (m === 'done') {
    const doneS = doneSeconds(seed)
    return elapsed < doneS ? { mood: 'done', t: elapsed } : sceneFor('relax', elapsed - doneS, seed)
  }
  if (m === 'relax' && elapsed >= relaxS) return { mood: 'idle', t: elapsed - relaxS }
  return { mood: m, t: elapsed }
}

// The scene on show at `t` (epoch ms) for the stored mood and cues, as the band picks it,
// how far into its loop it is, and how long until the next moment another may be due (its
// next loop boundary, or relax handing over to idle).
async function sceneAt($: EngineInterface, t: number, m: Mood, since: number): Promise<{ mood: Mood; shown: Shown; nextMs: number }> {
  const elapsed = Math.max(0, (t - since) / 1000)
  const { mood: shownMood, t: sceneT } = sceneFor(m, elapsed, since)
  // The cues, as seconds into the mood on show.
  const moodAtMs = since + (elapsed - sceneT) * 1000
  const into = (ms: number) => (ms - moodAtMs) / 1000
  const shown = pick(shownMood, sceneT, since, {
    compactions: (await read($, compactions)).map(into).map(at => (at < 0 && at > -COMPACTION_CARRY_S ? 0 : at)),
    agents: (await read($, agents)).map(a => ({ from: Math.max(0, into(a.from)), until: into(a.until ?? a.from + SUBAGENT_STALE_S * 1000) })),
  })
  const toBoundary = (shown.scene.loop - shown.local) * 1000
  const toIdle = shownMood === 'relax' ? (RELAX_MS / 1000 - sceneT) * 1000 : Infinity
  return { mood: shownMood, shown, nextMs: Math.min(toBoundary, toIdle) }
}

// This session's scene bookkeeping (the module runs once per session; a reload starts it
// over, and session.start runs again): the scene last written, the pending look, the
// queue that keeps looks one at a time, and whether the engine takes `tabular`.
let shownKey: string | undefined
let wake: { cancel: () => void } | undefined
let looking: Promise<void> = Promise.resolve()
let tabular = false

// Looks at which scene is due and writes `frame` only when it is another one: the band
// redraws once a scene, never a frame. Then waits for the scene's next loop boundary (or
// SCENE_CHECK_MAX_MS at most) to look again. Mood and cue changes call it at once. Runs
// one look at a time; a failed look tries again after SCENE_CHECK_MAX_MS.
function refreshScene($: EngineInterface): Promise<void> {
  looking = looking.then(() => lookAtScene($)).catch(() => undefined)
  return looking
}

async function lookAtScene($: EngineInterface) {
  let nextMs = SCENE_CHECK_MAX_MS
  try {
    const t = await $.clock.now()
    const at = await sceneAt($, t, await read($, mood), await read($, moodAt))
    const key = `${at.mood}/${at.shown.name}`
    if (key !== shownKey) {
      shownKey = key
      await update($, frame, () => t)
    }
    nextMs = Math.min(SCENE_CHECK_MAX_MS, Math.max(50, at.nextMs + 20))
  } finally {
    wake?.cancel()
    wake = $.clock.after(nextMs, () => void refreshScene($))
  }
}

// Whether the engine's version is at least `min`.
const atLeast = (version: string, min: [number, number, number]) => {
  const parts = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (!parts) return false
  const v: [number, number, number] = [Number(parts[1]), Number(parts[2]), Number(parts[3])]
  for (let i = 0; i < 3; i++) if (v[i] !== min[i]) return (v[i] as number) > (min[i] as number)
  return true
}

// 999,500 and up rounds to a million, so it is written in M (never "1000k"); a whole
// number of millions drops its ".0".
const kTokens = (n: number) =>
  n >= 999_500 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : `${Math.round(n / 1000)}k`

// Tokens of context left before the next compaction, never below 0; undefined before a reading.
const leftToCompact = (c: Ctx | null, at: number) =>
  c?.tokens === undefined ? undefined : Math.max(0, (c.window * at) / 100 - c.tokens)
// What the latest compaction saved: a figure the publisher measured stands as it is, its
// estimate is marked as one. Undefined before the first compaction.
const savedText = (k: Compaction) =>
  k.count
    ? `saved ${k.lastSavedMeasured === true ? '' : '~'}${kTokens(k.lastSaved)}${k.count > 1 ? ` (${k.count}×)` : ''}`
    : undefined
// A published value is drawn only when it holds a usable threshold and saving: anything
// else is no publisher at all.
const published = (k: Compaction | undefined) =>
  k &&
  typeof k.compactAtPercent === 'number' &&
  Number.isFinite(k.compactAtPercent) &&
  k.compactAtPercent > 0 &&
  k.compactAtPercent <= 100 &&
  typeof k.lastSaved === 'number' &&
  Number.isFinite(k.lastSaved) &&
  k.lastSaved >= 0
    ? k
    : undefined

type Stat = { key: string; label: string; value: string; unit: string; caption: string; bar?: { percent: number; tick?: number } }

export const register: Register = (on, options) => {
  const ttlMs = options.cacheTtl === '5m' ? 5 * 60_000 : 60 * 60_000

  on('session.start', async ($, e, next) => {
    const u = await $.session.usage()
    await update($, ctx, () => u.context)
    await update($, limits, () => u.rateLimits)
    const t0 = await $.clock.now()
    await update($, minute, () => t0)

    // Keep "resets in" fresh, and tick the cache countdown while it is warm.
    $.clock.every(60_000, async () => {
      const t = await $.clock.now()
      await update($, minute, () => t)
    })
    await update($, moodAt, () => t0)
    try {
      tabular = atLeast((await $.session.version()).version, TABULAR_FROM)
    } catch {
      tabular = false
    }
    shownKey = undefined
    await watchCompaction($)
    $.clock.every(1_000, () => watchCompaction($))
    await refreshScene($)
    $.clock.every(1_000, async () => {
      const at = await read($, cacheAt)
      if (at === null) return
      const t = await $.clock.now()
      if (t - at < ttlMs + 2_000) await update($, now, () => t)
    })

    return next(e)
  })

  // Each response refreshes the prompt cache and reports the live usage.
  on('session.measure', async ($, e, next) => {
    await update($, ctx, () => e.context)
    if (e.rateLimits.length) await update($, limits, () => e.rateLimits)
    if (e.changed.includes('context')) {
      const t = await $.clock.now()
      await update($, cacheAt, () => t)
      await update($, now, () => t)
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await setMood($, 'working')
    await refreshScene($)
    return next(e)
  })

  // A sub-agent is starting: note it, so the working rotation can favour `subagents`
  // while it runs. The spawn's own answer is passed on untouched, whatever the note does.
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    try {
      if (!('deny' in started && started.deny)) {
        const t = await $.clock.now()
        const id = 'agentId' in started ? started.agentId : undefined
        const run: AgentRun = id ? { id, from: t, until: null } : { from: t, until: t + SUBAGENT_LINGER_S * 1000 }
        await update($, agents, list => [...list, run])
        await refreshScene($)
      }
    } catch {
      // The band's bookkeeping must never cost a spawn.
    }
    return started
  })

  // Task complete: the party plays once, then Claude relaxes, then idles. The hand-offs
  // are worked out from the clock on each frame (see sceneFor), so no timer can be lost.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId) {
      // A sub-agent's own turn ended: it is no longer running.
      const t = await $.clock.now()
      await update($, agents, list => list.map(a => (a.id === e.agentId && a.until === null ? { ...a, until: t } : a)))
      await refreshScene($)
      return next(e)
    }
    await setMood($, e.isAborted || e.reason === 'error' ? 'idle' : 'done')
    await refreshScene($)
    return next(e)
  })

  // The band above the prompt: a column of exact figures each for the 5h and 7d limits
  // and the context (a fourth, tokens left before the next compaction, while
  // monster-compact publishes one), led by the mascot at the left.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const rl = await read($, limits)
    const t = await read($, minute)
    const c = await read($, ctx)
    const comp = published(await read($, compaction))

    const limitStat = (kind: string, label: string): Stat => {
      const lim = rl.find(l => l.kind === kind)
      return {
        key: kind,
        label,
        value: lim ? `${Math.round(lim.percentUsed)}%` : '–',
        unit: label,
        caption: lim?.resetsAt && t ? `resets ${span(Date.parse(lim.resetsAt) - t)}` : 'waiting',
        bar: { percent: Math.round(lim?.percentUsed ?? 0) },
      }
    }
    const left = comp ? leftToCompact(c, comp.compactAtPercent) : undefined
    const stats: Stat[] = [
      limitStat('five_hour', '5h'),
      limitStat('seven_day', '7d'),
      {
        key: 'context',
        label: 'context',
        value: c?.tokens === undefined ? '–' : kTokens(c.tokens),
        unit: c ? `/ ${kTokens(c.window)}` : '',
        caption: c?.percent === undefined ? 'context' : `context · ${Math.round(c.percent)}%`,
        bar: { percent: Math.round(c?.percent ?? 0), ...(comp ? { tick: comp.compactAtPercent } : {}) },
      },
      ...(comp
        ? [
            {
              key: 'compact',
              label: 'to compact',
              value: left === undefined ? '–' : kTokens(left),
              unit: 'left',
              caption: savedText(comp) ?? 'saved –',
            },
          ]
        : []),
    ]

    if (e.surface !== 'desktop' && e.surface !== 'vscode') {
      const [five, seven, context] = stats as [Stat, Stat, Stat]
      const limitText = (s: Stat) => [s.label, s.value, ...(s.caption.startsWith('resets ') ? [s.caption.slice(7)] : [])].join(' ')
      const saved = comp ? savedText(comp) : undefined
      const line = [
        limitText(five),
        limitText(seven),
        c?.tokens === undefined ? 'ctx –' : `ctx ${context.value}/${kTokens(c.window)}${c.percent === undefined ? '' : ` ${Math.round(c.percent)}%`}`,
        ...(comp ? [`${left === undefined ? '–' : kTokens(left)} left`, ...(saved ? [saved] : [])] : []),
      ].join(' · ')
      return (
        <Box>
          <Text dimColor>{line}</Text>
        </Box>
      )
    }
    const { Svg } = $.ui.resolve(e as typeof e & { surface: 'desktop' })

    const stored = await read($, mood)
    const m: Mood = e.props.isWorking ? 'working' : stored === 'working' ? 'idle' : stored
    const tFrame = await read($, frame)
    const since = m === stored ? await read($, moodAt) : 0
    const { mood: shownMood, shown } = await sceneAt($, tFrame, m, since)

    // Figures of one width, where the engine takes them (typed loosely: older engines'
    // types do not know the prop).
    const figures = (tabular ? { tabular: true } : {}) as object
    const column = (s: Stat) => (
      <Box key={s.key} flexDirection="column" flexShrink={0}>
        <Box flexDirection="row" gap={UNIT_GAP}>
          <Text bold wrap="truncate-end" {...figures}>{s.value}</Text>
          {s.unit ? <Text dimColor wrap="truncate-end">{s.unit}</Text> : null}
        </Box>
        <Text dimColor wrap="truncate-end">{s.caption}</Text>
        {s.bar ? (
          <Svg
            source={barSvg(s.bar.percent, levelColor(s.bar.percent), s.bar.tick)}
            alt={`${s.label} bar, ${s.bar.percent}%`}
            width={BAR_WIDTH}
            height={BAR_HEIGHT}
          />
        ) : (
          <Svg source={BAR_SPACER} alt="" width={BAR_WIDTH} height={BAR_HEIGHT} />
        )}
      </Box>
    )
    // The columns go in pairs that never break, so a narrow band wraps them to two
    // rows of two (5h 7d over context and to-compact), never three and one.
    const pair = (key: string, pairStats: Stat[]) => (
      <Box key={key} flexDirection="row" alignItems="flex-start" gap={STAT_GAP} flexShrink={0}>
        {pairStats.map(column)}
      </Box>
    )

    // The scene's whole loop as one picture that plays itself: the same markup for as long
    // as the scene is on show, so the app keeps playing it while the stats redraw. A scene
    // too big for that (none today) shows as a still.
    const mascotSvg = (variant: 'bleed' | 'inline') => {
      const animated = animatedSceneSvg(shown.scene, variant)
      return (
        <Svg
          source={animated ?? sceneSvg(shown.scene, shown.local, variant, tFrame / 1000)}
          alt={`Claude is ${shownMood === 'done' ? 'celebrating' : shownMood === 'relax' ? 'relaxing' : shownMood}`}
          width={variant === 'bleed' ? SCENE_WIDTH : SCENE_BODY_WIDTH}
          height={variant === 'bleed' ? SCENE_HEIGHT : SCENE_BODY_HEIGHT}
          isInteractive={animated !== null}
        />
      )
    }
    const statPairs = [pair('limits', stats.slice(0, 2)), pair('session', stats.slice(2))]

    // Wide: one row that never wraps, so the band keeps the height the bled picture's
    // outline was measured for. The picture is out of the flow, pinned by its top-left
    // corner past the band's edge; the blank holds its room before the stats, whose
    // columns spread evenly over the rest of the band (STAT_GAP is the least between them).
    if (BLEED && e.props.bodyColumns >= WIDE_MIN_COLUMNS) {
      return (
        <Box position="relative" flexDirection="row" alignItems="center" flexWrap="nowrap" columnGap={MASCOT_GAP} paddingX={1}>
          <Box position="absolute" top={BLEED_TOP} left={BLEED_LEFT} flexDirection="row" alignItems="flex-start">
            {mascotSvg('bleed')}
          </Box>
          <Box flexShrink={0}>
            <Svg source={MASCOT_SPACER} alt="mascot space" width={BLEED_SPACER_WIDTH} height={BLEED_SPACER_HEIGHT} />
          </Box>
          <Box flexDirection="row" alignItems="flex-start" justifyContent="space-between" flexWrap="nowrap" flexGrow={1} flexShrink={1} columnGap={STAT_GAP}>
            {stats.map(column)}
          </Box>
        </Box>
      )
    }
    // Narrow: no bleed. The picture has the first row to itself, in the flow and never
    // squeezed; the stats follow under it, their two pairs wrapping to two rows of two.
    return (
      <Box flexDirection="column" alignItems="flex-start" rowGap={STAT_ROW_GAP} paddingX={1}>
        <Box flexShrink={0}>{mascotSvg('inline')}</Box>
        <Box flexDirection="row" alignItems="flex-start" flexWrap="wrap" flexShrink={1} columnGap={STAT_GAP} rowGap={STAT_ROW_GAP}>
          {statPairs}
        </Box>
      </Box>
    )
  })

  // Beside the model picker: prompt-cache countdown and context fill.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const { Box, Text } = $.ui.resolve(e)
    const at = await read($, cacheAt)
    const tNow = await read($, now)
    const c = await read($, ctx)
    const left = at === null ? 0 : ttlMs - (tNow - at)
    const warm = at !== null && left > 0
    const cacheLabel = at === null ? 'cache –' : warm ? `cache ${clockText(left)}` : 'cache cold'
    const cacheColor = !warm ? undefined : left < 60_000 ? AMBER : GREEN
    const pct = c?.percent
    const ctxLabel =
      pct === undefined ? 'ctx –' : `ctx ${pct}%${c?.tokens ? ` · ${kTokens(c.tokens)}/${kTokens(c.window)}` : ''}`
    const modes = e.props.modes.join(' & ')

    if (e.surface !== 'desktop' && e.surface !== 'vscode') {
      return <Text dimColor>{[cacheLabel, ctxLabel, modes].filter(Boolean).join('  ·  ')}</Text>
    }
    const { Svg } = $.ui.resolve(e as typeof e & { surface: 'desktop' })

    return (
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Svg source={hourglassSvg(warm ? left / ttlMs : 0)} alt="prompt cache timer" width={14} height={18} />
        <Text color={cacheColor} dimColor={!warm}>{cacheLabel}</Text>
        <Text dimColor>·</Text>
        <Svg source={ctxBarSvg(pct ?? 0)} alt="context used" width={39} height={8} />
        <Text dimColor>{ctxLabel}</Text>
        {modes ? <Text dimColor>{`· ${modes}`}</Text> : null}
      </Box>
    )
  })
}
