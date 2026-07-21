import { describe, it, expect } from 'vitest';
import { reportToMarkdown, type ReportSnapshot } from './export';
import { QUESTIONS, type QuestionId } from '../lab/questions';
import type { Evidence } from '../lab/evidence';
import type { Finding } from '../state/findings.svelte';
import type { ReportSection } from '../state/report.svelte';

/**
 * The Markdown export. Two things must hold: it is BYTE-STABLE (the same snapshot always renders the
 * same document — no dates, ids or ordering drift, so a report is a diffable artifact), and it carries
 * the honesty rail through untouched (an unanswered question exports as a "run the test" prompt, never
 * a fabricated answer). The formatter is pure, so these drive it with hand-built snapshots.
 */

function finding(over: Partial<Finding> = {}): Finding {
	return {
		id: 'id',
		key: 'key',
		source: 'sweep',
		questions: [],
		title: 'A title',
		detail: 'a detail',
		status: 'ok',
		seeds: 6,
		configHash: 'a3f19c',
		subjectHash: 'subject',
		recorded: '2020-01-01T00:00:00.000Z',
		...over
	};
}

function section(
	id: QuestionId,
	finding: Finding | null,
	answer: string | null,
	producer: string
): ReportSection {
	return { question: QUESTIONS.find((q) => q.id === id)!, finding, producer, answer };
}

const EFFECTS: Evidence = {
	kind: 'effects',
	effects: [
		{ label: 'Direction', delta: 2.4, lo: 1.2, hi: 3.1 }, // a mover
		{ label: 'Distance', delta: 0.1, lo: -0.9, hi: 1.1 } // straddles zero → a kept negative
	]
};

/** A realistic brief: the Sweep (Q2/Q6), the Ledger (Q3) and the Atlas (Q4) answered; Q1/Q5 waiting on
 *  a trace; Q7 the method. The same shape the on-screen Report shows. */
function studiedSnapshot(): ReportSnapshot {
	const sweep = finding({
		source: 'sweep',
		title: 'Direction +2.4s',
		detail: 'the strongest factor',
		evidence: EFFECTS
	});
	const ledger = finding({
		source: 'ledger',
		title: 'Direction pays',
		detail: 'supported · +2.2s · d 2.1',
		evidence: {
			kind: 'contrast',
			arms: [
				{ label: 'With direction', mean: 5.2, lo: 4.1, hi: 6.3 },
				{ label: 'Blind', mean: 3.0, lo: 2.2, hi: 3.8 }
			]
		}
	});
	const atlas = finding({
		source: 'atlas',
		title: 'Cliff at 1.20×',
		detail: 'survival drops 2.7s across the step',
		evidence: {
			kind: 'landscape',
			axisLabel: 'Predator speed',
			axisKey: 'predSpeed',
			band: [
				{ x: 1.0, survival: 5.4 },
				{ x: 1.2, survival: 4.8 },
				{ x: 1.4, survival: 2.1 }
			],
			cliffX: 1.2
		}
	});
	return {
		subjectName: 'a generic world',
		coverage: { answered: 5, total: 7 },
		leadTitle: 'Direction pays',
		method: { configHash: 'a3f19c', seeds: 40 },
		sections: [
			section('Q1', null, null, 'a behaviour trace'),
			section('Q2', sweep, 'Direction +2.4s', 'The Sweep'),
			section('Q3', ledger, 'Direction pays', 'The Ledger'),
			section('Q4', atlas, 'Cliff at 1.20×', 'The Atlas'),
			section('Q5', null, null, 'a behaviour trace'),
			section('Q6', sweep, 'Distance — no gain', 'The Sweep'),
			section('Q7', sweep, 'config a3f19c · 40 seeds', 'any test')
		]
	};
}

