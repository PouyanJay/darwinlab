import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import SweepDrillCard from './SweepDrillCard.svelte';
import { findings } from '$lib/state';
import { newWorldConfig } from '$lib/engine';
import type { SweepCell } from '$lib/lab/sweep';
import type { Evaluation } from '$lib/lab/evaluator';
import type { BehaviorStats } from '$lib/harness/behavior';

/**
 * The sidebar drill card answers its questions from data the sweep already measured, so they are
 * pinned here with fixed data — each value asserted against ITS OWN row, so a swapped field or an
 * inverted rank fails loudly rather than passing because the string appears somewhere. (Ported
 * from RunCellCard's spec when the drill moved into the sidebar; extended with the fingerprint's
 * ticks, the champion states and the convergence badge.)
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
/** Four conditions, ASYMMETRIC around 8.1 (two below, one above) so an inverted rank reads
 *  differently: best-first → 2nd of 4; worst-first → 3rd of 4. */
const allResults: (Evaluation | null)[] = [evaluation, other(6.0), other(6.5), other(9.0)];

const props = {
	cell,
	conditionIndex: 0,
	seed: 0,
	evaluation,
	allResults,
	championScored: false,
	// the microscope inherits the run's frozen budget — the card prices its door from these
	episodes: 30,
	genDuration: 10,
	onclose: () => {}
};

describe('SweepDrillCard', () => {
	/** Surgical, not clear(): sibling spec files share the persisted notebook in this worker. */
	const removeCellFinding = (variantKey: string) => {
		for (const finding of [...findings.entries]) {
			if (finding.key.includes(variantKey)) findings.remove(finding.id);
		}
	};

	beforeEach(() => removeCellFinding('cell-0'));

	it('shows THIS run against the CELL mean — two distinct numbers, bound to the right source', () => {
		const { container } = render(SweepDrillCard, props);
		const rows = [...container.querySelectorAll('.row')].map((r) => r.textContent ?? '');
		expect(rows.find((r) => r.includes('this run'))).toContain('7.9s'); // seed 0's own value
		expect(rows.find((r) => r.includes('cell mean'))).toContain('8.1s'); // the aggregate
	});

	it('ranks the world best-first among every condition swept', () => {
		const { container } = render(SweepDrillCard, props);
		const rank = [...container.querySelectorAll('.row')].find((r) =>
			r.textContent?.includes('rank among')
		);
		expect(rank?.textContent).toContain('2nd'); // one condition (9.0) beats 8.1 → second of four
		expect(rank?.textContent).toContain('4 cells');
	});

	it('leads the recipe with the swept level LOUD, pinned knobs quiet, from the cell’s cfg', () => {
		const { container } = render(SweepDrillCard, props);
		const hot = [...container.querySelectorAll('.chip.hot')].map((c) => c.textContent);
		expect(hot).toEqual(['Direction on']); // the one swept level is the loud identity
		const quiet = [...container.querySelectorAll('.chip:not(.hot)')].map((c) => c.textContent);
		expect(quiet).toContain('20 prey'); // the cell cfg's own count, not a percent
	});

	it('binds each fingerprint value to its own labelled row, with the sweep-average ticked', () => {
		const { container } = render(SweepDrillCard, props);
		const row = [...container.querySelectorAll('.fprow')].find((r) =>
			r.textContent?.includes('bolts when seen')
		);
		expect(row?.textContent).toContain('1.4×'); // this cell's own bolt ratio, in its own row
		expect(row?.querySelector('.fpbar u')).not.toBeNull(); // the average tick exists
	});

	it('rings "you are here" on this run’s own seed dot', () => {
		const { container } = render(SweepDrillCard, props);
		expect(container.querySelectorAll('.dot')).toHaveLength(4); // one per seed…
		expect(container.querySelectorAll('.dot.me')).toHaveLength(1); // …exactly one ringed
	});

	it('offers the champion hint when Live scoring did not run, the paired numbers when it did', () => {
		const off = render(SweepDrillCard, props);
		expect(off.container.textContent).toContain('enable Live scoring');
		off.unmount();

		const on = render(SweepDrillCard, {
			...props,
			championScored: true,
			evaluation: { ...evaluation, championReturns: [9.0, 9.4] } // champion mean 9.2
		});
		const row = [...on.container.querySelectorAll('.row')].find((r) =>
			r.textContent?.includes('champion clones')
		);
		expect(row?.textContent).toContain('9.2s');
		// the delta is vs the CELL MEAN (8.1) — champion and population are both means over the
		// same seeds and arenas; comparing the champion to one seed's run would mix baselines
		expect(row?.textContent).toContain('+1.1');
	});

	it('badges convergence from this cell’s own curve', () => {
		const climbing = Array.from({ length: 24 }, (_, i) => 0.2 + i * 0.02);
		const { container } = render(SweepDrillCard, {
			...props,
			evaluation: { ...evaluation, curve: climbing }
		});
		expect(container.textContent).toContain('under-trained');

		const flatCase = render(SweepDrillCard, {
			...props,
			evaluation: { ...evaluation, curve: Array.from({ length: 24 }, () => 0.5) }
		});
		expect(flatCase.container.textContent).toContain('converged ✓');
	});

	it('the notebook door files the CELL as a finding once, then says so', async () => {
		render(SweepDrillCard, {
			...props,
			evaluation: { ...evaluation, curve: [0.2, 0.5, 0.5] }
		});
		expect(findings.has('sweep', 'cell-0')).toBe(false); // the state we claim to create starts absent

		await page.getByRole('button', { name: 'Send cell finding to notebook' }).click();
		expect(findings.has('sweep', 'cell-0')).toBe(true);
		const filed = findings.entries.find((f) => f.key.includes('cell-0'));
		expect(filed?.title).toContain('Condition 1'); // the cell's identity, not the sweep's headline
		expect(filed?.detail).toContain('Direction on'); // the swept recipe as the description
		await expect.element(page.getByRole('button', { name: 'In the report' })).toBeDisabled();
	});

	it('says plainly when the condition was not measured — no invented numbers', () => {
		const { container } = render(SweepDrillCard, { ...props, evaluation: null });
		expect(container.textContent).toContain('nothing to report');
		expect(container.querySelectorAll('.fprow')).toHaveLength(0);
	});

	it('offers the microscope on a measured cell — the trace door priced by the frozen budget', () => {
		const { container } = render(SweepDrillCard, props);
		const microscope = container.querySelector('[data-testid="drill-microscope"]');
		expect(microscope?.textContent).toContain('The microscope');
		expect(microscope?.textContent).toContain('Q1'); // the questions a trace settles…
		expect(microscope?.textContent).toContain('Q5'); // …worn right on the section
		// the door names the study and carries a wall-clock estimate — a number, not a promise
		expect(microscope?.textContent).toMatch(/Trace this world · ≈ \d+ s/);
	});

	it('offers NO microscope on an unmeasured cell — there is no recipe worth re-running', () => {
		const { container } = render(SweepDrillCard, { ...props, evaluation: null });
		expect(container.querySelector('[data-testid="drill-microscope"]')).toBeNull();
	});
});
