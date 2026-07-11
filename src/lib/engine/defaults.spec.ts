import { describe, it, expect } from 'vitest';
import { DEFAULT_WORLDS, ACCENTS, newWorldConfig } from './defaults';

describe('DEFAULT_WORLDS (the sense ladder)', () => {
	it('has five worlds that add one sense at a time', () => {
		expect(DEFAULT_WORLDS.map((w) => w.name)).toEqual([
			'Blind drift',
			'Distance',
			'Direction',
			'Anticipation',
			'Corner-wise'
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
			closing: true,
			walls: false
		});
		expect(DEFAULT_WORLDS[4].senses).toEqual({ dist: true, dir: true, closing: true, walls: true });
	});

	it('uses the standard 20-prey / 2-shark / 640×400 config throughout', () => {
		for (const w of DEFAULT_WORLDS) {
			expect(w.prey).toBe(20);
			expect(w.preds).toBe(2);
			expect(w.bw).toBe(640);
			expect(w.bh).toBe(400);
			expect(w.caption.length).toBeGreaterThan(0);
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
		expect(world).toMatchObject({ prey: 20, preds: 2, bw: 640, bh: 400, predSpeed: 1 });
	});

	it('hands every world its own senses object, so toggling one cannot ablate another', () => {
		const first = newWorldConfig('a', ACCENTS[0]);
		const second = newWorldConfig('b', ACCENTS[1]);

		first.senses.dir = false;

		expect(second.senses.dir).toBe(true);
	});
});
