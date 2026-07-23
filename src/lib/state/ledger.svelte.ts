/**
 * The Ledger store — claims in, a dated record of verdicts out.
 *
 * Since the composer redesign the store owns the COMPOSER: the picked template, its slot values,
 * and the seeds-per-arm budget. `active` is always a runnable claim — slot resolution (defaults,
 * wiring gates, no-self-rivalry) happens on read against the current subject, so the panel can
 * never hold an impossible sentence. Running the claim designs its two arms (hypothesis.ts),
 * measures them through the shared `research` lifecycle, reads the verdict off the pre-registered
 * contrast, and writes a RECORD: what was claimed, how it came out, the effect and its interval,
 * the shared background both arms stood on, and the config fingerprint + seed count that reproduce
 * it. The records PERSIST to localStorage, so the ledger is the same the next time you open the
 * lab — a growing, dated notebook of what this world has been shown to do.
 *
 * This is the platform's persistence layer, and it lives here (not in R1) because the Ledger is its
 * first real consumer: a generic store with nothing to keep would have been speculative.
 */

import { browser } from '$app/environment';
import type { WorldConfig } from '../engine';
import {
	LIBRARY,
	TEMPLATES,
	buildClaim,
	designFor,
	resolveSlots,
	sharedBackground,
	templateById,
	verdictFrom,
	type Claim,
	type ClaimExpectation,
	type ClaimTemplate,
	type LibraryItem,
	type SlotValues,
	type TemplateId,
	type Verdict
} from '../lab/hypothesis';
import { research } from './research.svelte';
import { app } from './app.svelte';
import { configHash } from '../lab/run';
import { contrast, mean, bootstrapCI, type Interval } from '../lab/stats';
import type { ArmRow } from '../lab/evidence';
import type { JobExecutor } from '../lab/runner';
import type { Evaluation } from '../lab/evaluator';
import { loadSimRate } from './sweep.svelte';

export const LEDGER_STORAGE_KEY = 'darwinlab:ledger';
const STORAGE_VERSION = 1;
/** The record is bounded; over this, the oldest entries are evicted. The composer opened the claim
 *  space wide, so the bound is generous — 50 was right for a three-claim menu, not for this one. */
export const MAX_ENTRIES = 200;

/** A ledger run's fixed shape — training and scoring never vary, so every record in the feed stays
 *  comparable to every other. Seeds per arm is the ONE budget knob, and it lives on the store. */
export const LEDGER_RUN_SHAPE = { episodes: 30, bouts: 4 } as const;
export const LEDGER_SEED_LIMITS = { min: 4, max: 16, fallback: 8 } as const;
/** Sim-seconds one arm-seed costs: training generations plus scoring bouts, at the default
 *  10-sim-second generation the evaluator runs. */
const SIM_SECONDS_PER_RUN = (LEDGER_RUN_SHAPE.episodes + LEDGER_RUN_SHAPE.bouts) * 10;

/** One arm's summary — mean seconds survived and its interval, for the A/B plot. */
export interface ArmSummary {
	label: string;
	mean: number;
	ci: Interval;
}

/** The arms as the compact ArmRow the interval plot and the notebook share — one converter, so the
 *  Ledger's card and the Report's Q3 can't shape the evidence differently. */
