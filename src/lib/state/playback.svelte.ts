/**
 * Playback — "how time advances". Owns the sim loop, play/pause, speed, and the turbo trainer,
 * and nothing about which worlds exist. `BenchStore` composes it.
 */

import { createSimLoop, type SimLoop } from '../sim/loop';

export type Speed = 0.5 | 1 | 2;

export class Playback {
	running = $state(true);
	speed = $state<Speed>(1);
	/** Non-null while fast-forwarding generations; the loop trains instead of simulating. */
	turboTarget = $state<number | null>(null);

	#loop: SimLoop | null = null;

	get training(): boolean {
		return this.turboTarget !== null;
	}

	/** Begin driving `onFrame` on the visibility-safe loop. Idempotent. */
	start(onFrame: (elapsed: number) => void): void {
		this.#loop ??= createSimLoop({ onFrame });
		this.#loop.start();
	}

	stop(): void {
		this.#loop?.stop();
		this.#loop = null;
	}

	toggle(): void {
		this.running = !this.running;
	}

	/** Say what you mean. A film that has reached its end must PAUSE, not toggle. */
	play(): void {
		this.running = true;
	}

	pause(): void {
		this.running = false;
	}

	setSpeed(speed: Speed): void {
		this.speed = speed;
	}

	/** Ask to fast-forward to `target`. Ignored if training is already under way. */
	requestTraining(target: number): void {
		if (this.turboTarget === null) this.turboTarget = target;
	}

	finishTraining(): void {
		this.turboTarget = null;
	}

	/** Back to construction defaults — stops the loop too, so nothing survives a teardown. */
	reset(): void {
		this.stop();
		this.running = true;
		this.speed = 1;
		this.turboTarget = null;
	}
}
