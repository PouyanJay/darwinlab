# Components

UI, grouped by feature. Recreate the design reference
(`.claude/docs/initial_instruction_and_material/Darwin Lab.dc.html`) — lift layout,
tokens, copy, and behavior; do not ship the `.dc.html` itself.

| Folder        | Owns (README §5)                                                       |
| ------------- | ---------------------------------------------------------------------- |
| `topbar/`     | Sticky glassy top bar: logo, play/pause, speed, train, theme, story, + |
| `bench/`      | Field-note banner, bench grid, world tile, Champion button, curves     |
| `conditions/` | Conditions modal — all fields applied live via `applyCfg`              |
| `inspector/`  | Brain Inspector drawer: senses, `drawBrain` net, motor, ablate, ladder |
| `story/`      | Story mode full-screen takeover: scenes, sensor rail, transport        |
| `common/`     | Shared primitives (DPR-aware Canvas host, pills, sliders, steppers)    |

Components read engine state and call engine functions **only** through
`$lib/state` — they never mutate simulation internals directly (README §7).
