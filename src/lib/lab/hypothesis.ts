/**
 * The Ledger's claims — where a sentence becomes an experiment.
 *
 * A CLAIM is a plain statement with two arms (each a config patch) and what "supported" would mean:
 * either arm A reliably beats arm B (`A>B`), or the two are indistinguishable (`A≈B`). That is the
 * whole trick that keeps a verdict honest — one PRE-REGISTERED contrast, decided before the run, so
 * "supported / refuted" is a real test and not the end of a fishing trip. The Sweep is where you go
 * looking; the Ledger is where you commit to a question and take the answer either way.
 *
 * Since the composer redesign, claims are built from TEMPLATES: seven families, each a sentence
 * skeleton with SLOTS filled from closed vocabularies (senses, predator speeds, world conditions).
 * The vocabulary is dropdowns, never free text — every fillable claim maps to exactly one contrast
 * the stats module can evaluate, and its id is deterministic, so "direction beats distance" is the
 * same experiment in every session and its record history survives. Pure — claims are patches over
 * WorldConfig, so this is node-testable.
 */

import type { Senses, WorldConfig } from '../engine';
import type { EvalRequest, RunSize } from './evaluator';
import type { Contrast } from './stats';
import { BOOL_KNOBS, hasNineWires, knobLabel } from './sweep';

/** What a claim asserts: A beats B, or A and B are the same. */
export type ClaimExpectation = 'A>B' | 'A≈B';

export type Verdict = 'supported' | 'refuted';

/** One side of a claim — a label and the patch that builds its world from the base. */
export interface ClaimArm {
	label: string;
	apply: (cfg: WorldConfig) => WorldConfig;
}

export interface Claim {
	id: string;
	text: string;
	a: ClaimArm;
	b: ClaimArm;
	expect: ClaimExpectation;
}

/* ======================================= the vocabulary ======================================= */

/** One pick a slot offers — its id is what the store holds and what a claim id is built from. */
export interface SlotOption {
	id: string;
	label: string;
}

export type SlotPool = 'sense' | 'speed' | 'condition';

/** The sense channels a slot can name. Own speed is offered but WIRING-GATED (see below). */
export const SENSE_OPTIONS: SlotOption[] = [
	{ id: 'dir', label: 'Direction' },
	{ id: 'dist', label: 'Distance' },
	{ id: 'closing', label: 'Closing speed' },
	{ id: 'walls', label: 'Walls' },
	{ id: 'speed', label: 'Own speed' }
];

/** Predator cruise multipliers the speed templates offer — within WORLD_LIMITS.predSpeed. */
export const SPEED_OPTIONS: SlotOption[] = [0.8, 1.0, 1.2, 1.4, 1.6].map((v) => ({
	id: v.toFixed(1),
	label: `${v.toFixed(1)}×`
}));

/** The world-condition knobs a claim can flip — the Sweep's own predator/shoal catalog entries,
 *  reused so a condition means the same patch in both instruments. */
const CONDITION_KEYS = ['persistence', 'lunge', 'lungeCommit', 'confusion'] as const;
export const CONDITION_OPTIONS: SlotOption[] = CONDITION_KEYS.map((key) => ({
	id: key,
	label: knobLabel(key)
}));

export function optionsFor(pool: SlotPool): SlotOption[] {
	if (pool === 'sense') return SENSE_OPTIONS;
	if (pool === 'speed') return SPEED_OPTIONS;
	return CONDITION_OPTIONS;
}

/** Why a sense pick is impossible on this subject, or null when it is allowed. Own speed reads the
 *  9th input wire, so on an 8-wire brain the option is DISABLED with the reason shown — never
 *  silently dropped (the same discipline the Sweep panel applies). */
export function senseDisabledReason(id: string, base: WorldConfig): string | null {
	return id === 'speed' && !hasNineWires(base) ? 'needs the 9-input brain' : null;
}

const label = (pool: SlotPool, id: string) =>
	optionsFor(pool).find((o) => o.id === id)?.label ?? id;
const lc = (text: string) => text.toLowerCase();

/* ==================================== the config patches ====================================== */

type SenseKey = 'dir' | 'dist' | 'closing' | 'walls' | 'speed';

/** Every channel off. Built against the config's own wiring, so a 9-wire blind arm carries an
 *  explicit `speed: false` rather than an absent key. */
function blindSenses(cfg: WorldConfig): Senses {
	const senses: Senses = { dist: false, dir: false, closing: false, walls: false };
	if (hasNineWires(cfg)) senses.speed = false;
	return senses;
}

/** The full suite, relative to the wiring — "all senses" honestly includes own speed only on a
 *  brain that has the wire for it. */
