/**
 * The instruments of the Research console — the fixed list the rail nav, the workspace header and the
 * right sidebar all read, so they can never disagree about what exists or what is active.
 *
 * The Trace is deliberately NOT here: it retired as an instrument when its study folded into the
 * Sweep drill's microscope (the trace-in-drill mock is the contract). Its findings still exist —
 * `FindingSource` keeps 'trace' and the Report consumes them unchanged.
 */

import { ANSWERS, type QuestionId } from '../../lab/questions';

export type Instrument = 'sweep' | 'ledger' | 'atlas' | 'report';

export interface InstrumentMeta {
	key: Instrument;
	/** Display name, e.g. "The Sweep". */
	name: string;
	/** The one-line "input → output" the mock puts under each name. */
	blurb: string;
	/** False while the instrument's view is not built yet — the nav shows it, disabled. */
	isReady: boolean;
}

export const INSTRUMENTS: InstrumentMeta[] = [
	{ key: 'sweep', name: 'The Sweep', blurb: 'factorial → effects', isReady: true },
	{ key: 'ledger', name: 'The Ledger', blurb: 'claim → verdict', isReady: true },
	{ key: 'atlas', name: 'The Atlas', blurb: 'two axes → landscape', isReady: true },
	{ key: 'report', name: 'The Report', blurb: 'findings → a brief', isReady: true }
];

/** The instruments a user can actually select — what the rail's roving-tabindex cycles through. */
export const readyInstrumentKeys: Instrument[] = INSTRUMENTS.filter((i) => i.isReady).map(
	(i) => i.key
);

/** The metadata for one instrument key — the list is small, so a find is fine. */
export function instrumentMeta(key: Instrument): InstrumentMeta {
	return INSTRUMENTS.find((instrument) => instrument.key === key) ?? INSTRUMENTS[0];
}

/**
 * Which of the seven questions an instrument settles — the "answers Q…" tag the rail and the workspace
 * header wear, from the one `ANSWERS` map so a tag can never drift from what the Report actually credits
 * that instrument for. The Report ASSEMBLES the seven rather than answering any, so it carries no tag.
 * The Sweep also wears the trace's questions: its drill carries the microscope, so Q1 and Q5 are lit
 * from inside it — the tag says so, while the Report keeps crediting those findings to their own source.
 */
export function answersOf(key: Instrument): QuestionId[] {
	if (key === 'report') return [];
	if (key === 'sweep') return [...ANSWERS.sweep, ...ANSWERS.trace].sort();
	return ANSWERS[key];
}
