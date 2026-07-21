import { describe, it, expect } from 'vitest';
import { traceBout } from './trace';
import { newWorldConfig } from '../engine';

/**
 * The trajectory trace: it records every fish's path and the predator's, for one frozen bout. The
 * paths' shapes are a live simulation and are not asserted; what is asserted is the CONTRACT — every
 * fish is traced, the death flag tracks who was actually eaten, and the same seed gives the same trace.
 */

const world = (over = {}) => ({ ...newWorldConfig('Trace', '#888888'), ...over });

describe('traceBout', () => {
	it('traces every fish that started the bout, each with a sampled path', () => {
		const cfg = world({ prey: 8 });
		const trace = traceBout(cfg, undefined, 1, 2);

		expect(trace.fish).toHaveLength(8); // one trace per fish, eaten or not
		expect(trace.bw).toBe(cfg.bw);
		expect(trace.bh).toBe(cfg.bh);
		expect(trace.fish.every((f) => f.path.length > 0)).toBe(true);
	});

	it('with no predator, nothing dies and the predator path is empty', () => {
		// preds:0 is the clean control — every fish must survive, so `died` is provably about eating,
		// not about the bout simply ending.
		const trace = traceBout(world({ prey: 6, preds: 0 }), undefined, 2, 2);

		expect(trace.fish.every((f) => !f.died)).toBe(true);
		expect(trace.fish.every((f) => f.life === trace.seconds)).toBe(true);
		expect(trace.pred).toHaveLength(0);
	});

	it('with a predator, its path is recorded', () => {
		const trace = traceBout(world({ prey: 6, preds: 1 }), undefined, 3, 2);
		expect(trace.pred.length).toBeGreaterThan(0);
	});

	it('is deterministic — the same world and seed give the same trace', () => {
		const cfg = world({ prey: 6, preds: 1 });
		expect(traceBout(cfg, undefined, 7, 2)).toEqual(traceBout(cfg, undefined, 7, 2));
	});
});
