import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import IntervalPlot from './IntervalPlot.svelte';

/** Two arms; the first survives longer, so it is the winner. */
const arms = [
	{ label: 'only direction', mean: 8.7, lo: 7.5, hi: 9.9 },
	{ label: 'only distance', mean: 6.5, lo: 5.4, hi: 7.6 }
];

describe('IntervalPlot', () => {
	it('plots one interval per arm and marks the longer-surviving one as the winner', () => {
		const { container } = render(IntervalPlot, { arms });

		const rows = container.querySelectorAll('.armrow');
		expect(rows).toHaveLength(2);
		// The winning arm (higher mean) wears the .won class; the other does not.
		expect(rows[0].querySelector('.ci')?.classList.contains('won')).toBe(true);
		expect(rows[1].querySelector('.ci')?.classList.contains('won')).toBe(false);
	});

	it('backs the plot with a table of both arms', () => {
		const { container } = render(IntervalPlot, { arms });

		const bodyRows = container.querySelectorAll('tbody tr');
		expect(bodyRows).toHaveLength(2);
		expect(bodyRows[0].querySelectorAll('td')[0].textContent).toBe('only direction');
		expect(bodyRows[0].querySelectorAll('td')[1].textContent).toBe('8.7s');
	});

	it('names both arms in the graphic label a screen reader hears', () => {
		const { container } = render(IntervalPlot, { arms });
		const label = container.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '';
		expect(label).toContain('only direction 8.7s');
		expect(label).toContain('only distance 6.5s');
	});
});
