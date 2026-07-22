# Architecture — Darwin Lab

Darwin Lab is a client-only SvelteKit app (static SPA via `adapter-static`, no backend) for
**neuroevolution**: tiny neural-net fish evolve real behavior against a fixed-rule shark.
The vendored original implementation and its measurement notes live in
[reference/](reference/) — the port is held bit-exact to it (see _Honesty gates_ below).

## Organizing principle

**The science is walled off from the UI.** The engine is pure, framework-agnostic TypeScript
with zero Svelte/DOM imports, so it runs identically in the app, in unit tests, and in the
headless survival bench. The UI wraps the engine; it never leaks into it. The UI mutates
simulation state **only** through the state stores, which call engine functions.

```
UI (components)  →  state stores  →  engine functions  →  world state
      ↑                                                        │
      └───────────────  render painters  ←────────────────────┘
```

## Layout

```
src/
├─ lib/
│  ├─ engine/     Pure neuroevolution science. NO Svelte/DOM imports, ever.
│  │              network (8→6→2 tanh, or wider when a world carries extra senses), genetics
│  │              (GA), sensing, world step, predator AI, flocking order params (flock.ts),
│  │              seeded rng, story beats. Constants are empirically tuned — re-measure
│  │              (npm run bench:survival / bench:schooling) before changing any of them.
│  │              Every extra sense (proprioception, the shoal senses) and every predator knob
│  │              (persistence, the confusion effect) is OPTIONAL and defaults to reference
│  │              behaviour, which is what keeps the bit-exact fidelity gate green.
│  ├─ render/     Pure canvas painters: drawWorld, drawBrain, drawCurve, hit-testing (pick),
│  │              theme palettes (kept in sync with the CSS tokens). State in, pixels out.
│  ├─ harness/    The honesty gates: the bit-exact fidelity spec against reference/engine2.js,
│  │              and the headless survival sweep the science claims are measured with. Also the
│  │              behaviour recorders — trace.ts (one bout's paths) + traceStudy.ts (evolve → the
│  │              learning curve + an evolved-vs-control study), read-only so fidelity stays green.
│  ├─ state/      Svelte 5 runes stores — THE only seam between UI and simulation.
│  │              app.svelte.ts       the MODE (Studio | Research, persisted) + the analysis
│  │                                  SUBJECT (a Studio world handed to Research to explore)
│  │              bench.svelte.ts     which worlds exist, selection, conditions, tick();
│  │                                  branchWorld/moveWorld drive the lineage tree;
│  │                                  analyzeWorld hands a world to Research (Studio→Research)
│  │              views.svelte.ts     reactive projections components bind to
│  │                                  (WorldStats / WorldConfigView / MindView / LineageView)
│  │              viewport.svelte.ts  the generic pan/zoom CAMERA; the lineage tree (canvas.svelte)
│  │                                  and the Atlas each own one instance, never shared
│  │              research.svelte.ts  the ONE running batch (progress, cancel-on-new)
│  │              sweep / ledger /     the instruments' state: factors→effects · claims→verdicts ·
│  │              landscape / trace     axes→landscape · evolve→learning-curve+mechanism (trace runs
│  │                                    its OWN time-sliced study, not the worker batch)
│  │              findings.svelte.ts  the persisted findings NOTEBOOK (any instrument writes to it)
│  │              report.svelte.ts    the seven-question brief derived from the notebook (honesty rail)
│  │              playback.svelte.ts  play / pause / speed / turbo training
│  │              story.svelte.ts     scenes, the scene clock, NEW-sense tagging
│  │              theme / motion      theme (DARK by default, monochrome) + reduced-motion
│  │              painters.ts         paint registry (bench/story groups, paint-on-change)
│  ├─ sim/        loop.ts — the visibility-safe fixed-timestep loop (setTimeout, never bare
│  │              rAF: rAF throttles offscreen and would freeze the sim).
│  │              governor.ts — one-way downgrade of cinematic detail under sustained honest
│  │              frame-time pressure (stands down during turbo training by design).
│  ├─ components/ UI by feature: intro, topbar, bench, conditions, inspector, story, research,
│  │              common. intro/Intro — the full-screen welcome; the first interaction fades it
│  │              out over the already-running platform. bench/LineageCanvas — the pannable plane;
│  │              worlds are draggable nodes (WorldTile) wired parent→child by branch edges.
│  │              research/ — the three-zone CONSOLE (ResearchRail · ResearchWorkspace ·
│  │              ResearchSidebar) over five instruments (Sweep, Ledger, Atlas, Trace, Report),
│  │              the shared viz/ graph library + QuestionTags + RunProgress; topbar/ModeSwitch
│  │              flips Studio ⇄ Research.
│  ├─ lab/        The Research SCIENCE (pure, no Svelte/DOM), + the batch pipeline:
│  │              evaluator.ts        n-seed measurement of a config (mean ± sd survival)
│  │              runner.ts +         the off-main-thread worker POOL and its protocol;
│  │              eval.worker.ts +      falls back in-thread where Worker is absent (SSR/vitest).
│  │              protocol.ts          runner.spec asserts worker ≡ in-thread, bit-identical.
│  │              stats.ts            bootstrap CIs, Cohen's d, two-arm contrast (seeded)
│  │              sweep / hypothesis / the instruments' pure cores (factorial · claim→contrast ·
│  │              landscape.ts          2D grid + measured cliff)
│  │              questions.ts        the seven-question model (which test answers which Q; ANSWERS)
│  │              evidence.ts         the small persisted graph payloads a finding carries + the
│  │                                  kept-negatives predicate the Report/Sweep share
│  │              run.ts              configHash + manifest (an experiment you can cite)
│  │              lineage.ts          canvas geometry (node sizes, the parent→child edge curve)
│  └─ styles/     Design tokens (both themes as CSS custom properties) + global styles.
├─ routes/        Single bench page; ssr=false, prerender=true (client-only static SPA). Vite
│                 bundles eval.worker.ts as its own module chunk for the static build.
tests/            Playwright e2e: bench, conditions, inspector, deploy lifecycle, story,
                  keyboard, a11y (zero axe violations, both themes), responsive.
scripts/bench.ts  Headless survival sweep + drift watch (nightly CI job fails on drift).
reference/        The vendored original engine + measurement README (read-only truth).
```

