import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator';
import { DEFAULT_WORLDS } from '../engine';

/** Tiny budgets: this spec is about the CONTRACT, not about converged science. */
const tiny = { seeds: 2, episodes: 2, bouts: 2 };

describe('evaluate — a result, not a lucky run', () => {
	it('reports the n it was measured over, and an error bar with it', async () => {
		const result = await evaluate({ cfg: DEFAULT_WORLDS[2], ...tiny });

		expect(result).not.toBeNull();
		expect(result!.n).toBe(2);
		expect(result!.returns).toHaveLength(2); // one per independent seed
		expect(result!.meanReturn).toBeGreaterThan(0);
		expect(result!.sdReturn).toBeGreaterThanOrEqual(0);
	}, 60_000);

	it('is deterministic: the same environment evaluates to the same numbers', async () => {
		// The whole point of an evaluation is that someone else can get it back. If this drifts, the
		// number on the card is an anecdote.
		const a = await evaluate({ cfg: DEFAULT_WORLDS[2], ...tiny });
		const b = await evaluate({ cfg: DEFAULT_WORLDS[2], ...tiny });

		expect(a!.meanReturn).toBe(b!.meanReturn);
		expect(a!.returns).toEqual(b!.returns);
	}, 90_000);

	it('leaves the caller’s config alone — an evaluation must not mutate what it measures', async () => {
		const cfg = structuredClone(DEFAULT_WORLDS[2]);
		const before = JSON.stringify(cfg);

		await evaluate({ cfg, ...tiny });

		expect(JSON.stringify(cfg)).toBe(before);
	}, 60_000);

	it('cancels between slices instead of running to completion in the background', async () => {
		const controller = new AbortController();
		controller.abort(); // already gone: the user closed the panel before it started

		const result = await evaluate(
			{ cfg: DEFAULT_WORLDS[2], seeds: 5, episodes: 50 },
			{ signal: controller.signal }
		);

		expect(result).toBeNull();
	}, 20_000);

	it('captures the learning curve only when asked, so the hot batch path pays nothing', async () => {
		const without = await evaluate({ cfg: DEFAULT_WORLDS[2], ...tiny });
		expect(without!.curve).toBeUndefined(); // a sweep/landscape run must not ship the curve

		const withCurve = await evaluate({ cfg: DEFAULT_WORLDS[2], ...tiny, curve: true });
		expect(withCurve!.curve).toBeDefined();
		// One point per evolved generation — the per-gen survival fraction the UI plots.
		expect(withCurve!.curve).toHaveLength(tiny.episodes);
		// a smoothed survival FRACTION per point, never seconds — so it stays inside [0, 1]
		expect(withCurve!.curve!.every((point) => point >= 0 && point <= 1)).toBe(true);
	}, 60_000);

	it('the captured curve is deterministic — the same run gives the same curve', async () => {
		const a = await evaluate({ cfg: DEFAULT_WORLDS[2], ...tiny, curve: true });
		const b = await evaluate({ cfg: DEFAULT_WORLDS[2], ...tiny, curve: true });
		expect(a!.curve).toEqual(b!.curve);
	}, 90_000);

	it('carries the behavior signatures, so a card can say HOW the agents survived', async () => {
		const result = await evaluate({ cfg: DEFAULT_WORLDS[2], ...tiny });

		// 90° is aimless drift; a real number here means the measurement actually ran
		expect(result!.behavior.fleeAngleErrorDeg).toBeGreaterThan(0);
		expect(result!.behavior.fleeAngleErrorDeg).toBeLessThanOrEqual(180);
		expect(result!.behavior.dodgeRate).toBeGreaterThanOrEqual(0);
		expect(result!.behavior.dodgeRate).toBeLessThanOrEqual(1);
	}, 60_000);
});
