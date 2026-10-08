import type { Plugin } from 'claude-code/testing'

// Stands in for monster-compact, the owner of the compaction value: it publishes
// what the test seats in the COMPACTION variable (JSON), and nothing without one.
export const publisher: Plugin = {
  name: 'monster-compact',
  register(on) {
    on('session.start', async ($, e, next) => {
      const seated = await $.env.get('COMPACTION')
      if (seated) await $.state.set({ plugin: 'monster-compact', key: 'compaction' }, JSON.parse(seated))
      return next(e)
    })
  },
}
