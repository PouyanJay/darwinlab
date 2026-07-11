import { describe, it, expect } from 'vitest';
import { drawWorld, drawBrain, drawCurve, drawDecay, pickCreature, THEMES } from './index';
import { makeWorld, stepWorld, seededRng, DEFAULT_WORLDS } from '../engine';
import type { World } from '../engine';

/** A no-op 2D context — enough to prove the painters run end-to-end without touching a DOM. */
function mockCtx(): CanvasRenderingContext2D {
	const gradient = { addColorStop: () => {} };
	return new Proxy(
		{},
		{
			get(_t, prop) {
				if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
					return () => gradient;
				if (prop === 'measureText') return () => ({ width: 20 });
				return () => {};
			},
			set: () => true
		}
	) as unknown as CanvasRenderingContext2D;
}

const world = (): World => makeWorld(DEFAULT_WORLDS[4], undefined, seededRng(3));

describe('drawWorld', () => {
	it('computes and stores the fit-scale transform', () => {
		const w = world();
		expect(w.transform).toBeNull();
		drawWorld(w, mockCtx(), 640, 400, { theme: 'light' });
		const c = w.cfg;
		const s = Math.min(640 / c.bw, 400 / c.bh) * 0.95;
		expect(w.transform).toEqual({
			s,
			ox: (640 - c.bw * s) / 2,
			oy: (400 - c.bh * s) / 2
		});
	});

	it('renders both themes, big mode, and reduced motion without throwing', () => {
		const w = world();
		for (let i = 0; i < 30; i++) stepWorld(w, 1 / 60); // give it trails, bursts, motion
		expect(() => drawWorld(w, mockCtx(), 800, 500, { theme: 'dark', big: true })).not.toThrow();
		expect(() =>
			drawWorld(w, mockCtx(), 400, 300, {
				theme: 'light',
				detail: 'performance',
				reducedMotion: true
			})
		).not.toThrow();
	});

	it('renders the wiped-out state when every fish is eaten', () => {
		const w = world();
		w.fish = [];
		expect(() => drawWorld(w, mockCtx(), 640, 400, {})).not.toThrow();
	});

	it('renders the perception overlay for a selected fish', () => {
		const w = world();
		w.selFish = w.fish[0];
		stepWorld(w, 1 / 60); // populates w.sense
		expect(w.sense).not.toBeNull();
		expect(() => drawWorld(w, mockCtx(), 640, 400, { theme: 'light' })).not.toThrow();
	});
});

describe('drawBrain', () => {
	it('renders with and without a live sense snapshot', () => {
		const w = world();
		w.selFish = w.fish[0];
		stepWorld(w, 1 / 60);
		const accent = w.cfg.accent;
		expect(() =>
			drawBrain(mockCtx(), 300, 224, w.cfg.senses, w.sense, w.t, 'light', accent)
		).not.toThrow();
		expect(() =>
			drawBrain(mockCtx(), 300, 224, w.cfg.senses, null, 0, 'dark', accent, true)
		).not.toThrow();
	});
});

describe('drawCurve / drawDecay', () => {
	it('handle empty and populated series', () => {
		expect(() => drawCurve(mockCtx(), 200, 34, [], '#4f56d3', 'light')).not.toThrow();
		expect(() => drawCurve(mockCtx(), 200, 34, [0.2], '#4f56d3', 'light')).not.toThrow();
		expect(() => drawCurve(mockCtx(), 200, 34, [0.2, 0.4, 0.6], '#4f56d3', 'dark')).not.toThrow();
		expect(() => drawDecay(mockCtx(), 200, 30, [], 'light')).not.toThrow();
		expect(() => drawDecay(mockCtx(), 200, 30, [1, 0.6, 0.2, 0], 'dark')).not.toThrow();
	});
});

describe('pickCreature', () => {
	it('returns null before the world has been drawn (no transform)', () => {
		const w = world();
		expect(pickCreature(w, 10, 10)).toBeNull();
	});

	it('inverts the transform to hit a fish at its logical position', () => {
		const w = world();
		w.transform = { s: 0.5, ox: 10, oy: 20 };
		w.preds = [];
		const f = w.fish[0];
		f.x = 100;
		f.y = 100;
		// logical (100,100) → canvas (10 + 100*0.5, 20 + 100*0.5) = (60, 70)
		const hit = pickCreature(w, 60, 70);
		expect(hit).toEqual({ type: 'fish', obj: f });
	});

	it('prefers a predator over a fish and misses empty water', () => {
		const w = world();
		w.transform = { s: 1, ox: 0, oy: 0 };
		const p = w.preds[0];
		p.x = 200;
		p.y = 200;
		w.fish[0].x = 200;
		w.fish[0].y = 200;
		expect(pickCreature(w, 200, 200)).toEqual({ type: 'pred', obj: p });

		// far from everything (predator radius is 26, fish 16)
		w.preds = [];
		for (const f of w.fish) {
			f.x = 10;
			f.y = 10;
		}
		expect(pickCreature(w, 600, 380)).toBeNull();
	});
});

describe('THEMES', () => {
	it('exposes a light and dark palette with matching keys', () => {
		expect(Object.keys(THEMES.light).sort()).toEqual(Object.keys(THEMES.dark).sort());
		expect(THEMES.light.fish).toBe('#4f56d3');
		expect(THEMES.dark.pred).toBe('#ff2d9c');
	});
});
