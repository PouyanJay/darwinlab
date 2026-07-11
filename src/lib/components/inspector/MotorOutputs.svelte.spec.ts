import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import MotorOutputs from './MotorOutputs.svelte';
import { bench } from '$lib/state';
import { DEFAULT_WORLDS } from '$lib/engine';

afterEach(() => bench.destroy());

/**
 * Drive the panel from a forged engine snapshot: the outputs shown must be the brain's own.
 *
 * Tears the bench down first, because a test that calls this twice would otherwise leave the first
 * bench's loop running — and that loop would overwrite the forged snapshot with real numbers on its
 * very next tick. (It did. That is why this helper starts with a destroy.)
 */
function show(turn: number, thrust: number) {
	bench.destroy();
	document.body.replaceChildren();
	bench.init({ configs: [structuredClone(DEFAULT_WORLDS[4])] });
	bench.togglePlay(); // paused: nothing but the forged snapshot may move these numbers
	const entry = bench.worlds[0];
	bench.select(entry.id, { type: 'fish', obj: entry.world.fish[0] });

	entry.world.sense = { ...entry.world.sense!, turn, thrust };
	bench.tick(1 / 60);

	const { container } = render(MotorOutputs);
	return container;
}

const turnBar = (container: HTMLElement) => container.querySelector('.fill') as HTMLElement;
const reads = (label: string) => page.getByRole('status', { name: label }).element().textContent;

describe('MotorOutputs', () => {
	it('says which way the fish is turning, not just how hard', () => {
		show(0.62, 0.4);
		expect(reads('turn')).toBe('right 0.62');

		show(-0.62, 0.4);
		expect(reads('turn')).toBe('left 0.62');
	});

	it('claims no direction for a twitch', () => {
		show(0.01, 0.4);

		// below the deadzone it is not a decision, and saying "right" about it would be reading
		// intent into noise
		expect(reads('turn')).toBe('0.01');
	});

	it('grows the turn bar out from the centre, on the side the fish is turning', () => {
		const right = turnBar(show(1, 0.5));
		expect(right.style.left).toBe('50%'); // starts at the centre tick…
		expect(right.style.width).toBe('50%'); // …and reaches the right end at full lock

		const left = turnBar(show(-1, 0.5));
		expect(left.style.left).toBe('0%'); // full left lock reaches the left end…
		expect(left.style.width).toBe('50%'); // …arriving back at the centre
	});

	it('reads the thrust the brain actually produced', () => {
		show(0, 0.83);

		expect(reads('thrust')).toBe('0.83');
	});
});
