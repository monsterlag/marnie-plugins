import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import type { Compaction } from '../types'
import { eventScenes } from '../hooks/native'
import { compactionFired, frameDue, pick } from '../hooks/rotation'
import { publisher } from './fixtures/publisher'

const NOW = Date.parse('2026-10-07T12:00:00.000Z')
const PROPS = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 12,
  bodyColumns: 160,
  scroll: { offset: 0, bodyRows: 11 },
  view: {},
}
const NONE: Compaction = { compactAtPercent: 60, count: 0, lastSaved: 0, lastSavedMeasured: false, totalSaved: 0, lastAt: null }
const ONE: Compaction = { ...NONE, count: 1, lastSaved: 172_000, totalSaved: 172_000, lastAt: NOW }
// The context bar's tick: 2 px wide, centred on 60% of the 72 px bar.
const TICK = '<rect x="42.20" y="0" width="2" height="7" fill="#e8e6df"/>'

// The mocked clock of the band last mounted.
let clock: ReturnType<typeof mock.clock>

// A session whose context stands at `percent` (none before a reading), with both usage
// windows read, and the band mounted on `surface`. `seated` is what monster-compact
// has published; undefined is that plugin publishing nothing.
async function band<S extends 'terminal' | 'desktop'>($: Engine, on: On, surface: S, seated?: Compaction, percent?: number) {
  clock = mock.clock(on, { now: NOW })
  mock.env(on, seated ? { COMPACTION: JSON.stringify(seated) } : {})
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({
    value: {
      startedAt: NOW,
      context: { window: 200_000, ...(percent === undefined ? {} : { tokens: percent * 2000, percent }) },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 41, resetsAt: '2026-10-07T15:12:00.000Z' },
        { kind: 'seven_day', percentUsed: 19, resetsAt: '2026-10-13T12:00:00.000Z' },
      ],
    },
  }))
  await $.session.start({ surface, isInteractive: true, cwd: '/work' })
  return $.ui.mount({ plugin: 'pixel-buddy', surface, component: 'AbovePrompt', props: PROPS })
}

// A desktop band's stat columns (their keys, in order), its bars (every Svg that says
// it is one), its mascot, and its texts in reading order.
async function columns($: Engine, on: On, seated?: Compaction, percent?: number) {
  const ui = await band($, on, 'desktop', seated, percent)
  const svgs = (await ui.findAll({ type: 'Svg' })).map(s => s.props as { source: string; alt: string; width: number; height: number })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text)
  const tree = (await ui.drawn()) as unknown as { children: { children: { props: { key: string } }[] }[] }
  // The bled mascot and the blank holding its room lead; the stat columns follow.
  const keys = tree.children[2]?.children.map(c => c.props.key)
  return { keys, bars: svgs.filter(s => / bar, /.test(s.alt)), mascot: svgs.filter(s => s.alt.startsWith('Claude is')), texts }
}

const LIMITS = ['41%', '5h', 'resets 3h 12m', '19%', '7d', 'resets 6d 0h']
const CONTEXT = ['80k', '/ 200k', 'context · 40%']

