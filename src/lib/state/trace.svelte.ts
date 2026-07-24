/**
 * The microscope store — the behaviour trace, folded into the Sweep's drill card (the trace-in-drill
 * mock is the contract; the standalone Trace instrument retired with it).
 *
 * It owns one study at a time, keyed by the RECIPE it studied — the drilled cell's frozen config plus
 * the training budget inherited from the run's receipt. Keying by recipe (not by grid position) means
 * a re-run sweep whose grid re-uses condition numbers can never present another recipe's trace, and
 * two cells with identical recipes honestly share one deterministic study. It runs `runTraceStudy`
 * (a deliberate, time-sliced action — NOT a worker batch, so it carries its own busy/progress and
 * AbortController, not the shared `research` lifecycle the batch instruments use).
 *
 * The result is DELIBERATELY not persisted: the learning curve and the behaviour signatures are small
 * and go into the notebook via "send trace", but the full trajectories are too large to carry across
 * a reload — they live here for the live paths panels and are re-run on demand.
 *
 * "Send trace" writes TWO findings, because a trace answers two different questions with two different
 * graphs: the learning curve settles Q1, the evolved-vs-control mechanism settles Q5.
 */

import {
	runTraceStudy,
	behaviorMetrics,
	traceSummary,
	type TraceStudy
} from '../harness/traceStudy';
import type { WorldConfig } from '../engine';
import { findings, type FindingInput } from './findings.svelte';
import { configHash } from '../lab/run';
import { loadSimRate } from './sweep.svelte';
import { formatSurvivalPct } from '../format';

/** What the drill card asks the microscope to study — everything frozen at the click. */
export interface TraceRequest {
	/** The drilled cell's config — the exact recipe the sweep measured, re-evolved brains-kept. */
	cfg: WorldConfig;
	/** Training budget inherited from the run's receipt (generations), NOT a fixed trace length —
	 *  that inheritance is what makes the traced curve comparable to the cell's own. */
	episodes: number;
	/** How the findings name the cell, e.g. "Condition 12" — frozen with the study. */
	label: string;
}

/** The recipe identity a study belongs to — config and budget, nothing positional. */
export function traceKey(cfg: WorldConfig, episodes: number): string {
	return `${configHash([cfg])}·${episodes}`;
}

/** One completed study, frozen with everything its findings need — nothing is re-read at send time,
 *  so a panel or subject edit after the run cannot relabel what was measured. */
export interface TraceRecord {
	key: string;
	study: TraceStudy;
	hash: string;
	label: string;
}

/**
 * A study's two report findings — the learning curve (Q1) and the evolved-vs-control mechanism (Q5).
 * TWO findings, not one: they answer different questions with different evidence, so each declares its
 * own single question via the notebook's `questions` override rather than sharing the source's whole
 * `[Q1, Q5]` set. Variants carry the recipe key, so each traced cell files its own pair and the door's
 * "in report" state can never borrow another cell's. Pure, so the mapping is testable without a live
 * evolve.
 */
export function traceFindings({ key, study, hash, label }: TraceRecord): FindingInput[] {
	const { finalSurvival, evolvedSurvivors, total } = traceSummary(study);

	return [
		{
			source: 'trace',
			variant: `curve-${key}`,
			questions: ['Q1'],
			title: `Learned to ${formatSurvivalPct(finalSurvival)} survival`,
			detail: `${label} · climbed over ${study.episodes} generations of selection`,
			status: 'ok',
			seeds: 1,
			configHash: hash,
			evidence: { kind: 'curve', curve: study.curve }
		},
		{
			source: 'trace',
			variant: `mechanism-${key}`,
			questions: ['Q5'],
			title: `${evolvedSurvivors}/${total} survive where random brains don't`,
			detail: `${label} · evolved fish flee accurately and keep their distance from the predator`,
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

/** The two frozen bouts a study prices beside its evolve — the evolved school's and the control's. */
const FROZEN_BOUTS = 2;

class TraceStore {
	#done = $state.raw<TraceRecord | null>(null);
	#busyKey = $state<string | null>(null);
	#progress = $state(0);
	#controller: AbortController | null = null;

	/** The study for THIS recipe, or null — a drill card only ever sees its own cell's trace. */
	resultFor(key: string): TraceStudy | null {
		return this.#done?.key === key ? this.#done.study : null;
	}

	/** Whether the microscope is currently evolving/tracing THIS recipe. */
	runningFor(key: string): boolean {
		return this.#busyKey === key;
	}

	/** A study is running for a DIFFERENT recipe — this card's door waits instead of cancelling it. */
	busyElsewhere(key: string): boolean {
		return this.#busyKey !== null && this.#busyKey !== key;
	}

	/** 0–1 while a study runs — the evolve loop is the bulk of it. */
	get progress(): number {
		return this.#progress;
	}

	/** Price one trace — the evolve plus its two frozen bouts — with the same calibrated rate every
	 *  console estimate uses, so the button's "≈ n s" can't drift from the Sweep's arithmetic. */
	estimateSeconds(episodes: number, genDuration: number): number {
		return ((episodes + FROZEN_BOUTS) * genDuration) / loadSimRate();
	}

	/**
	 * Run the microscope on one drilled cell: re-evolve its exact recipe keeping the genomes, then
	 * trace the evolved school against a random-brain control on one frozen bout. Ignores the call
	 * while a study is already running (the card disables its door instead); a cancelled run leaves
	 * any prior result in place.
	 */
	async run({ cfg, episodes, label }: TraceRequest): Promise<void> {
		if (this.#busyKey !== null) return;
		const key = traceKey(cfg, episodes);
		this.#controller = new AbortController();
		this.#busyKey = key;
		this.#progress = 0;
		try {
			const study = await runTraceStudy(
				{ cfg, episodes },
				{ signal: this.#controller.signal, onProgress: (fraction) => (this.#progress = fraction) }
			);
			if (study) this.#done = { key, study, hash: configHash([cfg]), label };
		} finally {
			this.#busyKey = null;
			this.#controller = null;
		}
	}

	cancel(): void {
		this.#controller?.abort();
	}

	/** Whether this recipe's pair of findings is already in the notebook (both are added together). */
	inReport(key: string): boolean {
		return findings.has('trace', `curve-${key}`) && findings.has('trace', `mechanism-${key}`);
	}

	/** Add the frozen study's two findings — the learning curve (Q1) and the mechanism (Q5). */
	addToReport(): void {
		if (!this.#done) return;
		for (const finding of traceFindings(this.#done)) findings.add(finding);
	}
}

export const trace = new TraceStore();
