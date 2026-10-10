# pixel-buddy fork handoff

Fork of `hamymarnie/marnie-plugins`. Remotes: `origin` = monsterlag/marnie-plugins (public),
`upstream` = hamymarnie/marnie-plugins. The plugin lives in `plugins/pixel-buddy/`; the
marketplace is named `monsterlag-plugins`.

## Where things stand (end of 2026-10-09)

- **Released on `main`** and installed on the owner's Mac from GitHub
  (`pixel-buddy@monsterlag-plugins`). It is not installed on any other host.
- **Rollout is manual.** Claude Code's built-in plugin auto-update does not run for the owner
  (the desktop app disables it for its sessions, and CLI auto-updates are off on the Mac).
  After a push: `claude plugin marketplace update monsterlag-plugins` then
  `claude plugin update pixel-buddy@monsterlag-plugins`; the desktop app then reloads its open
  sessions by itself within a few minutes (`/reload-plugins` does it at once).
- **The 2026-10-09 evening regression** (app crawling, band freezing) and its fix are written up
  under "Frame load". The fix is released; whether it holds over hours is not yet known.
- The installed version is the commit sha: the root `.claude-plugin/plugin.json` version is not
  what the marketplace keys on, and `claude plugin validate .` fails on the root manifest's
  `types` path (an upstream layout quirk, left alone).

## What the band is

- **Stats, native text:** four columns of bold value, dim label and a thin SVG bar: 5h limit,
  7d limit, context tokens (with a tick at the compaction trigger), and tokens left before
  compaction with the last saved amount. The last two come from a value another plugin
  publishes, `{ plugin: 'monster-compact', key: 'compaction' }` (contract mirrored in
  `types/index.d.ts`); without a valid value there are three columns and no tick.
- **Mascot portrait on the left:** a 216x104 SVG at 4x pixels in an absolutely positioned Box at
  negative cell offsets, so it bleeds into the band's padding; a clip path rounds its two left
  corners to the band's outline; a gradient fades its right side into the band.
- **Two layouts**, chosen by `bodyColumns` against `WIDE_MIN_COLUMNS` (84): wide as above with the
  stats spread across the remaining width; narrow with the picture inline on its own row
  (192x72, its own rounded corners) and the stats wrapping underneath.
- **Scenes:** 22 native scenes on a 48x18 grid, 150 ms tick while animating (see "Frame load"). Moods: working (7, including
  `fallback`), done (1, plays once), relax (6), idle (6, including `waiting`). Order is shuffled
  per mood entry; a scene plays whole loops for about 16 s. `compaction` cuts in for two loops
  when the published `count` rises; `subagents` is favoured while a sub-agent runs
  (`agent.spawn` until a `turn.complete` carrying its `agentId`, or a 45 s decay).

## Frame load: the 2026-10-09 regression, what was found, what was done

Read this before changing anything that animates. It is long because most of it is evidence,
and the cause is still an inference.

### What the owner saw

On the evening of the redesign's release, with five desktop sessions open: the band "keeps
freezing in certain sessions", then it stopped showing at all in a new session, then the animation
was "extremely stuttery" and the whole desktop app "extremely slow". After the fix and an app
restart they reported it "seems fine now" (a reading taken minutes after the restart, see
"Not proven").

### What was measured

- **Every session animated for its whole life.** `session.start` set a 100 ms timer that wrote the
  `frame` state on every tick, whether the session was working, idle, or not on screen. A band
  hook cannot tell whether it is visible: `AbovePrompt`'s props carry nothing about it.
- **Each write redraws the band with a whole new picture.** One frame of the bleed cut is an SVG of
  8-10 KB and 140-190 shapes (3-7 KB for the relax scenes). Over a loop sampled at ten a second,
  nearly every frame is a different string: 59 of 60 for `typing`, 80 of 80 for `walking`. The
  background dots run on a clock that never restarts (`setDotClock`), so in the app no frame ever
  repeats, even where the scene's own drawing does.
- **Five sessions made about fifty pictures a second**, around 450 KB/s of SVG text for the app to
  take in. The desktop surface draws an `Svg` as an image, so each is a new image to it.
- **The app's renderer process** (`Claude Helper (Renderer)`) was at about 100% CPU. Its memory, from
  the `[process-memory]` lines in `~/Library/Logs/Claude/main.log` (one a minute, field
  `electron_renderer:<pid>:<MB>`):
  - 2026-10-08 evening, before the redesign (the old strip, 150 ms): flat at 560-690 MB for over
    an hour.
  - 2026-10-09, redesign installed: about 1 GB at 10:40, 2 GB by 12:15, 4 GB by 14:15; app
    relaunched at 15:50, then 1 GB, 2.2 GB by 16:30, 3 GB by 18:40, 4.6 GB by 20:15.
  - After the fix and a relaunch at 20:50: between 1.07 and 1.30 GB over the first 13 minutes,
    CPU reading 8-35% while one session worked. Too short to call: the old build stood near
    1.4 GB at the same point.
