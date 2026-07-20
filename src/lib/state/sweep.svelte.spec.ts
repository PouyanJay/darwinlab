import { describe, it, expect, beforeEach } from 'vitest';
import { sweep } from './sweep.svelte';

/**
 * The selection → grid-size logic, kept fast and free of any run. The store is a singleton, so each
 * test restores the default selection first (toggling only the factors that are out of place), which
 * keeps the tests order-independent under shuffle.
 */
const DEFAULTS = new Set(['dir', 'dist', 'walls', 'predSpeed']);

describe('sweep selection', () => {
	beforeEach(() => {
		for (const factor of sweep.factors) {
			if (sweep.isSelected(factor.key) !== DEFAULTS.has(factor.key)) sweep.toggle(factor.key);
		}
		sweep.setSeeds(6);
	});

	it('starts on a bounded grid under the cap', () => {
		expect(sweep.plannedCells).toBe(24); // dir·dist·walls (2 each) × predSpeed (3)
		expect(sweep.willSample).toBe(false);
	});

	it('a toggle changes the grid size', () => {
		expect(sweep.isSelected('closing')).toBe(false); // the state we claim to change starts here
		sweep.toggle('closing');
		expect(sweep.isSelected('closing')).toBe(true);
		expect(sweep.plannedCells).toBe(48); // ×2 for the new two-level factor
	});

	it('warns when the grid would overflow the cap', () => {
		sweep.toggle('closing'); // → 48
		sweep.toggle('persistence'); // → 96, over the 32 cap
		expect(sweep.plannedCells).toBeGreaterThan(32);
		expect(sweep.willSample).toBe(true);
	});

	it('setSeeds clamps out-of-range values so a bad input never reaches a job', () => {
		sweep.setSeeds(999);
		expect(sweep.seeds).toBe(12);
		sweep.setSeeds(-4);
		expect(sweep.seeds).toBe(2);
		sweep.setSeeds(5);
		expect(sweep.seeds).toBe(5);
	});
});
