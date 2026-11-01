# pixel-buddy fork handoff

Fork of `hamymarnie/marnie-plugins`. Remotes: `origin` = monsterlag/marnie-plugins (public),
`upstream` = hamymarnie/marnie-plugins. The plugin lives in `plugins/pixel-buddy/`; the
marketplace is named `monsterlag-plugins`.

## Start here (state on 2026-11-01)

- **Released and installed:** the code on `main` (GitHub `monsterlag/marnie-plugins`) is `c1241da`;
  later commits change only this file. Installed on the owner's Mac as
  `pixel-buddy@monsterlag-plugins` at `c1241da` (the version shows as the commit sha). Working tree
  clean, `main` level with `origin/main`. Only the Mac has the plugin.
- **Owner's account is Claude Ultra** (since late October 2026): no 5-hour limit, so the engine
  reports only `seven_day` and the band shows two blocks, 7d and context.
- **The band was redesigned on 2026-10-31** after the owner called the three-column version
  "bloody awful". The owner approved the new look from an in-app screenshot. It has been seen in
  the app only at the owner's narrower window width (right-hand panel open, band about 690 CSS
  px). Full width and the three-block (Pro/Max) layout were checked only in Fable's rebuild of the
  app's layout, not by eye.
- **Nothing is in progress.** No open branches from this work (`band-redesign` was merged and
  deleted; the older `b1-band`, `scenes-*` branches are history). The temporary dev marketplace
  `pixel-buddy-dev` and its folder were removed.

### What changed on 2026-10-31 (three pushes, each passed a Fable gate)

1. **`705662a`, the 5h column follows the plan.** Claude's plans (claude.com/pricing): Free, Pro
   ($20), Max ($100, 5x Pro), Ultra ($200, 10x Pro, *no 5-hour limit for verified accounts*). A
   plugin cannot read the plan: `$.session.identity()` answers only mods installed by an
   organization's managed settings. But the engine reports only the windows the account has, so
   the band draws a block for each window in `LIMIT_WINDOWS` that the known list holds. Before any
   list is known, both 5h and 7d show `waiting`. Unverified Ultra, Pro and Max still report
   `five_hour` and keep the block.
2. **`993bcd6`, edge cases from the first gate.**
   - Only a reply can drop a window. A `session.measure` counts as a reply when `changed` holds
     `context`. A measure raised by a limit-status change carries only windows whose reset is still
     ahead by the local clock, so a window it lacks is merged back in (an idle Pro session past its
     5h reset keeps its 5h block).
   - Off a subscription (API key, Bedrock, Vertex) replies carry no rate limits: the first reply
     with none while none is known sets `noLimits`, and the band shows no limit blocks instead of
     two `waiting` forever.
   - The engine's own list at `session.start` is dated then, so an older stored list does not
     replace it.
3. **`459e2a4`..`c1241da`, the redesign** (see "What the band is" for the result):
   - large values (`size: 'title'`, `weight: 'semibold'`, `tabular`; `heading` looked no bigger
     than body in the app), dim unit and caption;
   - blocks share the width (`flexGrow`, `width={0}`), context gets twice a limit's share;
   - bars stretch to their block: `stretchBarSvg` draws 1000 units with
     `preserveAspectRatio="none"` and `vector-effect="non-scaling-stroke"` lines, and the `Svg` has
     no `width` prop (the app draws it as an `img` with `max-width:100%`, so it fills the block);
   - the old fourth column (to compact, saved) is folded into the context caption:
     `44% used · 163k to compact · saved 217k (2×)`;
   - the mascot's right edge fades by an SVG `<mask>` to transparent. Before, it faded to the fixed
     `BAND_BG` `#212121` while the app's band is about `#313131`, which left a hard seam;
   - the mascot sits beside the stats from 60 band cells with two blocks, 78 with three (the first
     redesign gate said NO PUSH because a three-block band at 60-77 cells clipped its values).

