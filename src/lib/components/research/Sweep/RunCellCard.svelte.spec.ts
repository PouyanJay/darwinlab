import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RunCellCard from './RunCellCard.svelte';
import { newWorldConfig } from '$lib/engine';
import type { SweepCell } from '$lib/lab/sweep';
import type { Evaluation } from '$lib/lab/evaluator';
import type { BehaviorStats } from '$lib/harness/behavior';

/**
 * The drilled-cell card presents two DIFFERENT numbers — this one run's survival vs the whole
 * condition's mean ± sd — and the run's place in the condition's spread. Those bindings are the reason
 * the component exists, so they are pinned here with fixed data (no live sweep).
 */

const behavior: BehaviorStats = {
	boltRatio: 1,
	fleeAngleErrorDeg: 40,
	dodgeRate: 0.4,
	cornerDeathShare: 0,
	cornerTimeShare: 0.1,
	meanPredDistance: 70,
	meanLife: 8,
	aliveAtEnd: 3,
	lunges: 3,
	deaths: 4
};

const cell: SweepCell = { index: 0, levels: { dir: 'on' }, cfg: newWorldConfig('cell', '#123456') };

const evaluation: Evaluation = {
	n: 4,
	episodes: 30,
	meanReturn: 8.1,
	sdReturn: 0.5,
	behavior,
	returns: [7.9, 8.3, 7.6, 8.6] // seed 0 = 7.9s; the range is 7.6–8.6
};

describe('RunCellCard', () => {
	it('shows THIS run against the CONDITION mean — two distinct numbers, bound to the right source', () => {
		const { container } = render(RunCellCard, { cell, seed: 0, evaluation, onclose: () => {} });

		// This run is the clicked seed's value (returns[0] = 7.9s), not the mean.
		expect(container.textContent).toContain('7.9s');
		// The condition mean is the aggregate ± sd over its seeds.
		expect(container.textContent).toContain('8.1s');
		expect(container.textContent).toContain('0.5s');
		expect(container.textContent).toContain('4 seeds');
	});

	it('names the condition by its factor LABELS, not the raw level keys', () => {
		const { container } = render(RunCellCard, { cell, seed: 0, evaluation, onclose: () => {} });
		expect(container.textContent).toContain('Direction'); // the label for key 'dir'
		expect(container.textContent).toContain('on');
	});

	it('plots one spread dot per seed, and rings exactly the clicked run', () => {
		const { container } = render(RunCellCard, { cell, seed: 2, evaluation, onclose: () => {} });
		expect(container.querySelectorAll('.spread .dot')).toHaveLength(4); // one per seed
		expect(container.querySelectorAll('.spread .dot.me')).toHaveLength(1); // exactly the clicked one
	});
});
