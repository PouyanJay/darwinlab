# Components

UI, grouped by feature. Recreate the design reference
(`.claude/docs/initial_instruction_and_material/Darwin Lab.dc.html`) — lift layout,
tokens, copy, and behavior; do not ship the `.dc.html` itself.

| Folder        | Owns                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| `topbar/`     | Sticky glassy top bar — identity, the scenario, settings, theme. No more. |
| `shell/`      | The control column: the sidebar, its collapsed rail, and its drag-resizer |
| `bench/`      | Field-note banner, bench grid, world tile, Champion button, curves        |
| `conditions/` | Conditions modal — all fields applied live via `applyCfg`                 |
| `inspector/`  | Brain Inspector drawer: senses, `drawBrain` net, motor, ablate, ladder    |
| `story/`      | Story mode full-screen takeover: scenes, sensor rail, transport           |
| `common/`     | The primitives everything else is assembled from, plus page furniture     |

**Every control that drives the bench lives in `shell/`**, and the top bar carries none of them.
The rail is not a decoration: collapsed, it is the only way to reach play/pause, speed and a
training burst, so its controls and the panel's must stay in step (`shell/train.ts` is the shared
answer for what a "Train" press means, precisely so the two cannot disagree).

## The primitives (`common/`)

| Component            | Notes                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| `Button`             | primary · accent · ghost · icon (`tone="danger"` for ✕)                    |
| `Chip`               | inert label: `pill` ("Gen 12") or `tag` ("live evolution")                 |
| `Segmented`          | a radio group, not toggle buttons — one tab stop, arrow keys               |
| `Slider` · `Stepper` | controlled: they report the next value and hold none of their own          |
| `EditableLabel`      | in-place rename; Enter commits, Escape restores                            |
| `Modal`              | native `<dialog>` — the browser owns the focus trap and the inertness      |
| `Drawer`             | non-modal on purpose: the bench stays live behind the inspector            |
| `Canvas`             | DPR-aware canvas host (Phase 2)                                            |
| `FooterPill`         | the standing disclaimer, floating — shown when the sidebar is shut         |
| `disclaimer.ts`      | that disclaimer's one wording: the pill, the sidebar and the film share it |

Styling comes from the tokens in `$lib/styles/tokens.css` — no component invents a
colour, radius or duration of its own.

Components read engine state and call engine functions **only** through
`$lib/state` — they never mutate simulation internals directly (README §7).
