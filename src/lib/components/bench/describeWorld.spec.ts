import { describe, it, expect } from 'vitest';
import { describeWorld } from './describeWorld';
import { WorldConfigView } from '$lib/state';
import { newWorldConfig, ACCENTS } from '$lib/engine';

const world = (overrides: Partial<WorldConfigView> = {}) =>
	Object.assign(new WorldConfigView(), newWorldConfig('World 1', ACCENTS[0]), overrides);

describe('describeWorld', () => {
	it('states the conditions of the standard tank', () => {
		expect(describeWorld(world())).toBe('20 prey · 2 sharks · 640×400');
	});

	it('says "shark" when there is only one of them', () => {
		expect(describeWorld(world({ preds: 1 }))).toContain('1 shark ·');
	});

	it('says nothing about predator speed while it is the baseline the bench is calibrated to', () => {
		expect(describeWorld(world({ predSpeed: 1 }))).not.toContain('×1');
		expect(describeWorld(world())).toBe('20 prey · 2 sharks · 640×400');
	});

	it('states a predator speed that has been changed, trimmed of trailing zeros', () => {
		// The reading has to be "2×", never "2.0×" — a spurious decimal reads as false precision
		// about a number the user set by hand.
		expect(describeWorld(world({ predSpeed: 2 }))).toContain('· 2×');
		expect(describeWorld(world({ predSpeed: 1.4 }))).toContain('· 1.4×');
		expect(describeWorld(world({ predSpeed: 0.65 }))).toContain('· 0.65×');
	});
});
