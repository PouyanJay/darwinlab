/**
 * Behavior signatures — measures whether evolved behavior is VISIBLE, not just fitter.
 *
 * The narration the product wants to earn makes four claims you can see: fish BOLT when
 * the predator nears, flee the RIGHT WAY, DODGE the lunge so the shark sails past, and
 * stop CORNERING themselves. Each claim is a number here, measured on a frozen population
 * (no evolution during the bout), so environment variants can be compared honestly —
 * the ladder must emerge from selection, never from a script.
 */

import { makeWorld, stepWorld, seededRng } from '../engine';
import { clamp } from '../engine';
import type { Genome, WorldConfig, Fish } from '../engine';

const DT = 1 / 60;

export interface BehaviorStats {
	/** Mean fish speed with the predator in vision ÷ speed while unseen. >1 = they bolt. */
	boltRatio: number;
	/** Mean |angle between velocity and dead-away-from-predator| while in vision, degrees.
	 *  90° is what aimless drift scores; low means they flee the right way. */
	fleeAngleErrorDeg: number;
	/** Fraction of lunges that end with no kill during the strike — the shark sails past. */
	dodgeRate: number;
	/** Of all deaths, the share that happened boxed near two walls at once. */
	cornerDeathShare: number;
	/** Share of living fish-time spent boxed near two walls — exposure-normalized, unlike
	 *  the death share (long-lived populations otherwise look MORE corner-prone). */
	cornerTimeShare: number;
	/** Mean distance kept from the nearest predator, px — "keeping distance" is the
	 *  Distance sense's visible story even when bolting isn't. */
	meanPredDistance: number;
	/** Mean seconds survived per fish over the bout. */
	meanLife: number;
	aliveAtEnd: number;
	lunges: number;
	deaths: number;
}

/** Run one no-evolution bout and score the four visible claims plus survival. */
export function measureBout(
	cfg: WorldConfig,
	genomes: Genome[] | undefined,
	seed: number,
	seconds = 10
): BehaviorStats {
	const w = genomes
		? makeWorld(cfg, genomes, seededRng(seed))
		: makeWorld(cfg, undefined, seededRng(seed));
	w.maxGen = 1; // deployed semantics: no respawns, no breeding — the population is frozen
	w.gen = 1;

	const steps = Math.round(seconds / DT);
	const lifespans = new Map<Fish, number>(w.fish.map((f) => [f, seconds]));
	let seenSpeed = 0;
	let seenN = 0;
	let unseenSpeed = 0;
	let unseenN = 0;
	let fleeErr = 0;
	let fleeN = 0;
	let lunges = 0;
	let lungeKills = 0;
	let cornerDeaths = 0;
	let deaths = 0;
	let cornerTime = 0;
	let liveTime = 0;
	let predDist = 0;
	let predDistN = 0;
	const wasLunging = w.preds.map(() => false);

	for (let s = 0; s < steps; s++) {
		const before = [...w.fish];
		stepWorld(w, DT);

		// lunge rising edges
		w.preds.forEach((p, i) => {
			const now = p.lunge > 0;
			if (now && !wasLunging[i]) lunges++;
			wasLunging[i] = now;
		});

		// deaths this step: where, and during a strike?
		const anyLunge = w.preds.some((p) => p.lunge > 0);
		for (const f of before) {
			if (w.fish.includes(f)) continue;
			deaths++;
			lifespans.set(f, (s + 1) * DT);
			if (anyLunge) lungeKills++;
			const edgeX = Math.min(f.x, cfg.bw - f.x);
			const edgeY = Math.min(f.y, cfg.bh - f.y);
			if (edgeX < 70 && edgeY < 70) cornerDeaths++;
		}

		// per-fish motion vs the nearest predator
		for (const f of w.fish) {
			let nd = Infinity;
			let np = null;
			for (const p of w.preds) {
				const d = Math.hypot(p.x - f.x, p.y - f.y);
				if (d < nd) {
					nd = d;
					np = p;
				}
			}
			liveTime += DT;
			if (Math.min(f.x, cfg.bw - f.x) < 70 && Math.min(f.y, cfg.bh - f.y) < 70) {
				cornerTime += DT;
			}
			if (np) {
				predDist += nd;
				predDistN++;
			}
			const speed = Math.hypot(f.vx, f.vy);
			if (np && nd < cfg.vision) {
				seenSpeed += speed;
				seenN++;
				if (speed > 12) {
					const away = Math.atan2(f.y - np.y, f.x - np.x);
					const vel = Math.atan2(f.vy, f.vx);
					let d = Math.abs(vel - away) % (2 * Math.PI);
					if (d > Math.PI) d = 2 * Math.PI - d;
					fleeErr += (d * 180) / Math.PI;
					fleeN++;
				}
			} else {
				unseenSpeed += speed;
				unseenN++;
			}
		}
	}

	const lives = [...lifespans.values()];
	return {
		boltRatio: seenN && unseenN ? seenSpeed / seenN / Math.max(1, unseenSpeed / unseenN) : 1,
		fleeAngleErrorDeg: fleeN ? fleeErr / fleeN : 90,
		dodgeRate: lunges ? clamp(1 - lungeKills / lunges, 0, 1) : 0,
		cornerDeathShare: deaths ? cornerDeaths / deaths : 0,
		cornerTimeShare: liveTime ? cornerTime / liveTime : 0,
		meanPredDistance: predDistN ? predDist / predDistN : 0,
		meanLife: lives.reduce((a, b) => a + b, 0) / lives.length,
		aliveAtEnd: w.fish.length,
		lunges,
		deaths
	};
}

/** Mean of `measureBout` across seeds — one row of the variant table. */
export function measureBouts(
	cfg: WorldConfig,
	genomes: Genome[] | undefined,
	seeds: number[],
	seconds = 10
): BehaviorStats {
	const rows = seeds.map((s) => measureBout(cfg, genomes, s, seconds));
	const mean = (pick: (r: BehaviorStats) => number) =>
		rows.reduce((a, r) => a + pick(r), 0) / rows.length;
	return {
		boltRatio: mean((r) => r.boltRatio),
		fleeAngleErrorDeg: mean((r) => r.fleeAngleErrorDeg),
		dodgeRate: mean((r) => r.dodgeRate),
		cornerDeathShare: mean((r) => r.cornerDeathShare),
		cornerTimeShare: mean((r) => r.cornerTimeShare),
		meanPredDistance: mean((r) => r.meanPredDistance),
		meanLife: mean((r) => r.meanLife),
		aliveAtEnd: mean((r) => r.aliveAtEnd),
		lunges: mean((r) => r.lunges),
		deaths: mean((r) => r.deaths)
	};
}
