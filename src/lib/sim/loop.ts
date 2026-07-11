/**
 * Sim loop — bridges the pure engine to the UI.
 *
 * Drives every world's `stepWorld` on a FIXED timestep (target 1/60s) scaled by the
 * speed control. Must use a visibility-safe `setTimeout(loop, 16)` scheduler, NOT bare
 * requestAnimationFrame — RAF throttles/freezes offscreen and stalls the sim
 * (README §4 and gotcha #1 in CLAUDE.md). Turbo/"Train N gens" runs off-loop in
 * time-boxed ~15ms slices.
 *
 * TODO(ui): implement once engine + state stores exist.
 */
export {};
