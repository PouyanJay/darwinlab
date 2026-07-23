/**
 * A finding's EVIDENCE — the small, serialisable payload the Report renders a graph from. Kept
 * deliberately compact (a handful of numbers and a short series, never raw genomes or full
 * trajectories), because it PERSISTS in the notebook: a report has to survive a reload without
 * dragging megabytes of state with it.
 *
 * One variant per graph the Report draws, tagged by `kind` so the Report can pick the right viz.
 */

/** A factor's main effect on survival, with its 95% interval — the Sweep's effect bars (Q2). */
export interface EffectRow {
	label: string;
	delta: number;
	lo: number;
	hi: number;
}

/** One arm of a contrast: its mean survival and interval — the Ledger's two-arm plot (Q3). */
export interface ArmRow {
	label: string;
	mean: number;
	lo: number;
	hi: number;
}

/** One point along a landscape axis: its value and the mean survival there — the Atlas strip (Q4). */
export interface BandPoint {
	x: number;
	survival: number;
}

/** How to read a behaviour number — the unit its bar and label are formatted in. */
export type BehaviorUnit = 'deg' | 'frac' | 'px';

/**
 * One behavioural signature, evolved against a random-brain control — the mechanism IS the contrast
 * (Q5). A trace measures both populations on the same frozen bout, so "evolved flees more accurately"
 * is the gap between the two bars, not an absolute a reader has no baseline for.
 */
export interface BehaviorMetric {
	label: string;
	evolved: number;
	control: number;
	unit: BehaviorUnit;
	/** True when a HIGHER number is better behaviour (dodge rate); false when lower is (flee error). */
	higherIsBetter: boolean;
}

export type Evidence =
	| { kind: 'effects'; effects: EffectRow[] }
	| { kind: 'contrast'; arms: ArmRow[] }
	| { kind: 'landscape'; axisLabel: string; axisKey: string; band: BandPoint[]; cliffX?: number }
	| { kind: 'curve'; curve: number[] }
	| { kind: 'behavior'; metrics: BehaviorMetric[] };

/**
 * A factor's interval can't clear zero — the Sweep's "does nothing here" test, and the one that
 * decides Q6's kept negatives. One definition, so the muted bar, the notebook and the Report can never
 * disagree on what counts as a real mover.
 */
export function isFlatEffect(row: EffectRow): boolean {
	return Number.isNaN(row.delta) || (row.lo <= 0 && row.hi >= 0);
}

/**
 * Effect rows RANKED by size, so the answer reads top-down; NaN arms (an empty contrast) sink to
 * the bottom rather than poisoning the sort. Pure and shared — one sorter, so the chart and any
 * other consumer rank identically. Returns a new array; the input is untouched.
 */
export function rankEffectRows(rows: EffectRow[]): EffectRow[] {
	const magnitude = (row: EffectRow) => (Number.isNaN(row.delta) ? -1 : Math.abs(row.delta));
	return [...rows].sort((a, b) => magnitude(b) - magnitude(a));
}

/**
 * The strongest factor whose interval clears zero — or null when nothing did, which is itself a
 * real result (a flat environment), not a gap to paper over. ONE selector on top of isFlatEffect,
 * so the workspace's headline tile and the sidebar's lead can never disagree about the winner.
 */
export function strongestEffect(rows: EffectRow[]): EffectRow | null {
	const movers = rows.filter((row) => !isFlatEffect(row));
	if (movers.length === 0) return null;
	return movers.reduce((best, row) => (Math.abs(row.delta) > Math.abs(best.delta) ? row : best));
}

/**
 * The kept negatives in a piece of evidence — the factors whose interval can't clear zero (Q6). ONE
 * extractor, so the on-screen note and the Markdown export can never disagree about what "did not work";
 * evidence that isn't a Sweep's effects has no negatives to keep.
 */
export function negativesOf(evidence: Evidence | undefined): string[] {
	if (evidence?.kind !== 'effects') return [];
	return evidence.effects.filter(isFlatEffect).map((e) => e.label);
}