function allSenses(cfg: WorldConfig): Senses {
	const senses: Senses = { dist: true, dir: true, closing: true, walls: true };
	if (hasNineWires(cfg)) senses.speed = true;
	return senses;
}

const withOnly =
	(...keys: SenseKey[]) =>
	(cfg: WorldConfig): WorldConfig => {
		const senses = blindSenses(cfg);
		for (const key of keys) senses[key] = true;
		return { ...cfg, senses };
	};

const withBlind = (cfg: WorldConfig): WorldConfig => ({ ...cfg, senses: blindSenses(cfg) });
const withAll = (cfg: WorldConfig): WorldConfig => ({ ...cfg, senses: allSenses(cfg) });

const withAllMinus =
	(key: SenseKey) =>
	(cfg: WorldConfig): WorldConfig => {
		const senses = allSenses(cfg);
		senses[key] = false;
		return { ...cfg, senses };
	};

const atSpeed =
	(speed: number, senses: (cfg: WorldConfig) => WorldConfig) =>
	(cfg: WorldConfig): WorldConfig => ({ ...senses(cfg), predSpeed: speed });

/** Flip one world-condition knob via the Sweep's own apply, so the patch cannot drift from the
 *  knob catalog's meaning. Both arms of a condition claim pin the full suite: the claim is about
 *  the world's rule, and the senses must not differ between the arms. */
const withCondition =
	(key: string, on: boolean) =>
	(cfg: WorldConfig): WorldConfig => {
		const knob = BOOL_KNOBS.find((k) => k.key === key);
		if (!knob) return withAll(cfg);
		return knob.apply(withAll(cfg), on);
	};

/* ====================================== the templates ========================================= */

/** One fillable blank in a template's sentence. */
export interface TemplateSlot {
	key: string;
	/** The dropdown's label in the panel — "sense X", "predator speed". */
	label: string;
	pool: SlotPool;
	/** The option id a fresh template opens with. */
	def: string;
	/** A sibling slot this one may not repeat — a sense cannot rival itself. */
	excl?: string;
}

/** slot key → picked option id. */
export type SlotValues = Record<string, string>;

/** One run of the composed sentence — slot-derived words are marked so the panel can show them. */
export interface SentencePart {
	text: string;
	slot: boolean;
}

export type TemplateId =
	'rivalry' | 'solo' | 'stack' | 'knockout' | 'pressure' | 'cliff' | 'condition';

export interface ClaimTemplate {
	id: TemplateId;
	name: string;
	/** The one-line skeleton under the name in the panel's template list. */
	sub: string;
	slots: TemplateSlot[];
	expect: ClaimExpectation;
	parts: (v: SlotValues) => SentencePart[];
	claimId: (v: SlotValues) => string;
	arms: (v: SlotValues) => [ClaimArm, ClaimArm];
}

const word = (text: string): SentencePart => ({ text, slot: false });
const slotWord = (text: string): SentencePart => ({ text, slot: true });

/**
 * The seven families. Ids are chosen so the three claims the Ledger shipped with keep their exact
 * historical ids (`dir-beats-dist`, `walls-pays-alone`, `cliff-1`) — persisted records and Report
 * findings stay attached to the same experiments.
 */
