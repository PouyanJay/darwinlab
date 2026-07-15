/**
 * Schooling metric (Phase 14 spike) — measures whether a population MOVES AS A SCHOOL, not
 * whether it was told to. Two order parameters, both pure functions of the live fish:
 *
 *   polarization φ — the magnitude of the mean unit-velocity vector, 0 (chaos, every fish
 *     pointing its own way) to 1 (a perfectly aligned school). This is the number that rises
 *     if synchronized swimming evolves.
 *   nearest-neighbour distance (NND) — mean px to each fish's closest neighbour. It FALLS as a
 *     population clumps. φ says "aligned"; NND says "close" — a school is both.
 *
 * Neither is ever an input to selection: fitness stays seconds survived. These only OBSERVE.
 * The honest experiment (scripts/sweep-schooling.ts) asks whether they climb, and only when
 * the world both makes grouping pay (confusion) and lets the fish feel their shoal (the sense).
 */

import { makeWorld, stepWorld, seededRng, applyCfg } from '../engine';
import type { Fish, Genome, WorldConfig } from '../engine';

const DT = 1 / 60;
/** Below this speed a fish has no meaningful heading, so it does not vote on polarization. */
const MOVING_EPS = 6;

/**
 * Polarization φ ∈ [0,1]: |mean of unit velocity vectors| over the fish that are actually
 * moving. Stationary fish (speed < MOVING_EPS) have no direction and are excluded; with none
 * moving there is nothing to align, so φ = 0.
 */
export function polarization(fish: readonly Pick<Fish, 'vx' | 'vy'>[]): number {
	let sx = 0;
	let sy = 0;
	let n = 0;
	for (const f of fish) {
		const sp = Math.hypot(f.vx, f.vy);
		if (sp < MOVING_EPS) continue;
		sx += f.vx / sp;
		sy += f.vy / sp;
		n++;
	}
	return n ? Math.hypot(sx, sy) / n : 0;
}

/**
 * Mean nearest-neighbour distance (px) — for each fish, the distance to its closest neighbour,
 * averaged. A tight school scores low. Undefined for fewer than two fish (there is no
 * neighbour), so it returns null: a caller time-averaging this must skip a null sample rather
 * than fold a zero in (which would read as "perfectly packed" for an empty tank).
 */
export function meanNearestNeighbor(fish: readonly Pick<Fish, 'x' | 'y'>[]): number | null {
	if (fish.length < 2) return null;
	let sum = 0;
	for (let i = 0; i < fish.length; i++) {
		let nd = Infinity;
		for (let j = 0; j < fish.length; j++) {
			if (i === j) continue;
			const d = Math.hypot(fish[i].x - fish[j].x, fish[i].y - fish[j].y);
			if (d < nd) nd = d;
		}
		sum += nd;
	}
	return sum / fish.length;
}

export interface SchoolStats {
	/** Time-averaged polarization φ (0–1) over the bout. */
	polarization: number;
	/** Time-averaged nearest-neighbour distance (px), sampled only while ≥2 fish live. */
	nnd: number;
	/** Mean seconds survived per fish over the bout — the honest survival signal. */
	meanLife: number;
	aliveAtEnd: number;
}

/**
 * Run one no-evolution bout on a frozen population and score φ, NND and survival — the same
 * "deployed semantics, normalise by hand" contract measureBout uses (makeWorld double-spawns
 * predators; applyCfg fixes it, or every trial runs against twice the sharks it configured).
 */
export function measureSchool(
	cfg: WorldConfig,
	genomes: Genome[] | undefined,
	seed: number,
	seconds = 12
): SchoolStats {
	const w = makeWorld(cfg, genomes, seededRng(seed));
	w.maxGen = 1; // no respawns, no breeding — the evolved brains are held fixed
	w.gen = 1;
	applyCfg(w);

	const steps = Math.round(seconds / DT);
	const lifespans = new Map<Fish, number>(w.fish.map((f) => [f, seconds]));
	let polSum = 0;
	let polN = 0;
	let nndSum = 0;
	let nndN = 0;

	for (let s = 0; s < steps; s++) {
		const before = [...w.fish];
		stepWorld(w, DT);
		for (const f of before) {
			if (!w.fish.includes(f)) lifespans.set(f, (s + 1) * DT);
		}
		polSum += polarization(w.fish);
		polN++;
		const nnd = meanNearestNeighbor(w.fish);
		if (nnd !== null) {
			nndSum += nnd;
			nndN++;
		}
	}

	const lives = [...lifespans.values()];
	return {
		polarization: polN ? polSum / polN : 0,
		nnd: nndN ? nndSum / nndN : NaN,
		meanLife: lives.reduce((a, b) => a + b, 0) / lives.length,
		aliveAtEnd: w.fish.length
	};
}

/** Mean of `measureSchool` across seeds. */
export function measureSchools(
	cfg: WorldConfig,
	genomes: Genome[] | undefined,
	seeds: number[],
	seconds = 12
): SchoolStats {
	const rows = seeds.map((s) => measureSchool(cfg, genomes, s, seconds));
	const mean = (pick: (r: SchoolStats) => number) =>
		rows.reduce((a, r) => a + pick(r), 0) / rows.length;
	return {
		polarization: mean((r) => r.polarization),
		nnd: mean((r) => r.nnd),
		meanLife: mean((r) => r.meanLife),
		aliveAtEnd: mean((r) => r.aliveAtEnd)
	};
}
