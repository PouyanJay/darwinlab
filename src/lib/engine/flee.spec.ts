import { describe, it, expect } from 'vitest';
import { fleeError, nearestPred, FLEE_MIN_SPEED } from './flee';
import type { Fish, Predator, WorldConfig } from './types';

/**
 * The reading the lens paints and the evaluation panel averages. Both call THIS function, so what is
 * pinned here is the definition itself — including the two cases where there is deliberately no
 * reading at all, which is the part a careless "return 0" would quietly destroy.
 */

const cfg = { vision: 200 } as Pick<WorldConfig, 'vision'>;

/** A fish at the origin, swimming along +x at a speed the metric will accept. */
function fish(vx: number, vy: number, x = 0, y = 0): Fish {
	return { x, y, vx, vy } as Fish;
}

const pred = (x: number, y: number): Predator => ({ x, y }) as Predator;

describe('fleeError', () => {
	it('is 0° when the fish swims dead away from the shark', () => {
		// shark to the left, fish swimming right — a perfect escape
		expect(fleeError(cfg, fish(100, 0), [pred(-50, 0)])).toBeCloseTo(0, 6);
	});

	it('is 180° when the fish swims straight into it', () => {
		expect(fleeError(cfg, fish(100, 0), [pred(50, 0)])).toBeCloseTo(180, 6);
	});

	it('is 90° — chance — when the fish swims across the shark', () => {
		// This is the number the whole lens diverges around: what a fish that IGNORES the shark scores.
		expect(fleeError(cfg, fish(0, 100), [pred(-50, 0)])).toBeCloseTo(90, 6);
	});

	it('is symmetric: turning left or right of the escape is the same error', () => {
		const left = fleeError(cfg, fish(100, 100), [pred(-50, 0)]);
		const right = fleeError(cfg, fish(100, -100), [pred(-50, 0)]);
		expect(left).toBeCloseTo(right!, 6);
	});

	it('reads the NEAREST shark, not the first one', () => {
		// Fleeing the far one perfectly while swimming into the near one is not an escape.
		const err = fleeError(cfg, fish(100, 0), [pred(150, 0), pred(-190, 0)]);
		expect(err).toBeCloseTo(180, 6);
	});

	it('has NO READING when nothing is in vision', () => {
		// Not zero. A fish that cannot see the shark has not fled correctly — it has not been asked,
		// and scoring it as perfect would flatter every blind population in the lab.
		expect(fleeError(cfg, fish(100, 0), [pred(-500, 0)])).toBeNull();
		expect(fleeError(cfg, fish(100, 0), [])).toBeNull();
	});

	it('has NO READING when the fish is barely moving', () => {
		// The direction of a near-zero velocity is atan2 of two tiny numbers — noise, not an intention.
		expect(fleeError(cfg, fish(FLEE_MIN_SPEED - 1, 0), [pred(-50, 0)])).toBeNull();
		expect(fleeError(cfg, fish(FLEE_MIN_SPEED + 1, 0), [pred(-50, 0)])).not.toBeNull();
	});
});

describe('nearestPred', () => {
	it('finds the closest one, and null in a world with none', () => {
		const near = nearestPred(fish(0, 0), [pred(300, 0), pred(-40, 0)]);
		expect(near?.dist).toBeCloseTo(40, 6);
		expect(nearestPred(fish(0, 0), [])).toBeNull();
	});
});
