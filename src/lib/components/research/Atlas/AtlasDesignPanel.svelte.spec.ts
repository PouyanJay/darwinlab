import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import AtlasDesignPanel from './AtlasDesignPanel.svelte';
import { landscape } from '$lib/state';
import { restoreLandscapeDefaults } from '$lib/state/landscape.testkit';

/**
 * The landscape panel's EDITING contract: a pick made in the panel must land in the landscape
 * store (which owns every clamp, snap and swap) — asserted against the store, not the panel's own
 * display, so a panel that renders a pick it never committed fails loudly. The span/snap maths has
 * its own specs (landscape.spec, landscape.svelte.spec); this one proves the panel is wired to it.
 *
 * Selects and inputs commit on `change`, which Svelte 5 DELEGATES to the app root — a dispatched
 * event must BUBBLE to be heard (the SubjectCard spec found that the hard way).
 */
const commit = (el: Element, value: string) => {
	(el as HTMLInputElement | HTMLSelectElement).value = value;
	el.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('AtlasDesignPanel', () => {
	beforeEach(() => {
		restoreLandscapeDefaults();
	});

	it('an axis dropdown never offers the other slot’s pick — an axis can’t face itself', async () => {
		render(AtlasDesignPanel);
		const options = [
			...page.getByLabelText('x axis', { exact: true }).element().querySelectorAll('option')
		];
		expect(options.map((o) => o.value)).not.toContain(landscape.axisY.key);
	});

	it('picking an axis reaches the store', async () => {
		render(AtlasDesignPanel);
		expect(landscape.axisX.key).not.toBe('vision'); // the state we claim to change starts elsewhere
		commit(page.getByLabelText('x axis', { exact: true }).element(), 'vision');
		expect(landscape.axisX.key).toBe('vision');
	});

	it('a range edit commits to the store, normalised by the store', async () => {
		render(AtlasDesignPanel);
		commit(page.getByLabelText('x axis from').element(), '1.9'); // past the axis bound
		expect(landscape.axisX.min).toBeCloseTo(0.6); // the LAB's rules ran, not the input's text
		expect(landscape.axisX.max).toBeCloseTo(1.4);
	});

	it('a resolution chip snaps the store to the menu', async () => {
		render(AtlasDesignPanel);
		expect(landscape.resolution).not.toBe(9); // starts elsewhere
		await page.getByRole('button', { name: '9 × 9' }).click();
		expect(landscape.resolution).toBe(9);
		await expect
			.element(page.getByTestId('atlas-plan'))
			.toHaveTextContent(`9 × 9 = 81 cells × ${landscape.seeds} seeds`);
	});

	it('a pin flip reaches the store', async () => {
		render(AtlasDesignPanel);
		expect(landscape.pin('persistence')).toBe(false); // the generic ocean's own truth
		await page
			.getByRole('radiogroup', { name: 'Hunger escalation' })
			.getByRole('radio', { name: 'on' })
			.click();
		expect(landscape.pin('persistence')).toBe(true);
	});

	it('the budget inputs commit to the store, clamped by the store', async () => {
		render(AtlasDesignPanel);
		const seeds = page.getByTestId('atlas-seeds');
		await seeds.fill('99');
		seeds.element().dispatchEvent(new Event('change', { bubbles: true }));
		expect(landscape.seeds).toBe(10); // the STORE's clamp

		const gens = page.getByTestId('atlas-episodes');
		await gens.fill('999');
		gens.element().dispatchEvent(new Event('change', { bubbles: true }));
		expect(landscape.episodes).toBe(60);
	});
});
