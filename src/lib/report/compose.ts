/**
 * Composing the Report's PROSE — the auto-abstract and the tensions check — from the settled findings.
 *
 * Both are pure functions of the report sections, and both keep the honesty rail the rest of the Report
 * keeps: a clause appears ONLY when a real finding backs it, and every number is READ from the finding's
 * own evidence, never invented. The sentences are templates with real values slotted in — the same move
 * the glance table makes ("config X · N seeds"), not a fabricated verdict. An unanswered question never
 * produces a clause; instead the abstract closes with an honest "not yet tested" naming the gap.
 *
 * Kept separate from the store so the composition is testable without a live notebook, and separate from
 * the Markdown export (which renders the whole brief) because this is the shorter, spoken synthesis.
 */

import type { QuestionId } from '../lab/questions';
import type { ReportSection } from '../state/report.svelte';
import { strongestEffect, negativesOf, type EffectRow, type Evidence } from '../lab/evidence';
import { formatSignedSeconds, formatSurvivalPct } from '../format';

/** One clause of the abstract — its sentence, and the question it is drawn from (for the ← link). A
 *  `gap` clause is the honest closer naming an unanswered question; it cites no finding. */
export interface AbstractClause {
	text: string;
	/** The question this clause is READ from — the citation the view superscripts. Null on the gap clause. */
	questionId: QuestionId | null;
	gap?: boolean;
}

/** A flagged conflict between two findings that both stand — surfaced, not averaged away. */
export interface Tension {
	id: string;
	title: string;
	body: string;
	/** The two findings in tension — each a question + its source, for the "between … and …" line. */
	between: { questionId: QuestionId; source: string }[];
}

/** The finding answering a question, or null — a thin lookup over the already-built sections. */
function findingFor(sections: ReportSection[], id: QuestionId) {
	return sections.find((s) => s.question.id === id)?.finding ?? null;
}

/** The typed evidence of a question's finding, when it is the kind asked for — else null, so a caller
 *  reads the payload it expects or gets nothing (never a wrong-kind read). */
function evidenceFor<K extends Evidence['kind']>(
	sections: ReportSection[],
	id: QuestionId,
	kind: K
): Extract<Evidence, { kind: K }> | null {
	const evidence = findingFor(sections, id)?.evidence;
	return evidence?.kind === kind ? (evidence as Extract<Evidence, { kind: K }>) : null;
}

/** The first UNANSWERED content question (Q1–Q6, skipping Q7 which is always provenance) — the honest
 *  gap the abstract closes on. Null when everything a study needs is settled. */
function firstGap(sections: ReportSection[]): ReportSection | null {
	return sections.find((s) => s.question.id !== 'Q7' && !s.finding) ?? null;
}

/**
 * The auto-abstract: a handful of sentences composed from the settled findings, in the order a paper
 * would state them — what matters, what did not, that it learned, how, where it holds — each closing
 * with a citation to the question it came from, and a final honest clause naming the first gap.
 *
 * Every clause is a template filled from real evidence; a clause is emitted only when its finding
 * exists, so the abstract can never claim a thing the notebook does not hold. Returns [] before the
 * subject has been studied at all.
 */
export function composeAbstract(sections: ReportSection[]): AbstractClause[] {
	const clauses: AbstractClause[] = [];

	// Q2 · what matters — the dominant mover, read from the Sweep's effect bars.
	const effects = evidenceFor(sections, 'Q2', 'effects');
	if (effects) {
		const dominant = strongestEffect(effects.effects);
		if (dominant) {
			clauses.push({
				text: `${dominant.label.toLowerCase()} moved survival most (${formatSignedSeconds(dominant.delta)})`,
				questionId: 'Q2'
			});
		}
	}

	// Q6 · what did not — the kept negatives, from the same Sweep evidence.
	const negatives = negativesOf(findingFor(sections, 'Q6')?.evidence);
	if (negatives.length) {
		clauses.push({
			text: `${negatives.join(', ')} did not measurably help`,
			questionId: 'Q6'
		});
	}

	// Q1 · did it learn — the final survival the learning curve reached.
	const curve = evidenceFor(sections, 'Q1', 'curve');
	if (curve && curve.curve.length) {
		const final = curve.curve[curve.curve.length - 1];
		clauses.push({
			text: `one population climbed to ${formatSurvivalPct(final)} survival over ${curve.curve.length} generations`,
			questionId: 'Q1'
		});
	}

	// Q5 · how — the mechanism is the finding's own headline (a behaviour contrast reads best in words).
	const mechanism = findingFor(sections, 'Q5');
	if (mechanism) {
		clauses.push({ text: mechanism.title.toLowerCase(), questionId: 'Q5' });
	}

	// Q4 · where it holds — bounded by the Atlas's cliff, when one was found.
	const landscape = evidenceFor(sections, 'Q4', 'landscape');
	if (landscape) {
		clauses.push({
			text:
				landscape.cliffX !== undefined
					? `the result holds until survival falls off a cliff along ${landscape.axisLabel.toLowerCase()}`
					: `the result varies across ${landscape.axisLabel.toLowerCase()}`,
			questionId: 'Q4'
		});
	}

	// The honest closer — the first content question still without a finding. Only when something WAS
	// settled (an empty abstract needs no "but one thing is missing"); with nothing settled, return [].
	if (clauses.length) {
		const gap = firstGap(sections);
		if (gap) {
			clauses.push({
				text: `one question — ${gap.question.short} — is not yet tested`,
				questionId: null,
				gap: true
			});
		}
	}

	return clauses;
}

/**
 * The tensions check — conflicts the Report surfaces rather than averaging away.
 *
 * This round detects the one that is genuinely computable from persisted evidence: a strong main effect
 * (Q2) that the Atlas shows is BOUNDED — survival is not flat, it falls off a cliff (Q4). Both findings
 * stand; the point is that the headline result is real AND conditional. A tension is emitted only when
 * both findings exist and the landscape actually has a cliff, so it can never manufacture a conflict.
 */
export function detectTensions(sections: ReportSection[]): Tension[] {
	const tensions: Tension[] = [];

	const effects = evidenceFor(sections, 'Q2', 'effects');
	const landscape = evidenceFor(sections, 'Q4', 'landscape');
	const dominant: EffectRow | null = effects ? strongestEffect(effects.effects) : null;

	if (dominant && landscape && landscape.cliffX !== undefined) {
		tensions.push({
			id: 'bounded-effect',
			title: `${dominant.label} pays — but only within bounds`,
			body:
				`The Sweep ranks ${dominant.label.toLowerCase()} as a real effect (${formatSignedSeconds(dominant.delta)}). ` +
				`The Atlas shows that result is conditional: survival is a plateau that falls off a cliff along ` +
				`${landscape.axisLabel.toLowerCase()}. Both stand — the effect is real and bounded. The Report ` +
				`surfaces the conflict rather than averaging it away.`,
			between: [
				{ questionId: 'Q2', source: 'The Sweep' },
				{ questionId: 'Q4', source: 'The Atlas' }
			]
		});
	}

	return tensions;
}