describe('reportToMarkdown', () => {
	it('renders a studied subject as a stable, whole brief', () => {
		expect(reportToMarkdown(studiedSnapshot())).toMatchInlineSnapshot(`
			"# Research report — a generic world

			**Direction pays** — 5 of 7 questions a rigorous study must answer are settled for this subject; the rest are waiting on a test.

			## Answers at a glance

			| # | Question | Answer | Source |
			| --- | --- | --- | --- |
			| Q1 | did it learn | Not tested | — |
			| Q2 | what matters | Direction +2.4s | The Sweep |
			| Q3 | is it real | Direction pays | The Ledger |
			| Q4 | where it holds | Cliff at 1.20× | The Atlas |
			| Q5 | the mechanism | Not tested | — |
			| Q6 | the limits | Distance — no gain | The Sweep |
			| Q7 | reproducible | config a3f19c · 40 seeds | The Sweep |

			## Q1 · Did evolution actually work?

			_Not answered yet — run a behaviour trace._

			## Q2 · What actually moves survival?

			**Direction +2.4s** — the strongest factor

			_Source: The Sweep._

			| Factor | Effect | 95% interval |
			| --- | --- | --- |
			| Direction | +2.4s | +1.2s … +3.1s |
			| Distance | +0.1s | -0.9s … +1.1s |

			## Q3 · Is the winner real, or noise?

			**Direction pays** — supported · +2.2s · d 2.1

			_Source: The Ledger._

			| Arm | Mean survival | 95% interval |
			| --- | --- | --- |
			| With direction | 5.2s | 4.1s … 6.3s |
			| Blind | 3.0s | 2.2s … 3.8s |

			## Q4 · Where does it hold — and break?

			**Cliff at 1.20×** — survival drops 2.7s across the step

			_Source: The Atlas._

			Survival across **Predator speed**, steepest fall-off at 1.20×:

			| Predator speed | Survival |
			| --- | --- |
			| 1.00× | 5.4s |
			| 1.20× | 4.8s |
			| 1.40× | 2.1s |

			## Q5 · How do they do it?

			_Not answered yet — run a behaviour trace._

			## Q6 · What did NOT work?

			**Distance** don't clear zero — kept as real negatives, not hidden. More knobs is not more survival.

			## Q7 · Can anyone re-run it?

			Reproducible: config **a3f19c**, 40 seeds per arm. Seeded runs re-run identical.
			"
		`);
	});

	it('is byte-stable — pure, and free of the dates or ids that would make a report undiffable', () => {
		const md = reportToMarkdown(studiedSnapshot());
		expect(reportToMarkdown(studiedSnapshot())).toBe(md); // idempotent: same snapshot, same bytes
		// And directly: nothing non-deterministic leaked in. Two same-millisecond calls would match even
		// if a timestamp were stamped, so this guards the date-freedom the docstring claims — the fixture
		// carries a `recorded` ISO date the formatter must never surface.
		expect(md).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/); // no ISO timestamp
		expect(md).not.toContain('2020-01-01'); // nor the fixture's recorded date in any form
	});

	it('exports an unanswered question as a prompt, never a fabricated answer (the honesty rail)', () => {
		const md = reportToMarkdown(studiedSnapshot());
		expect(md).toContain('## Q1 · Did evolution actually work?');
		expect(md).toContain('_Not answered yet — run a behaviour trace._');
		// The glance row for the unanswered question reads "Not tested", with no source.
		expect(md).toMatch(/\| Q1 \| did it learn \| Not tested \| — \|/);
	});

	it('traces every answered question to the test that produced it', () => {
		const md = reportToMarkdown(studiedSnapshot());
		expect(md).toContain('_Source: The Sweep._');
		expect(md).toContain('_Source: The Ledger._');
		expect(md).toContain('_Source: The Atlas._');
		expect(md).toMatch(/\| Q2 \| what matters \| Direction \+2\.4s \| The Sweep \|/);
	});

	it('renders each evidence kind as its own table', () => {
		const md = reportToMarkdown(studiedSnapshot());
		expect(md).toContain('| Factor | Effect | 95% interval |'); // effects (Q2)
		expect(md).toContain('| Direction | +2.4s | +1.2s … +3.1s |');
		expect(md).toContain('| Arm | Mean survival | 95% interval |'); // contrast (Q3)
		expect(md).toContain('| With direction | 5.2s | 4.1s … 6.3s |');
		expect(md).toContain('Survival across **Predator speed**'); // landscape (Q4)
	});

	it('keeps the Sweep negatives under Q6 — the factor that could not clear zero', () => {
		const md = reportToMarkdown(studiedSnapshot());
		expect(md).toContain('## Q6 · What did NOT work?');
		expect(md).toContain("**Distance** don't clear zero");
		expect(md).not.toContain("**Direction** don't clear zero"); // the mover is not a negative
	});

	it('states the method that reproduces it under Q7', () => {
		const md = reportToMarkdown(studiedSnapshot());
		expect(md).toContain('## Q7 · Can anyone re-run it?');
		expect(md).toContain('config **a3f19c**, 40 seeds per arm');
	});

	it('summarises a learning curve when a trace has answered Q1', () => {
		const curve: Evidence = { kind: 'curve', curve: [1.2, 2.0, 3.6, 3.4] };
		const snap: ReportSnapshot = {
			subjectName: 'a generic world',
			coverage: { answered: 1, total: 7 },
			leadTitle: 'It learned',
			method: { configHash: 'a3f19c', seeds: 6 },
			sections: QUESTIONS.map((q) =>
				q.id === 'Q1'
					? section(
							'Q1',
							finding({ source: 'trace', title: 'It learned', evidence: curve }),
							'It learned',
							'a behaviour trace'
						)
					: section(q.id, null, null, 'a test')
			)
		};
		expect(reportToMarkdown(snap)).toContain(
			'Learning curve over 4 generations: 1.2s → 3.4s (peak 3.6s).'
		);
	});

	it('says plainly that a subject has not been studied — no invented answers, no method', () => {
		const snap: ReportSnapshot = {
			subjectName: 'a generic world',
			coverage: { answered: 0, total: 7 },
			leadTitle: null,
			method: null,
			sections: QUESTIONS.map((q) => section(q.id, null, null, 'a test'))
		};
		const md = reportToMarkdown(snap);
		expect(md).toContain("a generic world hasn't been studied yet");
		expect(md).toContain('No runs recorded yet');
		expect(md).not.toContain('_Source:'); // nothing is attributed, because nothing was found
		// every glance row is honestly "Not tested"
		expect(md.match(/Not tested/g)?.length).toBe(7);
	});
});
