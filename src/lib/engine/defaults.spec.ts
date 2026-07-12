import { describe, it, expect } from 'vitest';
import { DEFAULT_WORLDS, SHOWCASE_OCEAN, ACCENTS, ACCENT_NAMES, newWorldConfig } from './defaults';

describe('DEFAULT_WORLDS (the sense ladder)', () => {
	it('has five worlds that add one sense at a time, in the order the MEASUREMENTS say they pay', () => {
		// Walls before closing speed, deliberately: measured in this ocean, walls adds on top of
		// direction while closing-next-to-direction is still a net tax. The ladder is ordered by
		// what is true (scripts/sweep-senses.ts), not by what would read well.
		expect(DEFAULT_WORLDS.map((w) => w.name)).toEqual([
			'Blind drift',
			'Distance',
			'Direction',
			'Corner-wise',
			'Full senses'
		]);
		expect(DEFAULT_WORLDS[0].senses).toEqual({
			dist: false,
			dir: false,
			closing: false,
			walls: false
		});
		expect(DEFAULT_WORLDS[1].senses).toEqual({
			dist: true,
			dir: false,
			closing: false,
			walls: false
		});
		expect(DEFAULT_WORLDS[2].senses).toEqual({
			dist: true,
			dir: true,
			closing: false,
			walls: false
		});
		expect(DEFAULT_WORLDS[3].senses).toEqual({
			dist: true,
			dir: true,
			closing: false,
			walls: true
		});
		expect(DEFAULT_WORLDS[4].senses).toEqual({ dist: true, dir: true, closing: true, walls: true });
	});

	it('runs every world in the ocean where a sense can actually pay', () => {
		for (const w of DEFAULT_WORLDS) {
			expect(w.prey).toBe(20);
			expect(w.bw).toBe(640);
			expect(w.bh).toBe(400);
			expect(w.caption.length).toBeGreaterThan(0);
			// the four settings without which the ladder collapses (see SHOWCASE_OCEAN)
			expect(w.predSpeed).toBe(SHOWCASE_OCEAN.predSpeed); // a shark slower than the fish
			expect(w.wallInstinct).toBe(false); // no FREE wall avoidance
			expect(w.lungeCommit).toBe(true); // a dodge can work
			expect(w.persistence).toBe(false); // learned evasion is allowed to look safe
		}
	});

	it('keeps the shark slower than the fish, which is the whole reason direction pays', () => {
		// The fish tops out at MAXSPEED (176 px/s); the shark cruises at 200 × predSpeed. Above
		// ~0.88 it simply runs every fish down, and no amount of sensing can buy an escape.
		for (const w of DEFAULT_WORLDS) {
			expect(200 * w.predSpeed).toBeLessThan(176);
		}
	});
});

describe('ACCENTS', () => {
	it('is six hex colours', () => {
		expect(ACCENTS).toHaveLength(6);
		expect(ACCENTS.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
	});
});

describe('newWorldConfig', () => {
	it('starts a hand-added world with every sense on and the standard tank', () => {
		const world = newWorldConfig('World 6', '#8a5ad8');

		expect(world.name).toBe('World 6');
		expect(world.accent).toBe('#8a5ad8');
		expect(world.senses).toEqual({ dist: true, dir: true, closing: true, walls: true });
		// born in the DEFAULT ocean — a hand-added world must be able to reward what it senses
		expect(world).toMatchObject({
			prey: 20,
			bw: 640,
			bh: 400,
			predSpeed: SHOWCASE_OCEAN.predSpeed
		});
	});

	it('hands every world its own senses object, so toggling one cannot ablate another', () => {
		const first = newWorldConfig('a', ACCENTS[0]);
		const second = newWorldConfig('b', ACCENTS[1]);

		first.senses.dir = false;

		expect(second.senses.dir).toBe(true);
	});
});

describe('ACCENT_NAMES', () => {
	it('names every accent, so no swatch is left announcing itself as a hex code', () => {
		for (const accent of ACCENTS) {
			expect(ACCENT_NAMES[accent]).toBeTruthy();
		}
	});
});
