import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EffectBars from './EffectBars.svelte';

/** A clear mover, a costly one, and one whose interval straddles zero (muted). */
const effects = [
	{ label: 'Direction', delta: 2.4, lo: 1.2, hi: 3.1 },
	{ label: 'Predator speed', delta: -4.2, lo: -6, hi: -2 },
	{ label: 'Distance', delta: 0.1, lo: -0.9, hi: 1.1 }
];

describe('EffectBars', () => {
	it('draws one row per factor, with its signed effect', () => {
		const { container } = render(EffectBars, { effects });

		const rows = container.querySelectorAll('.effects .row');
		expect(rows).toHaveLength(3);
		expect(rows[0].querySelector('.val')?.textContent?.trim()).toBe('+2.4s');
		expect(rows[1].querySelector('.val')?.textContent?.trim()).toBe('-4.2s');
	});

	it('mutes a factor whose interval straddles zero — it does nothing here', () => {
		const { container } = render(EffectBars, { effects });
		const rows = container.querySelectorAll('.effects .row');

		// Distance (lo<0<hi) is flat; Direction is not.
		expect(rows[2].querySelector('.val')?.classList.contains('flat')).toBe(true);
		expect(rows[0].querySelector('.val')?.classList.contains('flat')).toBe(false);
	});

	it('backs the bars with a table, and names the movers for a screen reader', () => {
		const { container } = render(EffectBars, { effects });

		expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
		const label = container.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '';
		expect(label).toContain('Direction +2.4s'); // a mover named
		expect(label).not.toContain('Distance'); // the flat one is not sold as a finding
	});
});
