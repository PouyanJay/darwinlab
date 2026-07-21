import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LearningCurve from './LearningCurve.svelte';

/** A fixed rising curve — survival FRACTIONS (0–1), one per generation. */
const CURVE = [0.1, 0.3, 0.55, 0.6];

describe('LearningCurve', () => {
	it('draws the survival line and its endpoint, labelled as a percentage', () => {
		const { container } = render(LearningCurve, { curve: CURVE });

		expect(container.querySelectorAll('.line')).toHaveLength(1);
		expect(container.querySelector('.area')).not.toBeNull();
		// The endpoint reads the last fraction as a percent (0.6 → 60%).
		expect(container.querySelector('.endlabel')?.textContent).toBe('60%');
	});

	it('offers the raw numbers as a table — one row per generation', () => {
		const { container } = render(LearningCurve, { curve: CURVE });

		const rows = container.querySelectorAll('tbody tr');
		expect(rows).toHaveLength(CURVE.length);
		// first row: generation 1, its survival fraction as a percent
		expect(rows[0].querySelectorAll('td')[0].textContent).toBe('1');
		expect(rows[0].querySelectorAll('td')[1].textContent).toBe('10%');
	});

	it('names the conclusion for a screen reader, not the pixels', () => {
		const { container } = render(LearningCurve, { curve: CURVE });

		const label = container.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '';
		expect(label).toContain('4 generations');
		expect(label).toContain('60%'); // the value it ended at
	});

	it('renders nothing to plot when there is no curve, without throwing', () => {
		const { container } = render(LearningCurve, { curve: [] });
		expect(container.querySelector('.line')).toBeNull();
		expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
	});
});
