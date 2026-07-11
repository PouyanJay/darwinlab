/**
 * Engine — the pure neuroevolution science.
 *
 * HARD CONSTRAINT: this folder is FRAMEWORK-AGNOSTIC. No Svelte / SvelteKit / DOM /
 * canvas imports may ever appear here (enforced by ESLint), so the engine stays portable
 * and can be driven headlessly by `$lib/harness`.
 *
 * Faithful port of `.claude/docs/initial_instruction_and_material/engine2.js`. Every tuning
 * constant was found empirically (README §9) — do NOT tune values to flatter results
 * without reproducing the README §8 survival numbers headlessly first.
 *
 * Public surface (grows as modules land: network, genetics, sensing, world, story, defaults).
 */
export * from './math';
export * from './rng';
export * from './constants';
export * from './types';
export * from './network';
export * from './genetics';
