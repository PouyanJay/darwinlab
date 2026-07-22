/**
 * The Trace store — the console's second discovery type, "did they learn, and how?".
 *
 * It owns one behaviour-trace study at a time: it runs `runTraceStudy` (a deliberate, time-sliced
 * action — NOT a worker batch, so it carries its own running/progress and AbortController, not the
 * shared `research` lifecycle the Sweep/Ledger/Atlas use), holds the result, and turns it into report
 * findings. The result is DELIBERATELY not persisted: the learning curve and the behaviour signatures
 * are small and go into the notebook via "add to report", but the full trajectories are too large to
 * carry across a reload — they live here for the live Trajectories graph and are re-run on demand.
 *
 * "Add to report" writes TWO findings, because a trace answers two different questions with two
 * different graphs: the learning curve settles Q1, the evolved-vs-control mechanism settles Q5.
 */

import {
	runTraceStudy,
	behaviorMetrics,
	traceSummary,
	type TraceStudy
} from '../harness/traceStudy';
import { app } from './app.svelte';
import { findings, type FindingInput } from './findings.svelte';
import { configHash } from '../lab/run';
import { formatSurvivalPct } from '../format';

/** Generations a trace evolves its population for — enough to climb and converge on this predator. */
export const TRACE_EPISODES = 40;

/** The two dedupe variants a trace contributes — one place, so `add` and `has` can never mistype them. */
const CURVE = 'curve';
const MECHANISM = 'mechanism';

/**
 * A study's two report findings — the learning curve (Q1) and the evolved-vs-control mechanism (Q5).
 * TWO findings, not one: they answer different questions with different evidence, so each declares its
 * own single question via the notebook's `questions` override rather than sharing the source's whole
 * `[Q1, Q5]` set. Pure, so the mapping is testable without a live evolve.
 */
export function traceFindings(study: TraceStudy, hash: string): FindingInput[] {
	const { finalSurvival, evolvedSurvivors, total } = traceSummary(study);

	return [
		{
			source: 'trace',
			variant: CURVE,
			questions: ['Q1'],
			title: `Learned to ${formatSurvivalPct(finalSurvival)} survival`,
			detail: `climbed over ${study.episodes} generations of selection`,
			status: 'ok',
			seeds: 1,
			configHash: hash,
			evidence: { kind: 'curve', curve: study.curve }
		},
		{
			source: 'trace',
			variant: MECHANISM,
			questions: ['Q5'],
			title: `${evolvedSurvivors}/${total} survive where random brains don't`,
			detail: 'evolved fish flee accurately and keep their distance from the predator',
			status: 'ok',
			seeds: 1,
			configHash: hash,
			evidence: {
				kind: 'behavior',
				metrics: behaviorMetrics(study.evolved.behavior, study.control.behavior)
			}
		}
	];
}

class TraceStore {
	#result = $state.raw<TraceStudy | null>(null);
	#running = $state(false);
	#progress = $state(0);
	#controller: AbortController | null = null;

	/** The last completed study, or null — the workspace reads this to draw the curve, bars and paths. */
	get result(): TraceStudy | null {
		return this.#result;
	}

	get running(): boolean {
		return this.#running;
	}

	/** 0–1 while a study runs — the evolve loop is the bulk of it. */
	get progress(): number {
		return this.#progress;
	}

	/**
	 * Run a behaviour trace on the current subject: evolve one population keeping its genomes, then
	 * trace it against a random-brain control. Ignores a re-entrant call while one is already running;
	 * a cancelled run (null) leaves any prior result in place.
	 */
	async run(): Promise<void> {
		if (this.#running) return;
		const cfg = app.subjectBase('Trace');
		this.#controller = new AbortController();
		this.#running = true;
		this.#progress = 0;
		try {
			const study = await runTraceStudy(
				{ cfg, episodes: TRACE_EPISODES },
				{ signal: this.#controller.signal, onProgress: (fraction) => (this.#progress = fraction) }
			);
			if (study) this.#result = study;
		} finally {
			this.#running = false;
			this.#controller = null;
		}
	}

	cancel(): void {
		this.#controller?.abort();
	}

	/** Whether this subject already has the trace's findings in the notebook (both are added together). */
	get inReport(): boolean {
		return findings.has('trace', CURVE) && findings.has('trace', MECHANISM);
	}

	/** Add the study's two findings — the learning curve (Q1) and the mechanism (Q5) — to the report. */
	addToReport(): void {
		if (!this.#result) return;
		const hash = configHash([app.subjectBase('Trace')]);
		for (const finding of traceFindings(this.#result, hash)) findings.add(finding);
	}
}

export const trace = new TraceStore();
