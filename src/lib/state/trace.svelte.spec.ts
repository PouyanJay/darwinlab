import { describe, it, expect } from 'vitest';
import { trace, traceFindings, traceKey } from './trace.svelte';
import { findings } from './findings.svelte';
import { newWorldConfig } from '$lib/engine';
import type { TraceStudy } from '../harness/traceStudy';
import type { BoutTrace } from '../harness/trace';
import type { BehaviorStats } from '../harness/behavior';

/**
 * The microscope's report mapping. A study answers TWO questions with two different graphs, so it must
 * become TWO findings — the learning curve settling Q1, the mechanism settling Q5 — each declaring its
 * own single question, not the source's whole [Q1, Q5] set (which would make the Report draw the wrong
 * graph for one of them). The variants carry the RECIPE key, so each traced cell files its own pair and
 * one cell's "in report" state can never borrow another's. This drives the pure mapping with a
 * hand-built study, no live evolve.
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

/** A bout where 5 of 8 evolved fish survived; the numbers below are what the finding titles read off. */
const bout = (survivors: number): BoutTrace => ({
	bw: 800,
	bh: 500,
	seconds: 10,
	pred: [],
	fish: Array.from({ length: 8 }, (_, i) => ({ path: [], life: 10, died: i >= survivors }))
});

const study = (): TraceStudy => ({
	episodes: 25,
	curve: [0.1, 0.3, 0.55, 0.62],
	evolved: { trace: bout(5), behavior: behavior({ fleeAngleErrorDeg: 25 }) },
	control: { trace: bout(0), behavior: behavior({ fleeAngleErrorDeg: 90 }) }
});

describe('traceFindings', () => {
	it('makes exactly two findings — the curve and the mechanism — keyed to their recipe', () => {
		const findings = traceFindings({
			study: study(),
			hash: 'cfg123',
			key: 'k1',
			label: 'Condition 3'
		});
		expect(findings).toHaveLength(2);
		expect(findings.map((f) => f.variant)).toEqual(['curve-k1', 'mechanism-k1']);
	});

	it('the curve finding settles ONLY Q1 and carries the learning curve', () => {
		const curve = traceFindings({
			study: study(),
			hash: 'cfg123',
			key: 'k1',
			label: 'Condition 3'
		})[0];
		expect(curve.questions).toEqual(['Q1']); // not the source's [Q1, Q5] — this one is the curve
		expect(curve.evidence).toEqual({ kind: 'curve', curve: [0.1, 0.3, 0.55, 0.62] });
		expect(curve.title).toContain('62%'); // the final survival fraction, as a percent
	});

	it('the mechanism finding settles ONLY Q5 and carries the evolved-vs-control behaviour', () => {
		const mechanism = traceFindings({
			study: study(),
			hash: 'cfg123',
			key: 'k1',
			label: 'Condition 3'
		})[1];
		expect(mechanism.questions).toEqual(['Q5']);
		expect(mechanism.evidence?.kind).toBe('behavior');
		expect(mechanism.title).toContain('5/8'); // the survivors it reports
	});

	it('names the traced cell in both findings — the drill is where this study came from', () => {
		const findings = traceFindings({
			study: study(),
			hash: 'cfg123',
			key: 'k1',
			label: 'Condition 3'
		});
		expect(findings.every((f) => f.detail.includes('Condition 3'))).toBe(true);
	});

	it('stamps both findings with the config that reproduces them', () => {
		const findings = traceFindings({
			study: study(),
			hash: 'abc999',
			key: 'k1',
			label: 'Condition 3'
		});
		expect(findings.every((f) => f.configHash === 'abc999')).toBe(true);
	});
});

