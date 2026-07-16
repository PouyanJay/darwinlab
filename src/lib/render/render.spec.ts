import { describe, it, expect } from 'vitest';
import { drawWorld, drawBrain, drawCurve, drawDecay, pickCreature, THEMES } from './index';
import { makeWorld, stepWorld, seededRng, DEFAULT_WORLDS, SHOAL_WORLDS } from '../engine';
import type { World } from '../engine';

/** A no-op 2D context — enough to prove the painters run end-to-end without touching a DOM. */
function mockCtx(): CanvasRenderingContext2D {
	return recordingCtx().ctx;
}

/**
 * The same context, but it remembers what the painter actually painted — and, crucially, WHAT SHAPE.
 *
 * A Proxy that swallows writes is fine for "does this painter run", but it cannot see what the
 * painter DECIDED, and for the brain the colour IS the decision: which edges excite and which
 * inhibit. Recording only the colours is not enough either — the NODES are stroked in those same two
 * colours (by the sign of their activation), so a drawBrain that ignored the weights' signs
 * completely would still emit some of each colour and sail through. Both of my earlier versions of
 * this test did exactly that.
 *
 * So the recorder tracks the current path's shape: a stroked line is an edge, a stroked arc is a
 * node. The edges are what the legend is making a claim about.
 */
function recordingCtx(): { ctx: CanvasRenderingContext2D; edges: string[] } {
	const gradient = { addColorStop: () => {} };
	const edges: string[] = [];
	const state: Record<string, unknown> = {};
	let shape: 'line' | 'arc' | 'none' = 'none';

	const ctx = new Proxy(
		{},
		{
			get(_t, prop) {
				if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
					return () => gradient;
				if (prop === 'measureText') return () => ({ width: 20 });
				if (prop === 'beginPath')
					return () => {
						shape = 'none';
					};
				if (prop === 'moveTo' || prop === 'lineTo')
					return () => {
						if (shape === 'none') shape = 'line';
					};
				if (prop === 'arc')
					return () => {
						shape = 'arc';
					};
				if (prop === 'stroke')
					return () => {
						if (shape === 'line' && typeof state.strokeStyle === 'string') {
							edges.push(state.strokeStyle);
						}
					};
				if (typeof prop === 'string' && prop in state) return state[prop];
				return () => {};
			},
			set(_t, prop, value) {
				state[prop as string] = value;
				return true;
			}
		}
	) as unknown as CanvasRenderingContext2D;

	return { ctx, edges };
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

	it('freezes the drifting dust under reduced motion — the same pixels at any clock', () => {
		/** Records every arc (position, radius, alpha at the time). An empty tank draws arcs for
		 *  nothing BUT the dust, so the recording is the dust field verbatim. */
		function arcRecorder(): { ctx: CanvasRenderingContext2D; arcs: string[] } {
			const gradient = { addColorStop: () => {} };
			const arcs: string[] = [];
			const state: Record<string, unknown> = {};
			const ctx = new Proxy(
				{},
				{
					get(_t, prop) {
						if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
							return () => gradient;
						if (prop === 'measureText') return () => ({ width: 20 });
						if (prop === 'arc')
							return (x: number, y: number, r: number) =>
								arcs.push(`${x.toFixed(3)},${y.toFixed(3)},${r},${state.globalAlpha}`);
						if (typeof prop === 'string' && prop in state) return state[prop];
						return () => {};
					},
					set(_t, prop, value) {
						state[prop as string] = value;
						return true;
					}
				}
			) as unknown as CanvasRenderingContext2D;
			return { ctx, arcs };
		}

		const w = world();
		w.fish = []; // no creatures: every arc that gets painted is a dust mote
		w.preds = [];

		const dustAt = (t: number, reducedMotion: boolean) => {
			w.t = t;
			const rec = arcRecorder();
			drawWorld(w, rec.ctx, 300, 200, { theme: 'light', detail: 'cinematic', reducedMotion });
			return rec.arcs.join('|');
		};

		expect(dustAt(1, true).length).toBeGreaterThan(0); // the dust IS painted, just still
		expect(dustAt(1, true)).toBe(dustAt(9, true)); // frozen: the clock moves, the motes don't
		expect(dustAt(1, false)).not.toBe(dustAt(9, false)); // and honestly animated without the flag
	});
});

