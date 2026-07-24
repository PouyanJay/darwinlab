/**
 * The seven questions a rigorous study must answer — the fixed scientific framework the Research
 * console is organised around. Each finding an instrument produces answers one or more of them, and
 * the Report (a later phase) assembles the answers into a brief, each traced to the test it came from.
 *
 * This module is intentionally small: the QUESTIONS themselves and the mapping from a producing SOURCE
 * to the questions it answers. The Report's composition logic builds on top of it later.
 */

export type QuestionId = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5' | 'Q6' | 'Q7';

/** The instruments the Research console navigates between — the neutral key type, so both the state
 *  store (which owns which is active) and the components (which render them) share one definition. The
 *  Trace is deliberately absent: it retired into the Sweep drill's microscope. */
export type ResearchInstrument = 'sweep' | 'ledger' | 'atlas' | 'report';

export interface Question {
	id: QuestionId;
	/** The question, as a rigorous study would phrase it. */
	title: string;
	/** A few words for a tag or pill ("what matters"). */
	short: string;
}

/** The fixed seven, in order — the skeleton every discovery in this lab fills in. */
export const QUESTIONS: Question[] = [
	{ id: 'Q1', title: 'Did evolution actually work?', short: 'did it learn' },
	{ id: 'Q2', title: 'What actually moves survival?', short: 'what matters' },
	{ id: 'Q3', title: 'Is the winner real, or noise?', short: 'is it real' },
	{ id: 'Q4', title: 'Where does it hold — and break?', short: 'where it holds' },
	{ id: 'Q5', title: 'How do they do it?', short: 'the mechanism' },
	{ id: 'Q6', title: 'What did NOT work?', short: 'the limits' },
	{ id: 'Q7', title: 'Can anyone re-run it?', short: 'reproducible' }
];

/** A source that can produce a finding — an instrument, or a behaviour trace (lands in a later phase). */
export type FindingSource = 'sweep' | 'ledger' | 'atlas' | 'trace';

/**
 * Which questions each source answers — the fixed mapping the Report groups findings by. The Sweep
 * settles what matters AND what does not (its kept negatives); the Ledger settles whether a winner is
 * real; the Atlas settles where a result holds; a trace settles that it learned and how.
 */
export const ANSWERS: Record<FindingSource, QuestionId[]> = {
	sweep: ['Q2', 'Q6'],
	ledger: ['Q3'],
	atlas: ['Q4'],
	trace: ['Q1', 'Q5']
};

/** How each source is named in the Report — the "← source" pill on an answered question. */
export const SOURCE_LABEL: Record<FindingSource, string> = {
	sweep: 'The Sweep',
	ledger: 'The Ledger',
	atlas: 'The Atlas',
	trace: 'Behaviour trace'
};

/**
 * The single source that answers each question — the inverse of `ANSWERS`, derived from it so the two
 * can never drift. Every content question maps to exactly one source (Q2/Q6→sweep, Q3→ledger, Q4→atlas,
 * Q1/Q5→trace); Q7 is provenance and has none. The Report's drill-through reads this to send an
 * unanswered question to the instrument that WOULD settle it — typed, not matched off a display string.
 */
export const QUESTION_SOURCE: Partial<Record<QuestionId, FindingSource>> = Object.fromEntries(
	Object.entries(ANSWERS).flatMap(([source, ids]) => ids.map((id) => [id, source as FindingSource]))
);

/** The console instrument a finding's source drills back to — a trace has no rail tab of its own, so
 *  it lands on the Sweep, whose drill microscope produced it. One place, so the Report's source links
 *  and its "run the test" prompts navigate the same way. */
export const SOURCE_INSTRUMENT: Record<FindingSource, ResearchInstrument> = {
	sweep: 'sweep',
	ledger: 'ledger',
	atlas: 'atlas',
	trace: 'sweep'
};
