import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import SweepDesignPanel from './SweepDesignPanel.svelte';
import { sweep, app } from '$lib/state';

/**
 * The panel is the store's face, so what is pinned here is the WIRING: a control operated in the
 * panel must land in the sweep store (which owns every clamp and guard) — asserted against the
 * store, not the panel's own display. The store's plan/guard maths has its own spec; the run is
 * never actually started here (the real worker pool has no place in a component test).
 */

/** Walk every knob and the budget back to the catalog defaults — the store is a singleton. */
function restoreDefaults(): void {
	app.clearSubject();
	app.resetBase();
	for (const knob of sweep.boolKnobs) sweep.setBoolState(knob.key, knob.defaultState);
	for (const knob of sweep.gradedKnobs) {
		for (const value of knob.values) {
			const want = knob.defaultSelected.includes(value);
			if (sweep.isLevelSelected(knob.key, value) !== want) sweep.toggleLevel(knob.key, value);
		}
	}
	sweep.setSeeds(6);
	sweep.setEpisodes(20);
	sweep.setGenDuration(10);
	sweep.setCapOn(false);
	sweep.setCapN(32);
}

describe('SweepDesignPanel', () => {
	beforeEach(restoreDefaults);

	it('pinning a swept knob through its three-state reaches the store', async () => {
		render(SweepDesignPanel);
		expect(sweep.boolState('dist')).toBe('sweep'); // the state we claim to change starts swept
		await page
			.getByRole('radiogroup', { name: 'Distance' })
			.getByRole('radio', { name: 'on' })
			.click();
		expect(sweep.boolState('dist')).toBe('on');
	});

	it('a level chip click sweeps the graded knob in the store', async () => {
		render(SweepDesignPanel);
		expect(sweep.plannedCells).toBe(48); // the size we claim to double starts here
		await page
			.getByRole('group', { name: 'Vision px' })
			.getByRole('button', { name: '240' })
			.click();
		expect(sweep.isLevelSelected('vision', 240)).toBe(true);
		expect(sweep.plannedCells).toBe(96);
	});

	it('the cap switch arms the cap and its count input', async () => {
		render(SweepDesignPanel);
		expect(sweep.capOn).toBe(false); // the state we claim to arm starts off
		const capInput = page.getByLabelText('cell cap');
		await expect.element(capInput).toBeDisabled();
		await page.getByRole('switch', { name: 'cap the cell count' }).click();
		expect(sweep.capOn).toBe(true);
		await expect.element(capInput).toBeEnabled();
		expect(sweep.willSample).toBe(true); // 48 planned > the default 32 cap
	});

	it('a confirm-tier design disables Run until the exact cell count is typed', async () => {
		sweep.setSeeds(12);
		sweep.setEpisodes(120);
		sweep.setGenDuration(60); // hours at the fallback rate → confirm tier
		expect(sweep.guard).toBe('confirm'); // the tier we claim gates really is in force
		render(SweepDesignPanel);

		const run = page.getByRole('button', { name: 'Run sweep' });
		await expect.element(run).toBeDisabled();

		const confirm = page.getByLabelText('type the cell count to confirm');
		await confirm.fill(String(sweep.cellsToRun + 1)); // close is not correct
		await expect.element(run).toBeDisabled();
		await confirm.fill(String(sweep.cellsToRun));
		await expect.element(run).toBeEnabled();
	});

	it('the impossible own-speed row offers the 9-input brain, and the offer works', async () => {
		render(SweepDesignPanel);
		const ownSpeed = page.getByRole('radiogroup', { name: 'Own speed' });
		await expect.element(ownSpeed).toHaveAttribute('aria-disabled', 'true');

		await page.getByRole('button', { name: 'switch the subject to the 9-input brain' }).click();
		expect(app.base.brainInputs).toBe(9); // the offer really rewired the subject
		await expect.element(ownSpeed).toHaveAttribute('aria-disabled', 'false');
	});
});
