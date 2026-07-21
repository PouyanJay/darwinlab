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
│  │              and the headless survival sweep the science claims are measured with.
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
│  │              sweep / ledger /     the three Research instruments' state (factors →
│  │              landscape.svelte     effects · claims → verdicts+persistence · axes → landscape)
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
│  │              research/ — the Research stage + the three instruments (Sweep, Ledger, Atlas)
│  │              and RunProgress; topbar/ModeSwitch flips Studio ⇄ Research.
│  ├─ lab/        The Research SCIENCE (pure, no Svelte/DOM), + the batch pipeline:
│  │              evaluator.ts        n-seed measurement of a config (mean ± sd survival)
│  │              runner.ts +         the off-main-thread worker POOL and its protocol;
│  │              eval.worker.ts +      falls back in-thread where Worker is absent (SSR/vitest).
│  │              protocol.ts          runner.spec asserts worker ≡ in-thread, bit-identical.
│  │              stats.ts            bootstrap CIs, Cohen's d, two-arm contrast (seeded)
│  │              sweep / hypothesis / the instruments' pure cores (factorial · claim→contrast ·
│  │              landscape.ts          2D grid + measured cliff)
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
bar). **Studio** is the spatial tree above — watch a world evolve, read one brain. **Research** runs
MANY simulations to extract conclusions, across three instruments: **the Sweep** (a factorial → each
factor's effect on survival, with intervals), **the Ledger** (a claim → one pre-registered contrast →
a supported/refuted verdict, kept as a dated, reproducible, localStorage-persisted record), and **the
Atlas** (two parameters → a pannable survival landscape with the cliff drawn where it measures, not
where it's assumed). All three are thin UIs over one spine: the pure `evaluator` moved onto a **Web
Worker pool** (`runner.ts`) so a thousand-bout batch never blocks the frame, aggregated by honest
`stats.ts`. **The engine and the fidelity gate are never touched** — Research only ever *reads* the
engine. The two modes are stitched by a round-trip: Studio's **Analyse** hands a world to Research as
the subject every instrument then explores (`app.analyze` / `bench.analyzeWorld`), and the Atlas's
**Watch this world** drops a drilled point back onto the bench (`landscape.watch`).

**Honesty rails (load-bearing):** an exploratory Sweep shows effect **intervals only** — no
significance badge, because it is many comparisons. A verdict WORD ("supported"/"refuted") is emitted
**only** by the Ledger, and only from a single contrast fixed before the run. The Atlas's cliff is the
steepest measured fall-off, and it draws **nothing** on a flat or rising field rather than inventing a
threshold.

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
