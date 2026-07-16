import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import TileStats from './TileStats.svelte';
import { WorldStats, WorldConfigView, LineageView, type WorldEntry } from '$lib/state';
import { makeWorld, DEFAULT_WORLDS } from '$lib/engine';

/**
 * Built by hand rather than through the bench store: the store owns a running loop that would
 * re-sync these numbers out from under the test on the very next frame. What is under test here is
 * the reading — how a deployment is described — not how the store fills it in.
 */
function entryWith(stats: Partial<WorldStats>): WorldEntry {
	const world = makeWorld(structuredClone(DEFAULT_WORLDS[2]));
	const config = new WorldConfigView();
	config.syncFrom(world.cfg);
	return {
		id: 'w1',
		world,
		stats: Object.assign(new WorldStats(), stats),
		config,
		lineage: new LineageView()
	};
}

const deployment = () => page.getByTestId('deployment').element().textContent;

describe('TileStats — the real-world run', () => {
	it('has nothing to report while the world is still evolving', () => {
		render(TileStats, { entry: entryWith({ deployed: false, alive: 14 }) });

		// generations are still resetting the population, so no decay has happened to describe
		expect(deployment()).toBe('after training');
	});

	it('counts the seconds while the deployed population is still holding on', () => {
		render(TileStats, { entry: entryWith({ deployed: true, deployT: 8.6, alive: 17 }) });

		expect(deployment()).toBe('9s · 17 left');
	});

	it('leads with the half-life once the population has halved — that is the comparable number', () => {
		render(TileStats, {
			entry: entryWith({ deployed: true, deployT: 30, halfLife: 12.4, alive: 6 })
		});

		expect(deployment()).toBe('half-life 12s · 6 left');
	});

	it('says when the world has finished the job', () => {
		render(TileStats, {
			entry: entryWith({ deployed: true, deployT: 61, halfLife: 12.4, extinctT: 47.8, alive: 0 })
		});

		expect(deployment()).toBe('wiped out · 48s');
	});

	it('shows the live population and the toll it has taken', () => {
		render(TileStats, { entry: entryWith({ alive: 13, eaten: 7, survivalPct: 36 }) });

		expect(page.getByTestId('alive').element().textContent).toBe('13');
		expect(page.getByTestId('eaten').element().textContent).toBe('−7');
		expect(page.getByTestId('survival').element().textContent).toBe('36%');
	});
});

describe('TileStats — what a screen reader hears about the run', () => {
	/**
	 * The visible readout ticks every second; the LIVE REGION must not. It speaks only at the
	 * moments the run turns, in phrases that are stable once said — so each is announced once.
	 */
	const spoken = () => page.getByRole('status').element().textContent;

	it('says nothing while the world is still evolving', () => {
		render(TileStats, { entry: entryWith({ deployed: false, alive: 14 }) });
		expect(spoken()).toBe('');
	});

	it('announces the start of the run — without the ticking seconds', () => {
		render(TileStats, { entry: entryWith({ deployed: true, deployT: 8.6, alive: 17 }) });
		expect(spoken()).toBe('Direction: deployed. The real-world run has started');
	});

	it('announces the half-life the moment it latches, and holds that phrase', () => {
		render(TileStats, {
			entry: entryWith({ deployed: true, deployT: 30, halfLife: 12.4, alive: 6 })
		});
		expect(spoken()).toBe('Direction: half the population gone at 12 seconds');
	});

	it('announces extinction', () => {
		render(TileStats, {
			entry: entryWith({ deployed: true, deployT: 61, halfLife: 12.4, extinctT: 47.8, alive: 0 })
		});
		expect(spoken()).toBe('Direction: population wiped out after 48 seconds');
	});
});
