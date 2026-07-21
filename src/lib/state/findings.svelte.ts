/**
 * The Findings notebook — the curated record the Report is assembled from.
 *
 * An instrument produces a conclusion; "add to report" writes it here as a FINDING — small enough to
 * persist (numbers and a sentence, never raw genomes), tagged with the questions it answers and the
 * fingerprint that reproduces it. The notebook PERSISTS to localStorage, so a report survives across
 * sessions, and it generalises the Ledger's envelope (`{version, entries}`, a per-entry guard, a cap):
 * the Ledger keeps every verdict; the notebook keeps the ones you chose to report, from any instrument.
 *
 * Re-adding the same finding UPDATES it in place rather than duplicating — a report has one answer per
 * conclusion, not one per click.
 */

import { browser } from '$app/environment';
import { app } from './app.svelte';
import { configHash } from '../lab/run';
import { ANSWERS, type FindingSource, type QuestionId } from '../lab/questions';
import type { Evidence } from '../lab/evidence';

export const FINDINGS_STORAGE_KEY = 'darwinlab:findings';
const STORAGE_VERSION = 1;
/** The notebook is bounded; over this, the oldest findings are evicted. */
export const MAX_FINDINGS = 50;

/** A positive result vs a kept negative/limit — the honest distinction the Report preserves (Q6). */
export type FindingStatus = 'ok' | 'limit';

/** One recorded conclusion — enough to read it, group it by question, and reproduce it. */
export interface Finding {
	id: string;
	/** Dedupe identity: same source + variant + subject → the newer replaces the older. */
	key: string;
	source: FindingSource;
	/** Which of the seven questions this finding answers (from `ANSWERS[source]`). */
	questions: QuestionId[];
	/** The headline, e.g. "Direction +2.4s". */
	title: string;
	/** A short supporting line. */
	detail: string;
	status: FindingStatus;
	seeds: number;
	/** The experiment's fingerprint — provenance (Q7). */
	configHash: string;
	/** The subject this finding is about — stable across instruments, so the Report can scope to it. */
	subjectHash: string;
	/** The small graph payload the Report renders (optional: a text-only finding still answers a Q). */
	evidence?: Evidence;
	/** ISO timestamp of when it was recorded. Metadata, not part of what reproduces the run. */
	recorded: string;
}

/** What a producer hands to `add` — the store stamps the id, questions, subject, key and timestamp. */
export interface FindingInput {
	source: FindingSource;
	/** Distinguishes findings from the same source about the same subject (the Ledger's claimId); '' when
	 *  a source contributes one finding per subject (the Sweep, the Atlas). */
	variant: string;
	title: string;
	detail: string;
	status: FindingStatus;
	seeds: number;
	configHash: string;
	evidence?: Evidence;
}

const VALID_SOURCES: FindingSource[] = ['sweep', 'ledger', 'atlas', 'trace'];

/** A runtime shape check on ONE finding — persisted state can be hand-edited, half-written or from a
 *  future build, and the UI reads `.title`/`.status`/`.questions`, so a malformed one is dropped
 *  rather than trusted (a bare cast would let it through to crash a render). */
function isFinding(value: unknown): value is Finding {
	if (!value || typeof value !== 'object') return false;
	const f = value as Record<string, unknown>;
	return (
		typeof f.id === 'string' &&
		typeof f.key === 'string' &&
		typeof f.source === 'string' &&
		VALID_SOURCES.includes(f.source as FindingSource) &&
		Array.isArray(f.questions) &&
		typeof f.title === 'string' &&
		(f.status === 'ok' || f.status === 'limit') &&
		typeof f.configHash === 'string' &&
		typeof f.subjectHash === 'string' &&
		// evidence is optional; if present it must at least be a kind-tagged object (the Report renders
		// defensively per kind, so a foreign kind just means "no graph", not a crash).
		(f.evidence === undefined ||
			(typeof f.evidence === 'object' &&
				f.evidence !== null &&
				typeof (f.evidence as { kind?: unknown }).kind === 'string'))
	);
}