**The load-bearing rule:** a `World` is mutated 60×/s and holds every genome, so it lives in
`$state.raw` and is never reactive. Components never read `world.*` directly — they bind to
the projections in `state/views.svelte.ts` and mutate only through store methods. If a
component is writing `entry.world.x = ...`, the fix is a new store method.

**The lineage canvas:** the bench is a spatial tree, not a grid. Each world is a node with a
reactive `LineageView` (its `x`/`y` on the plane and its `parentId`/`childIds`), placed and
moved only by the store (`branchWorld`, `moveWorld`, the initial auto-layout). **Branch** forks
a world into a wired child that inherits the parent's evolved genomes at the current generation,
drops below it, and opens Conditions to change one thing — a controlled experiment with a common
ancestor, so any later difference is caused by the one variable, not a fresh random start. The
camera (one `translate…scale` transform) lives in `canvas.svelte.ts`, separate from the bench
because moving the camera touches no genome.

**Studio + Research:** the lab is one place with two modes (`app.svelte.ts`, flipped from the top
bar). **Studio** is the spatial tree above — watch a world evolve, read one brain. **Research** is a
three-zone **console** (`ResearchRail` · `ResearchWorkspace` · `ResearchSidebar`) organised around the
**seven questions a rigorous study must answer** (`lab/questions.ts`; each instrument declares which it
settles via the `ANSWERS` map, shown as `QuestionTags`). Five instruments fill them in:

- **The Sweep** _(Q2 · Q6)_ — a factorial → each factor's effect on survival, with intervals.
- **The Ledger** _(Q3)_ — a claim → one pre-registered contrast → a supported/refuted verdict, kept.
- **The Atlas** _(Q4)_ — two parameters → a pannable survival landscape with the measured cliff.
- **The Trace** _(Q1 · Q5)_ — the SECOND discovery type: evolve one population keeping its genomes,
  read the learning curve, then trace it against a random-brain control (the mechanism is the contrast).
