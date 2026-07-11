/**
 * State — Svelte 5 runes stores. The ONLY seam through which the UI touches the sim.
 *
 * Per README §7, the UI never mutates engine internals directly; it calls engine
 * functions (applyCfg, resetWorld, toggling cfg.senses then applyCfg) and reads state
 * back for rendering. These stores hold the global bench/selection/story/theme state
 * and wrap those calls.
 *
 * Planned modules (`.svelte.ts` so they can use runes):
 *   bench.svelte.ts · selection.svelte.ts · story.svelte.ts · theme.svelte.ts
 *
 * TODO(ui): implement alongside the components that consume them.
 */
export {};
