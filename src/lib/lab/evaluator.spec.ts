import { describe, it, expect, vi } from 'vitest';
import { evaluate } from './evaluator';
import { measureBout } from '../harness/behavior';
import { DEFAULT_WORLDS } from '../engine';

// A pass-through spy on measureBout: every call still runs the REAL measurement, but the seed of
// each bout is recorded — the only way to assert the champion's arena IS the population's arena
// (two different seeds can coincidentally produce similar returns on tiny fixtures).
vi.mock('../harness/behavior', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../harness/behavior')>();
	return { ...actual, measureBout: vi.fn(actual.measureBout) };
});

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

	it('scores champion clones only when asked, without perturbing the population', async () => {
		const plain = await evaluate({ cfg: DEFAULT_WORLDS[2], ...tiny });
		expect(plain!.championReturns).toBeUndefined(); // the default path pays nothing

		const live = await evaluate({ cfg: DEFAULT_WORLDS[2], ...tiny, champion: true });
		expect(live!.championReturns).toHaveLength(2); // one per seed
		expect(live!.championReturns!.every((value) => value > 0)).toBe(true);
		// the POPULATION numbers are identical with and without the champion pass — scoring the
		// clones must not perturb the evolved population's own measurement
		expect(live!.returns).toEqual(plain!.returns);
	}, 90_000);

	it('the champion is scored in the SAME arenas as its population — the pairing itself', async () => {
		const spy = vi.mocked(measureBout);
		spy.mockClear();
		await evaluate({ cfg: DEFAULT_WORLDS[2], ...tiny, champion: true });
		// 2 seeds × 2 bouts, each bout scored TWICE (population + champion) on one seed: every bout
		// seed used must appear exactly twice. A drifted champion seed base fails this immediately.
		const boutSeeds = spy.mock.calls.map((call) => call[2]);
		const counts = new Map<number, number>();
		for (const seed of boutSeeds) counts.set(seed, (counts.get(seed) ?? 0) + 1);
		expect(boutSeeds.length).toBe(8); // 2 seeds × 2 bouts × 2 rosters
		expect([...counts.values()].every((count) => count === 2)).toBe(true);
	}, 90_000);

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
