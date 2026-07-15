import { describe, it, expect } from 'vitest';
import { makeWorld, stepWorld, seededRng, DEFAULT_WORLDS, MAXSPEED } from './index';
import type { WorldConfig } from './types';

/**
 * The two conditions added for the Agents / Adversary split: the agent's top speed, and whether the
 * adversary darts. Both are optional-with-a-reference-default, so the fidelity gate stays bit-exact
 * (proved separately); here we prove they actually MOVE the world when set.
 */

const DIRECTION = DEFAULT_WORLDS[2];

function peakSpeeds(cfg: WorldConfig, seed: number, seconds = 10) {
	const w = makeWorld(cfg, undefined, seededRng(seed));
	let fish = 0;
	let shark = 0;
	for (let i = 0; i < seconds * 60; i++) {
		stepWorld(w, 1 / 60);
		for (const f of w.fish) fish = Math.max(fish, Math.hypot(f.vx, f.vy));
		for (const p of w.preds) shark = Math.max(shark, Math.hypot(p.vx, p.vy));
	}
	return { fish, shark };
}

describe('agent top speed (maxSpeed)', () => {
	it('defaults to the reference MAXSPEED when unset — this is what keeps fidelity bit-exact', () => {
		expect(DIRECTION.maxSpeed).toBeUndefined();
		const { fish } = peakSpeeds(DIRECTION, 1);
		// a fish flat-out reaches roughly its cap; it must not exceed the reference 176 by much
		expect(fish).toBeLessThanOrEqual(MAXSPEED + 2);
	});

	it('raises the ceiling when set: a faster world lets a fish actually go faster', () => {
		const fast = peakSpeeds({ ...DIRECTION, maxSpeed: 260 } as WorldConfig, 1).fish;
		const slow = peakSpeeds({ ...DIRECTION, maxSpeed: 110 } as WorldConfig, 1).fish;

		expect(fast).toBeGreaterThan(MAXSPEED + 20); // the cap really lifted
		expect(slow).toBeLessThan(140); // …and really lowered
	});
});

describe('the dart (lunge)', () => {
	it('defaults on: the adversary strikes far above its cruise', () => {
		expect(DIRECTION.lunge).toBeUndefined();
		const { shark } = peakSpeeds(DIRECTION, 1);
		const cruise = 200 * DIRECTION.predSpeed; // 140 at predSpeed 0.7
		expect(shark).toBeGreaterThan(cruise * 2); // a strike, not a cruise
	});

	it('off: the adversary never exceeds its cruise', () => {
		const { shark } = peakSpeeds({ ...DIRECTION, lunge: false } as WorldConfig, 1);
		const cruise = 200 * DIRECTION.predSpeed;
		// no strike ever arms, so the peak is the cruise (plus the small overshoot before the speed
		// clamp catches it) — nowhere near a lunge.
		expect(shark).toBeLessThan(cruise * 1.25);
	});

	// Its own timeout: this test evolves several worlds AND runs long bouts, so under full-suite
	// contention it drifts past the 5s default — which is a timeout dressed as a failure, not a real
	// one (the values are deterministic and hugely separated). See CLAUDE.md on CPU-heavy tests.
	it(
		'is where most of the killing comes from — off, far more of a good population survives',
		() => {
			/*
			 * The honest finding the UI states, and it corrected my first guess. A cruise-only shark is
			 * NOT toothless: interception, cornering and imperfect fleeing still catch a good share of an
			 * evolved generation. But the STRIKE catches nearly all of it. So the true claim is not
			 * "nothing dies" — it is "the dart is doing most of the killing".
			 *
			 * Measured, 5 seeds: dart-on survival averages ~6%, dart-off ~28%. That is a ~5× gap, so
			 * two seeds are plenty to pin the RELATIONSHIP without turning the test into a CPU hog.
			 */
			const survivors = (lunge: boolean, seed: number) => {
				const w = makeWorld({ ...DIRECTION, lunge } as WorldConfig, undefined, seededRng(seed));
				while (w.gen < 40) stepWorld(w, 1 / 60);
				w.maxGen = 1;
				w.gen = 1;
				const start = w.fish.length;
				for (let i = 0; i < 20 * 60; i++) stepWorld(w, 1 / 60);
				return w.fish.length / start;
			};

			const mean = (lunge: boolean) => [1, 2].reduce((sum, s) => sum + survivors(lunge, s), 0) / 2;
			const withDart = mean(true);
			const withoutDart = mean(false);

			expect(withDart).toBeLessThan(0.35); // the strike catches most of a generation
			expect(withoutDart).toBeGreaterThan(withDart * 1.6); // the dart is doing most of the killing
		},
		20_000
	);
});
