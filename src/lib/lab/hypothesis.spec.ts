import { describe, it, expect } from 'vitest';
import { newWorldConfig } from '../engine';
import {
	CANDIDATE_CLAIMS,
	SENSE_OPTIONS,
	TEMPLATES,
	buildClaim,
	designFor,
	rationaleFor,
	resolveSlots,
	senseDisabledReason,
	sharedBackground,
	templateById,
	verdictFrom,
	type Claim,
	type ClaimTemplate
} from './hypothesis';
import type { Contrast } from './stats';

const base = () => newWorldConfig('Base', '#888888');
const nineWired = () => ({ ...base(), brainInputs: 9 as const });
const claim = (id: string) => CANDIDATE_CLAIMS.find((c) => c.id === id) as Claim;
const tpl = (id: string) => templateById(id) as ClaimTemplate;
const ci = (lo: number, hi: number): Contrast => ({ delta: (lo + hi) / 2, ci: { lo, hi }, d: 0 });

describe('designFor', () => {
	it('turns an A>B sense claim into two configs, one per arm', () => {
		const { a, b } = designFor(claim('dir-beats-dist'), base(), {
			seeds: 5,
			episodes: 20,
			bouts: 4
		});
		// arm A is "only direction", arm B is "only distance"
		expect(a.cfg.senses).toEqual({ dist: false, dir: true, closing: false, walls: false });
		expect(b.cfg.senses).toEqual({ dist: true, dir: false, closing: false, walls: false });
		// the whole run size travels through — seeds AND episodes AND bouts, not a subset
		expect(a).toMatchObject({ seeds: 5, episodes: 20, bouts: 4 });
		expect(b).toMatchObject({ seeds: 5, episodes: 20, bouts: 4 });
	});

	it('turns a pays-alone claim into "only X" versus a blind policy', () => {
		const { a, b } = designFor(claim('walls-pays-alone'), base(), {
			seeds: 4,
			episodes: 10,
			bouts: 2
		});
		expect(a.cfg.senses).toEqual({ dist: false, dir: false, closing: false, walls: true }); // only walls
		expect(b.cfg.senses).toEqual({ dist: false, dir: false, closing: false, walls: false }); // blind
	});

	it('sets both the senses and the predator speed for a cliff claim', () => {
		const { a, b } = designFor(claim('cliff-1'), base(), { seeds: 3, episodes: 10, bouts: 2 });
		expect(a.cfg.predSpeed).toBe(1.0);
		expect(b.cfg.predSpeed).toBe(1.0);
		expect(a.cfg.senses).toEqual({ dist: true, dir: true, closing: true, walls: true }); // all on
		expect(b.cfg.senses).toEqual({ dist: false, dir: false, closing: false, walls: false }); // blind
	});
});