- **The Report** — assembles the **findings notebook** (`state/findings.svelte.ts`, a persisted
  envelope any instrument writes to) into a seven-question brief (`state/report.svelte.ts`), each
  answer drawn from the evidence that settled it; exportable to Markdown/PDF.

The measuring instruments are thin UIs over one spine: the pure `evaluator` on a **Web Worker pool**
(`runner.ts`) aggregated by honest `stats.ts`. The Trace is the exception — a deliberate, time-sliced
main-thread study (`harness/traceStudy.ts`) that evolves-and-KEEPS a population (the evaluator discards
it) and reads `World.lifeCurve` **read-only**, plus `harness/trace.ts` for one bout's paths. **The
engine and the fidelity gate are never touched** — Research, the curve capture included, only ever
_reads_ the engine. A round-trip stitches the modes: **Analyse** hands a Studio world to Research as the
subject every instrument explores (`app.analyze`), and **Watch this world** drops an Atlas point or the
Report's subject back onto the bench (`landscape.watch` / `report.watch`).

**Honesty rails (load-bearing):** an exploratory Sweep shows effect **intervals only** — no
significance badge, because it is many comparisons. A verdict WORD ("supported"/"refuted") is emitted
**only** by the Ledger, and only from a single contrast fixed before the run. The Atlas's cliff is the
steepest measured fall-off, and it draws **nothing** on a flat or rising field rather than inventing a
threshold. **The Report answers a question only when a real finding backs it** — every other question
stays an honest "run the test" prompt; it can never say more than was measured, because it renders the
same snapshot the screen does (`state/report.svelte.ts` is the one place this rail lives).

## Honesty gates

1. **Port fidelity** (`src/lib/harness/fidelity.spec.ts`): seeds the RNG and drives our
   engine and the vendored `reference/engine2.js` off the same draw stream, asserting
   **bit-identical** state. If it fails, the port diverged — it is never loosened.
2. **The science** (`src/lib/harness/survival.spec.ts` + `npm run bench:survival`): seeded
   sweeps pin the honest finding — Direction is the only sense that clearly pays, extras
   don't stack. A nightly CI job re-measures and fails if any world drifts >5pp off its
   measured baseline.
3. **Schooling** (`npm run bench:schooling`): a 2×2 ablation that measures whether flocking
   evolves, scored by the shoal sense's MARGINAL effect (sense-on vs sense-off at equal ocean)
   and by training-life — controls that separate evolved grouping from the artifact of a
   confusion effect simply keeping more fish alive. It confirms schooling both evolves AND
   pays under predator attention (a shark that loses its lock in a dense swarm), and does not
   under the mechanics that came before it. The Shoal exhibit runs this experiment live.

## Non-negotiable constraints

- **Each fish owns its own 68-weight genome** — never collapse to one shared brain.
- **A disabled sense feeds 0** into its input slot — that's what makes toggling a sense a
  true ablation.
- **Deployed mode never respawns** — the population decays to zero (training-time generation
  resets are a separate, correct mechanism).
- **No pointer may outlive its creature**: selection/hover/sense pointers are cleared when a
  fish is eaten, when its generation is replaced, and on world reset.
- **The honest finding stays**: more senses ≠ more intelligence. Don't fake a clean ladder.

## Deployment

Static build, deployed to GitHub Pages by CI on `main`. The Pages sub-path is env-guarded:
`BASE_PATH=/darwinlab npm run build` produces the Pages-shaped build; local dev and plain
builds stay at `/`. The e2e suite runs against the based build in CI, so a base-path
regression fails before it deploys.

## Stack

SvelteKit 2 · Svelte 5 (runes) · TypeScript · Vite · `adapter-static` ·
Vitest (unit + component, real Chromium for component specs) · Playwright (e2e) ·
ESLint + Prettier · GitHub Actions (CI, Pages deploy, nightly science watch).
