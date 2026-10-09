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
  `claude plugin update pixel-buddy@monsterlag-plugins`, then `/reload-plugins` in open sessions.
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
- **Scenes:** 22 native scenes on a 48x18 grid, 100 ms tick. Moods: working (7, including
  `fallback`), done (1, plays once), relax (6), idle (6, including `waiting`). Order is shuffled
  per mood entry; a scene plays whole loops for about 16 s. `compaction` cuts in for two loops
  when the published `count` rises; `subagents` is favoured while a sub-agent runs
  (`agent.spawn` until a `turn.complete` carrying its `agentId`, or a 45 s decay).

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

- A stutter while typing was seen once at the 100 ms tick and could not be reproduced or
  explained. If it returns, set `FRAME_MS` in `register.tsx` back to 150 (upstream's value).
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