describe('the templates', () => {
	it('keep the shipped claims’ historical ids, so old records stay attached', () => {
		// These three ids are persisted in users’ ledgers and in Report findings — they must never move.
		expect(buildClaim(tpl('rivalry'), { x: 'dir', y: 'dist' }).id).toBe('dir-beats-dist');
		expect(buildClaim(tpl('solo'), { x: 'walls' }).id).toBe('walls-pays-alone');
		expect(buildClaim(tpl('cliff'), { s: '1.0' }).id).toBe('cliff-1');
	});

	it('compose the sentence the parts render — one source for text and slot marking', () => {
		const template = tpl('pressure');
		const values = { x: 'dir', s: '1.4' };
		const built = buildClaim(template, values);
		expect(built.text).toBe('Direction still pays at 1.4× cruise.');
		// the slot-derived words are the marked parts
		expect(
			template
				.parts(values)
				.filter((p) => p.isSlot)
				.map((p) => p.text)
		).toEqual(['Direction', '1.4×']);
	});

	it('stacking contrasts X+Y against only-X — the added sense is the only difference', () => {
		const built = buildClaim(tpl('stack'), { x: 'dir', y: 'closing' });
		const { a, b } = designFor(built, base(), { seeds: 2, episodes: 5, bouts: 2 });
		expect(a.cfg.senses).toEqual({ dist: false, dir: true, closing: true, walls: false });
		expect(b.cfg.senses).toEqual({ dist: false, dir: true, closing: false, walls: false });
		expect(built.expect).toBe('A>B');
	});

	it('knockout contrasts all-minus-X against the full suite, expecting no difference', () => {
		const built = buildClaim(tpl('knockout'), { x: 'closing' });
		const { a, b } = designFor(built, base(), { seeds: 2, episodes: 5, bouts: 2 });
		expect(a.cfg.senses).toEqual({ dist: true, dir: true, closing: false, walls: true });
		expect(b.cfg.senses).toEqual({ dist: true, dir: true, closing: true, walls: true });
		expect(built.expect).toBe('A≈B');
	});

	it('under-pressure pins the SAME predator speed on both arms — the sense is the only difference', () => {
		const built = buildClaim(tpl('pressure'), { x: 'dir', s: '1.4' });
		const { a, b } = designFor(built, base(), { seeds: 2, episodes: 5, bouts: 2 });
		expect(a.cfg.predSpeed).toBe(1.4);
		expect(b.cfg.predSpeed).toBe(1.4);
		expect(a.cfg.senses.dir).toBe(true);
		expect(Object.values(b.cfg.senses)).not.toContain(true); // blind
	});

	it('a condition claim flips ONE world rule and pins the full suite on both arms', () => {
		const built = buildClaim(tpl('condition'), { c: 'persistence' });
		const { a, b } = designFor(built, base(), { seeds: 2, episodes: 5, bouts: 2 });
		// arm A is the world WITHOUT the rule — "makes survival harder" means off outlives on
		expect(a.cfg.persistence).toBe(false);
		expect(b.cfg.persistence).toBe(true);
		expect(a.cfg.senses).toEqual(b.cfg.senses); // the senses must not differ between the arms
		expect(a.cfg.senses.dir).toBe(true);
	});

	it('“all senses” honestly includes own speed only on a brain with the 9th wire', () => {
		const built = buildClaim(tpl('cliff'), { s: '1.0' });
		const eight = designFor(built, base(), { seeds: 2, episodes: 5, bouts: 2 });
		const nine = designFor(built, nineWired(), { seeds: 2, episodes: 5, bouts: 2 });
		expect(eight.a.cfg.senses.speed).toBeUndefined();
		expect(nine.a.cfg.senses.speed).toBe(true);
		expect(nine.b.cfg.senses.speed).toBe(false); // blind on a 9-wire brain zeroes the 9th too
	});

	it('every template yields a distinct claim id from its default slots', () => {
		const ids = TEMPLATES.map(
			(t) => buildClaim(t, Object.fromEntries(t.slots.map((s) => [s.key, s.def]))).id
		);
		expect(new Set(ids).size).toBe(TEMPLATES.length);
	});
});

describe('resolveSlots', () => {
	it('fills missing slots with the template defaults', () => {
		expect(resolveSlots(tpl('rivalry'), {}, base())).toEqual({ x: 'dir', y: 'dist' });
	});

	it('hands an exclusive slot the first sense still free when it collides with its sibling', () => {
		const values = resolveSlots(tpl('rivalry'), { x: 'dist', y: 'dist' }, base());
		expect(values.x).toBe('dist');
		expect(values.y).not.toBe('dist'); // a sense cannot rival itself
	});

	it('drops a wiring-gated pick back to the default on an 8-wire subject, keeps it on a 9-wire one', () => {
		expect(resolveSlots(tpl('solo'), { x: 'speed' }, base()).x).toBe('dir');
		expect(resolveSlots(tpl('solo'), { x: 'speed' }, nineWired()).x).toBe('speed');
	});

	it('replaces an unknown option id with the default', () => {
		expect(resolveSlots(tpl('solo'), { x: 'sonar' }, base()).x).toBe('dir');
	});

	it('never offers the gated sense as a collision fallback on an 8-wire subject', () => {
		// x has taken y's default; the bump must skip own-speed even though it is a sense option
		const values = resolveSlots(tpl('rivalry'), { x: 'dir', y: 'dir' }, base());
		expect(values.y).not.toBe('dir');
		expect(values.y).not.toBe('speed');
	});
});

