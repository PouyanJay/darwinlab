import { describe, it, expect } from 'vitest';
import { traceFindings } from './trace.svelte';
import type { TraceStudy } from '../harness/traceStudy';
import type { BoutTrace } from '../harness/trace';
import type { BehaviorStats } from '../harness/behavior';

/**
 * The trace store's report mapping. A study answers TWO questions with two different graphs, so it must
 * become TWO findings — the learning curve settling Q1, the mechanism settling Q5 — each declaring its
 * own single question, not the source's whole [Q1, Q5] set (which would make the Report draw the wrong
 * graph for one of them). This drives the pure mapping with a hand-built study, no live evolve.
 */

const behavior = (over: Partial<BehaviorStats> = {}): BehaviorStats => ({
	boltRatio: 1,
	fleeAngleErrorDeg: 30,
	dodgeRate: 0.4,
	cornerDeathShare: 0,
	cornerTimeShare: 0.1,
	meanPredDistance: 70,
	meanLife: 6,
	aliveAtEnd: 4,
	lunges: 3,
	deaths: 4,
	...over
});

/** A trace where 5 of 8 evolved fish survived; the numbers below are what the finding titles read off. */
const trace = (survivors: number): BoutTrace => ({
	bw: 800,
	bh: 500,
	seconds: 10,
	pred: [],
	fish: Array.from({ length: 8 }, (_, i) => ({ path: [], life: 10, died: i >= survivors }))
});

const study = (): TraceStudy => ({
	episodes: 40,
	curve: [0.1, 0.3, 0.55, 0.62],
	evolved: { trace: trace(5), behavior: behavior({ fleeAngleErrorDeg: 25 }) },
	control: { trace: trace(0), behavior: behavior({ fleeAngleErrorDeg: 90 }) }
});

describe('traceFindings', () => {
	it('makes exactly two findings — the curve and the mechanism', () => {
		const findings = traceFindings(study(), 'cfg123');
		expect(findings).toHaveLength(2);
		expect(findings.map((f) => f.variant)).toEqual(['curve', 'mechanism']);
	});

	it('the curve finding settles ONLY Q1 and carries the learning curve', () => {
		const curve = traceFindings(study(), 'cfg123')[0];
		expect(curve.questions).toEqual(['Q1']); // not the source's [Q1, Q5] — this one is the curve
		expect(curve.evidence).toEqual({ kind: 'curve', curve: [0.1, 0.3, 0.55, 0.62] });
		expect(curve.title).toContain('62%'); // the final survival fraction, as a percent
	});

	it('the mechanism finding settles ONLY Q5 and carries the evolved-vs-control behaviour', () => {
		const mechanism = traceFindings(study(), 'cfg123')[1];
		expect(mechanism.questions).toEqual(['Q5']);
		expect(mechanism.evidence?.kind).toBe('behavior');
		expect(mechanism.title).toContain('5/8'); // the survivors it reports
	});

	it('stamps both findings with the config that reproduces them', () => {
		const findings = traceFindings(study(), 'abc999');
		expect(findings.every((f) => f.configHash === 'abc999')).toBe(true);
	});
});
