import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Distribution from './Distribution.svelte';

const seeds = [3.1, 4.2, 3.8, 5.0, 4.4, 3.9, 4.1, 4.7];

describe('Distribution', () => {
	it('plots one dot per seed', () => {
		const { container } = render(Distribution, { returns: seeds });

		expect(container.querySelectorAll('.dot')).toHaveLength(seeds.length);
	});

	it('marks the mean and the CI band only when they are supplied', () => {
		const withStats = render(Distribution, {
			returns: seeds,
			mean: 4.2,
			ci: { lo: 3.7, hi: 4.6 }
		}).container;
		expect(withStats.querySelector('.mean')).not.toBeNull();
		expect(withStats.querySelector('.ci')).not.toBeNull();

		const bare = render(Distribution, { returns: seeds }).container;
		expect(bare.querySelector('.mean')).toBeNull();
		expect(bare.querySelector('.ci')).toBeNull();
	});

	it('lists every seed with its seconds in the table fallback', () => {
		const { container } = render(Distribution, { returns: seeds });

		const bodyRows = container.querySelectorAll('tbody tr');
		expect(bodyRows).toHaveLength(seeds.length);
		// Second column is the survival time, one decimal + "s" — the exact cell, in seed order.
		expect(bodyRows[0].querySelectorAll('td')[1].textContent).toBe('3.1s');
	});

	it('labels the graphic with the seed count and mean, for a screen reader', () => {
		const { container } = render(Distribution, { returns: seeds, mean: 4.2 });

		const label = container.querySelector('[role="img"]')?.getAttribute('aria-label');
		expect(label).toContain('8 seeds');
		expect(label).toContain('mean 4.2s');
	});

	it('draws no dots for an empty result', () => {
		const { container } = render(Distribution, { returns: [] });

		expect(container.querySelectorAll('.dot')).toHaveLength(0);
	});
});
