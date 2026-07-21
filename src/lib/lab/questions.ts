/**
 * The seven questions a rigorous study must answer — the fixed scientific framework the Research
 * console is organised around. Each finding an instrument produces answers one or more of them, and
 * the Report (a later phase) assembles the answers into a brief, each traced to the test it came from.
 *
 * This module is intentionally small: the QUESTIONS themselves and the mapping from a producing SOURCE
 * to the questions it answers. The Report's composition logic builds on top of it later.
 */

export type QuestionId = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5' | 'Q6' | 'Q7';

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
