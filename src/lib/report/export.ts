/**
 * The Report, as a file you can keep.
 *
 * `reportToMarkdown` turns a snapshot of the seven-question brief into a plain Markdown document — a
 * title, the answers at a glance, each question in turn with its evidence as a small table, and the
 * method that reproduces it. It is a PURE function of the snapshot: no dates, no ids, no store — so the
 * same findings always produce byte-identical Markdown (which is what the export test pins). The
 * honesty rail carries through untouched: an unanswered question exports as a "run the test" prompt,
 * never a fabricated answer, because the snapshot it reads is the same one the on-screen Report shows.
 */

import { CANDIDATE_AXES } from '../lab/landscape';
import { SOURCE_LABEL } from '../lab/questions';
import { negativesOf, type Evidence } from '../lab/evidence';
import { formatSeconds, formatSignedSeconds, formatSurvivalPct, formatBehavior } from '../format';
import type { ReportSection, ReportMethod } from '../state/report.svelte';

/** Everything the Markdown needs, lifted off the report store so the formatter stays pure + testable. */
export interface ReportSnapshot {
	subjectName: string;
	coverage: { answered: number; total: number };
	/** The strongest real finding's headline, or null when nothing has been studied. */
	leadTitle: string | null;
	sections: ReportSection[];
	method: ReportMethod | null;
}

/** Escape the one character that would break a Markdown table cell. Titles rarely contain it, but a
 *  finding's text is user-facing data, not a literal, so it is escaped rather than trusted. */
function cell(text: string): string {
	return text.replace(/\|/g, '\\|');
}

/** A signed survival delta, or an em dash when the factor never resolved (a NaN effect). */
function delta(value: number): string {
	return Number.isNaN(value) ? '—' : formatSignedSeconds(value);
}

/** The axis's own value formatter, resolved from its persisted key — so the exported numbers read
 *  exactly as the on-screen strip's ticks (the format fn itself can't be serialised into a finding). */
function axisFormat(key: string): (v: number) => string {
	return CANDIDATE_AXES.find((a) => a.key === key)?.format ?? ((v: number) => String(v));
}

/** A finding's evidence as a compact Markdown block — a table per kind, matching the on-screen graph. */
function evidenceMarkdown(evidence: Evidence | undefined): string {
	if (!evidence) return '';
	switch (evidence.kind) {
		case 'effects':
			return [
				'| Factor | Effect | 95% interval |',
				'| --- | --- | --- |',
				...evidence.effects.map(
					(e) => `| ${cell(e.label)} | ${delta(e.delta)} | ${delta(e.lo)} … ${delta(e.hi)} |`
				)
			].join('\n');
		case 'contrast':
			return [
				'| Arm | Mean survival | 95% interval |',
				'| --- | --- | --- |',
				...evidence.arms.map(
					(a) =>
						`| ${cell(a.label)} | ${formatSeconds(a.mean)} | ${formatSeconds(a.lo)} … ${formatSeconds(a.hi)} |`
				)
			].join('\n');
		case 'landscape': {
			const fmt = axisFormat(evidence.axisKey);
			const cliff =
				evidence.cliffX !== undefined ? `, steepest fall-off at ${fmt(evidence.cliffX)}` : '';
			return [
				`Survival across **${evidence.axisLabel}**${cliff}:`,
				'',
				`| ${cell(evidence.axisLabel)} | Survival |`,
				'| --- | --- |',
				...evidence.band.map((p) => `| ${fmt(p.x)} | ${formatSeconds(p.survival)} |`)
			].join('\n');
		}
		case 'curve': {
			const c = evidence.curve;
			if (!c.length) return '';
			// The curve is survival FRACTIONS (0–1), the same as the on-screen LearningCurve reads — a
			// percent, never seconds.
			const peak = Math.max(...c);
			return `Learning curve over ${c.length} generations: ${formatSurvivalPct(c[0])} → ${formatSurvivalPct(c[c.length - 1])} (peak ${formatSurvivalPct(peak)}).`;
		}
		case 'behavior':
			return [
				'| Signature | Evolved | Random | Better when |',
				'| --- | --- | --- | --- |',
				...evidence.metrics.map(
					(m) =>
						`| ${cell(m.label)} | ${formatBehavior(m.evolved, m.unit)} | ${formatBehavior(m.control, m.unit)} | ${m.higherIsBetter ? 'higher' : 'lower'} |`
				)
			].join('\n');
	}
}

/** The Q6 body: the honest negatives note. */
function negativesMarkdown(section: ReportSection): string {
	const negatives = negativesOf(section.finding?.evidence);
	if (negatives.length)
		return `**${negatives.join(', ')}** don't clear zero — kept as real negatives, not hidden. More knobs is not more survival.`;
	if (section.finding) return 'Every factor the Sweep measured moved survival — no kept negatives.';
	return `No negatives recorded yet — run **${section.producer}** to find what a knob does NOT buy.`;
}

/** The Q7 body: the method that reproduces the run, or an honest "nothing yet". */
function methodMarkdown(method: ReportMethod | null): string {
	return method
		? `Reproducible: config **${method.configHash}**, ${method.seeds} seeds per arm. Seeded runs re-run identical.`
		: 'No runs recorded yet — the provenance that reproduces a result appears here once a finding is added.';
}

/** One `## Q… · title` section — answered (with evidence) or an honest prompt. */
function sectionMarkdown(
	section: ReportSnapshot['sections'][number],
	method: ReportMethod | null
): string {
	const { question, finding } = section;
	const head = `## ${question.id} · ${question.title}`;

	if (question.id === 'Q6') return `${head}\n\n${negativesMarkdown(section)}`;
	if (question.id === 'Q7') return `${head}\n\n${methodMarkdown(method)}`;

	if (!finding) return `${head}\n\n_Not answered yet — run ${section.producer}._`;

	const evidence = evidenceMarkdown(finding.evidence);
	return [
		head,
		'',
		`**${finding.title}** — ${finding.detail}`,
		'',
		`_Source: ${SOURCE_LABEL[finding.source]}._`,
		...(evidence ? ['', evidence] : [])
	].join('\n');
}

/** Render the whole brief. Pure, deterministic, and honest — it renders only what the snapshot holds. */
export function reportToMarkdown(snap: ReportSnapshot): string {
	const lede = snap.leadTitle
		? `**${snap.leadTitle}** — ${snap.coverage.answered} of ${snap.coverage.total} questions a rigorous study must answer are settled for this subject; the rest are waiting on a test.`
		: `${snap.subjectName} hasn't been studied yet — run the instruments and add findings to the report, and the seven questions fill in here.`;

	const glance = [
		'## Answers at a glance',
		'',
		'| # | Question | Answer | Source |',
		'| --- | --- | --- | --- |',
		...snap.sections.map(
			(s) =>
				`| ${s.question.id} | ${cell(s.question.short)} | ${s.answer ? cell(s.answer) : 'Not tested'} | ${s.finding ? SOURCE_LABEL[s.finding.source] : '—'} |`
		)
	].join('\n');

	const body = snap.sections.map((s) => sectionMarkdown(s, snap.method)).join('\n\n');

	return `# Research report — ${snap.subjectName}\n\n${lede}\n\n${glance}\n\n${body}\n`;
}