- **The session processes themselves were cheap** (1-4% CPU each), and `pick()` costs under 0.1 ms
  in the ordinary case (2.5 ms in the worst one tried, a sub-agent cue twenty days old with
  `since` 0). The plugin's own code was not the bottleneck; what it sent the app was.
- **Nothing in the app log names the band.** It records plugin reloads ("0 plugin error(s)") and no
  hook or render failure. Per-session hook errors go to a session's debug log only, and desktop
  sessions are not started with one, so none exists.

### The inference, and what does not follow from it

Inferred: the renderer was saturated by the picture stream, so frames arrived late (stutter,
freezing) and the app slowed for everything else. Supporting it: the timing (flat the day before,
climbing on both launches after), the volume, and that it is the only thing the redesign changed
in what the app receives. Nothing was profiled; the renderer was sampled once and showed nothing
conclusive.

Not explained by any of this:
- **The band vanishing in a new session.** The engine leaves the band empty, with a debug-log line
  ending `nothing was drawn`, when a render hook throws, returns a tree that does not validate, or
  outlasts its budget; a lost hooks worker stops the band and its timers; a survey holding the band
  empties it by design (`hasSurvey`). Which of these happened is unknown. A hook overrunning its
  budget because the host was too busy to answer its state reads is a guess.
- **The memory growth itself.** 1 GB to 4.5 GB suggests the app keeps something for every picture
  it is sent. If so, the fix slows the growth in proportion to the pictures saved and does not
  stop it: a turn that runs for hours still sends about seven a second.

### What was changed

1. **`297f4d8`, animate only when someone is likely watching.** `frameDue` in `hooks/rotation.ts`:
   the timer writes `frame` on every tick while the stored mood is `working`; in a quiet mood (done,
   relax, idle) for `QUIET_ANIMATE_MS` (2 min) after the mood began, which covers the party and the
   start of the rest; after that once per `STILL_MS` (16 s, one slot), so an idle session shows a
   still that changes pose a few times a minute. `FRAME_MS` went from 100 back to 150 (upstream's
   value). Per session: about 6.7 pictures a second while working, one per 16 s when idle, against
   10 a second always.
2. **`fbc78cd`, the tick guard.** A frame tick that finds the last one still running is skipped, so
   a slow host is never sent a backlog of state calls and overlapping writes of `frame`. If a tick
   never comes back, one runs anyway after `TICK_PATIENCE` skipped ticks (32, about 5 s), so one
   hung call cannot stop the mascot for good. A tick also reads only what its answer turns on: a
   working session reads the clock and the mood (then writes); an idle one past its window reads
   the clock, mood, mood time and frame time, and writes nothing.

Tests (`claude plugin test plugins/pixel-buddy`, 8 pass): a truth table for `frameDue`, and a
desktop test that moves the mocked clock and checks the mascot moves inside the window, holds for
3 s past it, and changes once after a slot. The second compares SVG strings and so leans on every
frame being unique.

Both commits were pushed without the usual fresh-context gate, on the owner's word, because the app
was unusable. The gate rule stands for everything else.

### The review afterwards (Fable 5.1, fresh context, read-only, of `297f4d8`): KEEP

Confirmed: the timer logic is right and cannot stop writing; with a stale `frame` the hand-offs
still work (done to relax falls inside the animated window; relax to idle can show up to 16 s
late; a compaction in a quiet mood shows as one still of the compaction scene); a mood change
while `frame` is stale clamps to 0 and the next tick corrects it; no quiet picture can be stuck
longer than 16 s. Its findings, and what became of each:

- **Ticks could pile up under a slow host and contend on the `frame` write** (medium). Done:
  `fbc78cd`.
- **The cache countdown redraws once a second** (medium, not from this change). The `SessionMode`
  hook rewrites `now` every second while the prompt cache is warm, up to an hour after each
  response, and redraws its row with two small SVGs. This is upstream's design, unchanged in the
  fork. Left as it is.
- **The band redraws whenever monster-compact writes its value** (medium). The band reads
  `{ plugin: 'monster-compact', key: 'compaction' }`, so each write there redraws the whole mascot.
  How often that plugin writes was not checked. `watchCompaction` itself only reads, once a second.
- **A turn that never reports its end animates for ever** (medium, older than this change). The
  timer goes by the stored mood, so a `working` that no `turn.complete` clears keeps writing; the
  band meanwhile sees `isWorking` false and shows an idle scene picked with `since` 0. The engine
  says `turn.complete` comes for every end, so the trigger is unlikely. Two backstops were put to
  the owner, who declined both for now: a heartbeat (note the time of each `session.measure`; with
  none for ten minutes treat the session as idle, at the price of going still during one silent
  tool call longer than that), or a flat cap on a turn's animation (say two hours).
