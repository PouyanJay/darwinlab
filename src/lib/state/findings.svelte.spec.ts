import { describe, it, expect, beforeEach } from 'vitest';
import {
	findings,
	loadFindings,
	currentSubjectHash,
	FINDINGS_STORAGE_KEY,
	MAX_FINDINGS,
	type FindingInput
} from './findings.svelte';
import { app } from './app.svelte';
import { newWorldConfig } from '../engine';

/**
 * The Findings notebook's recording + persistence. The store is a singleton, so each test clears it
 * (and its storage and any analysis subject) first, then drives it through the public `add` the
 * "add to report" buttons call.
 */

const stored = () => JSON.parse(localStorage.getItem(FINDINGS_STORAGE_KEY) ?? 'null');

/** A well-formed PERSISTED finding (the shape `loadFindings` reads off disk), for the guard tests. */
const GOOD = {
	id: 'x',
	key: 'sweep::abc',
	source: 'sweep',
	questions: ['Q2', 'Q6'],
	title: 't',
	detail: 'd',
	status: 'ok',
	seeds: 6,
	configHash: 'abc123',
	subjectHash: 'abc123',
	recorded: ''
};

/** A sweep-shaped finding by default; override any field per test. */
const input = (over: Partial<FindingInput> = {}): FindingInput => ({
	source: 'sweep',
	variant: '',
	title: 'Direction +2.4s',
	detail: 'the strongest factor whose interval clears zero',
	status: 'ok',
	seeds: 6,
	configHash: 'abc123',
	...over
});