describe('senseDisabledReason', () => {
	it('gates own speed on the brain wiring', () => {
		expect(senseDisabledReason('speed', base())).toMatch(/9-input/);
		expect(senseDisabledReason('speed', nineWired())).toBeNull();
	});

	it.each(SENSE_OPTIONS.filter((o) => o.id !== 'speed'))(
		'never gates $label — only own speed needs a wire',
		(option) => {
			expect(senseDisabledReason(option.id, base())).toBeNull();
		}
	);
});

describe('verdictFrom', () => {
	it('A>B is supported only when the interval clears zero in A’s favour', () => {
		expect(verdictFrom(ci(0.4, 1.2), 'A>B')).toBe('supported'); // wholly positive
		expect(verdictFrom(ci(-0.3, 0.9), 'A>B')).toBe('refuted'); // straddles ⇒ not shown
		expect(verdictFrom(ci(-1.2, -0.4), 'A>B')).toBe('refuted'); // B beat A
	});

	it('A≈B is supported only when the interval straddles zero', () => {
		expect(verdictFrom(ci(-0.3, 0.4), 'A≈B')).toBe('supported'); // no difference shown
		expect(verdictFrom(ci(0.4, 1.2), 'A≈B')).toBe('refuted'); // there IS a difference
		expect(verdictFrom(ci(-1.2, -0.4), 'A≈B')).toBe('refuted');
	});

	it('treats a lower bound of exactly zero as not clearing zero', () => {
		expect(verdictFrom(ci(0, 1), 'A>B')).toBe('refuted'); // ci.lo === 0 does not clear
		expect(verdictFrom(ci(0, 1), 'A≈B')).toBe('supported'); // but it does straddle
	});

	it('a contrast with no data refutes either kind of claim', () => {
		const noData: Contrast = { delta: NaN, ci: { lo: NaN, hi: NaN }, d: NaN };
		expect(verdictFrom(noData, 'A>B')).toBe('refuted');
		expect(verdictFrom(noData, 'A≈B')).toBe('refuted');
	});
});

describe('rationaleFor', () => {
	it('phrases each verdict from the pre-registered reading, matching verdictFrom’s logic', () => {
		// The cases mirror verdictFrom exactly — if the two ever disagree, one of them is lying.
		expect(rationaleFor('A>B', 'supported', { lo: 0.4, hi: 1.2 })).toMatch(
			/clears zero.*supported/i
		);
		expect(rationaleFor('A>B', 'refuted', { lo: -1.2, hi: -0.4 })).toMatch(/arm B outlived/i);
		expect(rationaleFor('A>B', 'refuted', { lo: -0.3, hi: 0.9 })).toMatch(/straddles zero/i);
		expect(rationaleFor('A≈B', 'supported', { lo: -0.3, hi: 0.4 })).toMatch(
			/what the claim asserts/i
		);
		expect(rationaleFor('A≈B', 'refuted', { lo: 0.4, hi: 1.2 })).toMatch(
			/IS a reliable difference/
		);
	});
});

describe('sharedBackground', () => {
	it('freezes the subject’s place-and-wiring as human chips', () => {
		const cfg = { ...base(), prey: 20, preds: 1, bw: 800, bh: 500, vision: 200, mutation: 0.06 };
		expect(sharedBackground(cfg)).toEqual([
			'20 prey',
			'1 pred',
			'800×500',
			'8-input brain',
			'vision 200',
			'mutation 0.06'
		]);
	});

	it('pluralises predators and names the 9-wire brain', () => {
		const cfg = { ...nineWired(), preds: 3 };
		const chips = sharedBackground(cfg);
		expect(chips).toContain('3 preds');
		expect(chips).toContain('9-input brain');
	});
});
