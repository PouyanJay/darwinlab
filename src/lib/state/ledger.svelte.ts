/**
 * The Ledger store — claims in, a dated record of verdicts out.
 *
 * Running a claim designs its two arms (hypothesis.ts), measures them through the shared `research`
 * lifecycle, reads the verdict off the pre-registered contrast, and writes a RECORD: what was
 * claimed, how it came out, the effect and its interval, and the config fingerprint + seed count
 * that reproduce it. The records PERSIST to localStorage, so the ledger is the same the next time you
 * open the lab — a growing, dated notebook of what this world has been shown to do.
 *
 * This is the platform's persistence layer, and it lives here (not in R1) because the Ledger is its
 * first real consumer: a generic store with nothing to keep would have been speculative.
 */

import { browser } from '$app/environment';
import {
	CANDIDATE_CLAIMS,
	designFor,
	verdictFrom,
	type Claim,
	type Verdict
} from '../lab/hypothesis';
import { research } from './research.svelte';
import { app } from './app.svelte';
import { configHash } from '../lab/run';
import { contrast, mean, bootstrapCI, type Interval } from '../lab/stats';
import type { JobExecutor } from '../lab/runner';
import type { Evaluation } from '../lab/evaluator';

export const LEDGER_STORAGE_KEY = 'darwinlab:ledger';
const STORAGE_VERSION = 1;
/** The record is bounded; over this, the oldest entries are evicted. */
export const MAX_ENTRIES = 50;

/** A ledger run's size — more seeds per arm than a sweep cell, since there are only two arms. */
const LEDGER_RUN = { seeds: 8, episodes: 30, bouts: 4 };

/** One arm's summary — mean seconds survived and its interval, for the A/B plot. */
export interface ArmSummary {
	label: string;
	mean: number;
	ci: Interval;
}

/** One settled finding — enough to read it AND to reproduce it. */
export interface LedgerEntry {
	id: string;
	claimId: string;
	text: string;
	verdict: Verdict;
	delta: number;
	ci: Interval;
	d: number;
	/** Each arm on its own, so the card can plot the two intervals the verdict came from. */
	arms: ArmSummary[];
	seeds: number;
	/** The two-arm config fingerprint — say "I ran a3f19c" and mean the same experiment. */
	configHash: string;
	/** ISO timestamp of when it was measured. Metadata, not part of what reproduces the run. */
	recorded: string;
}

/** A runtime shape check on ONE entry — a persisted record can be hand-edited, half-written or from a
 *  future build, and the UI calls `.toFixed` on `delta` and maps `arms`, so a malformed entry must be
 *  dropped rather than trusted (a bare `as LedgerEntry[]` cast would let it through to crash a render). */
function isLedgerEntry(value: unknown): value is LedgerEntry {
	if (!value || typeof value !== 'object') return false;
	const e = value as Record<string, unknown>;
	return (
		typeof e.id === 'string' &&
		typeof e.claimId === 'string' &&
		typeof e.text === 'string' &&
		(e.verdict === 'supported' || e.verdict === 'refuted') &&
		typeof e.delta === 'number' &&
		Array.isArray(e.arms) &&
		typeof e.configHash === 'string'
	);
}

/** Read the persisted ledger, tolerating anything that is not a ledger this version wrote. Exported
 *  so the persistence robustness (version mismatch, corrupt JSON, malformed entries) can be tested. */
export function loadEntries(): LedgerEntry[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.entries)) return [];
		return (parsed.entries as unknown[]).filter(isLedgerEntry);
	} catch {
		return [];
	}
}

class LedgerStore {
	readonly claims: Claim[] = CANDIDATE_CLAIMS;

	#activeId = $state<string>(CANDIDATE_CLAIMS[0].id);
	#entries = $state.raw<LedgerEntry[]>(loadEntries());

	/** The claim whose verdict card is open. */
	get active(): Claim {
		return this.claims.find((claim) => claim.id === this.#activeId) ?? this.claims[0];
	}

	select(id: string): void {
		this.#activeId = id;
	}

	/** How many seeds each arm runs — shown on the card before a run, stored on each entry after. */
	get runSeeds(): number {
		return LEDGER_RUN.seeds;
	}

	get running(): boolean {
		return research.running;
	}

	get progress(): number {
		return research.progress;
	}

	/** The whole record, newest first — the discoveries feed. */
	get entries(): LedgerEntry[] {
		return this.#entries;
	}

	/** The most recent verdict for a claim, or null if it has never been run. */
	latestFor(claimId: string): LedgerEntry | null {
		return this.#entries.find((entry) => entry.claimId === claimId) ?? null;
	}

	/**
	 * Test the claim: design its arms, measure them, and record the verdict. Publishes nothing if a
	 * newer run superseded this one (`research.run` returns null). `executor` overrides the pool for
	 * tests, exactly as it does on the research store.
	 */
	async run(claimId: string, executor?: JobExecutor): Promise<void> {
		const claim = this.claims.find((c) => c.id === claimId);
		if (!claim) return;

		const design = designFor(claim, app.subjectBase('Ledger', '#8b8b8b'), LEDGER_RUN);
		const results = await research.run([design.a, design.b], executor);
		if (!results) return;

		const entry = this.#toEntry(claim, design, results);
		this.#entries = [entry, ...this.#entries].slice(0, MAX_ENTRIES);
		this.#persist();
	}

	/** Assemble the record: the verdict, each arm's interval, and the config fingerprint that reruns it. */
	#toEntry(
		claim: Claim,
		design: ReturnType<typeof designFor>,
		[armA, armB]: (Evaluation | null)[]
	): LedgerEntry {
		const c = contrast(armA?.returns ?? [], armB?.returns ?? []);
		const summarise = (label: string, result: Evaluation | null): ArmSummary => ({
			label,
			mean: mean(result?.returns ?? []),
			ci: bootstrapCI(result?.returns ?? [])
		});
		return {
			// A globally-unique id — never a session counter, which would reset on reload and collide
			// with an id already in the persisted array (run.svelte.ts's keyed feed needs it unique).
			id: crypto.randomUUID(),
			claimId: claim.id,
			text: claim.text,
			verdict: verdictFrom(c, claim.expect),
			delta: c.delta,
			ci: c.ci,
			d: c.d,
			arms: [summarise(claim.a.label, armA), summarise(claim.b.label, armB)],
			seeds: LEDGER_RUN.seeds,
			configHash: configHash([design.a.cfg, design.b.cfg]),
			// run() is only ever called from a client button handler, so the browser clock is present.
			recorded: new Date().toISOString()
		};
	}

	cancel(): void {
		research.cancel();
	}

	/** The whole ledger as JSON — what "export" hands over. */
	toJson(): string {
		return JSON.stringify({ version: STORAGE_VERSION, entries: this.#entries }, null, 2);
	}

	/** Forget every record. */
	clear(): void {
		this.#entries = [];
		if (browser) localStorage.removeItem(LEDGER_STORAGE_KEY);
	}

	#persist(): void {
		if (!browser) return;
		try {
			const payload = JSON.stringify({ version: STORAGE_VERSION, entries: this.#entries });
			localStorage.setItem(LEDGER_STORAGE_KEY, payload);
		} catch {
			// Storage full or unavailable — the in-memory ledger still works for this session.
		}
	}
}

export const ledger = new LedgerStore();
