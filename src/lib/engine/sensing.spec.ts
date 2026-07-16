import { describe, it, expect } from 'vitest';
import { senseInputs } from './sensing';
import type { World, Predator, WorldConfig } from './types';
import {
	testCfg as cfg,
	testPred as pred,
	testFish as fish,
	ALL_SENSES as allSenses
} from './testkit';

function world(preds: Predator[], over: Partial<WorldConfig> = {}): Pick<World, 'cfg' | 'preds'> {
	return { cfg: cfg(over), preds };
}

describe('senseInputs', () => {
	it('bias slot is always 1; with no predator everything predator-derived is 0', () => {
		const r = senseInputs(world([]), fish({ x: 300, y: 200 }));
		expect(r.x[0]).toBe(1);
		expect(r.x.slice(1, 5)).toEqual([0, 0, 0, 0]);
		expect(r.np).toBeNull();
		expect(r.dist).toBe(Infinity);
		expect(r.inVis).toBe(false);
	});

	it('a predator beyond vision is not "in vis" and gates its inputs to 0', () => {
		// distance 300 > vision 200
		const r = senseInputs(world([pred(300, 0)], { vision: 200 }), fish({ x: 0, y: 0 }));
		expect(r.inVis).toBe(false);
		expect(r.x[1]).toBe(0);
		expect(r.dist).toBeCloseTo(300, 6); // dist still reported, just not "in vis"
	});

	it('distance input is 1 - nd/vision inside vision', () => {
		const r = senseInputs(world([pred(100, 0)], { vision: 200 }), fish({ x: 0, y: 0 }));
		expect(r.inVis).toBe(true);
		expect(r.x[1]).toBeCloseTo(0.5, 6); // 1 - 100/200
	});

	it('direction encodes bearing relative to heading (predator dead ahead → dir-y = 1)', () => {
		const r = senseInputs(world([pred(100, 0)]), fish({ x: 0, y: 0, heading: 0 }));
		expect(r.x[2]).toBeCloseTo(0, 6); // sin(0)
		expect(r.x[3]).toBeCloseTo(1, 6); // cos(0)
	});

	it('a disabled sense feeds exactly 0 even with a predator in range (true ablation)', () => {
		const withoutDist = senseInputs(
			world([pred(100, 0)], { senses: { ...allSenses, dist: false } }),
			fish({ x: 0, y: 0 })
		);
		expect(withoutDist.x[1]).toBe(0);

		const withoutDir = senseInputs(
			world([pred(100, 0)], { senses: { ...allSenses, dir: false } }),
			fish({ x: 0, y: 0 })
		);
		expect(withoutDir.x[2]).toBe(0);
		expect(withoutDir.x[3]).toBe(0);
	});

	it('closing speed is positive when the predator is approaching', () => {
		// predator at origin moving +x at 10 toward a stationary fish at (100,0)
		const r = senseInputs(world([pred(0, 0, 10, 0)]), fish({ x: 100, y: 0 }));
		expect(r.closing).toBeCloseTo(10, 6);
		expect(r.x[4]).toBeCloseTo(10 / 170, 6);
	});

	it('forward wall ray reports distance to the wall directly ahead', () => {
		// at x=10 facing −x (heading π): the left wall (x=0) is 10 units ahead
		const r = senseInputs(world([]), fish({ x: 10, y: 200, heading: Math.PI }));
		expect(r.wallFront).toBeCloseTo(10, 6);
		expect(r.x[6]).toBeCloseTo(1 - 10 / 170, 6); // center ray, slot 6 (wall F)
	});

	it('wall inputs stay 0 when the walls sense is off, but wallFront is still computed', () => {
		const r = senseInputs(
			world([], { senses: { ...allSenses, walls: false } }),
			fish({ x: 10, y: 200, heading: Math.PI })
		);
		expect(r.x[5]).toBe(0);
		expect(r.x[6]).toBe(0);
		expect(r.x[7]).toBe(0);
		expect(r.wallFront).toBeCloseTo(10, 6);
	});
});

describe('senseInputs — the shoal sense (cohesion + alignment)', () => {
	const shoalCfg = (over: Partial<WorldConfig> = {}) =>
		cfg({
			brainInputs: 14,
			senses: { ...allSenses, cohesion: true, align: true },
			...over
		});
	/** A world carrying the shoal — senseInputs reads `w.fish` for the neighbour scan. */
	const shoalWorld = (
		self: ReturnType<typeof fish>,
		others: ReturnType<typeof fish>[],
		over = {}
	) =>
		({ cfg: shoalCfg(over), preds: [], fish: [self, ...others] }) as Pick<
			World,
			'cfg' | 'preds' | 'fish'
		>;

	it('reads 0 across the shoal slots when no neighbour is within socialRadius', () => {
		const self = fish({ x: 300, y: 200 });
		const far = fish({ x: 300, y: 200 + 500 }); // well beyond the 70px default
		const r = senseInputs(shoalWorld(self, [far]), self);
		expect(r.x.slice(9, 14)).toEqual([0, 0, 0, 0, 0]);
	});

	it('density rises with the neighbour count inside the radius', () => {
		const self = fish({ x: 300, y: 200 });
		const near = (dx: number) => fish({ x: 300 + dx, y: 200 });
		const one = senseInputs(shoalWorld(self, [near(20)]), self).x[9];
		const three = senseInputs(shoalWorld(self, [near(10), near(20), near(-15)]), self).x[9];
		expect(three).toBeGreaterThan(one);
	});

	it('cohesion points sin/cos toward the neighbours (a fish dead ahead → shoal→y = 1)', () => {
		const self = fish({ x: 300, y: 200, heading: 0 }); // facing +x
		const ahead = fish({ x: 340, y: 200 }); // due +x of self
		const r = senseInputs(shoalWorld(self, [ahead]), self);
		expect(r.x[10]).toBeCloseTo(0, 6); // sin(0)
		expect(r.x[11]).toBeCloseTo(1, 6); // cos(0)
	});

	it('alignment reflects the neighbours’ mean heading relative to own', () => {
		const self = fish({ x: 300, y: 200, heading: 0 });
		const sameWay = fish({ x: 320, y: 200, heading: 0 }); // pointing the same way
		const r = senseInputs(shoalWorld(self, [sameWay]), self);
		expect(r.x[12]).toBeCloseTo(0, 6); // sin(0) — aligned
		expect(r.x[13]).toBeCloseTo(1, 6); // cos(0)
	});

	it('a disabled shoal sense feeds exactly 0 even with neighbours packed in (true ablation)', () => {
		const self = fish({ x: 300, y: 200 });
		const near = fish({ x: 315, y: 200 });
		const cohesionOff = senseInputs(
			shoalWorld(self, [near], { senses: { ...allSenses, cohesion: false, align: true } }),
			self
		);
		expect(cohesionOff.x.slice(9, 12)).toEqual([0, 0, 0]);

		const alignOff = senseInputs(
			shoalWorld(self, [near], { senses: { ...allSenses, cohesion: true, align: false } }),
			self
		);
		expect(alignOff.x.slice(12, 14)).toEqual([0, 0]);
	});
});
