/**
 * Render — pure canvas painters. Engine state + theme in, pixels out.
 *
 * These functions read engine data and draw; they own NO physics and mutate NO simulation
 * state (the sole exception is `drawWorld` storing the fit-scale `w.transform`, which
 * `pickCreature` inverts). Behaviour is a faithful port of the rendering half of engine2.js.
 *
 * Framework-agnostic: the only DOM contact is the `CanvasRenderingContext2D` passed IN.
 * Reduced-motion is injected as a flag rather than read from `matchMedia` at module scope,
 * so this layer stays testable and DOM-free (ESLint enforces no Svelte/Kit imports here).
 */
export * from './theme';
export * from './drawWorld';
export * from './drawBrain';
export * from './drawCurve';
export * from './pick';
