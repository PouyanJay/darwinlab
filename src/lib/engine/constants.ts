/**
 * Tuning constants — EMPIRICALLY FOUND (README §9). Values are byte-identical to
 * engine2.js. Do NOT change any of these to flatter results without re-measuring the §8
 * survival numbers headlessly (Golden rule #1/#4 in CLAUDE.md).
 *
 * This file holds the documented, cross-referenced knobs. Deep predator-internal magic
 * numbers stay inline (verbatim) at their call sites in world.ts, where copying them
 * literally is the safest against transcription error.
 */

// ---- generation / fish motion ----
/** Sim-seconds per generation (a generation can end early only if all fish are eaten). */
export const GEN_DURATION = 10;
/** Fish speed cap (px/s), applied to thrust output. */
export const MAXSPEED = 176;
/** Fish turn-rate cap (rad/s), applied to turn output. */
export const MAXTURN = 5.0;
/** Fish velocity responsiveness (how fast actual velocity chases the target). */
export const RESP = 4.6;

// ---- genome / genetic algorithm ----
/** Gaussian scale for fresh random weights (`randn() * 0.8`). */
export const GENOME_INIT_SCALE = 0.8;
/** Fraction of the ranked roster copied straight through as elites. */
export const ELITE_FRACTION = 0.12;
/** Tournament selection bias exponent over the top half (`pow(random, 1.7)`). */
export const TOURNAMENT_BIAS = 1.7;
/** Per-weight mutation std = MUTATION_BASE + rate * MUTATION_RATE_SCALE. */
export const MUTATION_BASE = 0.06;
export const MUTATION_RATE_SCALE = 1.7;
/** Probability a given weight is perturbed at all during mutation. */
export const MUTATION_PROB = 0.85;
/** Probability multiplier for a rare full weight reset (`rate * 0.25`). */
export const MUTATION_RESET_RATE = 0.25;

// ---- learning curve (survival %) ----
/** Curve smoothing: `surv = prev*0.65 + raw*0.35` so the trend reads through noise. */
export const CURVE_SMOOTH_PREV = 0.65;
export const CURVE_SMOOTH_RAW = 0.35;
/** Display band — the survival axis is zoomed to [0.1, 0.9] so the real trend is legible. */
export const CURVE_LO = 0.1;
export const CURVE_HI = 0.9;
/** Max samples retained in a curve/decay buffer before shifting. */
export const CURVE_MAX_POINTS = 400;

// ---- sensing normalization ----
/** Closing speed is normalized by this before clamping to [0,1]. */
export const CLOSING_NORM = 170;
/** Wall-ray distance is normalized by this (`1 - t/170`) before clamping to [0,1]. */
export const WALL_RAY_NORM = 170;

// ---- deployment (post-training real-world run) ----
/** Seconds between decay-curve samples in deployed mode. */
export const DECAY_SAMPLE_INTERVAL = 0.3;
