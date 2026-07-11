/**
 * Engine — the pure neuroevolution science.
 *
 * HARD CONSTRAINT: this folder is FRAMEWORK-AGNOSTIC. No Svelte / SvelteKit / DOM /
 * canvas imports may ever appear here, so the engine stays portable and can be driven
 * headlessly by `$lib/harness`.
 *
 * This is a faithful port of `.claude/docs/initial_instruction_and_material/engine2.js`.
 * Every tuning constant was found empirically (README §9) — do NOT tune values to
 * flatter results without reproducing the README §8 survival numbers headlessly first.
 *
 * Planned modules (see ARCHITECTURE.md):
 *   constants.ts  types.ts  rng.ts  network.ts  genetics.ts  sensing.ts  world.ts  story.ts
 *
 * TODO(engine-port): port engine2.js into the modules above and re-export them here.
 */
export {};
