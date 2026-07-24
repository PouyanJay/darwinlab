import { describe, it, expect } from 'vitest';
import { INSTRUMENTS, readyInstrumentKeys, instrumentMeta, answersOf } from './instruments';
import { ANSWERS } from '../../lab/questions';

/**
 * The instrument list drives the rail nav, the workspace header and the "answers Q…" tags. `answersOf`
 * is the tag's one source — it must agree with the ANSWERS map for the producing instruments and stay
 * empty for the Report (which ASSEMBLES the seven rather than answering any). The Trace is deliberately
 * absent: it retired into the Sweep drill's microscope, so the Sweep wears its questions too.
 */

describe('the console instruments', () => {
	it('lists the four instruments — no Trace — all ready, with the Report last', () => {
		expect(INSTRUMENTS.map((i) => i.key)).toEqual(['sweep', 'ledger', 'atlas', 'report']);
		expect(readyInstrumentKeys).toEqual(['sweep', 'ledger', 'atlas', 'report']);
	});

	it('resolves each key to its metadata, and falls back rather than throwing', () => {
		expect(instrumentMeta('atlas').name).toBe('The Atlas');
		// @ts-expect-error — a stray key must not crash a render; it falls back to the first instrument.
		expect(instrumentMeta('nope')).toBe(INSTRUMENTS[0]);
	});

	it('tags the Sweep with its own questions PLUS the microscope’s — Q1 and Q5 are lit from its drill', () => {
		expect(answersOf('sweep')).toEqual(['Q1', 'Q2', 'Q5', 'Q6']);
	});

	it('tags the other producing instruments with exactly the questions they answer', () => {
		expect(answersOf('ledger')).toEqual(ANSWERS.ledger);
		expect(answersOf('atlas')).toEqual(ANSWERS.atlas);
	});

	it('gives the Report no tag — it assembles the seven, it does not answer one', () => {
		expect(answersOf('report')).toEqual([]);
	});
});