describe('register', () => {
  test('desktop: the mascot and three columns while nothing is published', { plugins: [publisher] }, async ($, on) => {
    const { keys, bars, mascot, texts } = await columns($, on, undefined, 40)
    expect(keys).toEqual(['five_hour', 'seven_day', 'context'])
    expect(texts).toEqual([...LIMITS, ...CONTEXT])
    expect(bars.map(b => b.alt)).toEqual(['5h bar, 41%', '7d bar, 19%', 'context bar, 40%'])
    // No threshold is known, so the context bar carries no tick.
    expect(bars.some(b => b.source.includes('#e8e6df'))).toBe(false)
    expect(bars[0]?.source).toContain('<rect x="0" y="2" width="29.52" height="3" rx="1.5" fill="#4cc35a"/>')
    expect(mascot.map(m => [m.width, m.height])).toEqual([[216, 104]])
  })

  test('desktop: a fourth column and the context tick when the state is present', { plugins: [publisher] }, async ($, on) => {
    const { keys, bars, mascot, texts } = await columns($, on, { ...ONE, count: 3 }, 40)
    expect(keys).toEqual(['five_hour', 'seven_day', 'context', 'compact'])
    // 80k of a 200k window against a 60% threshold: 120k - 80k left.
    expect(texts).toEqual([...LIMITS, ...CONTEXT, '40k', 'left', 'saved ~172k (3×)'])
    // The fourth column has no bar; the tick is on the context bar alone.
    expect(bars.map(b => [b.alt, b.source.includes(TICK)])).toEqual([
      ['5h bar, 41%', false],
      ['7d bar, 19%', false],
      ['context bar, 40%', true],
    ])
    expect(mascot).toHaveLength(1)
  })

  test('desktop: a measured saving stands without the mark', { plugins: [publisher] }, async ($, on) => {
    const measured = { ...ONE, lastSaved: 85_343, totalSaved: 85_343, lastSavedMeasured: true, lastBefore: 164_377, lastAfter: 79_034 }
    const { texts } = await columns($, on, measured, 40)
    expect(texts.slice(-3)).toEqual(['40k', 'left', 'saved 85k'])
  })

  test('desktop: a value without a usable threshold draws the three-column band', { plugins: [publisher] }, async ($, on) => {
    const { compactAtPercent: _none, ...partial } = ONE
    const { keys, bars, texts } = await columns($, on, partial as Compaction, 40)
    expect(keys).toEqual(['five_hour', 'seven_day', 'context'])
    expect(texts).toEqual([...LIMITS, ...CONTEXT])
    expect(bars.some(b => b.source.includes('#e8e6df'))).toBe(false)
  })

  test('terminal: one line with the same figures', { plugins: [publisher] }, async ($, on) => {
    const ui = await band($, on, 'terminal', ONE, 40)
    expect((await ui.findAll({ type: 'Text' })).map(t => [t.text, t.props])).toEqual([
      ['5h 41% 3h 12m · 7d 19% 6d 0h · ctx 80k/200k 40% · 40k left · saved ~172k', { dimColor: true }],
    ])
  })

  test('rotation: a compaction cuts in at the next loop boundary for two loops, then the rotation resumes', () => {
    expect(compactionFired({ count: 1, lastAt: 10 }, { count: 2, lastAt: 20 })).toBe(true)
    expect(compactionFired({ count: 1, lastAt: 10 }, { count: 1, lastAt: 10 })).toBe(false)
    const SEED = 7
    const playing = pick('working', 4, SEED)
    const boundary = playing.scene.loop
    const span = 2 * (eventScenes.compaction?.scene.loop ?? 0)
    const cues = { compactions: [4] }
    // Noticed 4 s in: the scene on show finishes its loop first.
    expect(pick('working', boundary - 0.1, SEED, cues).name).toBe(playing.name)
    expect(pick('working', boundary + 0.1, SEED, cues).name).toBe('compaction')
    expect(pick('working', boundary + span - 0.1, SEED, cues).name).toBe('compaction')
    // Then the rotation is where it would have been at that boundary.
    const resumed = pick('working', boundary + span + 0.1, SEED, cues)
    const undisturbed = pick('working', boundary + 0.1, SEED)
    expect([resumed.name, resumed.local]).toEqual([undisturbed.name, undisturbed.local])
  })

  test('frames: a working session animates, a quiet one only at first and then holds a still', () => {
    const [ANIMATE, STILL] = [120_000, 16_000]
    expect(frameDue('working', 3_600_000, 150, ANIMATE, STILL)).toBe(true)
    expect(frameDue('done', 2_000, 150, ANIMATE, STILL)).toBe(true)
    expect(frameDue('idle', 119_000, 150, ANIMATE, STILL)).toBe(true)
    expect(frameDue('idle', 3_600_000, 150, ANIMATE, STILL)).toBe(false)
    expect(frameDue('relax', 3_600_000, 15_900, ANIMATE, STILL)).toBe(false)
    expect(frameDue('idle', 3_600_000, 16_000, ANIMATE, STILL)).toBe(true)
  })

  test('desktop: an idle session stops redrawing the mascot once the quiet window has passed', { plugins: [publisher] }, async ($, on) => {
    const ui = await band($, on, 'desktop', undefined, 40)
    const mascot = async () => (await ui.findAll({ type: 'Svg' })).map(s => s.props as { source: string; alt: string }).find(s => s.alt.startsWith('Claude is'))?.source
    // Inside the window the picture moves with the clock.
    await clock.advance(1_500)
    const early = await mascot()
    await clock.advance(1_500)
    expect(await mascot()).not.toBe(early)
    // Past it, a few seconds change nothing; a whole slot brings one new still.
    await clock.advance(150_000)
    const still = await mascot()
    await clock.advance(3_000)
    expect(await mascot()).toBe(still)
    await clock.advance(16_000)
    expect(await mascot()).not.toBe(still)
  })
})