export const TEMPLATES: ClaimTemplate[] = [
	{
		id: 'rivalry',
		name: 'Rivalry',
		sub: '“X pays more than Y” — sense against sense',
		slots: [
			{ key: 'x', label: 'sense X', pool: 'sense', def: 'dir' },
			{ key: 'y', label: 'sense Y', pool: 'sense', def: 'dist', excl: 'x' }
		],
		expect: 'A>B',
		parts: (v) => [
			slotWord(label('sense', v.x)),
			word(' pays more than '),
			slotWord(lc(label('sense', v.y))),
			word('.')
		],
		claimId: (v) => `${v.x}-beats-${v.y}`,
		arms: (v) => [
			{ label: `only ${lc(label('sense', v.x))}`, apply: withOnly(v.x as SenseKey) },
			{ label: `only ${lc(label('sense', v.y))}`, apply: withOnly(v.y as SenseKey) }
		]
	},
	{
		id: 'solo',
		name: 'Solo sense',
		sub: '“X pays on its own” — one sense against blind',
		slots: [{ key: 'x', label: 'sense', pool: 'sense', def: 'dir' }],
		expect: 'A>B',
		parts: (v) => [
			word('The '),
			slotWord(lc(label('sense', v.x))),
			word(' sense pays on its own.')
		],
		claimId: (v) => `${v.x}-pays-alone`,
		arms: (v) => [
			{ label: `only ${lc(label('sense', v.x))}`, apply: withOnly(v.x as SenseKey) },
			{ label: 'blind', apply: withBlind }
		]
	},
	{
		id: 'stack',
		name: 'Stacking',
		sub: '“adding Y to X pays” — does a second sense stack',
		slots: [
			{ key: 'x', label: 'base sense', pool: 'sense', def: 'dir' },
			{ key: 'y', label: 'added sense', pool: 'sense', def: 'closing', excl: 'x' }
		],
		expect: 'A>B',
		parts: (v) => [
			word('Adding '),
			slotWord(lc(label('sense', v.y))),
			word(' to '),
			slotWord(lc(label('sense', v.x))),
			word(' pays.')
		],
		claimId: (v) => `${v.y}-stacks-on-${v.x}`,
		arms: (v) => [
			{
				label: `${lc(label('sense', v.x))} + ${lc(label('sense', v.y))}`,
				apply: withOnly(v.x as SenseKey, v.y as SenseKey)
			},
			{ label: `only ${lc(label('sense', v.x))}`, apply: withOnly(v.x as SenseKey) }
		]
	},
	{
		id: 'knockout',
		name: 'Knockout',
		sub: '“the suite survives losing X” — remove one from all',
		slots: [{ key: 'x', label: 'removed sense', pool: 'sense', def: 'closing' }],
		expect: 'A≈B',
		parts: (v) => [
			word('The full suite survives losing '),
			slotWord(lc(label('sense', v.x))),
			word('.')
		],
		claimId: (v) => `suite-survives-losing-${v.x}`,
		arms: (v) => [
			{
				label: `all senses − ${lc(label('sense', v.x))}`,
				apply: withAllMinus(v.x as SenseKey)
			},
			{ label: 'all senses', apply: withAll }
		]
	},
	{
		id: 'pressure',
		name: 'Under pressure',
		sub: '“X still pays at S× cruise” — the sense, under a faster shark',
		slots: [
			{ key: 'x', label: 'sense', pool: 'sense', def: 'dir' },
			{ key: 's', label: 'predator speed', pool: 'speed', def: '1.4' }
		],
		expect: 'A>B',
		parts: (v) => [
			slotWord(label('sense', v.x)),
			word(' still pays at '),
			slotWord(label('speed', v.s)),
			word(' cruise.')
		],
		claimId: (v) => `${v.x}-pays-at-${v.s}`,
		arms: (v) => [
			{
				label: `only ${lc(label('sense', v.x))} · ${label('speed', v.s)}`,
				apply: atSpeed(Number(v.s), withOnly(v.x as SenseKey))
			},
			{ label: `blind · ${label('speed', v.s)}`, apply: atSpeed(Number(v.s), withBlind) }
		]
	},
	{
		id: 'cliff',
		name: 'Speed cliff',
		sub: '“above S×, no sense pays” — where seeing stops helping',
		slots: [{ key: 's', label: 'predator speed', pool: 'speed', def: '1.0' }],
		expect: 'A≈B',
		parts: (v) => [word('Above '), slotWord(label('speed', v.s)), word(' cruise, no sense pays.')],
		// Number() folds '1.0' → 1, which is exactly the historical `cliff-1` id.
		claimId: (v) => `cliff-${Number(v.s)}`,
		arms: (v) => [
			{ label: `all senses · ${label('speed', v.s)}`, apply: atSpeed(Number(v.s), withAll) },
			{ label: `blind · ${label('speed', v.s)}`, apply: atSpeed(Number(v.s), withBlind) }
		]
	},
	{
		id: 'condition',
		name: 'World condition',
		sub: '“C makes survival harder” — one rule of the world, on vs off',
		slots: [{ key: 'c', label: 'condition', pool: 'condition', def: 'persistence' }],
		expect: 'A>B',
		parts: (v) => [slotWord(label('condition', v.c)), word(' makes survival harder.')],
		claimId: (v) => `${v.c}-hurts`,
		arms: (v) => [
			{ label: `${lc(label('condition', v.c))} off`, apply: withCondition(v.c, false) },
			{ label: `${lc(label('condition', v.c))} on`, apply: withCondition(v.c, true) }
		]
	}
];

