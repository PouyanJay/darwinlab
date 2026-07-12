import { describe, it, expect } from 'vitest';
import { DetailGovernor, OUTLIER_SECONDS, WARMUP_FRAMES } from './governor';

const SLOW = 0.04; // 25fps — a machine that is clearly not keeping up
const FAST = 1 / 60;

describe('DetailGovernor', () => {
	it('downgrades exactly once under sustained slow frames', () => {
		const governor = new DetailGovernor();
		let flips = 0;
		for (let i = 0; i < 200; i++) if (governor.sample(SLOW)) flips++;
		expect(governor.degraded).toBe(true);
		expect(flips).toBe(1);
	});

	it('never downgrades a machine holding 60fps', () => {
		const governor = new DetailGovernor();
		for (let i = 0; i < 2000; i++) governor.sample(FAST);
		expect(governor.degraded).toBe(false);
	});

	it('withholds judgment during warmup, however bad the frames', () => {
		const governor = new DetailGovernor();
		for (let i = 0; i < WARMUP_FRAMES - 1; i++) governor.sample(SLOW);
		expect(governor.degraded).toBe(false);
	});

	it('does not count hidden-tab gaps as slowness', () => {
		const governor = new DetailGovernor();
		// a background tab: the throttled loop delivers ~1s gaps, far beyond the outlier line
		for (let i = 0; i < 500; i++) {
			governor.sample(FAST);
			governor.sample(OUTLIER_SECONDS * 4);
		}
		expect(governor.degraded).toBe(false);
	});

	it('shrugs off a single slow frame on an otherwise fast machine', () => {
		const governor = new DetailGovernor();
		for (let i = 0; i < 100; i++) governor.sample(FAST);
		governor.sample(SLOW); // one GC pause
		for (let i = 0; i < 100; i++) governor.sample(FAST);
		expect(governor.degraded).toBe(false);
	});
});