### Known gaps, all judged low by the gates and left as they are

- **A failed first turn hides the limits:** if a subscriber's very first turn errors or is aborted
  before any limit list is known (fresh install, empty store), that turn's measure carries
  `context` and no limits, so `noLimits` hides both limit blocks until the first good reply. Cannot
  happen on the owner's Mac (the store always holds a list).
- **`changed` holding `context` is not a perfect reply test:** the first measure of a process, and
  one after `/clear` or a model switch, also carry it; if such a measure is a reset-filtered
  status change, a past-reset window is dropped until the next reply anywhere. Rare.
- **The context caption truncates first:** below about 90 cells (Ultra) or 110 (Pro/Max) the
  `saved` figure is cut by `truncate-end`.
- **Very narrow bands (50 cells or less) with three blocks** cut the `5h`/`7d` unit at 100% usage.
- **The bar's round caps** are clipped very slightly at both ends (cosmetic).
- **A merged-in window can outlive the account change** if no reply ever arrives (the engine knows
  no better either).

## How to work on the band (recipes that worked on 2026-10-31)

### See the real band

Computer use refuses to capture or control Claude's own window. A read-only capture from the shell
works (needs Screen Recording for the shell, which this Mac has):

```zsh
# CGWindowID of the largest on-screen window owned by "Claude"
id=$(swift -e 'import CoreGraphics
let l = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]
var best: (Int, Double) = (0, 0)
for w in l where (w["kCGWindowOwnerName"] as? String) == "Claude" && (w["kCGWindowLayer"] as? Int) == 0 {
  let b = w["kCGWindowBounds"] as! [String: Any]
  let a = (b["Height"] as! Double) * (b["Width"] as! Double)
  if a > best.1 { best = (w["kCGWindowNumber"] as! Int, a) }
}
print(best.0)')
screencapture -x -o -l "$id" shot.png
sips -c 330 1520 --cropOffset 2350 600 shot.png --out band.png   # crop: adjust to the window
```

The capture shows whichever session the owner has on screen. **The session whose turn is running
never reloads its plugins** (the app defers it until the turn ends), so the band in your own
session shows the old code: capture another session.

### Iterate in the app without pushing (owner approved this on 2026-10-31)