/** Read the persisted notebook, tolerating anything that is not a notebook this version wrote.
 *  Exported so the persistence robustness (version mismatch, corrupt JSON, malformed entries) is
 *  testable, exactly as the Ledger's `loadEntries` is. */
export function loadFindings(): Finding[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(FINDINGS_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.entries)) return [];
		return (parsed.entries as unknown[]).filter(isFinding);
	} catch {
		return [];
	}
}

/**
 * The fingerprint of the world the console is currently pointed at — stable across instruments, since
 * `configHash` ignores name/accent. `add` stamps it so a finding remembers which subject it is about
 * and the Report can show only the current one's findings.
 */
export function currentSubjectHash(): string {
	return configHash([app.subjectBase('Findings')]);
}

class FindingsStore {
	#entries = $state.raw<Finding[]>(loadFindings());

	/** The whole notebook, newest first. */
	get entries(): Finding[] {
		return this.#entries;
	}

	/** The findings recorded about one subject — what the Report composes from. */
	forSubject(subjectHash: string): Finding[] {
		return this.#entries.filter((finding) => finding.subjectHash === subjectHash);
	}

	/** Whether a finding from this source + variant about the CURRENT subject is already in the notebook
	 *  — so a summary's button can read "in report" instead of inviting a duplicate. */
	has(source: FindingSource, variant = ''): boolean {
		const key = this.#keyFor(source, variant, currentSubjectHash());
		return this.#entries.some((finding) => finding.key === key);
	}

	/** The dedupe identity of a finding — one place, so `add` and `has` can never disagree on it. */
	#keyFor(source: FindingSource, variant: string, subjectHash: string): string {
		return `${source}:${variant}:${subjectHash}`;
	}

	/**
	 * Record a conclusion. Derives the questions from the source, stamps the current subject and a
	 * stable dedupe key, and prepends it — dropping any earlier finding with the same key so a re-add
	 * updates rather than duplicates.
	 */
	add(input: FindingInput): void {
		const subjectHash = currentSubjectHash();
		const key = `${input.source}:${input.variant}:${subjectHash}`;
		const finding: Finding = {
			// A globally-unique id — never a session counter, which would reset on reload and collide
			// with an id already in the persisted array (the keyed rail list needs it unique).
			id: crypto.randomUUID(),
			key,
			source: input.source,
			questions: ANSWERS[input.source],
			title: input.title,
			detail: input.detail,
			status: input.status,
			seeds: input.seeds,
			configHash: input.configHash,
			subjectHash,
			evidence: input.evidence,
			// add() is only ever called from a client button handler, so the browser clock is present.
			recorded: new Date().toISOString()
		};
		const others = this.#entries.filter((existing) => existing.key !== key);
		this.#entries = [finding, ...others].slice(0, MAX_FINDINGS);
		this.#persist();
	}

	/** Drop one finding — curating the notebook. */
	remove(id: string): void {
		this.#entries = this.#entries.filter((finding) => finding.id !== id);
		this.#persist();
	}

	/** The whole notebook as JSON — what a later "export" hands over. */
	toJson(): string {
		return JSON.stringify({ version: STORAGE_VERSION, entries: this.#entries }, null, 2);
	}

	/** Forget every finding. */
	clear(): void {
		this.#entries = [];
		if (browser) localStorage.removeItem(FINDINGS_STORAGE_KEY);
	}

	#persist(): void {
		if (!browser) return;
		try {
			const payload = JSON.stringify({ version: STORAGE_VERSION, entries: this.#entries });
			localStorage.setItem(FINDINGS_STORAGE_KEY, payload);
		} catch {
			// Storage full or unavailable — the in-memory notebook still works for this session.
		}
	}
}

export const findings = new FindingsStore();
