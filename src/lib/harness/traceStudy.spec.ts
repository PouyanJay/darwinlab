import { describe, it, expect } from 'vitest';
import { runTraceStudy, behaviorMetrics } from './traceStudy';
import { newWorldConfig } from '../engine';
import type { BehaviorStats } from './behavior';

/**
 * The behaviour-trace study. It evolves a real population, so these use a SMALL episode count to stay
 * fast; what they pin is the study's contract, not a survival number: it is deterministic in its seed
 * (a report built from it must be reproducible), its curve is one survival fraction per generation, it
 * traces the evolved population against a same-arena random-brain control, and it cancels.
 */

const cfg = () => newWorldConfig('Trace subject', '#888888');

describe('runTraceStudy', () => {
	it('is deterministic in its seed — the same study twice gives the same curve and paths', async () => {
		const a = await runTraceStudy({ cfg: cfg(), episodes: 8, seed: 3 });
		const b = await runTraceStudy({ cfg: cfg(), episodes: 8, seed: 3 });

		expect(a).not.toBeNull();
		expect(a!.curve).toEqual(b!.curve);
		// The exact lifespans of the traced evolved school match — same brains, same bout, same result.
		expect(a!.evolved.trace.fish.map((f) => f.life)).toEqual(
			b!.evolved.trace.fish.map((f) => f.life)
		);
		expect(a!.control.trace.fish.map((f) => f.life)).toEqual(
			b!.control.trace.fish.map((f) => f.life)
		);
	});

	it('captures a learning curve of survival fractions (0–1), one per generation', async () => {
		const study = await runTraceStudy({ cfg: cfg(), episodes: 8, seed: 1 });

		expect(study!.curve).toHaveLength(8);
		for (const v of study!.curve) {
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThanOrEqual(1);
		}
	});

	it('traces the evolved population against a random-brain control on the same arena', async () => {
		const study = await runTraceStudy({ cfg: cfg(), episodes: 6, seed: 2 });

		// Only the brains differ — same arena, same population size in both schools.
		expect(study!.evolved.trace.fish.length).toBe(study!.control.trace.fish.length);
		expect(study!.evolved.trace.bw).toBe(study!.control.trace.bw);
		expect(study!.evolved.trace.bh).toBe(study!.control.trace.bh);
	});

	it('returns null when cancelled — an aborted study yields no result', async () => {
		const controller = new AbortController();
		controller.abort();
		const study = await runTraceStudy(
			{ cfg: cfg(), episodes: 40, seed: 1 },
			{ signal: controller.signal }
		);
		expect(study).toBeNull();
	});
});

describe('behaviorMetrics', () => {
	const stats = (over: Partial<BehaviorStats> = {}): BehaviorStats => ({
		boltRatio: 1,
		fleeAngleErrorDeg: 90,
		dodgeRate: 0,
		cornerDeathShare: 0,
		cornerTimeShare: 0,
		meanPredDistance: 0,
		meanLife: 0,
		aliveAtEnd: 0,
		lunges: 0,
		deaths: 0,
		...over
	});

	it('contrasts each reported signature evolved-vs-control, tagged with the better direction', () => {
		const evolved = stats({ fleeAngleErrorDeg: 20, dodgeRate: 0.5, meanPredDistance: 80 });
		const control = stats({ fleeAngleErrorDeg: 90, dodgeRate: 0.1, meanPredDistance: 40 });

		const metrics = behaviorMetrics(evolved, control);
		const flee = metrics.find((m) => m.label === 'Flee-angle error')!;
		expect(flee.evolved).toBe(20);
		expect(flee.control).toBe(90);
		expect(flee.higherIsBetter).toBe(false); // a lower flee error is the good one

		const dodge = metrics.find((m) => m.label === 'Dodge rate')!;
		expect(dodge.higherIsBetter).toBe(true); // dodging more is better
	});
});
