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
		const trace = traceBout({ cfg, seed: 1, seconds: 2 });

		expect(trace.fish).toHaveLength(8); // one trace per fish, eaten or not
		expect(trace.bw).toBe(cfg.bw);
		expect(trace.bh).toBe(cfg.bh);
		expect(trace.fish.every((f) => f.path.length > 0)).toBe(true);
	});

	it('with no predator, nothing dies and the predator path is empty', () => {
		// preds:0 is the clean control — every fish must survive, so `died` is provably about eating,
		// not about the bout simply ending.
		const trace = traceBout({ cfg: world({ prey: 6, preds: 0 }), seed: 2, seconds: 2 });

		expect(trace.fish.every((f) => !f.died)).toBe(true);
		expect(trace.fish.every((f) => f.life === trace.seconds)).toBe(true);
		expect(trace.pred).toHaveLength(0);
	});

	it('with a predator, some fish are caught and its path is recorded', () => {
		const trace = traceBout({ cfg: world({ prey: 6, preds: 1 }), seed: 3, seconds: 2 });

		expect(trace.pred.length).toBeGreaterThan(0);
		// the death flag is the point: at least one fish must be marked eaten, and an eaten fish's life
		// must be shorter than the bout (the positive case the preds:0 control can't prove).
		expect(trace.fish.some((f) => f.died)).toBe(true);
		expect(trace.fish.find((f) => f.died)!.life).toBeLessThan(trace.seconds);
	});

	it('is deterministic — the same world and seed give the same trace', () => {
		const cfg = world({ prey: 6, preds: 1 });
		expect(traceBout({ cfg, seed: 7, seconds: 2 })).toEqual(
			traceBout({ cfg, seed: 7, seconds: 2 })
		);
	});
});
