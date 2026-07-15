import { describe, it, expect } from 'vitest';
import { polarization, meanNearestNeighbor } from './schooling';

const moving = (vx: number, vy: number) => ({ vx, vy });
const at = (x: number, y: number) => ({ x, y });

describe('polarization φ', () => {
	it('is 1 when every moving fish points the same way (a perfect school)', () => {
		const fish = [moving(10, 0), moving(20, 0), moving(5, 0)];
		expect(polarization(fish)).toBeCloseTo(1, 6);
	});

	it('is direction, not speed: same heading at different speeds still scores 1', () => {
		const fish = [moving(10, 10), moving(100, 100)];
		expect(polarization(fish)).toBeCloseTo(1, 6);
	});

	it('is ~0 when headings cancel (two fish swimming dead opposite)', () => {
		const fish = [moving(10, 0), moving(-10, 0)];
		expect(polarization(fish)).toBeCloseTo(0, 6);
	});

	it('excludes fish below the movement threshold — a still fish has no heading to align', () => {
		// two aligned movers + one drifting fish that must not drag φ down
		const fish = [moving(30, 0), moving(30, 0), moving(1, 0)];
		expect(polarization(fish)).toBeCloseTo(1, 6);
	});

	it('is 0 when nothing is moving (no directions to average)', () => {
		expect(polarization([moving(0, 0), moving(1, -1)])).toBe(0);
	});
});

describe('mean nearest-neighbour distance', () => {
	it('is null below two fish — there is no neighbour to measure', () => {
		expect(meanNearestNeighbor([])).toBeNull();
		expect(meanNearestNeighbor([at(0, 0)])).toBeNull();
	});

	it('is the symmetric gap for a pair', () => {
		expect(meanNearestNeighbor([at(0, 0), at(10, 0)])).toBeCloseTo(10, 6);
	});

	it("averages each fish's closest neighbour, not all pairs", () => {
		// a tight pair at 0 and 2, a loner at 100. Nearest neighbours: 2, 2, 98 → mean 34.
		const nnd = meanNearestNeighbor([at(0, 0), at(2, 0), at(100, 0)]);
		expect(nnd).toBeCloseTo((2 + 2 + 98) / 3, 6);
	});

	it('falls as a cloud tightens (the signal schooling would move)', () => {
		const spread = meanNearestNeighbor([at(0, 0), at(50, 0), at(0, 50), at(50, 50)])!;
		const tight = meanNearestNeighbor([at(0, 0), at(5, 0), at(0, 5), at(5, 5)])!;
		expect(tight).toBeLessThan(spread);
	});
});
