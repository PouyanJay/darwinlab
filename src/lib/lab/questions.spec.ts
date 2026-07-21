import { describe, it, expect } from 'vitest';
import { QUESTIONS, ANSWERS, type QuestionId, type FindingSource } from './questions';

/**
 * The seven-question model is pure data the Report will compose findings by, so a swapped or dropped
 * id here is a silent bug the Report would inherit. These lock the mapping down.
 */

describe('the seven-question model', () => {
	it('names exactly the seven questions, in order, with unique ids', () => {
		expect(QUESTIONS.map((q) => q.id)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7']);
	});

	it('gives every question a title and a short label', () => {
		for (const question of QUESTIONS) {
			expect(question.title.length).toBeGreaterThan(0);
			expect(question.short.length).toBeGreaterThan(0);
		}
	});

	// Each source answers a fixed set — the exact map the "add to report" buttons tag findings by.
	const EXPECTED: Record<FindingSource, QuestionId[]> = {
		sweep: ['Q2', 'Q6'],
		ledger: ['Q3'],
		atlas: ['Q4'],
		trace: ['Q1', 'Q5']
	};

	it.each(Object.entries(EXPECTED))('maps %s to the questions it answers', (source, expected) => {
		expect(ANSWERS[source as FindingSource]).toEqual(expected);
	});

	it('only ever answers real question ids', () => {
		const ids = new Set(QUESTIONS.map((q) => q.id));
		for (const answered of Object.values(ANSWERS)) {
			for (const id of answered) expect(ids.has(id)).toBe(true);
		}
	});
});