1. Branch in the checkout.
2. Make a local marketplace folder with a **copy** of the plugin (a symlink is refused: "Path
   escapes plugin directory"):
   `~/Claude Projects/pixel-buddy-dev-marketplace/.claude-plugin/marketplace.json` named
   `pixel-buddy-dev`, one plugin `{ "name": "pixel-buddy", "source": "./pixel-buddy" }`, and
   `rsync -a --delete plugins/pixel-buddy/ <folder>/pixel-buddy/`.
3. `claude plugin marketplace add <folder>`, `claude plugin disable pixel-buddy@monsterlag-plugins`,
   `claude plugin install pixel-buddy@pixel-buddy-dev`.
4. Each round: rsync, `claude plugin uninstall pixel-buddy@pixel-buddy-dev`, `claude plugin install
   pixel-buddy@pixel-buddy-dev`, wait for `reload_plugins applied ... 0 plugin error(s)` in
   `~/Library/Logs/Claude/main.log` (1-2 s), capture.
5. `claude plugin list` shows a load error (`Status: failed to load`) if the dev copy is broken; the
   log line counts plugin errors too.
6. When done: uninstall the dev plugin, `claude plugin marketplace remove pixel-buddy-dev`, delete
   the folder, `claude plugin enable pixel-buddy@monsterlag-plugins`, then update it after the push.

### Check before a push

- `claude plugin test plugins/pixel-buddy` (24 tests) and the same with the desktop app's engine:
  `"$(ls ~/Library/Application\ Support/Claude/claude-code/2.1.309/*/claude.app/Contents/MacOS/claude)" plugin test plugins/pixel-buddy`
  (the app pins its own engine; check the folder for the current version).
- `npx -y -p typescript@5.6.3 tsc -p plugins/pixel-buddy --noEmit`.
- Anything touching the mascot picture: `tools/check-animation.mts` (instructions in its header;
  deps install in a scratch folder; Chromium headless shell is in
  `~/Library/Caches/ms-playwright/chromium_headless_shell-1248`). Expect 0 differing frames except
  2 px on the bleed cut's left edge in `fishing` and `hammock`.
- A real engine run with the checkout:
  `claude -p --model haiku --plugin-dir plugins/pixel-buddy --settings '{"enabledPlugins":{"pixel-buddy@monsterlag-plugins":false}}' "Without using any tool, reply with the word ok."`
  then read `~/.claude/plugins/store/pixel-buddy_inline-*.json` (the limits that run measured).
- **Fable gate before every push that changes behaviour** (owner rule): a fresh native Fable
  review through `~/Claude Projects/infra-docs/bin/fable-review.sh <brief.md>` (see
  `infra-docs/runbooks/agent-tooling.md` → Native Fable review). Give it the diff range, the
  evidence, what to check and what it must not do; push only on `VERDICT: PUSH`. Small content
  changes the owner asks for directly do not need one.

### Release

Push `main`, then `claude plugin marketplace update monsterlag-plugins` and
`claude plugin update pixel-buddy@monsterlag-plugins`. Plugin auto-update does not run on this Mac.
The desktop app reloads open sessions within seconds (`reload_plugins broadcast` in its log).

## History

- **2026-10-15, 5h/7d kept across sessions (`daeff23`).** The engine learns rate limits only from
  a reply's headers: `$.session.usage().rateLimits` is `[]` at `session.start`, and the desktop app
  re-runs `session.start` in every open session whenever any plugin is installed or updated. Each
  reply's list therefore also goes to the plugin's store as `{ limits, at }` (one JSON file per
  plugin source under `~/.claude/plugins/store/`), and every session adopts it at `session.start`
  and on its minute tick when it is newer. A window whose `resetsAt` has passed draws `0%`, an
  empty bar and `reset`.
- **2026-10-14, the mascot animates itself** (see "Self-animating mascot"): one SMIL picture per
  scene instead of a still every 150 ms. Seen animating in the app on 2026-10-31.
- **2026-10-17, the manifest moved into `plugins/pixel-buddy/.claude-plugin/plugin.json`.** At the
  repo root (where upstream kept it) the marketplace never read it, so the app showed no author or
  description and `cacheTtl` never applied. It has no `version` on purpose: the installed version
  is the commit sha, so every push is picked up (`validate` warns; expected). "0 skills" in the app
  is correct (no SKILL.md).
- **2026-10-09, the frame-load regression** (app crawling, band freezing): see "Frame load".

## What the band is

- **Stats, native text:** a block per figure, each a large value (`title` size, semibold,
  tabular where the engine takes them, from 2.1.299; plain bold before), a dim unit, a dim caption
  and a bar that stretches to the block's width (a 1000-unit drawing scaled without proportion,
  its lines `non-scaling-stroke`). Blocks: 5h limit (only where the account has one), 7d limit,
  and context, which takes twice a limit's width and carries a tick at the compaction trigger and
  `N% used · Xk to compact · saved Yk` in its caption. The to-compact and saved figures come
  from a value another plugin publishes, `{ plugin: 'monster-compact', key: 'compaction' }`
  (contract mirrored in `types/index.d.ts`); without a valid value the caption is `N% used` and
  the bar has no tick. The limits
  are the last measured in any session (kept in `$.store`); a window past its reset shows
  `0%` and `reset`.
- **Mascot portrait on the left:** a 216x104 SVG at 4x pixels in an absolutely positioned Box at
  negative cell offsets, so it bleeds into the band's padding; a clip path rounds its two left
  corners to the band's outline; a mask fades its right side to transparent (a fade to the fixed
  `BAND_BG` left a seam: the app's band is lighter).