- **`isWorking` true while the stored mood is not `working`** (low, older): the scene is picked
  from the clock since 1970 with seed 0, so it is arbitrary and jumps when `turn.start` lands, and
  since the fix it is a still. Nothing loops or stalls.
- **Tests** (low): no test for a working session still animating past the window through the
  timer, for a mood change while the frame is stale, or for the stuck-`working` case.

### Not proven, and how to check

- That the plugin caused the renderer's load, and that the fix cures it. Check: several desktop
  sessions open for some hours, then the `[process-memory]` renderer figures. Flat near where it
  starts is a cure; a steady climb is not. `sample <renderer pid>` or the app's developer tools
  would say what it is busy with.
- Why the band vanished. Check: a session started with a debug log, looking for
  `pixel-buddy: ui.render (AbovePrompt)` lines.
- How often monster-compact writes its value.

### If the load comes back

In rising order of what they cost the look: shorten `QUIET_ANIMATE_MS`; lengthen `FRAME_MS`; let the
dots twinkle on the scene's loop time again, so a scene's frames repeat and the app has a bounded
set of pictures to hold (this was the case before `4296f4a`; whether the app reuses a picture it
has seen is untested); make the pictures smaller or simpler; add the stuck-turn backstop.

### After a `claude plugin update`

The desktop app notices `installed_plugins.json` change and reloads plugins in its open sessions
within a few minutes (`[CCD] reload_plugins broadcast` in its log; hidden sessions are paced), so a
restart is not needed for the new code. A reload does not shrink a renderer that has already
grown; only relaunching the app does.

## Files

- `hooks/register.tsx`: hooks, layouts, stats, timers, event cues. Tunables at the top.
- `hooks/scene.ts`: the wrapper only (two cuts, clip, fade, calibration card).
- `hooks/rotation.ts`: seeded shuffle, slot timing, event cut-ins.
- `hooks/native-kit.ts`: canvas rules (read its header first) and drawing helpers.
- `hooks/native-{idle,working,relax,done,events}.ts`: the scenes; `hooks/native.ts`: the registry.
- `tools/preview.ts`: `npx tsx plugins/pixel-buddy/tools/preview.ts <group|scene|all> out.svg`,
  then `qlmanage -t -s 1800 -o <dir> out.svg` to get a frame sheet as a PNG. Not loaded by the plugin.
- `git-assets/`: README preview, the all-scenes sheet, and the concept art the scenes came from.

## Things that will bite

- **The corner clip is measured, not derived.** `EDGE_LEFT 8`, `EDGE_TOP 8.5`, `EDGE_BOTTOM 101.5`,
  `CORNER_RADIUS 10` in `hooks/scene.ts` were read off the calibration card in the owner's desktop
  app (set `CALIBRATE = true`, reload, screenshot, read the grid: lines every 8 px, thick white
  lines at x = 40 and y = 40, magenta at y = 88). Re-measure if a desktop app update changes the
  band's padding or text size, or before using it on another machine.
- **Desktop app limits found the hard way:**
  - the band is one render instance and redraws whole; plugin redraws cap at ten a second;
  - a self-animating `Svg` (`isInteractive`) is torn down and restarted on every band redraw,
    and a `Client` element draws only text cells, so motion smoother than 10 fps is not possible;
  - native `Text` has no font size or weight control (bold and dim only);
  - an absolute Box at negative offsets is clipped to the band's rectangle, not its rounded shape;
  - SVG gradients and clip paths render; an `Svg` with an empty `alt` is silently dropped.
- **A hooks module has no DOM and no Node.** Scene files import only from `./native-kit`.
- **Scene canvas rules:** crab and props in columns 1-31; columns 32-47 are under the fade;
  feet end at row 16; loops must end on the frame they start on.

## Open

- Whether the frame-load fix holds over hours of use (see "Not proven, and how to check").
- Whether an idle mascot that holds still after two minutes is what the owner wants (changed
  as an emergency fix, without a mockup).
- A working session still sends about seven pictures a second for as long as the turn runs.
- No backstop for a turn that never reports its end (owner declined one, 2026-10-09).
- `0k left` when context is past the trigger could show the overrun instead.
- `compaction` and `subagents` cut-ins are verified in the test kit, not yet seen in the app.
- `WIDE_MIN_COLUMNS` is conservative: there is a range of widths where the wide layout would
  fit but the narrow one is used.
- Upstream has no LICENSE file.

## How changes are made here

Look-and-feel changes: mock first, then build, then look at it in the app before calling it done.
Scenes are drawn as code; generated images are concept sheets only. Check a scene on a frame sheet
from `tools/preview.ts` in both cuts before it goes in. A fresh-context reviewer gates pushes that
change behaviour; small content changes the owner asks for directly do not need one.
