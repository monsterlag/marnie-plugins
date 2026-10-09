export type Mood = 'idle' | 'working' | 'done' | 'relax'
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Ctx = { tokens?: number; window: number; percent?: number }

// A mirror of monster-compact's contract (its types/index.d.ts). That plugin owns and
// writes the value; this one only reads it, to draw the context tick and the to-compact column. Keep in step.
export type Compaction = {
  /** Context percent at which the plugin asks for compaction. */
  compactAtPercent: number
  /** Compactions this session that replaced the history (the plugin's own or a built-in fallback). */
  count: number
  /**
   * Tokens the latest one removed. Measured where lastSavedMeasured: the real context
   * before it less the real context at the first reading after it. Until that reading,
   * and where the turn since grew the context past the saving, the plugin's own
   * estimate (its token count of the text it cut), which runs low.
   */
  lastSaved: number
  /** True once lastSaved is the difference of two real context readings; false while it is the estimate. */
  lastSavedMeasured: boolean
  /** The real context, in tokens, just before the latest compaction; present only when measured. */
  lastBefore?: number
  /** The real context, in tokens, at the first reading after it; present only when measured. */
  lastAfter?: number
  /** Sum of lastSaved over the session: measured figures and estimates together. */
  totalSaved: number
  /** Epoch ms of the latest one, null before the first. */
  lastAt: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'pixel-buddy': {
      mood: Mood
      moodAt: number
      frame: number
      cacheAt: number | null
      now: number
      minute: number
      ctx: Ctx | null
      limits: Limit[]
    }
    'monster-compact': { compaction: Compaction }
  }
}