describe('the Findings notebook', () => {
	beforeEach(() => {
		findings.clear();
		app.clearSubject();
	});

	it('records a finding, tags it with its source’s questions, and persists it', () => {
		findings.add(input());

		const finding = findings.entries[0];
		expect(finding.title).toBe('Direction +2.4s');
		expect(finding.questions).toEqual(['Q2', 'Q6']); // ANSWERS.sweep — derived, not passed in
		expect(finding.status).toBe('ok');
		expect(finding.subjectHash).toMatch(/^[0-9a-f]{6}$/);

		// …and it is on disk, not just in memory
		expect(stored().entries[0].title).toBe('Direction +2.4s');
	});

	it('lets a finding override the questions it settles — a trace curve answers only Q1', () => {
		// A trace produces two findings from one source; each answers a subset of ANSWERS.trace ([Q1,Q5]),
		// so the store honours an explicit `questions` rather than always tagging the source's whole set.
		findings.add(input({ source: 'trace', variant: 'curve', questions: ['Q1'] }));
		expect(findings.entries[0].questions).toEqual(['Q1']);
	});

	it('re-adding the same source + variant on the same subject updates in place, not duplicates', () => {
		findings.add(input({ title: 'Direction +2.4s' }));
		findings.add(input({ title: 'Direction +2.6s' })); // the same sweep, re-added after another run

		expect(findings.entries).toHaveLength(1);
		expect(findings.entries[0].title).toBe('Direction +2.6s'); // the newer value replaced the older
	});

	it('keeps distinct-variant findings apart (a Ledger claim per variant), newest first', () => {
		findings.add(input({ source: 'ledger', variant: 'dir-beats-dist', title: 'A' }));
		findings.add(input({ source: 'ledger', variant: 'walls-pays-alone', title: 'B' }));

		expect(findings.entries).toHaveLength(2);
		expect(findings.entries[0].title).toBe('B'); // most recent first
	});

	it('gives every finding a distinct id, so a rerun after a reload cannot collide with a loaded one', () => {
		findings.add(input({ variant: 'a' }));
		findings.add(input({ variant: 'b' }));
		expect(findings.entries[0].id).not.toBe(findings.entries[1].id);
	});

	it('caps the notebook, evicting the oldest', () => {
		for (let i = 0; i < MAX_FINDINGS + 3; i++) {
			findings.add(input({ variant: String(i) })); // distinct keys, so none dedupe away
		}
		expect(findings.entries).toHaveLength(MAX_FINDINGS);
	});

	it('has() reports whether this source + variant is already in the notebook for the current subject', () => {
		expect(findings.has('sweep')).toBe(false);
		findings.add(input({ source: 'sweep', variant: '' }));
		expect(findings.has('sweep')).toBe(true);

		// variant-scoped: adding one Ledger claim does not make another claim read as "in report"
		findings.add(input({ source: 'ledger', variant: 'dir-beats-dist' }));
		expect(findings.has('ledger', 'dir-beats-dist')).toBe(true);
		expect(findings.has('ledger', 'walls-pays-alone')).toBe(false);
	});

	it('carries a graph evidence payload through, so the Report can draw it', () => {
		findings.add(
			input({
				source: 'sweep',
				evidence: {
					kind: 'effects',
					effects: [{ label: 'Direction', delta: 2.4, lo: 1.2, hi: 3.1 }]
				}
			})
		);

		const evidence = findings.entries[0].evidence;
		expect(evidence?.kind).toBe('effects');
		// …and it survives the round-trip to disk
		expect(stored().entries[0].evidence.kind).toBe('effects');
	});

	it('drops a finding whose evidence is not a kind-tagged object (a text-only finding still loads)', () => {
		const withText = { ...GOOD, id: 'text' }; // no evidence at all — valid
		const withBadEvidence = { ...GOOD, id: 'bad', evidence: 'not an object' };
		localStorage.setItem(
			FINDINGS_STORAGE_KEY,
			JSON.stringify({ version: 1, entries: [withText, withBadEvidence] })
		);
		expect(loadFindings().map((f) => f.id)).toEqual(['text']);
	});

	it('remove drops one finding by id, keeps the rest, and persists the removal', () => {
		findings.add(input({ variant: 'a', title: 'A' }));
		findings.add(input({ variant: 'b', title: 'B' }));
		const removed = findings.entries.find((f) => f.title === 'A')!;

		findings.remove(removed.id);

		expect(findings.entries.map((f) => f.title)).toEqual(['B']); // A gone, B untouched
		expect(stored().entries.map((f: { title: string }) => f.title)).toEqual(['B']); // and on disk
	});

	it('clear forgets the notebook on disk as well as in memory', () => {
		findings.add(input());
		expect(findings.entries).toHaveLength(1); // it really recorded before we clear it
		findings.clear();
		expect(findings.entries).toHaveLength(0);
		expect(localStorage.getItem(FINDINGS_STORAGE_KEY)).toBeNull();
	});

	it('clearSubject forgets one subject’s findings on disk and leaves the others standing', () => {
		findings.add(input({ title: 'on the generic world' }));
		const generic = currentSubjectHash();

		app.analyze({ ...newWorldConfig('Watched', '#123456'), vision: 999 });
		const subject = currentSubjectHash();
		findings.add(input({ title: 'on the subject' }));

		// both subjects really have a finding before we clear one — else "gone" proves nothing
		expect(findings.forSubject(generic)).toHaveLength(1);
		expect(findings.forSubject(subject)).toHaveLength(1);

		findings.clearSubject(subject);

		expect(findings.forSubject(subject)).toHaveLength(0); // the cleared subject is empty
		expect(findings.forSubject(generic).map((f) => f.title)).toEqual(['on the generic world']); // the other survives
		// …and the removal reached disk, not just memory
		expect(stored().entries.map((f: { title: string }) => f.title)).toEqual([
			'on the generic world'
		]);
	});

	it('scopes findings to the subject they were recorded on', () => {
		const generic = currentSubjectHash();
		findings.add(input({ title: 'on the generic world' }));

		// Analysing a different world changes the subject fingerprint; a finding added now belongs to it.
		app.analyze({ ...newWorldConfig('Watched', '#123456'), vision: 999 });
		const subject = currentSubjectHash();
		findings.add(input({ title: 'on the subject' }));

		expect(subject).not.toBe(generic); // the subject really is a different world
		expect(findings.forSubject(generic).map((f) => f.title)).toEqual(['on the generic world']);
		expect(findings.forSubject(subject).map((f) => f.title)).toEqual(['on the subject']);
	});

	it('load drops malformed findings and ignores a foreign or corrupt store', () => {
		// a valid finding beside one with an unknown source — only the valid one loads
		localStorage.setItem(
			FINDINGS_STORAGE_KEY,
			JSON.stringify({ version: 1, entries: [GOOD, { id: 'y', source: 'nonsense' }] })
		);
		expect(loadFindings()).toHaveLength(1);

		// a version this build did not write is discarded wholesale, not half-trusted
		localStorage.setItem(FINDINGS_STORAGE_KEY, JSON.stringify({ version: 999, entries: [GOOD] }));
		expect(loadFindings()).toEqual([]);

		// and outright garbage never throws
		localStorage.setItem(FINDINGS_STORAGE_KEY, 'not json at all');
		expect(loadFindings()).toEqual([]);
	});
});