describe('drawBrain', () => {
	it('renders with and without a live sense snapshot', () => {
		const w = world();
		w.selFish = w.fish[0];
		stepWorld(w, 1 / 60);
		expect(() =>
			drawBrain(mockCtx(), 300, 224, {
				senses: w.cfg.senses,
				sense: w.sense,
				t: w.t,
				theme: 'light'
			})
		).not.toThrow();
		expect(() =>
			drawBrain(mockCtx(), 300, 224, {
				senses: w.cfg.senses,
				sense: null,
				t: 0,
				theme: 'dark',
				reducedMotion: true
			})
		).not.toThrow();
	});

	it('paints by the SIGN of the weight — a brain of inhibitors does not look like a brain of exciters', () => {
		/*
		 * Paint two brains — one whose every weight is positive, one whose every weight is negative —
		 * and check the EDGE colours actually swap. Nothing but reading the sign can do that.
		 *
		 * (Asserting that both colours merely appear is not enough, and neither is counting every
		 * stroke: the nodes are stroked in the same two colours by the sign of their activation, so a
		 * drawBrain that ignored the weights entirely still emitted some of each. Two earlier versions
		 * of this test passed against exactly that sabotage.)
		 */
		for (const theme of ['light', 'dark'] as const) {
			const paintWith = (weight: number) => {
				const w = world();
				w.selFish = w.fish[0];
				w.selFish.genome.fill(weight);
				stepWorld(w, 1 / 60);

				const { ctx, edges } = recordingCtx();
				drawBrain(ctx, 300, 224, { senses: w.cfg.senses, sense: w.sense, t: w.t, theme });
				return {
					excite: edges.filter((colour) => colour === THEMES[theme].excite).length,
					inhibit: edges.filter((colour) => colour === THEMES[theme].inhibit).length
				};
			};

			const positive = paintWith(0.9);
			const negative = paintWith(-0.9);

			expect(positive.excite).toBeGreaterThan(negative.excite);
			expect(negative.inhibit).toBeGreaterThan(positive.inhibit);
			// and the two signs must be distinguishable at all — in dark, accent and danger are the
			// same magenta, which is why the brain has colours of its own
			expect(THEMES[theme].excite).not.toBe(THEMES[theme].inhibit);
		}
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

describe('drawWorld — the school density field', () => {
	/** A minimal ctx that only needs to survive drawWorld and count fill() calls. */
	function fillCountingCtx(): { ctx: CanvasRenderingContext2D; fills: () => number } {
		let fills = 0;
		const gradient = { addColorStop: () => {} };
		const ctx = new Proxy(
			{},
			{
				get(_t, prop) {
					if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
						return () => gradient;
					if (prop === 'measureText') return () => ({ width: 20 });
					if (prop === 'fill') return () => void fills++;
					return () => {};
				},
				set: () => true
			}
		) as unknown as CanvasRenderingContext2D;
		return { ctx, fills: () => fills };
	}

	/** Evolve a config a few generations so its fish have positions to crowd around. */
	function grown(cfg: World['cfg']): World {
		const w = makeWorld(cfg, undefined, seededRng(3));
		for (let i = 0; i < 400; i++) stepWorld(w, 1 / 60);
		return w;
	}

	it('paints one density blob per fish on a schooling world, and none on the sense ladder', () => {
		const shoal = grown(SHOAL_WORLDS[1]);
		const ladder = grown(DEFAULT_WORLDS[0]);

		const withField = fillCountingCtx();
		drawWorld(shoal, withField.ctx, 400, 300, { theme: 'light', accent: SHOAL_WORLDS[1].accent });

		// the SAME world, but no accent handed in → the field cannot paint (its one guard beyond senses)
		const noAccent = fillCountingCtx();
		drawWorld(shoal, noAccent.ctx, 400, 300, { theme: 'light' });

		// a ladder world declares no shoal senses, so an accent must change NOTHING for it
		const ladderAccent = fillCountingCtx();
		drawWorld(ladder, ladderAccent.ctx, 400, 300, {
			theme: 'light',
			accent: DEFAULT_WORLDS[0].accent
		});
		const ladderPlain = fillCountingCtx();
		drawWorld(ladder, ladderPlain.ctx, 400, 300, { theme: 'light' });

		// exactly one extra fill per living fish, and ONLY on a schooling world with an accent
		expect(withField.fills() - noAccent.fills()).toBe(shoal.fish.length);
		expect(ladderAccent.fills()).toBe(ladderPlain.fills());
	});
});
