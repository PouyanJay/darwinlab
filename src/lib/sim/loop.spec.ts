import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSimLoop, subSteps, turboSlice, MAX_FRAME_SECONDS, TURBO_DT } from './loop';
import { makeWorld, seededRng, DEFAULT_WORLDS } from '../engine';
import type { World } from '../engine';

describe('createSimLoop', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	/** A controllable clock so we can dictate exactly how much real time each frame took. */
	function clock(start = 0) {
		let t = start;
		return { now: () => t, advance: (ms: number) => (t += ms) };
	}

	it('does not run until started, and runs frames once started', () => {
		const c = clock();
		const onFrame = vi.fn();
		const loop = createSimLoop({ onFrame, now: c.now });

		expect(loop.running).toBe(false);
		vi.advanceTimersByTime(100);
		expect(onFrame).not.toHaveBeenCalled();

		loop.start();
		expect(loop.running).toBe(true);
		c.advance(16);
		vi.advanceTimersByTime(16);
		expect(onFrame).toHaveBeenCalledTimes(1);
		loop.stop();
	});

	it('keeps scheduling frames (self-scheduling chain)', () => {
		const c = clock();
		const onFrame = vi.fn(() => c.advance(16));
		const loop = createSimLoop({ onFrame, now: c.now });

		loop.start();
		vi.advanceTimersByTime(16 * 5);
		expect(onFrame.mock.calls.length).toBeGreaterThanOrEqual(4);
		loop.stop();
	});

	it('reports elapsed time in seconds', () => {
		const c = clock();
		const seen: number[] = [];
		const loop = createSimLoop({ onFrame: (e) => seen.push(e), now: c.now });

		loop.start();
		c.advance(16);
		vi.advanceTimersByTime(16);
		loop.stop();

		expect(seen[0]).toBeCloseTo(0.016, 6);
	});

	it('clamps a long stall so one frame can never deliver a huge dt', () => {
		const c = clock();
		const seen: number[] = [];
		const loop = createSimLoop({ onFrame: (e) => seen.push(e), now: c.now });

		loop.start();
		c.advance(30_000); // 30s backgrounded
		vi.advanceTimersByTime(16);
		loop.stop();

		expect(seen[0]).toBe(MAX_FRAME_SECONDS); // clamped, not 30
	});

	it('stops cleanly and start is idempotent (never stacks two timer chains)', () => {
		const c = clock();
		const onFrame = vi.fn(() => c.advance(16));
		const loop = createSimLoop({ onFrame, now: c.now });

		loop.start();
		loop.start(); // must not double-schedule
		vi.advanceTimersByTime(16 * 3);
		const afterThree = onFrame.mock.calls.length;

		loop.stop();
		expect(loop.running).toBe(false);
		vi.advanceTimersByTime(16 * 10);
		expect(onFrame).toHaveBeenCalledTimes(afterThree); // no frames after stop
	});
});

describe('subSteps', () => {
	it('takes one step at or below 1× and sub-steps above it', () => {
		expect(subSteps(0.016, 0.5)).toEqual({ steps: 1, dt: 0.008 });
		expect(subSteps(0.016, 1)).toEqual({ steps: 1, dt: 0.016 });
		expect(subSteps(0.016, 2)).toEqual({ steps: 2, dt: 0.016 });
	});

	it('advances exactly `speed × elapsed` of sim time however it is split', () => {
		for (const speed of [0.5, 1, 2]) {
			const { steps, dt } = subSteps(0.02, speed);
			expect(steps * dt).toBeCloseTo(0.02 * speed, 9);
		}
	});
});

describe('turboSlice', () => {
	const world = (): World => makeWorld(DEFAULT_WORLDS[2], undefined, seededRng(5));

	/** Deterministic clock: each read advances 1ms, so a slice yields after ~budgetMs reads. */
	function tickingClock() {
		let t = 0;
		return () => (t += 1);
	}

	it('reports done immediately when there is nothing to train', () => {
		expect(turboSlice([], 10)).toBe(true);
	});

	it('advances worlds to the target generation across slices', () => {
		const w = world();
		let done = false;
		let slices = 0;
		// deterministic clock → no dependency on how fast this machine happens to be
		while (!done && slices < 5000) {
			done = turboSlice([w], 5, { budgetMs: 15, now: tickingClock() });
			slices++;
		}
		expect(done).toBe(true);
		expect(w.gen).toBeGreaterThanOrEqual(5);
	});

	it('yields when the time budget is exhausted instead of blocking', () => {
		const w = world();
		// a clock that jumps past the budget on the first check → must yield after one pass
		let calls = 0;
		const now = () => (calls++ === 0 ? 0 : 999);
		const done = turboSlice([w], 1000, { budgetMs: 15, now });

		expect(done).toBe(false); // yielded, did not run to gen 1000
		expect(w.gen).toBeLessThan(1000);
	});

	it('steps on the fixed turbo timestep', () => {
		const w = world();
		// generous budget on a deterministic clock so one slice reaches gen 1
		turboSlice([w], 1, { budgetMs: 100_000, now: tickingClock() });
		expect(TURBO_DT).toBeCloseTo(1 / 60, 9);
		expect(w.gen).toBeGreaterThanOrEqual(1);
	});
});

describe('createSimLoop — visibility safety (CLAUDE.md gotcha #1)', () => {
	afterEach(() => vi.restoreAllMocks());

	it('never schedules through requestAnimationFrame (it is suspended in background tabs)', async () => {
		// rAF does not exist in node, so install a spy for it — if the loop ever reaches for it,
		// we see the call. (The e2e suite proves the same thing in a real browser by making rAF a
		// black hole and checking the sim still runs.)
		const raf = vi.fn(() => 0);
		const original = Reflect.get(globalThis, 'requestAnimationFrame');
		Reflect.set(globalThis, 'requestAnimationFrame', raf);

		const onFrame = vi.fn();
		const loop = createSimLoop({ onFrame });
		loop.start();
		await new Promise((r) => setTimeout(r, 60)); // real timers: let a few frames land
		loop.stop();

		Reflect.set(globalThis, 'requestAnimationFrame', original);

		expect(onFrame.mock.calls.length).toBeGreaterThan(0); // it really ran...
		expect(raf).not.toHaveBeenCalled(); // ...and never touched rAF
	});
});

describe('createSimLoop — clock safety', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('never emits a negative dt if the clock runs backwards', () => {
		let t = 1000;
		const seen: number[] = [];
		const loop = createSimLoop({ onFrame: (e) => seen.push(e), now: () => t });

		loop.start();
		t = 0; // clock jumps backwards — must not produce a negative dt (physics would reverse)
		vi.advanceTimersByTime(16);
		loop.stop();

		expect(seen[0]).toBe(0);
		expect(seen.every((e) => e >= 0)).toBe(true);
	});
});
