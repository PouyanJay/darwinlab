import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import SubjectCard from './SubjectCard.svelte';
import { app, presets, PRESETS_STORAGE_KEY } from '$lib/state';
import { newWorldConfig } from '$lib/engine';

/**
 * The subject card became a real editor, so what is pinned here is the EDITING contract: a value
 * typed into the card must land in the app store (which owns the clamp) — asserted against the
 * store, not against the card's own display, so a card that renders an edit it never committed
 * fails loudly. The store's clamp maths has its own spec (app.svelte.spec); this one proves the
 * card is wired to it.
 *
 * Commits are `change` events. Svelte 5 DELEGATES those to the app root, so a dispatched event
 * must BUBBLE to be heard — a non-bubbling `new Event('change')` silently reaches nobody (found
 * the hard way; the first draft of this spec passed fills and failed every commit).
 */
const commit = (el: Element) => el.dispatchEvent(new Event('change', { bubbles: true }));

describe('SubjectCard', () => {
	beforeEach(() => {
		localStorage.removeItem(PRESETS_STORAGE_KEY);
		for (const p of [...presets.entries]) presets.remove(p.name);
		app.clearSubject();
		app.resetBase();
	});

	it('typing a prey count commits it to the store, clamped by the store', async () => {
		render(SubjectCard);
		const prey = page.getByLabelText(/prey/);
		expect(app.base.prey).not.toBe(80); // the state we claim to change starts elsewhere
		await prey.fill('9999');
		commit(prey.element());
		expect(app.base.prey).toBe(80); // WORLD_LIMITS.prey.max — the STORE's clamp, reached the store
	});

	it('editing the tank size reaches the store', async () => {
		render(SubjectCard);
		expect(app.base.bw).not.toBe(1000); // the state we claim to change starts elsewhere
		const width = page.getByLabelText('tank width');
		await width.fill('1000');
		commit(width.element());
		expect(app.base.bw).toBe(1000);
	});

	it('committing hidden-layers text reshapes the base brain', async () => {
		render(SubjectCard);
		// the Brain group ships folded — open it the way a user does
		await page.getByText('Brain', { exact: true }).click();
		expect(app.base.brainHidden).not.toEqual([16, 8]); // the state we claim to change starts elsewhere
		const layers = page.getByLabelText(/hidden layers/);
		await layers.fill('16, 8');
		commit(layers.element());
		expect(app.base.brainHidden).toEqual([16, 8]);
	});

	it('the analysing banner names the analysed subject', async () => {
		app.analyze(newWorldConfig('Corner-wise', '#e8604c'));
		render(SubjectCard);
		const banner = page.getByTestId('research-subject');
		await expect.element(banner).toBeVisible();
		await expect.element(banner).toHaveTextContent('Corner-wise');
	});

	it('"Use a generic world" clears the analysed subject', async () => {
		app.analyze(newWorldConfig('Corner-wise', '#e8604c'));
		render(SubjectCard);
		expect(app.subject).not.toBeNull(); // it really was set before we clear it
		await page.getByRole('button', { name: 'Use a generic world' }).click();
		expect(app.subject).toBeNull();
	});

	it('"Save as preset" snapshots the current base, edits included', async () => {
		app.renameBase('Reef');
		app.setBaseCondition('prey', 36);
		render(SubjectCard);
		await page.getByRole('button', { name: 'Save as preset' }).click();
		expect(presets.entries[0]?.name).toBe('Reef');
		expect(presets.entries[0]?.cfg.prey).toBe(36); // the edit really is inside the snapshot
	});

	it('clicking a preset chip restores its edits as the base', async () => {
		app.renameBase('Reef');
		app.setBaseCondition('prey', 36);
		presets.saveCurrent();
		app.resetBase();
		expect(app.base.prey).not.toBe(36); // the base really left the preset's shape
		render(SubjectCard);
		// exact name — "remove preset Reef" also contains "Reef", and a substring match would
		// click whichever the locator resolves first (the first draft deleted the preset instead)
		await page.getByRole('button', { name: 'Reef', exact: true }).click();
		expect(app.base.prey).toBe(36);
	});

	it('"Reset to generic" is offered on a generic base, not on an analysed subject', async () => {
		const generic = render(SubjectCard);
		expect(generic.container.textContent).toContain('Reset to generic');
		generic.unmount();

		app.analyze(newWorldConfig('Watched', '#123456'));
		const analysed = render(SubjectCard);
		expect(analysed.container.textContent).not.toContain('Reset to generic');
	});
});
