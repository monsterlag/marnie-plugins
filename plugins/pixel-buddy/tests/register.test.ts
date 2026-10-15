import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import type { Compaction } from '../types'
import { eventScenes, nativeScenes } from '../hooks/native'
import { compact, flatten, topLevel } from '../hooks/animate'
import { compactionFired, pick } from '../hooks/rotation'
import { SVG_SOURCE_MAX, animatedSceneSvg } from '../hooks/scene'
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
async function band<S extends 'terminal' | 'desktop'>($: Engine, on: On, surface: S, seated?: Compaction, percent?: number, version = '2.1.295') {
  clock = mock.clock(on, { now: NOW })
  mock.env(on, seated ? { COMPACTION: JSON.stringify(seated) } : {})
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.version', () => ({ value: { version, base: version } }))
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

  test('desktop: the mascot is one picture that plays itself, sent again only when the scene changes', { plugins: [publisher] }, async ($, on) => {
    const ui = await band($, on, 'desktop', undefined, 40)
    const mascot = async () =>
      (await ui.findAll({ type: 'Svg' })).map(s => s.props as { source: string; alt: string; isInteractive?: boolean }).find(s => s.alt.startsWith('Claude is'))
    const first = await mascot()
    expect(first?.isInteractive).toBe(true)
    expect(first?.source).toContain('<animate ')
    expect(first?.source.length).toBeLessThanOrEqual(SVG_SOURCE_MAX)
    // Within the scene nothing changes: the same markup a few seconds on.
    await clock.advance(3_000)
    expect((await mascot())?.source).toBe(first?.source)
    // Over two minutes of idling the picture changes once a scene, never once a tick:
    // the scenes play at least 6 s, so at most one change in six seconds.
    const sources: string[] = []
    for (let s = 0; s < 120; s++) {
      await clock.advance(1_000)
      const now = (await mascot())?.source ?? ''
      if (now !== sources.at(-1)) sources.push(now)
    }
    expect(sources.length).toBeGreaterThanOrEqual(3)
    expect(sources.length).toBeLessThanOrEqual(120 / 6 + 2)
    expect((await mascot())?.source).not.toBe(first?.source)
  })

  test('desktop: a new turn shows a working scene at once', { plugins: [publisher] }, async ($, on) => {
    on('turn.start', (_$, e) => ({ turnId: e.turnId }))
    await band($, on, 'desktop', undefined, 40)
    await $.turn.start({ text: 'hi', turnId: 't1' })
    const ui = await $.ui.mount({ plugin: 'pixel-buddy', surface: 'desktop', component: 'AbovePrompt', props: { ...PROPS, isWorking: true } })
    const alt = (await ui.findAll({ type: 'Svg' })).map(s => s.props as { alt: string }).find(s => s.alt.startsWith('Claude is'))?.alt
    expect(alt).toBe('Claude is working')
  })

  test('desktop: a sub-agent starting its own turn leaves the main mood alone', { plugins: [publisher] }, async ($, on) => {
    on('turn.start', (_$, e) => ({ turnId: e.turnId }))
    const ui = await band($, on, 'desktop', undefined, 40)
    const mascot = async () => (await ui.findAll({ type: 'Svg' })).map(s => s.props as { source: string; alt: string }).find(s => s.alt.startsWith('Claude is'))
    const before = await mascot()
    await $.turn.start({ text: 'research', turnId: 't2', agentId: 'agent-1' })
    // The idle entry, its seed and so its scene are untouched.
    expect((await mascot())?.source).toBe(before?.source)
    expect((await mascot())?.alt).toBe('Claude is idle')
  })

  test('desktop: figures are tabular only on an engine that takes the prop', { plugins: [publisher] }, async ($, on) => {
    // The kit validates with the engine running the test: one older than TABULAR_FROM
    // refuses the prop (which is why the band asks), so there the check cannot run.
    const ui = await band($, on, 'desktop', undefined, 40, '2.1.299').catch((error: Error) => {
      if (/Text prop "tabular" is not allowed/.test(error.message)) return undefined
      throw error
    })
    if (!ui) return
    const value = (await ui.findAll({ type: 'Text' })).find(t => t.text === '41%')
    expect(value?.props).toMatchObject({ bold: true, tabular: true })
  })

  test('desktop: no tabular prop on an older engine', { plugins: [publisher] }, async ($, on) => {
    const ui = await band($, on, 'desktop', undefined, 40, '2.1.295')
    const value = (await ui.findAll({ type: 'Text' })).find(t => t.text === '41%')
    expect(value?.props).not.toHaveProperty('tabular')
  })

  test('animation: every scene fits as one picture of allowed elements', () => {
    for (const variant of ['bleed', 'inline'] as const) {
      for (const { name, scene } of [...Object.values(eventScenes), ...Object.values(nativeScenes).flat()]) {
        const svg = animatedSceneSvg(scene, variant)
        expect([name, variant, svg !== null]).toEqual([name, variant, true])
        expect((svg as string).length).toBeLessThanOrEqual(SVG_SOURCE_MAX)
        // The desktop's scrub drops these, and every event-handler attribute.
        expect(/<(script|foreignObject|image|a|iframe)[\s>]/i.test(svg as string)).toBe(false)
        expect(/\son[a-z]+=/i.test(svg as string)).toBe(false)
        // Built once: the same string every time.
        expect(animatedSceneSvg(scene, variant)).toBe(svg)
      }
    }
  })

  test('animation: elements split, the crab flattens, same-color pixels merge only where order allows', () => {
    expect(topLevel('<rect x="0" y="0" width="1" height="1" fill="#fff"/><g opacity="0.5"><rect x="1" y="1" width="1" height="1" fill="#000"/></g>')).toEqual([
      '<rect x="0" y="0" width="1" height="1" fill="#fff"/>',
      '<g opacity="0.5"><rect x="1" y="1" width="1" height="1" fill="#000"/></g>',
    ])
    expect(flatten('<g transform="translate(2 3)"><rect x="1" y="0" width="2" height="1" fill="#d97757"/></g>')).toEqual([
      '<rect x="3" y="3" width="2" height="1" fill="#d97757"/>',
    ])
    const red = (x: number) => `<rect x="${x}" y="0" width="1" height="1" fill="#f00"/>`
    const blue = (x: number) => `<rect x="${x}" y="0" width="1" height="1" fill="#00f"/>`
    // Apart: the two reds join one path past the blue.
    expect(compact([red(0), blue(1), red(2)])).toBe('<path d="M0 0h1v1h-1zM2 0h1v1h-1z" fill="#f00"/><path d="M1 0h1v1h-1z" fill="#00f"/>')
    // Over the blue: the second red must stay on top, so it gets its own path.
    expect(compact([red(0), blue(1), red(1)])).toBe('<path d="M0 0h1v1h-1z" fill="#f00"/><path d="M1 0h1v1h-1z" fill="#00f"/><path d="M1 0h1v1h-1z" fill="#f00"/>')
    // Translucent pixels on top of each other stack, so they stay separate.
    const glass = '<rect x="0" y="0" width="1" height="1" fill="#fff" fill-opacity="0.5"/>'
    expect(compact([glass, glass])).toBe('<path d="M0 0h1v1h-1z" fill="#fff" fill-opacity="0.5"/><path d="M0 0h1v1h-1z" fill="#fff" fill-opacity="0.5"/>')
  })
})
