/**
 * State — Svelte 5 runes stores. The ONLY seam through which the UI touches the sim.
 *
 * Per README §7, the UI never mutates engine internals directly; it calls engine functions
 * (applyCfg, resetWorld, toggling cfg.senses then applyCfg) via these stores and reads state
 * back for rendering.
 */
export * from './bench.svelte';
export * from './theme.svelte';
