import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import type { Compaction } from '../types'
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
const C = 2 * Math.PI * 12
const CHEVRONS = 'd="M10.5 10.2l4.5 3.4 4.5-3.4M10.5 19.8l4.5-3.4 4.5 3.4"'

// A session whose context stands at `percent` (none before a reading), with both usage
// windows read, and the band mounted on `surface`. `seated` is what monster-compact
// has published; undefined is that plugin publishing nothing.
async function band<S extends 'terminal' | 'desktop'>($: Engine, on: On, surface: S, seated?: Compaction, percent?: number) {
  mock.clock(on, { now: NOW })
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

// The rings of a desktop band (every Svg but the mascot) and the texts beside them.
async function rings($: Engine, on: On, seated?: Compaction, percent?: number) {
  const ui = await band($, on, 'desktop', seated, percent)
  const svgs = (await ui.findAll({ type: 'Svg' })).map(s => s.props as { source: string; alt: string })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text)
  return { ui, rings: svgs.filter(s => s.alt.endsWith('ring')), mascot: svgs.filter(s => !s.alt.endsWith('ring')), texts }
}

describe('register', () => {
  test('desktop: two rings, as before, while nothing is published', { plugins: [publisher] }, async ($, on) => {
    const { ui, rings: drawn, mascot, texts } = await rings($, on, undefined, 40)
    expect(drawn.map(r => r.alt)).toEqual(['5h usage ring', '7d usage ring'])
    expect(mascot).toHaveLength(1)
    expect(texts).toEqual(['41%', '5h · resets in 3h 12m', '19%', '7d · resets in 6d 0h'])
    // The left group is the tree the plugin drew before the third ring existed.
    const tree = (await ui.drawn()) as unknown as { children: { props: unknown; children: { props: { key: string } }[] }[] }
    expect(tree.children[0]?.props).toEqual({ flexDirection: 'row', alignItems: 'center', gap: 3 })
    expect(tree.children[0]?.children.map(c => c.props.key)).toEqual(['five_hour', 'seven_day'])
  })

  test('desktop: a third ring, after 7d, when the state is present', { plugins: [publisher] }, async ($, on) => {
    const { ui, rings: drawn, mascot, texts } = await rings($, on, NONE, 40)
    expect(drawn.map(r => r.alt)).toEqual(['5h usage ring', '7d usage ring', 'compaction ring'])
    expect(mascot).toHaveLength(1)
    // 40% of the window against a 60% threshold: two thirds of the way.
    expect(texts.slice(4)).toEqual(['67%', 'compact · at 60%'])
    expect(texts.slice(0, 4)).toEqual(['41%', '5h · resets in 3h 12m', '19%', '7d · resets in 6d 0h'])
    const ring = drawn[2]?.source ?? ''
    expect(ring).toContain(CHEVRONS)
    expect(ring).toContain('stroke="#a0a0a0" stroke-width="1.6" stroke-linecap="round"')
    expect(ring).toContain(`stroke="#4cc35a" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="${((C * 2) / 3).toFixed(2)} ${C.toFixed(2)}"`)
    // Same geometry and track as the other two.
    const track = '<circle cx="15" cy="15" r="12" fill="none" stroke="#3a3a3a" stroke-width="2.6"/>'
    for (const r of drawn) expect(r.source.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="30" height="30">${track}`)).toBe(true)
    const tree = (await ui.drawn()) as unknown as { children: { props: unknown; children: { props: { key: string; gap: number } }[] }[] }
    // The existing gap between items; a band too narrow for three wraps whole items, not their text.
    expect(tree.children[0]?.props).toEqual({ flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap', rowGap: 0 })
    expect(tree.children[0]?.children.map(c => c.props.key)).toEqual(['five_hour', 'seven_day', 'compact'])
    expect(tree.children[0]?.children.map(c => c.props.gap)).toEqual([1, 1, 1])
  })

  test('desktop: a measured saving stands without the mark', { plugins: [publisher] }, async ($, on) => {
    const measured = { ...ONE, lastSaved: 85_343, totalSaved: 85_343, lastSavedMeasured: true, lastBefore: 164_377, lastAfter: 79_034 }
    const { texts } = await rings($, on, measured, 40)
    expect(texts.slice(4)).toEqual(['67%', 'compact · at 60% · 85k saved'])
  })

  test('desktop: a value without a threshold draws the upstream band, never "at undefined%"', { plugins: [publisher] }, async ($, on) => {
    const { compactAtPercent: _none, ...partial } = ONE
    const { ui, rings: drawn, texts } = await rings($, on, partial as Compaction, 40)
    expect(drawn.map(r => r.alt)).toEqual(['5h usage ring', '7d usage ring'])
    expect(texts).toEqual(['41%', '5h · resets in 3h 12m', '19%', '7d · resets in 6d 0h'])
    const tree = (await ui.drawn()) as unknown as { children: { props: unknown }[] }
    expect(tree.children[0]?.props).toEqual({ flexDirection: 'row', alignItems: 'center', gap: 3 })
  })

  test('terminal: the compaction joins the line, in its format', { plugins: [publisher] }, async ($, on) => {
    const ui = await band($, on, 'terminal', ONE, 40)
    expect((await ui.findAll({ type: 'Text' })).map(t => [t.text, t.props])).toEqual([
      ['5h 41%   7d 19%   compact 67% · ~172k saved', { dimColor: true }],
    ])
  })
})
