/**
 * The sim loop — bridges the pure engine to the browser.
 *
 * ⚠️ VISIBILITY-SAFE BY DESIGN (CLAUDE.md gotcha #1): this drives the simulation with a
 * self-scheduling `setTimeout`, NOT `requestAnimationFrame`. rAF is *suspended entirely* when
 * the tab or frame is offscreen, which froze the sim in an earlier build. `setTimeout` is
 * throttled in background tabs (to ~1s) but never stops, so the simulation keeps advancing —
 * slowly — instead of dying. Do not "optimize" this back to rAF.
 *
 * Frame time is clamped (`maxFrameSeconds`) so a long stall (background tab, breakpoint) can
 * never deliver one enormous dt that would tunnel agents through walls.
 */

import { stepWorld } from '../engine';
import type { World } from '../engine';

/** ~60fps. The sim itself runs on a fixed timestep; this is just the scheduling cadence. */
export const FRAME_INTERVAL_MS = 16;
/** Never advance more than this much sim time in one frame, however long the real gap was. */
export const MAX_FRAME_SECONDS = 0.05;
/** Turbo trains off-loop in time-boxed slices so the UI stays responsive. */
export const TURBO_SLICE_MS = 15;
/** Fixed timestep used when fast-forwarding generations. */
export const TURBO_DT = 1 / 60;

export interface SimLoopOptions {
	/**
	 * Called once per frame. `elapsed` is the real elapsed time in seconds, already clamped, and
	 * is what the physics steps on. `frameSeconds` is the same gap UNclamped — the honest frame
	 * time, which is what a performance governor needs (a clamped value would report a struggling
	 * machine as a healthy 50ms forever).
	 */
	onFrame: (elapsed: number, frameSeconds: number) => void;
	intervalMs?: number;
	maxFrameSeconds?: number;
	/** Injectable clock — tests supply a controllable one. */
	now?: () => number;
}

export interface SimLoop {
	start(): void;
	stop(): void;
	readonly running: boolean;
}

export function createSimLoop(options: SimLoopOptions): SimLoop {
	const {
		onFrame,
		intervalMs = FRAME_INTERVAL_MS,
		maxFrameSeconds = MAX_FRAME_SECONDS,
		now = () => performance.now()
	} = options;

	let timer: ReturnType<typeof setTimeout> | null = null;
	let last = 0;
	let running = false;

	const tick = () => {
		if (!running) return;
		const ts = now();
		// Clamp BOTH ends. The upper bound stops a long stall (background tab, breakpoint) from
		// delivering one enormous dt that would tunnel agents through walls. The lower bound stops
		// a backwards clock from feeding a NEGATIVE dt into stepWorld, which would run the physics
		// in reverse (fitness would decrement, predator persistence would walk backwards).
		// `|| 0` guards the first frame and any NaN from an exotic clock.
		const seconds = Math.max(0, (ts - last) / 1000 || 0);
		const elapsed = Math.min(maxFrameSeconds, seconds);
		last = ts;
		// `finally`, so one bad frame cannot kill the chain: without it, a throw anywhere in
		// onFrame ends the loop forever — page alive, every tank frozen. The exception still
		// propagates (uncaught, loud in the console); nothing is swallowed here.
		try {
			onFrame(elapsed, seconds);
		} finally {
			if (running) timer = setTimeout(tick, intervalMs);
		}
	};

	return {
		start() {
			if (running) return; // idempotent — never stack two timer chains
			running = true;
			last = now();
			timer = setTimeout(tick, intervalMs);
		},
		stop() {
			running = false;
			if (timer !== null) {
				clearTimeout(timer);
				timer = null;
			}
		},
		get running() {
			return running;
		}
	};
}

/**
 * Split one frame into fixed sub-steps scaled by the speed control (½× / 1× / 2×).
 *
 * Speed multiplies how much SIM time passes per real second — it does not change the frame
 * rate. At 2× we take two sub-steps rather than one double-sized step, so the integrator stays
 * stable and fast-forwarding never changes the physics.
 */
export function subSteps(elapsed: number, speed: number): { steps: number; dt: number } {
	const steps = Math.max(1, Math.ceil(speed));
	return { steps, dt: (elapsed * speed) / steps };
}

export interface TurboSliceOptions {
	budgetMs?: number;
	/** Injectable clock — tests supply a deterministic one. */
	now?: () => number;
}

/**
 * Fast-forward worlds toward `targetGen` inside a time budget, so training many generations
 * never blocks the main thread for more than a frame. Call once per frame until it returns true.
 *
 * @returns true when every world has reached `targetGen`.
 */
export function turboSlice(
	worlds: readonly World[],
	targetGen: number,
	options: TurboSliceOptions = {}
): boolean {
	const { budgetMs = TURBO_SLICE_MS, now = () => performance.now() } = options;
	const started = now();
	for (;;) {
		let allDone = true;
		for (const w of worlds) {
			if (w.gen < targetGen) {
				stepWorld(w, TURBO_DT);
				if (w.gen < targetGen) allDone = false;
			}
		}
		if (allDone) return true;
		if (now() - started >= budgetMs) return false; // out of budget — resume next frame
	}
}
