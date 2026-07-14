import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { flushSync } from 'svelte';
import BrainCanvas from './BrainCanvas.svelte';
import { bench } from '$lib/state';
import { DEFAULT_WORLDS, bestAliveFish } from '$lib/engine';

/**
 * The brain must be drawn from the world the fish is actually SWIMMING IN.
 *
 * It read `entry.world` — the real run — and an exhibit puts the selected fish somewhere else. The
 * real world's sense snapshot is null in that case, and a null snapshot draws the empty scaffold:
 * eight input nodes, six hidden, two outputs, and not one weight between them. The panel next to it
 * went on printing live sense readings the whole time (it reads the store's published mind, which
 * does use the shown world), so the inspector was showing one fish's numbers beside another fish's
 * blank brain and saying nothing about it.
 *
 * The canvas is a picture, so what is asserted is the picture: EDGES ARE PAINTED.
 */

afterEach(() => bench.destroy());

/** Drive the bench without racing the 16ms timer. */
function run(seconds: number) {
	const dt = 1 / 60;
	for (let i = 0; i < seconds * 60; i++) bench.tick(dt, dt);
}

/** How much of this canvas is edges — coloured strokes between the nodes. */
function paintedPixels(canvas: HTMLCanvasElement): number {
	const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
	let painted = 0;
	for (let i = 3; i < data.length; i += 4) if (data[i] > 8) painted++;
	return painted;
}

describe('BrainCanvas', () => {
	it("draws the champion clone's real weights, not an empty scaffold", async () => {
		bench.init({ configs: [DEFAULT_WORLDS[4]], prewarmGenerations: 0, maxGenerations: 0 });
		const entry = bench.worlds[0];
		run(35); // one generation, so the world has a brain worth exhibiting

		// A fish in the REAL world first — this is the picture a working brain panel makes.
		bench.selectChampion(entry.id);
		run(0.2);
		const { container } = render(BrainCanvas, { entry });
		flushSync();
		const canvas = container.querySelector('canvas') as HTMLCanvasElement;
		await new Promise((r) => setTimeout(r, 60));
		const inTheRun = paintedPixels(canvas);
		expect(inTheRun).toBeGreaterThan(0);

		// Now put the exhibit up and watch a CLONE. The fish is in a different world now.
		expect(bench.setExhibit(entry.id, 'frozen')).toBe(true);
		run(1);
		bench.selectChampion(entry.id);
		run(0.5);
		flushSync();
		await new Promise((r) => setTimeout(r, 60));

		const inTheExhibit = paintedPixels(canvas);

		// The brain of a clone is a brain. It must be drawn as densely as any other — the failure this
		// pins is a canvas with the nodes on it and nothing else, which is roughly a third of the ink.
		expect(inTheExhibit).toBeGreaterThan(inTheRun * 0.6);
		expect(bench.shown(entry.id)).not.toBe(entry.world); // …and it really was the exhibit
		expect(bestAliveFish(bench.shown(entry.id))).not.toBeNull();
	});
});
