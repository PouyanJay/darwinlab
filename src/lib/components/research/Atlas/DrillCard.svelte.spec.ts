import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import DrillCard from './DrillCard.svelte';
import { landscape } from '$lib/state';
import { restoreLandscapeDefaults } from '$lib/state/landscape.testkit';
import type { JobExecutor } from '$lib/lab/runner';
import type { Evaluation } from '$lib/lab/evaluator';

/** Hands back pre-baked evaluations in submit order — one per cell, row-major. */
class CannedExecutor implements JobExecutor {
	readonly concurrency = 1;
	#queue: (Evaluation | null)[];
	constructor(evaluations: (Evaluation | null)[]) {
		this.#queue = [...evaluations];
	}
	async submit(): Promise<Evaluation | null> {
		return this.#queue.shift() ?? null;
	}
	dispose(): void {}
}

const evalMean = (meanReturn: number) => ({ meanReturn }) as unknown as Evaluation;
// Columns average 10, 5, 4.7, 4.5, 4.4 — a cliff between columns 0 and 1, then a plateau whose
// steps sit safely under the edge threshold, so the two where-lines are both reachable.
const cannedField = () =>
	new CannedExecutor(Array.from({ length: 25 }, (_, i) => evalMean([10, 5, 4.7, 4.5, 4.4][i % 5])));

describe('DrillCard', () => {
	beforeEach(async () => {
		restoreLandscapeDefaults();
		landscape.setResolution(5);
		landscape.setSeeds(2);
		await landscape.run(cannedField());
	});

	it('names the cell’s place on the axes loud and the pinned background quiet, frozen', async () => {
		landscape.select(0, 0);
		render(DrillCard);
		const drill = page.getByTestId('atlas-drill');
		await expect.element(drill).toHaveTextContent('predator speed 0.60×'); // the axis chips
		await expect.element(drill).toHaveTextContent('mutation 0.020');
		await expect.element(drill).toHaveTextContent('all senses on'); // the background, read from cfg
		await expect.element(drill).toHaveTextContent('hunger escalation off');
		await expect.element(drill).toHaveTextContent('8-input brain');
	});

	it('reads the neighbours and says when the cell stands at the edge', async () => {
		landscape.select(0, 0); // one step right falls 10 → 5
		render(DrillCard);
		await expect.element(page.getByTestId('atlas-drill')).toHaveTextContent('-5.0s');
		await expect.element(page.getByTestId('drill-where')).toHaveTextContent(/standing at the edge/);
	});

	it('says plateau when the neighbours hold — the edge line is measured, not decorative', async () => {
		landscape.select(2, 2); // 4.7 → 4.5 to the right: a gentle slope, not the cliff
		render(DrillCard);
		await expect.element(page.getByTestId('drill-where')).toHaveTextContent(/on the plateau/);
	});

	it('reports the map edge rather than a fake zero at the far corner', async () => {
		landscape.select(4, 4);
		render(DrillCard);
		await expect.element(page.getByTestId('atlas-drill')).toHaveTextContent('map edge');
	});
});
