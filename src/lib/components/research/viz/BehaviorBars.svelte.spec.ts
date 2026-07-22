import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BehaviorBars from './BehaviorBars.svelte';
import type { BehaviorMetric } from '$lib/lab/evidence';

/** A few signatures, each with an evolved value and a random-brain control to read it against. */
const metrics: BehaviorMetric[] = [
	{ label: 'Flee-angle error', evolved: 20, control: 90, unit: 'deg', higherIsBetter: false },
	{ label: 'Dodge rate', evolved: 0.5, control: 0.1, unit: 'frac', higherIsBetter: true },
	{ label: 'Distance kept', evolved: 80, control: 40, unit: 'px', higherIsBetter: true }
];

describe('BehaviorBars', () => {
	it('draws an evolved and a control bar per signature, in the right unit', () => {
		const { container } = render(BehaviorBars, { metrics });

		const rows = container.querySelectorAll('.metric');
		expect(rows).toHaveLength(3);
		// Flee error is in degrees; the dodge rate is a fraction shown as a percent.
		expect(container.textContent).toContain('20°');
		expect(container.textContent).toContain('90°');
		expect(container.textContent).toContain('50%');
	});

	it('scales the two bars of a row to their own larger value, so the gap is honest', () => {
		const { container } = render(BehaviorBars, { metrics });
		const flee = container.querySelectorAll('.metric')[0];

		// Row max is 90 (control): control fills the track, evolved is 20/90 ≈ 22%.
		const evolved = flee.querySelector('.fill.evolved') as HTMLElement;
		const control = flee.querySelector('.fill.control') as HTMLElement;
		expect(control.style.width).toBe('100%');
		expect(parseFloat(evolved.style.width)).toBeCloseTo((20 / 90) * 100, 1);
	});

	it('backs the bars with a table naming both populations for a screen reader', () => {
		const { container } = render(BehaviorBars, { metrics });

		expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
		const label = container.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '';
		expect(label).toContain('Flee-angle error 20° vs 90°'); // the contrast is spoken
	});
});
