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

export type Evidence =
	| { kind: 'effects'; effects: EffectRow[] }
	| { kind: 'contrast'; arms: ArmRow[] }
	| { kind: 'landscape'; axisLabel: string; axisKey: string; band: BandPoint[]; cliffX?: number }
	| { kind: 'curve'; curve: number[] };

/**
 * A factor's interval can't clear zero — the Sweep's "does nothing here" test, and the one that
 * decides Q6's kept negatives. One definition, so the muted bar, the notebook and the Report can never
 * disagree on what counts as a real mover.
 */
export function isFlatEffect(row: EffectRow): boolean {
	return Number.isNaN(row.delta) || (row.lo <= 0 && row.hi >= 0);
}