- **Two layouts**, chosen by `bodyColumns` against `WIDE_MIN_COLUMNS` (60 for two blocks, 78
  for three: below that a Pro/Max limit block clips its value): wide as above with the
  blocks sharing the remaining width; narrow with the picture inline on its own row (192x72, its
  own rounded corners) and the blocks in one row underneath.
- **Scenes:** 22 native scenes on a 48x18 grid, each loop drawn as one self-animating picture
  (see "Self-animating mascot"). Moods: working (7, including
  `fallback`), done (1, plays once), relax (6), idle (6, including `waiting`). Order is shuffled
  per mood entry; a scene plays whole loops for about 16 s. `compaction` cuts in for two loops
  when the published `count` rises; `subagents` is favoured while a sub-agent runs
  (`agent.spawn` until a `turn.complete` carrying its `agentId`, or a 45 s decay).

## Self-animating mascot (2026-10-14)

### What changed in the desktop app (2.31226.1 to 2.37337.1, installed 2026-10-14 15:30)

Read from the two app bundles (the old one from the 2026-10-12 Time Machine snapshot), chunk
`c2719cf1b-*.js` in `Resources/ion-dist/assets/v1/`, which draws plugin trees:

- **A band redraw no longer rebuilds the band.** The old app replaced the whole tree's DOM on
  every redraw (`replaceWith`); the new one morphs it, and an `iframe` whose node is equal to the
  new one (same `srcdoc`, same attributes, same path of tags) is kept. An interactive `Svg` is an
  iframe, so one whose markup has not changed keeps playing across redraws. A plain `Svg` is an
  `img` and is still rebuilt each time.
- **SMIL is allowed** in an interactive `Svg` (`animate`, `set`, `use` are added to the scrub; it
  was so in the old app too). The frame is `sandbox=""` with a CSP of `default-src 'none'`;
  declarative animation needs neither script nor network.
- **Text got typography**: `size` (caption, footnote, body, heading, title), `weight` (regular,
  medium, semibold, bold), `mono`, `tabular`. The engine has to let them through: 2.1.295, which
  the desktop app pinned for its sessions until 2026-10-17 (now `required_version:2.1.299`), refuses a
  tree that sets one (`Text prop "tabular" is not allowed`, and the band goes blank); 2.1.299
  accepts them. The band sets `tabular` on its values only when `$.session.version()` is at least
  2.1.299 (`TABULAR_FROM`), so today it does nothing on the desktop and turns on by itself when
  the app moves its engine.
- The band's container classes are the same (only split across lines), so the measured corner
  clip should still hold. Not yet confirmed by eye.

### How the mascot works now

