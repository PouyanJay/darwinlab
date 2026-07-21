/**
 * Trace one bout — the path, over time, of every fish and of the predator, so a painter can show what
 * a population actually DOES (Q5, the mechanism), not just how long it lasts.
 *
 * A FROZEN bout, set up exactly as `measureBout`'s (no evolution, predators normalised), so a trace
 * and the behaviour numbers describe the same run. Positions are sampled every few steps, so a 10s
 * bout is a few hundred points per fish rather than thousands. This is a deliberate "trace this world"
 * action, never on the hot batch path, so its cost is bounded.
 */

import { stepWorld, GEN_DURATION } from '../engine';
import type { Genome, WorldConfig, Point } from '../engine';
import { makeFrozenWorld } from './frozenWorld';

// Re-exported so a consumer of BoutTrace (the Trajectories chart) gets the point type from one import.
export type { Point };

const DT = 1 / 60;
/** Sample a position every N steps — at 60fps, every 6 steps is ~10 samples a second. */
const SAMPLE_EVERY = 6;

/** One agent's path through a bout, and what became of it. */
export interface FishTrace {
	path: Point[];
	/** Seconds it survived — equal to the bout length if it was still alive at the end. */
	life: number;
	/** True if it was eaten before the bout ended (drawn as an ✕ where the path stops). */
	died: boolean;
}

/** One bout's worth of movement — enough to draw the small-multiple, and to frame it. */
export interface BoutTrace {
	/** Container size, so a painter frames the paths without guessing the arena. */
	bw: number;
	bh: number;
	seconds: number;
	fish: FishTrace[];
	/** The predator's path, dashed in the painter — one hunter, sampled like the fish. */
	pred: Point[];
}

/** One trace request. `genomes` is the evolved population; omit it for a random-brain control (the
 *  two-schools comparison). Deterministic in `seed`. */
export interface TraceRequest {
	cfg: WorldConfig;
	genomes?: Genome[];
	seed: number;
	/** Bout length; defaults to the config's generation duration. */
	seconds?: number;
}

/** Step one frozen bout and record where everything went. */
export function traceBout({
	cfg,
	genomes,
	seed,
	seconds = cfg.genDuration ?? GEN_DURATION
}: TraceRequest): BoutTrace {
	const w = makeFrozenWorld(cfg, genomes, seed);

	const steps = Math.round(seconds / DT);
	const paths = new Map<(typeof w.fish)[number], Point[]>(w.fish.map((f) => [f, []]));
	const lifespans = new Map(w.fish.map((f) => [f, seconds]));
	const pred: Point[] = [];

	for (let s = 0; s < steps; s++) {
		const before = [...w.fish];
		stepWorld(w, DT);
		// A fish that left w.fish this step was eaten — stamp when.
		for (const f of before) if (!w.fish.includes(f)) lifespans.set(f, (s + 1) * DT);
		if (s % SAMPLE_EVERY === 0) {
			for (const f of w.fish) paths.get(f)?.push({ x: f.x, y: f.y });
			if (w.preds[0]) pred.push({ x: w.preds[0].x, y: w.preds[0].y });
		}
	}

	const fish: FishTrace[] = [...paths.entries()].map(([f, path]) => ({
		path,
		life: lifespans.get(f)!,
		died: !w.fish.includes(f)
	}));

	return { bw: cfg.bw, bh: cfg.bh, seconds, fish, pred };
}
