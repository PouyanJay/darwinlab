import { describe, it, expect, beforeEach } from 'vitest';
import {
	ledger,
	loadEntries,
	LEDGER_STORAGE_KEY,
	LEDGER_SEED_LIMITS,
	MAX_ENTRIES
} from './ledger.svelte';
import { app } from './app.svelte';
import { newWorldConfig } from '../engine';
import type { JobExecutor } from '../lab/runner';
import type { Evaluation } from '../lab/evaluator';

/**
 * The Ledger's composer, verdict + persistence, driven through a canned executor so the measurement
 * is fixed and the verdict is deterministic (a real run's sign is noisy — not something to assert).
 * The store is a singleton, so each test clears it (and its storage) and resets the composer first.
 */

/** Hands back pre-baked evaluations in submit order — arm A first, then arm B. */
class CannedExecutor implements JobExecutor {
	readonly concurrency = 1;
	#queue: (Evaluation | null)[];
	constructor(evaluations: (Evaluation | null)[]) {
		this.#queue = [...evaluations];
	}
	async submit(): Promise<Evaluation | null> {
		return this.#queue.shift() ?? null;
	}
	dispose(): void {}
}

const evalWith = (returns: number[]) => ({ returns }) as unknown as Evaluation;
const stored = () => JSON.parse(localStorage.getItem(LEDGER_STORAGE_KEY) ?? 'null');
/** A supported-shaped run of the currently composed claim: arm A beats arm B. */
const runSupported = () =>
	ledger.run(new CannedExecutor([evalWith([5, 5, 5]), evalWith([3, 3, 3])]));

