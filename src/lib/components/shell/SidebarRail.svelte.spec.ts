import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import SidebarRail from './SidebarRail.svelte';
import { bench, shell, SPEEDS } from '$lib/state';

/**
 * The rail is the collapsed sidebar, and the ONE control it cannot carry in its usual shape is
 * speed: a three-way segmented control does not fit 56px, so it becomes a cycle button. That
 * reshaping is the thing worth pinning — it is the only place in the app where the same choice is
 * offered by a different kind of widget, and the only place it could quietly stop offering all of it.
 *
 * `bench` is never init()ed: that would start a live loop with sharks eating in the background (a
 * trap this repo has fallen into before). The rail only reads speed/running/turboTarget and calls
 * store methods, so the store is driven directly and put back afterwards.
 */
const noop = () => {};
const mount = () => render(SidebarRail, { onaddworld: noop, onplaystory: noop });

const speedButton = () => page.getByRole('button', { name: /simulation speed/ });

let speed: (typeof SPEEDS)[number]['value'];

beforeEach(() => {
	speed = bench.speed;
});

afterEach(() => {
	bench.setSpeed(speed);
	if (shell.open !== true) shell.toggle();
});

describe('SidebarRail', () => {
	it('offers the run controls the panel would have hidden', () => {
		if (shell.open) shell.toggle(); // collapse: the rail is the whole sidebar now
		flushSync();
		mount();

		// The reason the rail exists at all: mid-experiment you pause, change speed and fast-forward.
		expect(page.getByRole('button', { name: 'Pause' }).element()).toBeTruthy();
		expect(speedButton().element()).toBeTruthy();
		expect(page.getByRole('button', { name: /Train/ }).element()).toBeTruthy();
	});

	it('cycles the speed through every value the panel offers, and wraps', async () => {
		if (shell.open) shell.toggle();
		bench.setSpeed(0.5);
		flushSync();
		mount();

		const seen: number[] = [];
		for (let press = 0; press < SPEEDS.length; press++) {
			await speedButton().click();
			seen.push(bench.speed);
		}

		// ½ → 1 → 2 → back to ½: every speed reachable, and the cycle closes.
		expect(seen).toEqual([1, 2, 0.5]);
	});

	it('says which speed it is on, so it reads as well as it acts', async () => {
		if (shell.open) shell.toggle();
		bench.setSpeed(1);
		flushSync();
		mount();

		expect(speedButton().element()).toHaveTextContent('1×');

		await speedButton().click();

		expect(speedButton().element()).toHaveTextContent('2×');
	});

	it('goes inert — and drops its controls — while the panel is open', () => {
		if (!shell.open) shell.toggle(); // expanded: the panel carries these controls itself
		flushSync();
		mount();

		// Not merely hidden: offered twice, a screen reader would ask the user which "Pause" they meant.
		expect(page.getByRole('button', { name: 'Pause' }).elements()).toHaveLength(0);
		expect(speedButton().elements()).toHaveLength(0);
	});

	it('refuses to fast-forward while a burst is already running', () => {
		if (shell.open) shell.toggle();
		const trainTo = vi.spyOn(bench, 'trainTo');
		vi.spyOn(bench, 'training', 'get').mockReturnValue(true);
		flushSync();
		mount();

		expect(page.getByRole('button', { name: /Train/ }).element()).toBeDisabled();
		expect(trainTo).not.toHaveBeenCalled();

		vi.restoreAllMocks();
	});
});
