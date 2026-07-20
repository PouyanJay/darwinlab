/**
 * The Ledger's claims — where a sentence becomes an experiment.
 *
 * A CLAIM is a plain statement with two arms (each a config patch) and what "supported" would mean:
 * either arm A reliably beats arm B (`A>B`), or the two are indistinguishable (`A≈B`). That is the
 * whole trick that keeps a verdict honest — one PRE-REGISTERED contrast, decided before the run, so
 * "supported / refuted" is a real test and not the end of a fishing trip. The Sweep is where you go
 * looking; the Ledger is where you commit to a question and take the answer either way.
 *
 * The vocabulary is a fixed set of templates, not free text: each maps to exactly one contrast the
 * stats module can evaluate. Pure — claims are patches over WorldConfig, so this is node-testable.
 */

import type { Senses, WorldConfig } from '../engine';
import type { EvalRequest, RunSize } from './evaluator';
import type { Contrast } from './stats';

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

const BLIND: Senses = { dist: false, dir: false, closing: false, walls: false };
const ALL: Senses = { dist: true, dir: true, closing: true, walls: true };
const only = (key: keyof Senses): Senses => ({ ...BLIND, [key]: true });

const withSenses = (senses: Senses) => (cfg: WorldConfig) => ({ ...cfg, senses: { ...senses } });

/** One side of a sense-vs-sense claim — the channel and how to name it. */
interface SenseSide {
	key: keyof Senses;
	label: string;
}

/** "X pays more than Y": the world with only X survives longer than the world with only Y. */
function senseBeats(x: SenseSide, y: SenseSide): Claim {
	return {
		id: `${String(x.key)}-beats-${String(y.key)}`,
		text: `${x.label} pays more than ${y.label.toLowerCase()}.`,
		a: { label: `only ${x.label.toLowerCase()}`, apply: withSenses(only(x.key)) },
		b: { label: `only ${y.label.toLowerCase()}`, apply: withSenses(only(y.key)) },
		expect: 'A>B'
	};
}

/** "X pays on its own": only X beats a blind policy. */
function sensePaysAlone(x: keyof Senses, label: string): Claim {
	return {
		id: `${String(x)}-pays-alone`,
		text: `The ${label} sense pays on its own.`,
		a: { label: `only ${label}`, apply: withSenses(only(x)) },
		b: { label: 'blind', apply: withSenses(BLIND) },
		expect: 'A>B'
	};
}

/** "Above S× cruise, no sense pays": at that predator speed, all-senses ≈ blind. */
function speedCliff(speed: number): Claim {
	return {
		id: `cliff-${speed}`,
		text: `Above ${speed.toFixed(1)}× cruise, no sense pays.`,
		a: {
			label: `all senses · ${speed.toFixed(1)}×`,
			apply: (cfg) => ({ ...cfg, senses: { ...ALL }, predSpeed: speed })
		},
		b: {
			label: `blind · ${speed.toFixed(1)}×`,
			apply: (cfg) => ({ ...cfg, senses: { ...BLIND }, predSpeed: speed })
		},
		expect: 'A≈B'
	};
}

/** The claims the Ledger opens with — the lab's own findings, ready to be re-tested. */
export const CANDIDATE_CLAIMS: Claim[] = [
	senseBeats({ key: 'dir', label: 'Direction' }, { key: 'dist', label: 'Distance' }),
	sensePaysAlone('walls', 'wall'),
	speedCliff(1.0)
];

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