- `hooks/animate.ts` samples a scene's loop on its 100 ms tick, splits each frame into its
  top-level elements (the crab's translated group flattened into plain pixels), merges the
  frames into one ordered sequence (each frame is a subsequence, so painting order holds), and
  groups neighbours that are on in the same frames under one `<animate attributeName="display">`.
  Elements on in every frame are drawn once. Same-color pixels merge into one `<path>` wherever
  nothing drawn between them could cover them. The twinkling dots are their own 3 s SMIL
  animations (`setDotMode('smil')` in the kit), so they no longer depend on a clock.
- `animatedSceneSvg` in `hooks/scene.ts` builds it once per scene and cut and keeps it. The
  engine and the app cap an `Svg` at 131,072 characters: 20 scenes fit at 100 ms (17-117k);
  `done` and `drive` only at 200 ms (84k and 116k), so those two step at 200 ms, coarser than
  the old 150 ms. A scene that fits at neither would fall back to a still (none does).
- `register.tsx` writes `frame` only when the scene on show changes (`refreshScene`): it looks at
  the scene's next loop boundary (5 s at most) and at once on a mood change, a compaction noticed,
  and a sub-agent's start or end. The band picks its scene at `frame`, as before.
- A sub-agent's own `turn.start` (it carries `agentId`) is passed on without touching the mood,
  as `turn.complete` already was; before, it reset the main mood's entry and jumped its scene.
- The `Svg` is `isInteractive`, and its markup depends only on the scene and the cut, so the app
  keeps the frame while the stats redraw, and a new scene arrives as a new frame (from its first
  frame: scenes change on loop boundaries anyway).

### Numbers

Over a full rotation of each mood, bleed cut (computed with the scenes' own code):

| | Old: a still every 150 ms | New: one picture per scene |
|---|---|---|
| working | 6.7 redraws/s, 60 KB/s | 0.09 redraws/s, 4.3 KB/s |
| idle (when it animated) | 6.7 redraws/s, 58 KB/s | 0.08 redraws/s, 2.8 KB/s |
| relax | 6.7 redraws/s, 33 KB/s | 0.07 redraws/s, 3.4 KB/s |

The cost moves to the app's own animation of one document per visible band, which is what SMIL
is for; whether a hidden session's frame keeps animating (Chromium normally stops painting what
is not shown) was not measured.

### How it was checked

- `tools/check-animation.mts` (run instructions in its header): every scene, both cuts, every
  tick, the animated picture with its SMIL clock seeked against the still the scene draws for
  that moment: 0 differing frames, except 2 px on the bleed cut's clipped left edge in `fishing`
  and `hammock` (anti-aliasing at x = 8, which the band hides). Then a copy of the app's
  pipeline (its DOMPurify config, frame and CSP, and its morph code, copied from the bundle):
  every animation survives the scrub, the picture plays by itself, a redraw with new stats keeps
  the same iframe and it keeps playing, a new scene gets a new frame.
- `claude plugin test plugins/pixel-buddy` (13 tests), also run with the app's pinned engine
  (`~/Library/Application Support/Claude/claude-code/2.1.295/*/claude.app/Contents/MacOS/claude`);
  the tabular test checks its prop only where the running engine accepts it.
- A real 2.1.295 session with the checkout as `--plugin-dir`: the module loads, every hook
  settles in 4-22 ms, no errors in the debug log.

## Frame load: the 2026-10-09 regression, what was found, what was done

Superseded on 2026-10-14 by the self-animating mascot; kept for the evidence and the method.

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

### Profile of the renderer (2026-10-09, 20:46 to 21:15)

Taken with `sample <pid> 8` (which threads are busy), `vmmap --summary <pid>` (memory by region)
and `ps` CPU-time differences. The app's binary is stripped: thread names can be trusted, the
function names `sample` prints for it cannot.

| | Old build, 20:46 | Fixed build, quiet animation | Fixed build, stills |
|---|---|---|---|
| Renderer main thread busy | 99% | 7% | 6% |
| Renderer CPU overall | ~100% | 12% (70 s) | 10% (91 s) |
| Renderer memory (RSS) | 4.4 GB | 1.18 GB | 1.18 GB |
| Desktop sessions open | 5 | 4 | 4 |

- **The old build's main thread was saturated.** That thread draws the interface and takes input,
  which accounts for the slowness, the stutter and the freezing. Nothing else in the process was
  busy (compositor and pool threads at 2-3%).
- **One session's animation costs about 2% of a core on the fixed build**: the difference between
  the two phases of one session after a turn, first animating at 150 ms with nothing streaming,
  then on stills. The other sessions did a little work in the same window, so it is approximate.
- **So the frames alone do not add up to the old 100%.** Five sessions at ten a second, scaled from
  that 2%, come to roughly 15%. The saturation therefore probably came from what had piled up
  (4 GB) and the work of managing it, with the picture stream as the feeder. This step is
  inference.
- **The memory is mostly JavaScript heap.** Of about 1.0 GB dirty at 21:09, 776 MB was in the region
  tagged "App-Specific Tag 16" and 270 MB in "Tag 14". By Chromium's convention those are the
  JavaScript engine's heap and its general allocator; the mapping is from memory of that
  convention, not checked against this build.
- **The size fits.** The old build sent about 450 KB of SVG text a second across five sessions, which
  is 1.6 GB an hour if all of it were kept; the climb seen was 0.8-1.0 GB an hour.
- **It can be reclaimed under light load.** Over four quiet minutes the Tag 16 region fell from 776
  to 568 MB and the footprint from 944 to 731 MB.
- **While a session works**, one pool thread ran 71% busy with the main thread at 10%. What it does
  is unknown; it was not seen in either quiet phase.

Not a controlled comparison: the two builds were sampled at different memory sizes and session
counts. What held the 4 GB is still not known. A heap snapshot from the app's developer tools
would show it; that needs a developer setting turned on in the app, which the owner has not
approved.

### The running check, and the review of it

A session-only job in the session that did this work runs `loadcheck.py` (in that session's
scratch folder, not in this repo) at :07 and :42. It fits a slope to the app log's one-a-minute
renderer readings and records how much CPU the session processes burned, as a stand-in for how
many pictures were sent. A second Fable review called the first version of this plan weak, and
its points stand for any later test:

- a quiet evening passes whether or not the fix works, so a flat reading while the sessions sat
  idle is no evidence;
- the pass has to be a number: under 100 MB an hour over two hours in which the sessions worked
  (the broken build did 800-1000); over 300, or past 2.5 GB, is a fail;
- check-to-check differences at this spacing are noise;
- there is no control. One evening with the plugin disabled, same sessions and readings, is the
  only thing that would turn a pass from evidence into proof. Not done;
- the fixed build starts at 1.07-1.30 GB against 560-690 MB the day before, unexplained.

### Not proven, and how to check

- That the plugin caused the renderer's load, and that the fix cures it. Check: several desktop
  sessions open for some hours, then the `[process-memory]` renderer figures. Flat near where it
  starts is a cure; a steady climb is not. `sample <renderer pid>` or the app's developer tools
  would say what it is busy with (first results under "Profile of the renderer").
- Why the band vanished. Check: a session started with a debug log, looking for
  `pixel-buddy: ui.render (AbovePrompt)` lines.
- How often monster-compact writes its value.

### If the load comes back

With the self-animating mascot the plugin sends almost nothing, so look at the app's side first
(`sample` the renderer). Options, cheapest first: stop animating idle sessions after a while (draw
a still `sceneSvg` with `isInteractive` off once a quiet mood is old); sample at 200 ms for every
scene (`ANIMATION_STEPS` in `scene.ts`); add the stuck-turn backstop.

### After a `claude plugin update`

The desktop app notices `installed_plugins.json` change and reloads plugins in its open sessions
within a few minutes (`[CCD] reload_plugins broadcast` in its log; hidden sessions are paced), so a
restart is not needed for the new code. A reload does not shrink a renderer that has already
grown; only relaunching the app does.

## Files

- `hooks/register.tsx`: hooks, layouts, stats, timers, event cues, the limits logic (`keepLimits`,
  `adoptLimits`, `noLimits`, `LIMIT_WINDOWS`). Tunables at the top (`WIDE_MIN_COLUMNS`, gaps, bar).
- `tests/register.test.ts`: the test kit suite (24 tests), run by `claude plugin test`.
- `hooks/scene.ts`: the wrapper (two cuts, clip, fade mask, calibration card), the still frame and the
  self-animating picture (`animatedSceneSvg`).
- `hooks/animate.ts`: folds a scene's frames into one SMIL picture.
- `hooks/rotation.ts`: seeded shuffle, slot timing, event cut-ins.
- `hooks/native-kit.ts`: canvas rules (read its header first) and drawing helpers.
- `hooks/native-{idle,working,relax,done,events}.ts`: the scenes; `hooks/native.ts`: the registry.
- `tools/preview.ts`: `npx tsx plugins/pixel-buddy/tools/preview.ts <group|scene|all> out.svg`,
  then `qlmanage -t -s 1800 -o <dir> out.svg` to get a frame sheet as a PNG. Not loaded by the plugin.
- `tools/check-animation.mts`: the browser check of the animated pictures and the app pipeline.
- `git-assets/`: README preview, the all-scenes sheet, and the concept art the scenes came from.

## Things that will bite

- **The limits store is a file the engine reads on every call.** `~/.claude/plugins/store/<plugin id>.json`
  (one per plugin install; the installed band and a `--plugin-dir` build use different files). A malformed
  file makes every `$.store` call throw: the band catches it and keeps working, but the stored limits stay
  unused until the file is deleted by hand.
- **Do not fade the mascot to a fixed color.** The band's color is the app's, not `BAND_BG`; the
  mask to transparent is what makes the edge vanish.
- **The corner clip is measured, not derived.** `EDGE_LEFT 8`, `EDGE_TOP 8.5`, `EDGE_BOTTOM 101.5`,
  `CORNER_RADIUS 10` in `hooks/scene.ts` were read off the calibration card in the owner's desktop
  app (set `CALIBRATE = true`, reload, screenshot, read the grid: lines every 8 px, thick white
  lines at x = 40 and y = 40, magenta at y = 88). Re-measure if a desktop app update changes the
  band's padding or text size, or before using it on another machine.
- **Desktop app limits found the hard way:**
  - the band is one render instance and redraws whole; plugin redraws cap at ten a second;
  - before 2.37337: a self-animating `Svg` (`isInteractive`) was torn down and restarted on every
    band redraw. Since: it is kept while its markup is unchanged (see "Self-animating mascot");
  - a `Client` element draws only text cells;
  - native `Text` `size`, `weight`, `tabular` need engine 2.1.299 or later (2.1.295 refuses the
    whole tree and the band goes blank); the app pins 2.1.309 as of 2026-10-31, and the band
    checks `$.session.version()` before setting them. Of the sizes, `title` is visibly larger
    than body; `heading` was not;
  - an `Svg` with no `width` is drawn as an `img` with `max-width:100%`: in a column Box it fills
    the Box's width (how the bars stretch);
  - the session whose turn is running does not reload plugins until the turn ends;
  - an `Svg` source is capped at 131,072 characters;
  - an absolute Box at negative offsets is clipped to the band's rectangle, not its rounded shape;
  - SVG gradients, clip paths and masks render and survive the scrub; an `Svg` with an empty
    `alt` is silently dropped.
- **A hooks module has no DOM and no Node.** Scene files import only from `./native-kit`.
- **Scene canvas rules:** crab and props in columns 1-31; columns 32-47 are under the fade;
  feet end at row 16; loops must end on the frame they start on.

## Open

- Look at the redesigned band at full window width, and (if anyone has one) on a Pro/Max account
  with three blocks: both were checked only in a simulation.
- The renderer's load with self-animating mascots over an evening with several sessions open was
  never measured (Fable estimated 2.5-5% of a core per visible band).
- The gaps listed under "Known gaps" at the top.
- `done` and `drive` step at 200 ms because their 100 ms builds pass the 131k cap; a tighter
  encoding (moving parts as one group with an animated transform) would let them back to 100 ms.
- The `SessionMode` row still redraws once a second while the cache is warm (two small plain
  SVGs, rebuilt each time); a self-counting SVG could take that to once per response.
- No backstop for a turn that never reports its end (owner declined one, 2026-10-09).
- `0k left` when context is past the trigger could show the overrun instead.
- `compaction` and `subagents` cut-ins are verified in the test kit, not yet seen in the app.
- Upstream has no LICENSE file.

## How changes are made here

Look-and-feel changes: mock first, then build, then look at it in the app before calling it done.
Scenes are drawn as code; generated images are concept sheets only. Check a scene on a frame sheet
from `tools/preview.ts` in both cuts before it goes in. A fresh-context reviewer gates pushes that
change behaviour; small content changes the owner asks for directly do not need one.