export function toArmRows(arms: ArmSummary[]): ArmRow[] {
	return arms.map((a) => ({ label: a.label, mean: a.mean, lo: a.ci.lo, hi: a.ci.hi }));
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
	/** The pre-registered reading this verdict was taken by. Absent on records from before the
	 *  composer — the drill then skips the rationale line rather than guessing. */
	expect?: ClaimExpectation;
	/** The composer pick that rebuilds this claim — "load into composer" needs both. Absent on
	 *  pre-composer records, whose claims may no longer be composable. */
	templateId?: TemplateId;
	slots?: SlotValues;
	/** The background both arms shared, frozen at measurement — a later subject edit must not
	 *  relabel an old verdict. */
	shared?: string[];
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
		typeof e.configHash === 'string' &&
		(e.shared === undefined || Array.isArray(e.shared)) &&
		(e.slots === undefined || (typeof e.slots === 'object' && e.slots !== null))
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
	readonly templates: ClaimTemplate[] = TEMPLATES;
	readonly library: LibraryItem[] = LIBRARY;

	// The composer: the picked family and its raw slot picks. Picks are RESOLVED on read (defaults,
	// wiring gates, exclusivity) so `values`/`active` are always legal for the current subject.
	// The default is Under pressure at 1.4× — a compound template, so a fresh panel demonstrates
	// slots rather than opening on the simplest sentence.
	#templateId = $state<TemplateId>('pressure');
	#slots = $state.raw<SlotValues>({});

	#seeds = $state<number>(LEDGER_SEED_LIMITS.fallback);
	#entries = $state.raw<LedgerEntry[]>(loadEntries());
	// The record row the drill sidebar is opened on; null falls back to the newest record.
	#selectedId = $state<string | null>(null);

	get template(): ClaimTemplate {
		return templateById(this.#templateId) ?? this.templates[0];
	}

	/** The slot picks, resolved to a legal combination for the current subject. */
	get values(): SlotValues {
		return resolveSlots(this.template, this.#slots, app.base);
	}

	/** The composed claim the panel is holding — always runnable. */
	get active(): Claim {
		return buildClaim(this.template, this.values);
	}

	/** Switch families. Slots reset to the template's defaults — picks do not carry across shapes. */
	selectTemplate(id: TemplateId): void {
		this.#templateId = id;
		this.#slots = {};
	}

	/** Pick one slot's option, keeping every other slot's current (resolved) pick. */
	setSlot(key: string, optionId: string): void {
		this.#slots = { ...this.values, [key]: optionId };
	}

	/** Refill the composer from a shelf item or a drilled record's stored pick. */
	compose(templateId: TemplateId, slots: SlotValues): void {
		if (!templateById(templateId)) return;
		this.#templateId = templateId;
		this.#slots = { ...slots };
	}

	/** How many seeds each arm runs — the one budget knob, shown on the plan and stored per record. */
	get seeds(): number {
		return this.#seeds;
	}

	setSeeds(value: number): void {
		if (!Number.isFinite(value)) return; // an emptied number input is not an edit
		const { min, max } = LEDGER_SEED_LIMITS;
		this.#seeds = Math.min(max, Math.max(min, Math.round(value)));
	}

	/** Estimated wall-clock seconds for one verdict, priced by the sweep-calibrated sim rate. */
	get estimatedSeconds(): number {
		return (this.#seeds * 2 * SIM_SECONDS_PER_RUN) / loadSimRate();
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

	/** The record the drill sidebar shows — the picked row, falling back to the newest record. */
	get selected(): LedgerEntry | null {
		return this.#entries.find((entry) => entry.id === this.#selectedId) ?? this.#entries[0] ?? null;
	}

	select(entryId: string): void {
		this.#selectedId = entryId;
	}

	/** The feed's honesty tally — how the settled record splits. */
	get tally(): { claims: number; supported: number; refuted: number } {
		return {
			claims: new Set(this.#entries.map((entry) => entry.claimId)).size,
			supported: this.#entries.filter((entry) => entry.verdict === 'supported').length,
			refuted: this.#entries.filter((entry) => entry.verdict === 'refuted').length
		};
	}

	/**
	 * Test the composed claim: design its arms, measure them, and record the verdict. Publishes
	 * nothing if a newer run superseded this one (`research.run` returns null). `executor` overrides
	 * the pool for tests, exactly as it does on the research store.
	 */
	async run(executor?: JobExecutor): Promise<void> {
		const template = this.template;
		const values = this.values;
		const claim = buildClaim(template, values);
		const base = app.subjectBase('Ledger');

		const design = designFor(claim, base, { seeds: this.#seeds, ...LEDGER_RUN_SHAPE });
		const results = await research.run([design.a, design.b], executor);
		if (!results) return;

		const entry = this.#toEntry(claim, template, values, base, design, results);
		this.#entries = [entry, ...this.#entries].slice(0, MAX_ENTRIES);
		this.#selectedId = entry.id; // the drill opens on what was just settled
		this.#persist();
	}

	/** Assemble the record: the verdict, each arm's interval, the shared background, and the
	 *  fingerprint + composer pick that rerun it. */
	#toEntry(
		claim: Claim,
		template: ClaimTemplate,
		values: SlotValues,
		base: WorldConfig,
		design: { a: { cfg: WorldConfig }; b: { cfg: WorldConfig } },
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
			seeds: this.#seeds,
			configHash: configHash([design.a.cfg, design.b.cfg]),
			// run() is only ever called from a client button handler, so the browser clock is present.
			recorded: new Date().toISOString(),
			expect: claim.expect,
			templateId: template.id,
			slots: { ...values },
			shared: sharedBackground(base)
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
		this.#selectedId = null;
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
