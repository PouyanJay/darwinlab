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
 * pinned here with fixed data — and each value is asserted against ITS OWN row, so a swapped field or an
 * inverted rank fails loudly rather than passing because the string appears somewhere.
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
/** Four conditions, ASYMMETRIC around 8.1 (two below, one above) so an inverted rank reads differently:
 *  best-first → 2 of 4; worst-first → 3 of 4. 8.1 must NOT sit at the median. */
const allResults: (Evaluation | null)[] = [evaluation, other(6.0), other(6.5), other(9.0)];

// The drilled condition sits at index 0 of allResults, so that is its "you are here" identity.
const props = { cell, conditionIndex: 0, seed: 0, evaluation, allResults, onclose: () => {} };

/** The value printed on a named behavioural-signature row — so a value is checked AGAINST its label. */
function sigValue(container: Element, label: string): string | null | undefined {
	const row = [...container.querySelectorAll('.sig li')].find(
		(li) => li.querySelector('.sig-label')?.textContent === label
	);
	return row?.querySelector('.sig-val')?.textContent?.trim();
}

describe('RunCellCard', () => {
	it('shows THIS run against the CONDITION mean — two distinct numbers, bound to the right source', () => {
		const { container } = render(RunCellCard, props);
		expect(container.textContent).toContain('7.9s'); // this run = returns[0], not the mean
		expect(container.textContent).toContain('8.1s'); // condition mean ± sd
		expect(container.textContent).toContain('0.5s');
		expect(container.textContent).toContain('4 seeds');
	});

	it('binds each behavioural-signature value to its own labelled row, in its own unit', () => {
		const { container } = render(RunCellCard, props);
		// Scoped per row: a swapped field (dodge value under the flee row) would fail here.
		expect(sigValue(container, 'Flee heading')).toBe('40° off'); // fleeAngleErrorDeg
		expect(sigValue(container, 'Dodge rate')).toBe('40%'); // dodgeRate 0.4
		expect(sigValue(container, 'Distance kept')).toBe('70px'); // meanPredDistance
		expect(sigValue(container, 'Bolt response')).toBe('1.4×'); // boltRatio
		expect(sigValue(container, 'Cornering')).toBe('10%'); // cornerTimeShare 0.1
	});

	it('ranks the world best-first among every condition swept', () => {
		const { container } = render(RunCellCard, props);
		// 8.1 beats 6.0 and 6.5 but loses to 9.0 → 2nd of 4. A worst-first bug would read "3 of 4".
		expect(container.querySelector('.strip')?.textContent).toContain('2 of 4');
	});

	it('names the condition by its factor LABEL, not the raw level key', () => {
		const { container } = render(RunCellCard, props);
		expect(container.textContent).toContain('Direction'); // the label for key 'dir'
	});

	it('plots the two distribution strips, ringing "you are here" in each', () => {
		const { container } = render(RunCellCard, { ...props, seed: 2 });
		const strips = container.querySelectorAll('.strip');
		expect(strips).toHaveLength(2);
		// Rank strip: one dot per condition (4), this condition ringed.
		expect(strips[0].querySelectorAll('.dot')).toHaveLength(4);
		expect(strips[0].querySelectorAll('.dot.me')).toHaveLength(1);
		// Seed strip: one dot per seed (4), the clicked run ringed.
		expect(strips[1].querySelectorAll('.dot')).toHaveLength(4);
		expect(strips[1].querySelectorAll('.dot.me')).toHaveLength(1);
	});

	it('says plainly when the condition was not measured — no signature, no invented numbers', () => {
		const { container } = render(RunCellCard, {
			cell,
			conditionIndex: 0,
			seed: 0,
			evaluation: null,
			allResults: [null],
			onclose: () => {}
		});
		expect(container.textContent).toContain('not measured'); // the honest empty state
		expect(container.querySelectorAll('.sig li')).toHaveLength(0); // no fabricated signature rows
		expect(container.querySelectorAll('.strip')).toHaveLength(0); // nothing to place it among
	});

	it('drops the rank strip when there is only one condition (nothing to rank against)', () => {
		const { container } = render(RunCellCard, { ...props, allResults: [evaluation] });
		const strips = container.querySelectorAll('.strip');
		expect(strips).toHaveLength(1); // only the seed spread — no "1 of 1" rank
		expect(container.textContent).not.toContain('of 1');
	});

	it('drops the seed-spread strip when the condition ran a single seed', () => {
		const single: Evaluation = { ...evaluation, n: 1, returns: [8.1] };
		const { container } = render(RunCellCard, {
			...props,
			evaluation: single,
			allResults: [single, other(6.0), other(6.5), other(9.0)]
		});
		// Only the rank strip renders; a lone-seed "spread" would be a single dot saying nothing.
		expect(container.querySelectorAll('.strip')).toHaveLength(1);
	});
});
