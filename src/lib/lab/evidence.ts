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

/** One bar of the behavioural signature: how the fish survived — the mechanism view (Q5). */
export interface BehaviorBar {
	label: string;
	value: number;
	/** The bar's full-scale value, so the Report can draw it without knowing the metric's units. */
	max: number;
}

export type Evidence =
	| { kind: 'effects'; effects: EffectRow[] }
	| { kind: 'contrast'; arms: ArmRow[] }
	| { kind: 'landscape'; axisLabel: string; axisKey: string; band: BandPoint[]; cliffX?: number }
	| { kind: 'curve'; curve: number[] }
	| { kind: 'behavior'; bars: BehaviorBar[] };
