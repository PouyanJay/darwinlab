/**
 * The Report — the seven-question brief, ASSEMBLED from the notebook, never authored.
 *
 * It is pure derivation over the findings recorded for the current subject: for each of the seven
 * questions it finds the finding that answers it (a finding declares which questions it settles), and
 * exposes a section that is either "answered" — with the real evidence to draw — or a prompt to run
 * the test that would answer it. Nothing here invents a verdict; a question reads answered ONLY when a
 * real finding backs it. That honesty rail is the whole point, so it lives in one place: this store.
 */

import { findings, currentSubjectHash, type Finding } from './findings.svelte';
import { app } from './app.svelte';
import { bench } from './bench.svelte';
import { QUESTIONS, type Question, type QuestionId } from '../lab/questions';
import { isFlatEffect } from '../lab/evidence';
import { reportToMarkdown, type ReportSnapshot } from '../report/export';

/** Who answers each question — the instrument (or action) whose finding fills it, named for the prompt
 *  shown when it is unanswered. Q7 is provenance: any finding carries the fingerprint that reproduces it. */
const PRODUCER: Record<QuestionId, string> = {
	Q1: 'a behaviour trace',
	Q2: 'The Sweep',
	Q3: 'The Ledger',
	Q4: 'The Atlas',
	Q5: 'a behaviour trace',
	Q6: 'The Sweep',
	Q7: 'any test'
};

/** One row of the report: a question, the finding that answers it (or null), and who would. */
export interface ReportSection {
	question: Question;
	finding: Finding | null;
	/** The instrument/action that produces this answer — for the "run …" prompt when unanswered. */
	producer: string;
	/** The concise answer for the glance table — question-aware (Q7 the method, Q6 the negatives),
	 *  null when unanswered. Never invented; derived from the finding. */
	answer: string | null;
}

/** The Sweep's kept negatives — the factors whose interval can't clear zero (what did NOT work). */
export function negativesOf(finding: Finding | null): string[] {
	if (finding?.evidence?.kind !== 'effects') return [];
	return finding.evidence.effects.filter(isFlatEffect).map((e) => e.label);
}

/** The method/provenance footer (Q7): the fingerprint + seed count any finding carries. */
export interface ReportMethod {
	configHash: string;
	seeds: number;
}

class ReportStore {
	/** The subject the console is pointed at — the report is always about THIS world. */
	get subjectHash(): string {
		return currentSubjectHash();
	}

	/** The name the report is titled with (the analysed world, or a generic one). */
	get subjectName(): string {
		return app.subject ? app.subject.name : 'a generic world';
	}

	/** The findings recorded about the current subject — the raw material. */
	get findings(): Finding[] {
		return findings.forSubject(this.subjectHash);
	}

	/** The finding that answers a question — the most recent one whose `questions` include it. `findings`
	 *  is already newest-first, so `find` picks the freshest. */
	#answerTo(id: QuestionId): Finding | null {
		return this.findings.find((finding) => finding.questions.includes(id)) ?? null;
	}

	/** The seven sections, in order — each answered or a prompt. */
	get sections(): ReportSection[] {
		return QUESTIONS.map((question) => {
			// Q7 is provenance: it is "answered" whenever ANY finding exists (there is a run to cite).
			const finding =
				question.id === 'Q7' ? (this.findings[0] ?? null) : this.#answerTo(question.id);
			return {
				question,
				finding,
				producer: PRODUCER[question.id],
				answer: this.#answer(question.id, finding)
			};
		});
	}

	/**
	 * The concise answer text for a question — question-aware so the glance table reads right: Q7 states
	 * the method that reproduces it, Q6 the kept negatives, everything else the finding's own headline.
	 */
	#answer(id: QuestionId, finding: Finding | null): string | null {
		if (!finding) return null;
		if (id === 'Q7') return `config ${finding.configHash} · ${finding.seeds} seeds`;
		if (id === 'Q6') {
			const negatives = negativesOf(finding);
			return negatives.length ? `${negatives.join(', ')} — no gain` : 'every factor moved survival';
		}
		return finding.title;
	}

	/** How many of the seven are answered — the coverage the lede reports honestly. */
	get coverage(): { answered: number; total: number } {
		return { answered: this.sections.filter((s) => s.finding).length, total: QUESTIONS.length };
	}

	/** Whether the current subject has been studied at all. */
	get hasFindings(): boolean {
		return this.findings.length > 0;
	}

	/**
	 * The headline finding — the strongest real claim to lead with, never a fabricated thesis. A
	 * settled Ledger verdict (Q3) is the strongest, then a Sweep mover (Q2), else the newest finding.
	 */
	get lead(): Finding | null {
		return (
			this.findings.find((f) => f.source === 'ledger' && f.status === 'ok') ??
			this.findings.find((f) => f.source === 'sweep' && f.status === 'ok') ??
			this.findings[0] ??
			null
		);
	}

	/** The provenance footer, from any finding — the fingerprint + seeds that reproduce a run (Q7). */
	get method(): ReportMethod | null {
		const finding = this.findings[0];
		return finding ? { configHash: finding.configHash, seeds: finding.seeds } : null;
	}

	/** The brief as plain data — everything the Markdown export needs, and nothing that isn't derivable
	 *  from the findings (no dates, no ids), so a re-export of the same notebook is byte-identical. */
	snapshot(): ReportSnapshot {
		return {
			subjectName: this.subjectName,
			coverage: this.coverage,
			leadTitle: this.lead?.title ?? null,
			sections: this.sections,
			method: this.method
		};
	}

	/** The brief as a Markdown document — a file the study can be kept and shared as. */
	toMarkdown(): string {
		return reportToMarkdown(this.snapshot());
	}

	/**
	 * Watch the report's subject evolve in Studio — the Report→Studio half of the round-trip, the same
	 * shape as the Atlas's `watch`: drop the subject onto the bench as a fresh, named world and switch
	 * modes. The report is always ABOUT one subject, so this reopens exactly that world.
	 */
	watch(): void {
		const name = app.subject ? app.subject.name : 'Report subject';
		bench.addWorld({ ...app.subjectBase(name), name });
		app.setMode('studio');
	}
}

export const report = new ReportStore();