describe('the Ledger', () => {
	beforeEach(() => {
		ledger.clear();
		app.clearSubject();
		app.resetBase();
		ledger.compose('rivalry', { x: 'dir', y: 'dist' });
		ledger.setSeeds(LEDGER_SEED_LIMITS.fallback);
	});

	describe('the composer', () => {
		it('holds a runnable claim built from the picked template and slots', () => {
			expect(ledger.active.id).toBe('dir-beats-dist');
			expect(ledger.active.text).toBe('Direction pays more than distance.');
		});

		it('switching templates resets the slots to that template’s defaults', () => {
			ledger.setSlot('x', 'walls');
			ledger.selectTemplate('pressure');
			expect(ledger.values).toEqual({ x: 'dir', s: '1.4' }); // picks do not carry across shapes
		});

		it('setting one slot keeps the other slots’ picks', () => {
			ledger.setSlot('y', 'closing');
			ledger.setSlot('x', 'walls');
			expect(ledger.values).toEqual({ x: 'walls', y: 'closing' });
		});

		it('an exclusive slot never equals its sibling — the collision is resolved, not stored', () => {
			ledger.setSlot('x', 'dist'); // x takes y's current pick
			expect(ledger.values.x).toBe('dist');
			expect(ledger.values.y).not.toBe('dist');
		});

		it('compose() with an unknown template is a no-op', () => {
			ledger.compose('sonar' as never, {});
			expect(ledger.template.id).toBe('rivalry');
		});

		it('clamps seeds per arm to the limits and ignores an emptied input', () => {
			ledger.setSeeds(99);
			expect(ledger.seeds).toBe(LEDGER_SEED_LIMITS.max);
			ledger.setSeeds(1);
			expect(ledger.seeds).toBe(LEDGER_SEED_LIMITS.min);
			ledger.setSeeds(NaN);
			expect(ledger.seeds).toBe(LEDGER_SEED_LIMITS.min); // unchanged
		});
	});

	it('records a supported verdict when arm A beats arm B, and persists it', async () => {
		await runSupported();

		const entry = ledger.latestFor('dir-beats-dist');
		expect(entry?.verdict).toBe('supported');
		expect(entry?.delta).toBeCloseTo(2, 6); // 5 − 3
		expect(entry?.arms[0].mean).toBeCloseTo(5, 6); // arm A summarised for the plot
		expect(entry?.arms[1].mean).toBeCloseTo(3, 6); // arm B
		expect(entry?.configHash).toMatch(/^[0-9a-f]{6}$/); // reproducible: it fingerprints the arms

		// …and it is on disk, not just in memory
		expect(stored().entries[0].claimId).toBe('dir-beats-dist');
	});

	it('records the composer pick, the reading, and the frozen shared background on the entry', async () => {
		await runSupported();
		const entry = ledger.entries[0];
		expect(entry.templateId).toBe('rivalry');
		expect(entry.slots).toEqual({ x: 'dir', y: 'dist' });
		expect(entry.expect).toBe('A>B');
		expect(entry.shared).toContain(`${app.base.prey} prey`); // the base both arms stood on
		expect(entry.seeds).toBe(LEDGER_SEED_LIMITS.fallback);
	});

	it('records the edited seed count — the budget knob reaches the record', async () => {
		ledger.setSeeds(12);
		await runSupported();
		expect(ledger.entries[0].seeds).toBe(12);
	});

	it('records a refuted verdict when arm B beats arm A', async () => {
		await ledger.run(new CannedExecutor([evalWith([3, 3, 3]), evalWith([5, 5, 5])]));
		expect(ledger.latestFor('dir-beats-dist')?.verdict).toBe('refuted');
	});

	it('keeps the record newest-first', async () => {
		await runSupported();
		ledger.compose('solo', { x: 'walls' });
		await ledger.run(new CannedExecutor([evalWith([4]), evalWith([4])]));
		expect(ledger.entries).toHaveLength(2);
		expect(ledger.entries[0].claimId).toBe('walls-pays-alone'); // the most recent run is first
	});

	it('opens the drill on what was just settled, and select() moves it', async () => {
		await runSupported();
		ledger.compose('solo', { x: 'walls' });
		await ledger.run(new CannedExecutor([evalWith([4]), evalWith([4])]));
		expect(ledger.selected?.claimId).toBe('walls-pays-alone'); // the fresh verdict is drilled
		ledger.select(ledger.entries[1].id);
		expect(ledger.selected?.claimId).toBe('dir-beats-dist');
	});

	it('tallies the record for the honesty tiles', async () => {
		await runSupported();
		await ledger.run(new CannedExecutor([evalWith([3]), evalWith([5])])); // same claim, refuted
		ledger.compose('solo', { x: 'walls' });
		await ledger.run(new CannedExecutor([evalWith([5]), evalWith([3])]));
		expect(ledger.tally).toEqual({ claims: 2, supported: 2, refuted: 1 });
	});

	it('clear forgets the record on disk as well as in memory', async () => {
		await runSupported();
		expect(ledger.entries).toHaveLength(1); // it really recorded before we clear it
		ledger.clear();
		expect(ledger.entries).toHaveLength(0);
		expect(ledger.selected).toBeNull();
		expect(localStorage.getItem(LEDGER_STORAGE_KEY)).toBeNull();
	});

	it('reruns get distinct ids, so a rerun after a reload cannot collide with a loaded entry', async () => {
		await runSupported();
		await runSupported();
		expect(ledger.entries).toHaveLength(2);
		expect(ledger.entries[0].id).not.toBe(ledger.entries[1].id);
	});

	it('caps the record, evicting the oldest', async () => {
		await ledger.run(new CannedExecutor([evalWith([5]), evalWith([3])]));
		const oldest = ledger.entries[0].id; // the first run — the one the cap must push out
		for (let i = 0; i < MAX_ENTRIES + 2; i++) {
			await ledger.run(new CannedExecutor([evalWith([5]), evalWith([3])]));
		}
		expect(ledger.entries).toHaveLength(MAX_ENTRIES);
		// oldest-first eviction, not just a bounded length — a newest-first slice would also cap
		expect(ledger.entries.some((entry) => entry.id === oldest)).toBe(false);
	});

	it('runs the claim on the analysis subject — its config is in the recorded fingerprint', async () => {
		// The configHash is over the two arms' configs, so a different base (the subject) must produce a
		// different fingerprint — that is what proves the subject reached the design, not a generic world.
		await runSupported();
		const generic = ledger.latestFor('dir-beats-dist')!.configHash;

		app.analyze({ ...newWorldConfig('Watched', '#123456'), vision: 999 });
		await runSupported();
		const onSubject = ledger.latestFor('dir-beats-dist')!.configHash;

		expect(onSubject).not.toBe(generic); // the subject's vision changed the two-arm fingerprint
	});

	describe('loading the persisted record', () => {
		// A pre-composer record: none of the new optional fields, all of the required ones.
		const good = {
			id: 'x',
			claimId: 'c',
			text: 't',
			verdict: 'supported',
			delta: 1,
			ci: { lo: 0.2, hi: 1.8 },
			d: 1,
			arms: [],
			seeds: 8,
			configHash: 'abc123',
			recorded: ''
		};

		it('drops a malformed entry but keeps the valid one beside it', () => {
			// the malformed neighbour is missing its numeric fields — only the valid entry loads
			localStorage.setItem(
				LEDGER_STORAGE_KEY,
				JSON.stringify({ version: 1, entries: [good, { id: 'y', claimId: 'c' }] })
			);
			expect(loadEntries()).toHaveLength(1);
		});

		it('accepts a pre-composer record — the new fields are optional, not required', () => {
			localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify({ version: 1, entries: [good] }));
			expect(loadEntries()[0]).toMatchObject({ id: 'x', claimId: 'c' });
		});

		it('drops an entry whose new optional fields are the wrong shape, not half-trusts it', () => {
			localStorage.setItem(
				LEDGER_STORAGE_KEY,
				JSON.stringify({ version: 1, entries: [{ ...good, slots: 5 }] })
			);
			expect(loadEntries()).toEqual([]);
		});

		it('discards a version this build did not write, wholesale', () => {
			localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify({ version: 999, entries: [good] }));
			expect(loadEntries()).toEqual([]);
		});

		it('never throws on outright garbage', () => {
			localStorage.setItem(LEDGER_STORAGE_KEY, 'not json at all');
			expect(loadEntries()).toEqual([]);
		});
	});
});
