import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RunCellCard from './RunCellCard.svelte';
import { newWorldConfig } from '$lib/engine';
import type { SweepCell } from '$lib/lab/sweep';
import type { Evaluation } from '$lib/lab/evaluator';
import type { BehaviorStats } from '$lib/harness/behavior';

/**
 * The drilled-cell card answers two scientific questions from data the sweep already measured: HOW the
 * fish here survive (the behavioural signature) and whether this world is any GOOD (its rank among every
 * condition, and its own seed spread). Those bindings are the reason the component exists, so they are
 * pinned here with fixed data — no live sweep.
 */

const behavior: BehaviorStats = {
	boltRatio: 1.4,
	fleeAngleErrorDeg: 40,
	dodgeRate: 0.4,
	cornerDeathShare: 0.05,
	cornerTimeShare: 0.1,
	meanPredDistance: 70,
	meanLife: 8,
	aliveAtEnd: 3,
	lunges: 3,
	deaths: 4
};

const cell: SweepCell = { index: 0, levels: { dir: 'on' }, cfg: newWorldConfig('cell', '#123456') };

/** The drilled condition: mean 8.1s over four seeds (seed 0 = 7.9s). */
const evaluation: Evaluation = {
	n: 4,
	episodes: 30,
	meanReturn: 8.1,
	sdReturn: 0.5,
	behavior,
	returns: [7.9, 8.3, 7.6, 8.6]
};

const other = (mean: number): Evaluation => ({ ...evaluation, meanReturn: mean, returns: [mean] });
/** Three conditions: 8.1 (this one), 6.0, 9.0 — so this world ranks 2nd of 3 for survival. */
const allResults: (Evaluation | null)[] = [evaluation, other(6.0), other(9.0)];

const props = { cell, seed: 0, evaluation, allResults, onclose: () => {} };

describe('RunCellCard', () => {
	it('shows THIS run against the CONDITION mean — two distinct numbers, bound to the right source', () => {
		const { container } = render(RunCellCard, props);
		expect(container.textContent).toContain('7.9s'); // this run = returns[0], not the mean
		expect(container.textContent).toContain('8.1s'); // condition mean ± sd
		expect(container.textContent).toContain('0.5s');
		expect(container.textContent).toContain('4 seeds');
	});

	it('reads out the behavioural signature — the measured mechanism, in its own units', () => {
		const { container } = render(RunCellCard, props);
		const text = container.textContent ?? '';
		expect(text).toContain('Flee heading');
		expect(text).toContain('40°'); // fleeAngleErrorDeg
		expect(text).toContain('Dodge rate');
		expect(text).toContain('40%'); // dodgeRate 0.4
		expect(text).toContain('70px'); // distance kept
		expect(text).toContain('1.4×'); // bolt ratio
	});

	it('ranks the world among every condition swept, best-first', () => {
		const { container } = render(RunCellCard, props);
		// 8.1 sits below 9.0 and above 6.0 → 2nd of 3.
		expect(container.querySelector('.strip')?.textContent).toContain('2 of 3');
	});

	it('names the condition by its factor LABEL, not the raw level key', () => {
		const { container } = render(RunCellCard, props);
		expect(container.textContent).toContain('Direction'); // the label for key 'dir'
	});

	it('plots the two distribution strips, ringing "you are here" in each', () => {
		const { container } = render(RunCellCard, { ...props, seed: 2 });
		const strips = container.querySelectorAll('.strip');
		expect(strips).toHaveLength(2);
		// Rank strip: one dot per condition (3), this condition ringed.
		expect(strips[0].querySelectorAll('.dot')).toHaveLength(3);
		expect(strips[0].querySelectorAll('.dot.me')).toHaveLength(1);
		// Seed strip: one dot per seed (4), the clicked run ringed.
		expect(strips[1].querySelectorAll('.dot')).toHaveLength(4);
		expect(strips[1].querySelectorAll('.dot.me')).toHaveLength(1);
	});
});
