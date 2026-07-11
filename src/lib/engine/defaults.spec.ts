import { describe, it, expect } from 'vitest';
import { DEFAULT_WORLDS, ACCENTS } from './defaults';

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
