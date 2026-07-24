import { describe, it, expect } from 'vitest';
import { composeAbstract, detectTensions } from './compose';
import type { ReportSection } from '../state/report.svelte';
import type { Finding } from '../state/findings.svelte';
import type { Evidence } from '../lab/evidence';
import { QUESTIONS, type QuestionId } from '../lab/questions';

/**
 * The abstract and the tensions check are where the Report starts writing SENTENCES — so the honesty
 * rail is most at risk here, and these tests guard it: a clause appears ONLY for a question a finding
 * answers, every number is read from the evidence, and a tension is flagged ONLY when the data really
 * conflicts. Pure functions over hand-built sections; no store, no live notebook.
 */

const finding = (over: Partial<Finding>): Finding => ({
	id: 'id',
	key: 'k',
	source: 'sweep',
	questions: [],
	title: 'a finding',
	detail: 'detail',
	status: 'ok',
	seeds: 6,
	configHash: 'cfg',
	subjectHash: 'subj',
	recorded: '2026-01-01T00:00:00.000Z',
	...over
});

/** Build the seven sections, filling only the ones the test answers (with an optional evidence). */
function sectionsWith(answers: Partial<Record<QuestionId, Evidence | 'text'>>): ReportSection[] {
	return QUESTIONS.map((question) => {
		const answer = answers[question.id];
		return {
			question,
			producer: 'The Sweep',
			answer: answer ? 'answered' : null,
			finding: answer
				? finding({
						evidence: answer === 'text' ? undefined : answer,
						title: `${question.id} title`
					})
				: null
		};
	});
}

const EFFECTS: Evidence = {
	kind: 'effects',
	effects: [
		{ label: 'Predator speed', delta: -2.8, lo: -3.5, hi: -2.1 },
		{ label: 'Direction', delta: 1.9, lo: 1.2, hi: 2.6 },
		{ label: 'Distance', delta: 0.2, lo: -0.5, hi: 0.9 } // straddles zero → a kept negative
	]
};
const CURVE: Evidence = { kind: 'curve', curve: [0.1, 0.3, 0.55, 0.62] };
const LANDSCAPE_CLIFF: Evidence = {
	kind: 'landscape',
	axisLabel: 'Predator speed',
	axisKey: 'predSpeed',
	band: [
		{ x: 0.6, survival: 6 },
		{ x: 1.0, survival: 2 }
	],
	cliffX: 1.0
};
const LANDSCAPE_FLAT: Evidence = { ...LANDSCAPE_CLIFF, cliffX: undefined };

describe('composeAbstract', () => {
	it('is empty before anything is studied — no sentences without findings', () => {
		expect(composeAbstract(sectionsWith({}))).toEqual([]);
	});

	it('reads the dominant mover from the Q2 effects, and cites Q2', () => {
		const clauses = composeAbstract(sectionsWith({ Q2: EFFECTS }));
		const q2 = clauses.find((c) => c.questionId === 'Q2');
		expect(q2?.text).toContain('predator speed'); // the strongest |effect|, not Direction
		expect(q2?.text).toContain('2.8s'); // the real number, formatted from the evidence
	});

	it('states the kept negatives from Q6, naming the factor that straddles zero', () => {
		const clauses = composeAbstract(sectionsWith({ Q2: EFFECTS, Q6: EFFECTS }));
		const q6 = clauses.find((c) => c.questionId === 'Q6');
		expect(q6?.text).toContain('Distance'); // the flat effect, kept as a negative
	});

	it('reads the final survival off the Q1 learning curve', () => {
		const clauses = composeAbstract(sectionsWith({ Q2: EFFECTS, Q1: CURVE }));
		const q1 = clauses.find((c) => c.questionId === 'Q1');
		expect(q1?.text).toContain('62%'); // curve.at(-1) as a percent
		expect(q1?.text).toContain('4 generations'); // curve.length
	});

	it('closes on the FIRST unanswered content question — the honest gap, cited to nothing', () => {
		// Q1, Q2 answered; Q3 is the first gap.
		const clauses = composeAbstract(sectionsWith({ Q1: CURVE, Q2: EFFECTS }));
		const gap = clauses.find((c) => c.gap);
		expect(gap).toBeTruthy();
		expect(gap?.questionId).toBeNull(); // a gap cites no finding
		expect(gap?.text).toContain('is it real'); // Q3's short — the first unanswered content question
	});

	it('emits NO gap clause when every content question is settled', () => {
		const full = sectionsWith({
			Q1: CURVE,
			Q2: EFFECTS,
			Q3: 'text',
			Q4: LANDSCAPE_CLIFF,
			Q5: 'text',
			Q6: EFFECTS
		});
		expect(composeAbstract(full).some((c) => c.gap)).toBe(false);
	});

	it('NEVER references an unanswered question — a Q4 clause needs a Q4 finding', () => {
		// Only Q2 answered: the abstract must not speak about the landscape (Q4) it does not have.
		const clauses = composeAbstract(sectionsWith({ Q2: EFFECTS }));
		expect(clauses.some((c) => c.questionId === 'Q4')).toBe(false);
	});
});

describe('detectTensions', () => {
	it('flags the bounded-effect tension when a strong mover meets a landscape cliff', () => {
		const tensions = detectTensions(sectionsWith({ Q2: EFFECTS, Q4: LANDSCAPE_CLIFF }));
		expect(tensions).toHaveLength(1);
		expect(tensions[0].between.map((b) => b.questionId)).toEqual(['Q2', 'Q4']);
		expect(tensions[0].title).toContain('Predator speed'); // the dominant mover, named
	});

	it('flags NOTHING when the landscape has no cliff — no cliff, no conflict', () => {
		expect(detectTensions(sectionsWith({ Q2: EFFECTS, Q4: LANDSCAPE_FLAT }))).toEqual([]);
	});

	it('flags NOTHING when only one side exists — a tension needs both findings', () => {
		expect(detectTensions(sectionsWith({ Q2: EFFECTS }))).toEqual([]);
		expect(detectTensions(sectionsWith({ Q4: LANDSCAPE_CLIFF }))).toEqual([]);
	});
});
