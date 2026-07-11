/**
 * Render — pure canvas painters. Engine state + theme in, pixels out.
 *
 * These functions read engine data and draw; they own NO physics and mutate NO
 * simulation state. Kept separate from `$lib/engine` only for cleanliness — behaviour
 * must stay byte-identical to the draw code in engine2.js.
 *
 * Planned modules:
 *   theme.ts (THEMES + ACCENTS canvas palettes) · drawWorld.ts · drawBrain.ts · drawCurve.ts (+ drawDecay)
 *
 * TODO(engine-port): port the rendering half of engine2.js here.
 */
export {};
