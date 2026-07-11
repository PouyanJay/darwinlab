import { describe, it, expect } from 'vitest';
import { rungFor, RUNGS } from './ladder';
import type { Senses } from '$lib/engine';

const senses = (on: Partial<Senses> = {}): Senses => ({
	dist: false,
	dir: false,
	closing: false,
	walls: false,
	...on
});

describe('rungFor', () => {
	it('is a reflex when no predator input reaches the brain at all', () => {
		expect(rungFor(senses())).toBe(0);
		expect(rungFor(senses({ walls: true }))).toBe(0); // walls say nothing about the threat
	});

	it('is a tuned reflex on a single threat channel', () => {
		expect(rungFor(senses({ dist: true }))).toBe(1);
	});

	it('DIRECTION alone is not a reflex — it is the one sense that pays', () => {
		// Reachable: the Conditions dialog toggles each sense independently, so a world can hand a
		// brain "which way" without "how far". Calling that a reflex would be wrong, and it is exactly
		// what the naive nested ternary did.
		expect(rungFor(senses({ dir: true }))).toBe(1);
	});

	it('is sensor integration once there are two channels to combine', () => {
		expect(rungFor(senses({ dist: true, dir: true }))).toBe(2);
	});

	it('is prediction once closing speed is wired in — the only input carrying the future', () => {
		expect(rungFor(senses({ dist: true, dir: true, closing: true }))).toBe(3);
		expect(rungFor(senses({ closing: true }))).toBe(3);
	});

	it('never climbs past prediction, whatever you switch on', () => {
		// memory, within-life learning and collective need machinery this network does not have
		const everything = senses({ dist: true, dir: true, closing: true, walls: true });
		expect(rungFor(everything)).toBe(3);
		expect(rungFor(everything)).toBeLessThan(RUNGS.length - 1);
	});
});
