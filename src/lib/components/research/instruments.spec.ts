import { describe, it, expect } from 'vitest';
import { INSTRUMENTS, readyInstrumentKeys, instrumentMeta, answersOf } from './instruments';
import { ANSWERS } from '../../lab/questions';

/**
 * The instrument list drives the rail nav, the workspace header and the "answers Q…" tags. `answersOf`
 * is the tag's one source — it must agree with the ANSWERS map for the three producing instruments and
 * stay empty for the Report (which ASSEMBLES the seven rather than answering any).
 */

describe('the console instruments', () => {
	it('lists the four instruments, all ready', () => {
		expect(INSTRUMENTS.map((i) => i.key)).toEqual(['sweep', 'ledger', 'atlas', 'report']);
		expect(readyInstrumentKeys).toEqual(['sweep', 'ledger', 'atlas', 'report']);
	});

	it('resolves each key to its metadata, and falls back rather than throwing', () => {
		expect(instrumentMeta('atlas').name).toBe('The Atlas');
		// @ts-expect-error — a stray key must not crash a render; it falls back to the first instrument.
		expect(instrumentMeta('nope')).toBe(INSTRUMENTS[0]);
	});

	it('tags each producing instrument with exactly the questions it answers', () => {
		expect(answersOf('sweep')).toEqual(ANSWERS.sweep);
		expect(answersOf('ledger')).toEqual(ANSWERS.ledger);
		expect(answersOf('atlas')).toEqual(ANSWERS.atlas);
	});

	it('gives the Report no tag — it assembles the seven, it does not answer one', () => {
		expect(answersOf('report')).toEqual([]);
	});
});