describe('traceKey', () => {
	it('is the RECIPE’s identity — same config and budget agree, regardless of grid position', () => {
		const cfg = newWorldConfig('cell', '#123456');
		expect(traceKey(cfg, 25)).toBe(traceKey(structuredClone(cfg), 25));
	});

	it('splits on budget — the same config trained longer is a different study', () => {
		const cfg = newWorldConfig('cell', '#123456');
		expect(traceKey(cfg, 25)).not.toBe(traceKey(cfg, 40));
	});

	it('splits on config — a re-run sweep re-using condition numbers cannot collide', () => {
		const a = newWorldConfig('cell', '#123456');
		const b = { ...a, preds: a.preds + 1 };
		expect(traceKey(a, 25)).not.toBe(traceKey(b, 25));
	});
});

describe('the microscope store', () => {
	// A REAL two-generation evolve, not a stub — the store's whole job is delivering a live study to
	// the right recipe and nobody else, and only a run that actually happened can prove the wiring.
	// No afterEach cleanup on purpose: the store is a singleton with one #done slot each test
	// overwrites for itself, and the findings it files carry collision-free recipe-hash variants.
	it('lands the study on ITS recipe key — a different budget or cell can never wear it', async () => {
		const cfg = newWorldConfig('microscope-spec', '#123456');
		const episodes = 2;
		await trace.run({ cfg, episodes, label: 'Condition 1' });

		const key = traceKey(cfg, episodes);
		expect(trace.resultFor(key)).not.toBeNull(); // the study landed for its own recipe…
		expect(trace.resultFor(key)?.episodes).toBe(episodes); // …trained for the INHERITED budget
		expect(trace.resultFor(traceKey(cfg, episodes + 1))).toBeNull(); // …not a different budget
		expect(trace.runningFor(key)).toBe(false); // and the busy flag cleared
	}, 30_000);

	it('files the frozen study as its recipe-keyed pair of findings', async () => {
		const cfg = newWorldConfig('microscope-report-spec', '#123456');
		await trace.run({ cfg, episodes: 2, label: 'Condition 7' });

		const key = traceKey(cfg, 2);
		expect(trace.inReport(key)).toBe(false); // the state we claim to create starts absent
		trace.addToReport();
		expect(trace.inReport(key)).toBe(true);
		expect(findings.has('trace', `curve-${key}`)).toBe(true);
		expect(findings.has('trace', `mechanism-${key}`)).toBe(true);
	}, 30_000);

	it('holds another recipe’s door while a study runs, and a cancel clears it without a result', async () => {
		const cfg = newWorldConfig('microscope-cancel-spec', '#123456');
		// 50 generations — long enough that the evolve MUST still be in flight when we look. run()
		// marks busy synchronously (before its first await), so these reads race nothing.
		const running = trace.run({ cfg, episodes: 50, label: 'Condition 9' });
		const key = traceKey(cfg, 50);

		expect(trace.runningFor(key)).toBe(true); // this recipe is the one measuring…
		expect(trace.busyElsewhere(key)).toBe(false); // …so its own card shows progress, not a wait
		expect(trace.busyElsewhere(traceKey(cfg, 51))).toBe(true); // any other recipe's door waits

		trace.cancel();
		await running;
		expect(trace.runningFor(key)).toBe(false); // the busy flag cleared…
		expect(trace.busyElsewhere(traceKey(cfg, 51))).toBe(false); // …for every card
		expect(trace.resultFor(key)).toBeNull(); // a cancelled study never lands
	}, 30_000);

	it('prices a trace as the evolve plus its two frozen bouts, at the calibrated rate', () => {
		// Seed the same persisted rate loadSimRate reads (the sweep's calibration key), so the
		// expected number is exact — a regex on the button could never catch a formula regression.
		localStorage.setItem('darwinlab:sweep-sim-rate', '100');
		try {
			expect(trace.estimateSeconds(8, 10)).toBe(1); // (8 gens + 2 bouts) × 10 sim-s ÷ 100 sim-s/s
		} finally {
			localStorage.removeItem('darwinlab:sweep-sim-rate');
		}
	});
});