export function templateById(id: string): ClaimTemplate | null {
	return TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Make a partial pick legal for this template on this subject: missing slots take their defaults,
 * a wiring-gated pick falls back, and an exclusive slot that collides with its sibling is handed
 * the first sense still free. The result is always a runnable claim — the composer can never hold
 * an impossible sentence.
 */
export function resolveSlots(
	template: ClaimTemplate,
	picks: SlotValues,
	base: WorldConfig
): SlotValues {
	const values: SlotValues = {};
	for (const slot of template.slots) {
		let pick = picks[slot.key] ?? slot.def;
		if (!optionsFor(slot.pool).some((o) => o.id === pick)) pick = slot.def;
		if (slot.pool === 'sense' && senseDisabledReason(pick, base)) pick = slot.def;
		const rival = slot.excl ? values[slot.excl] : null;
		if (rival && pick === rival) {
			pick =
				SENSE_OPTIONS.find((o) => o.id !== rival && !senseDisabledReason(o.id, base))?.id ?? pick;
		}
		values[slot.key] = pick;
	}
	return values;
}

/** The composed claim: deterministic id, the sentence, and the two arms. */
export function buildClaim(template: ClaimTemplate, values: SlotValues): Claim {
	const [a, b] = template.arms(values);
	return {
		id: template.claimId(values),
		text: template
			.parts(values)
			.map((p) => p.text)
			.join(''),
		a,
		b,
		expect: template.expect
	};
}

/* ================================== the library + rationale =================================== */

/** One shelf item: a template pick that reproduces a claim the lab has already asked. */
export interface LibraryItem {
	templateId: TemplateId;
	values: SlotValues;
}

/** The claims the Ledger shipped with — the lab's own findings, ready to be re-tested. */
export const LIBRARY: LibraryItem[] = [
	{ templateId: 'rivalry', values: { x: 'dir', y: 'dist' } },
	{ templateId: 'solo', values: { x: 'walls' } },
	{ templateId: 'cliff', values: { s: '1.0' } }
];

const libraryClaim = (item: LibraryItem): Claim =>
	buildClaim(templateById(item.templateId) as ClaimTemplate, item.values);

/** The library as concrete claims — kept for callers that only need the sentences and ids. */
export const CANDIDATE_CLAIMS: Claim[] = LIBRARY.map(libraryClaim);

/**
 * Why a verdict fell the way it did, in plain words — phrased from the pre-registered expectation
 * and the interval, so the drill can explain the reading without re-deriving it.
 */
export function rationaleFor(
	expect: ClaimExpectation,
	verdict: Verdict,
	ci: { lo: number; hi: number }
): string {
	if (expect === 'A>B') {
		if (verdict === 'supported')
			return 'A > B claim: the Δ interval clears zero in A’s favour — supported.';
		if (ci.hi < 0)
			return 'A > B claim: the interval sits below zero — arm B outlived arm A. Refuted.';
		return 'A > B claim: the interval straddles zero — no reliable difference. Refuted.';
	}
	if (verdict === 'supported')
		return 'A ≈ B claim: the interval straddles zero — no difference could be shown, which is what the claim asserts. Supported.';
	return 'A ≈ B claim: the interval clears zero — there IS a reliable difference. Refuted.';
}

/* ================================ the design and the verdict ================================== */

/** The claim as two evaluation requests — arm A and arm B, run at the same size. */
export function designFor(
	claim: Claim,
	base: WorldConfig,
	size: RunSize
): { a: EvalRequest; b: EvalRequest } {
	return {
		a: { cfg: claim.a.apply(base), ...size },
		b: { cfg: claim.b.apply(base), ...size }
	};
}

/**
 * Read the verdict off the pre-registered contrast.
 *
 * For an `A>B` claim, supported means the whole interval clears zero in A's favour — a difference in
 * the other direction OR no reliable difference both refute it. For an `A≈B` claim, supported means
 * the interval STRADDLES zero (no difference could be shown); any interval that clears zero refutes
 * it. A contrast with no data (NaN) refutes either way.
 */
export function verdictFrom(contrast: Contrast, expect: ClaimExpectation): Verdict {
	if (Number.isNaN(contrast.delta)) return 'refuted';
	const clearsZeroPositive = contrast.ci.lo > 0;
	const straddlesZero = contrast.ci.lo <= 0 && contrast.ci.hi >= 0;
	if (expect === 'A>B') return clearsZeroPositive ? 'supported' : 'refuted';
	return straddlesZero ? 'supported' : 'refuted';
}

/* ==================================== the shared background =================================== */

/**
 * The knobs BOTH arms hold in common — the subject's place-and-wiring plus the graded senses the
 * templates never touch — as human chips for the drill card. Built from the base at design time and
 * stored on the record, so a later subject edit cannot relabel an old verdict.
 */
export function sharedBackground(base: WorldConfig): string[] {
	return [
		`${base.prey} prey`,
		`${base.preds} pred${base.preds === 1 ? '' : 's'}`,
		`${base.bw}×${base.bh}`,
		`${base.brainInputs ?? 8}-input brain`,
		`vision ${Math.round(base.vision)}`,
		`mutation ${base.mutation.toFixed(2)}`
	];
}
