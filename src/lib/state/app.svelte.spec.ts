import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { app, MODE_STORAGE_KEY } from './app.svelte';
import { bench } from './bench.svelte';
import { newWorldConfig } from '../engine';

/**
 * The mode store is a singleton; each test restores it to the studio default first, so a test that
 * claims to prove a switch is asserting against a known starting point rather than whatever the
 * previous test left behind.
 */
describe('app mode', () => {
	beforeEach(() => {
		localStorage.removeItem(MODE_STORAGE_KEY);
		app.setMode('studio');
		app.clearSubject();
	});

	it('defaults to studio', () => {
		expect(app.mode).toBe('studio');
		expect(app.research).toBe(false);
	});

	it('setMode switches the instrument and flips the research flag', () => {
		expect(app.research).toBe(false); // the state we claim to change really exists first
		app.setMode('research');
		expect(app.mode).toBe('research');
		expect(app.research).toBe(true);
	});

	it('setMode persists the choice', () => {
		app.setMode('research');
		expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('research');
	});

	// Leaving Research must persist too — otherwise a store that only bothers writing the non-default
	// mode would dump a returning user straight back into Research, which is the bug this store exists
	// to prevent.
	it('setMode persists studio when switching back from research', () => {
		app.setMode('research');
		expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('research'); // the value we expect to change
		app.setMode('studio');
		expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('studio');
	});

	it('adopts the saved mode on init', () => {
		localStorage.setItem(MODE_STORAGE_KEY, 'research');
		app.init();
		expect(app.mode).toBe('research');
	});

	it('falls back to studio when nothing is saved', () => {
		localStorage.removeItem(MODE_STORAGE_KEY);
		app.init();
		expect(app.mode).toBe('studio');
	});
});

describe('the analysis subject (the Studio→Research round-trip)', () => {
	beforeEach(() => {
		app.setMode('studio');
		app.clearSubject();
	});

	// These tests add a world to the shared bench singleton — clear it so a later test never starts
	// from a polluted bench (the same discipline bench.svelte.spec follows).
	afterEach(() => bench.destroy());

	it('has no subject by default — Research explores a generic world', () => {
		expect(app.subject).toBeNull();
	});

	it('analyze seeds the subject AND switches to Research in one move', () => {
		expect(app.research).toBe(false); // the state we claim to change really starts here
		const cfg = newWorldConfig('Corner-wise', '#e8604c');
		app.analyze(cfg);
		expect(app.subject).toBe(cfg);
		expect(app.mode).toBe('research');
	});

	it('subjectBase returns the subject, relabelled for the instrument, when one is set', () => {
		const cfg = { ...newWorldConfig('Corner-wise', '#e8604c'), vision: 999 };
		app.analyze(cfg);
		const base = app.subjectBase('Sweep', '#8b8b8b');
		expect(base.vision).toBe(999); // the subject's own knobs carry through…
		expect(base.name).toBe('Sweep'); // …but name/accent are the instrument's chrome
		expect(base.accent).toBe('#8b8b8b');
	});

	it('subjectBase returns a fresh generic world when there is no subject', () => {
		expect(app.subject).toBeNull(); // no subject to carry
		const base = app.subjectBase('Sweep', '#8b8b8b');
		expect(base.name).toBe('Sweep');
		expect(base.senses).toEqual({ dist: true, dir: true, closing: true, walls: true }); // the default ocean
	});

	it('clearSubject drops the subject but leaves the mode where it is', () => {
		app.analyze(newWorldConfig('Corner-wise', '#e8604c'));
		expect(app.subject).not.toBeNull(); // it really was set before we clear it
		app.clearSubject();
		expect(app.subject).toBeNull();
		expect(app.mode).toBe('research'); // clearing the subject is not leaving Research
	});

	it('bench.analyzeWorld hands a CLONE of the world over and switches to Research', () => {
		bench.addWorld(newWorldConfig('Watched', '#123456'));
		const added = bench.worlds[bench.worlds.length - 1];
		expect(app.mode).toBe('studio'); // the mode we claim the hand-off flips really starts here
		expect(app.subject).toBeNull(); // and there is no subject yet

		bench.analyzeWorld(added.id);

		expect(app.mode).toBe('research');
		expect(app.subject).toEqual(added.world.cfg); // same config…
		expect(app.subject).not.toBe(added.world.cfg); // …but a snapshot, so later edits don't mutate it
	});

	it('bench.analyzeWorld on an unknown id is a no-op — no subject, no mode change', () => {
		bench.analyzeWorld('does-not-exist');
		expect(app.subject).toBeNull(); // nothing was handed over
		expect(app.mode).toBe('studio'); // and we did not lurch into Research on a bad id
	});
});
