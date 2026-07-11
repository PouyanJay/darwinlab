# Architecture — Darwin Lab

Darwin Lab is a client-only SvelteKit app (static SPA via `adapter-static`) for
**neuroevolution**: tiny neural-net fish evolve real behavior against a fixed-rule
shark. See [CLAUDE.md](CLAUDE.md) for the golden rules and
[.claude/docs/initial_instruction_and_material/README.md](.claude/docs/initial_instruction_and_material/README.md)
for the full spec.

## Organizing principle

**The science is walled off from the UI.** The engine is pure, framework-agnostic
TypeScript with zero Svelte/DOM imports, so it stays portable and testable headlessly.
The UI wraps the engine; it never leaks into it. The UI mutates simulation state **only**
through the state stores, which call engine functions (README §7).

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
│  │              Faithful port of engine2.js: network, genetics, sensing, world, story.
│  │              Constants are empirically tuned (README §9) — re-measure §8 before changing.
│  ├─ render/     Pure canvas painters. Engine state in, pixels out. No physics.
│  ├─ harness/    Headless survival measurement — proves the port reproduces README §8.
│  ├─ state/      Svelte 5 runes stores. The only seam that mutates the sim (via engine fns).
│  ├─ sim/        Visibility-safe fixed-timestep loop bridging engine ↔ UI (setTimeout, not RAF).
│  ├─ components/ UI grouped by feature: topbar, bench, inspector, conditions, story, common.
│  └─ styles/     Design tokens (both themes as CSS custom properties) + global styles.
├─ routes/
│  ├─ +layout.svelte   fonts + global css
│  ├─ +layout.ts       ssr=false, prerender=true, csr=true  (client-only SPA)
│  └─ +page.svelte     the bench (single screen)
tests/            Vitest unit tests (engine) + harness assertions.
```

## Non-negotiable constraints (from CLAUDE.md)

- **Each fish owns its own 68-weight genome** — never collapse to one shared brain.
- **A disabled sense feeds 0** into its input slot — that's what makes toggling a sense a true ablation.
- **Deployed mode never respawns** — the population decays to zero (training resets are separate).
- **Visibility-safe timer loop**, not bare `requestAnimationFrame` (RAF freezes offscreen).
- **The honest finding stays**: more senses ≠ more intelligence. Don't fake a clean ladder.

## Stack

SvelteKit 2 · Svelte 5 (runes) · TypeScript · Vite · `adapter-static` ·
Vitest (unit + component) · Playwright (e2e) · ESLint + Prettier.
