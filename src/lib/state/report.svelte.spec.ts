import { describe, it, expect, beforeEach } from 'vitest';
import { report } from './report.svelte';
import { findings, type FindingInput } from './findings.svelte';
import { app } from './app.svelte';

/**
 * The Report is pure derivation over the notebook, and its ONE job that must never slip is the honesty
 * rail: a question reads "answered" only when a real finding backs it. These drive it through the
 * findings store on a generic subject (each test clears the notebook first).
 */

const input = (over: Partial<FindingInput> = {}): FindingInput => ({
	source: 'sweep',
	variant: '',
	title: 'Direction +2.4s',
	detail: 'the strongest factor',
	status: 'ok',
	seeds: 6,
	configHash: 'a3f19c',
	...over
});

const sectionFor = (id: string) => report.sections.find((s) => s.question.id === id)!;

describe('the Report', () => {
	beforeEach(() => {
		findings.clear();
		app.clearSubject();
	});

	it('always has the seven questions, in order', () => {
		expect(report.sections.map((s) => s.question.id)).toEqual([
			'Q1',
			'Q2',
			'Q3',
			'Q4',
			'Q5',
			'Q6',
			'Q7'
		]);
	});

	it('answers nothing on a subject that has never been studied', () => {
		expect(report.hasFindings).toBe(false);
		expect(report.coverage).toEqual({ answered: 0, total: 7 });
		expect(report.sections.every((s) => s.finding === null)).toBe(true);
		expect(report.lead).toBeNull();
		expect(report.method).toBeNull();
	});

	it('marks a question answered ONLY when a finding declares it — a Sweep fills Q2 and Q6, not Q3', () => {
		findings.add(input({ source: 'sweep' })); // ANSWERS.sweep = [Q2, Q6]

		expect(sectionFor('Q2').finding).not.toBeNull();
		expect(sectionFor('Q6').finding).not.toBeNull();
		expect(sectionFor('Q3').finding).toBeNull(); // the Ledger's question is NOT answered by a sweep
		expect(sectionFor('Q3').producer).toBe('The Ledger'); // …and it names who would answer it
		expect(report.coverage.answered).toBe(3); // Q2, Q6, and Q7 (provenance exists once any finding does)
	});

	it('Q7 is provenance: answered as soon as any finding exists, carrying its fingerprint', () => {
		expect(sectionFor('Q7').finding).toBeNull();
		findings.add(input({ configHash: 'a3f19c', seeds: 40 }));
		expect(sectionFor('Q7').finding).not.toBeNull();
		expect(report.method).toEqual({ configHash: 'a3f19c', seeds: 40 });
	});

	it('answers a question in its OWN terms — Q7 the method, Q6 the negatives, not the sweep headline', () => {
		findings.add(
			input({
				source: 'sweep',
				title: 'Direction +2.4s',
				configHash: 'a3f19c',
				seeds: 6,
				evidence: {
					kind: 'effects',
					effects: [
						{ label: 'Direction', delta: 2.4, lo: 1.2, hi: 3.1 }, // a mover
						{ label: 'Distance', delta: 0.1, lo: -0.9, hi: 1.1 } // straddles zero → a negative
					]
				}
			})
		);

		expect(sectionFor('Q2').answer).toBe('Direction +2.4s'); // the headline, for "what moves survival"
		expect(sectionFor('Q6').answer).toContain('Distance'); // the kept negative, not the mover
		expect(sectionFor('Q6').answer).not.toContain('Direction +2.4s');
		expect(sectionFor('Q7').answer).toBe('config a3f19c · 6 seeds'); // the method, not a conclusion
	});

	it('leads with the strongest real claim — priority beats recency, not the newest finding', () => {
		// Add the Ledger verdict FIRST, then the Sweep — so the sweep is the NEWEST but lower priority.
		// If lead were merely "the most recent finding", the sweep would win; it must not.
		findings.add(
			input({ source: 'ledger', variant: 'dir', title: 'Direction pays', status: 'ok' })
		);
		findings.add(input({ source: 'sweep', title: 'Direction +2.4s' }));

		expect(report.lead?.title).toBe('Direction pays'); // the Ledger verdict leads, despite being older
	});

	it('exports the live report as Markdown — the snapshot → formatter wiring, end to end', () => {
		findings.add(
			input({
				source: 'sweep',
				title: 'Direction +2.4s',
				evidence: {
					kind: 'effects',
					effects: [{ label: 'Direction', delta: 2.4, lo: 1.2, hi: 3.1 }]
				}
			})
		);

		const md = report.toMarkdown();
		expect(md).toContain('# Research report —');
		expect(md).toContain('Direction +2.4s'); // the answered question carries its headline
		expect(md).toContain('_Not answered yet — run The Ledger._'); // Q3, still an honest prompt
	});

	it('scopes to the current subject — a finding on another world does not fill this report', () => {
		app.analyze({ ...structuredClone(app.subjectBase('X')), vision: 999 });
		findings.add(input({ title: 'on the subject' }));

		expect(report.coverage.answered).toBeGreaterThan(0); // it shows for its own subject

		app.clearSubject(); // back to the generic world — the subject's finding must not leak in
		expect(report.hasFindings).toBe(false);
		expect(report.coverage.answered).toBe(0);
	});
});
