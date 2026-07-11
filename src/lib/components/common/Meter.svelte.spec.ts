import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Meter from './Meter.svelte';

const fill = (container: HTMLElement) => container.querySelector('.fill') as HTMLElement;

describe('Meter', () => {
	it('fills from the left in proportion to the value', () => {
		const { container } = render(Meter, { value: 0.42 });

		expect(fill(container).style.width).toBe('42%');
	});

	it('clamps rather than overflowing its track', () => {
		expect(fill(render(Meter, { value: 1.8 }).container).style.width).toBe('100%');
		expect(fill(render(Meter, { value: -0.5 }).container).style.width).toBe('0%');
	});

	it('grows out from the centre when it is anchored there, in whichever direction', () => {
		// A turn is bidirectional: half the track per side, so full lock is 50% of it.
		const right = fill(render(Meter, { value: 0.5, origin: 'centre' }).container);
		expect(right.style.left).toBe('50%');
		expect(right.style.width).toBe('25%');

		const left = fill(render(Meter, { value: -1, origin: 'centre' }).container);
		expect(left.style.left).toBe('0%'); // hard left lock reaches the far end
		expect(left.style.width).toBe('50%');
	});

	it('a centred meter at rest shows nothing at all — straight ahead is not a turn', () => {
		const straight = fill(render(Meter, { value: 0, origin: 'centre' }).container);

		expect(straight.style.width).toBe('0%');
		expect(straight.style.left).toBe('50%');
	});
});
