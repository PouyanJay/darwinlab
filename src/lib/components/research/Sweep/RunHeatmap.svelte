<!--
  The raw runs behind the effects, drawn on a CRISP DPR-aware canvas: one COLUMN per condition, one
  square per seed, coloured by how long that seed's population survived — coral where they died fast,
  teal where they lasted. It is the evidence the effect chart is a summary OF: a condition that did
  badly across every seed reads as a coral column, and you can see the spread the intervals came from.

  The colour is a RELATIVE scale (the run's own min→max), not absolute-from-zero — survival here is a
  flat band a few seconds wide, so mapping it from zero would wash every cell to the same shade. Canvas,
  not a grid of DOM cells, so a 32×12 run stays sharp and cheap and the cells never reflow.

  Cells are drillable: click one (or arrow-move the cursor and press Enter) to open it below the grid —
  the condition's world, this run's survival against the condition's spread, and the door into Studio.
-->
<script lang="ts">
	import Canvas from '../../common/Canvas.svelte';
	import ChartTooltip from '../../common/ChartTooltip.svelte';
	import RunCellCard from './RunCellCard.svelte';
	import { theme } from '$lib/state';
	import { heatColor, THEMES } from '$lib/render';
	import type { SweepCell } from '$lib/lab/sweep';
	import type { Evaluation } from '$lib/lab/evaluator';

	let { cells, results }: { cells: SweepCell[]; results: (Evaluation | null)[] } = $props();

	/** A cell of the run grid — its condition column and seed row (mirrors the Atlas's `CellRef`). */
	interface RunCellRef {
		condition: number;
		seed: number;
	}

	let chart = $state<HTMLDivElement>();
	/** The cell the cursor is on — set by hover AND by keyboard; drives the outline and the tooltip. */
	let cursor = $state<RunCellRef | null>(null);
	/** The drilled cell, opened in the card below the grid. */
	let selected = $state<RunCellRef | null>(null);
	let pointer = $state<{ x: number; y: number } | null>(null);
	let repaint = $state<(() => void) | undefined>();

	const register = (render: () => void) => {
		repaint = render;
		return () => (repaint = undefined);
	};

	const seeds = $derived(results.find(Boolean)?.returns.length ?? 0);
	// The measured range this run spans — the ends of the colour scale.
	const values = $derived(results.filter(Boolean).flatMap((r) => (r as Evaluation).returns));
	const lo = $derived(values.length ? Math.min(...values) : 0);
	const hi = $derived(values.length ? Math.max(...values) : 1);

	const GAP = 2;
	const RADIUS = 2;

	function outline(
		ctx: CanvasRenderingContext2D,
		ref: RunCellRef,
		cw: number,
		ch: number,
		color: string,
		lineWidth: number
	): void {
		ctx.strokeStyle = color;
		ctx.lineWidth = lineWidth;
		ctx.beginPath();
		ctx.roundRect(
			ref.condition * cw + GAP / 2,
			ref.seed * ch + GAP / 2,
			cw - GAP,
			ch - GAP,
			RADIUS
		);
		ctx.stroke();
	}

	function paint(ctx: CanvasRenderingContext2D, width: number, height: number): void {
		ctx.clearRect(0, 0, width, height);
		const cols = cells.length;
		if (!cols || !seeds) return;
		const span = hi - lo || 1;
		const cw = width / cols;
		const ch = height / seeds;

		for (let c = 0; c < cols; c++) {
			for (let s = 0; s < seeds; s++) {
				const value = results[c]?.returns[s];
				// An unmeasured cell is left as the panel behind — a blank, not a coloured claim.
				if (value == null) continue;
				ctx.fillStyle = heatColor((value - lo) / span);
				ctx.beginPath();
				ctx.roundRect(c * cw + GAP / 2, s * ch + GAP / 2, cw - GAP, ch - GAP, RADIUS);
				ctx.fill();
			}
		}

		// Cursor (soft) and drilled (strong) outlines — a lightness cue, never a colour (the cell colour
		// is the data). The drilled outline is drawn last so it wins when the cursor sits on it.
		const palette = THEMES[theme.name];
		if (cursor) outline(ctx, cursor, cw, ch, palette.inkSoft, 1.5);
		if (selected) outline(ctx, selected, cw, ch, palette.ink, 2);
	}

	// Research has no per-frame loop — repaint off the reactive deps (a new run, the cursor, the drilled
	// cell, the theme). Reading each here is what subscribes this effect to it; `void` marks them
	// read-for-tracking only.
	$effect(() => {
		void cells;
		void results;
		void cursor;
		void selected;
		void theme.name;
		repaint?.();
	});

	// A new run replaces the cells — drop any cursor/drill, whose indices belonged to the old grid.
	$effect(() => {
		void cells;
		cursor = null;
		selected = null;
	});

	/** Which cell a chart-relative point falls on, or null if outside the grid. `.chart` has no padding,
	 *  so its client box IS the canvas box `paint` draws in — the two spaces line up, so a hover resolves
	 *  to the cell under the pointer. */
	function cellAt(x: number, y: number): RunCellRef | null {
		if (!chart || !cells.length || !seeds) return null;
		const condition = Math.floor(x / (chart.clientWidth / cells.length));
		const seed = Math.floor(y / (chart.clientHeight / seeds));
		if (condition < 0 || seed < 0 || condition >= cells.length || seed >= seeds) return null;
		return { condition, seed };
	}

	function onhover(x: number, y: number): void {
		pointer = { x, y };
		cursor = cellAt(x, y);
	}

	function onpick(x: number, y: number): void {
		const cell = cellAt(x, y);
		if (cell) selected = cell;
	}

	/** Arrow keys move the cursor cell; Enter/Space drill it — the keyboard path to the same open. */
	function onkeydown(event: KeyboardEvent): void {
		if (!cells.length || !seeds) return;
		const step: Record<string, [number, number]> = {
			ArrowRight: [1, 0],
			ArrowLeft: [-1, 0],
			ArrowDown: [0, 1],
			ArrowUp: [0, -1]
		};
		if (event.key in step) {
			const [dx, dy] = step[event.key];
			const base = cursor ?? selected ?? { condition: 0, seed: 0 };
			cursor = {
				condition: Math.max(0, Math.min(cells.length - 1, base.condition + dx)),
				seed: Math.max(0, Math.min(seeds - 1, base.seed + dy))
			};
			pointer = null; // keyboard moves have no pointer position, so no tooltip — the outline leads
			event.preventDefault();
		} else if ((event.key === 'Enter' || event.key === ' ') && cursor) {
			selected = cursor;
			event.preventDefault();
		}
	}

	const describeCondition = (cell: SweepCell) =>
		Object.entries(cell.levels)
			.map(([key, level]) => `${key} ${level}`)
			.join(' · ');

	/** The cursor cell's condition, seed and survival — the tooltip's contents. */
	const tip = $derived.by(() => {
		if (!cursor) return null;
		const value = results[cursor.condition]?.returns[cursor.seed];
		return {
			condition: describeCondition(cells[cursor.condition]),
			seed: cursor.seed + 1,
			value: value != null ? `${value.toFixed(1)}s` : '—'
		};
	});

	const label = $derived(
		seeds === 0
			? 'No conditions completed.'
			: `Survival across ${cells.length} conditions and ${seeds} seeds; teal squares survived longer, coral shorter. Arrow keys move the cursor, Enter opens a cell.`
	);
</script>

{#if seeds === 0}
	<p class="empty">No conditions completed.</p>
{:else}
	<div class="heat" data-testid="sweep-heat" data-conds={cells.length} data-seeds={seeds}>
		<div class="chart" bind:this={chart}>
			<Canvas
				{paint}
				{register}
				{onhover}
				{onpick}
				{onkeydown}
				onleave={() => (cursor = null)}
				{label}
				cursor="pointer"
			/>

			{#if tip && pointer}
				<ChartTooltip x={pointer.x} y={pointer.y}>
					<span class="tip-cond">{tip.condition}</span>
					<span class="tip-val tabular">seed {tip.seed} · {tip.value}</span>
				</ChartTooltip>
			{/if}
		</div>

		<div class="scale" aria-hidden="true">
			<span>{lo.toFixed(1)}s</span>
			<span class="ramp"></span>
			<span>{hi.toFixed(1)}s</span>
			<span class="scale-note">shortest → longest survived</span>
		</div>

		{#if selected && cells[selected.condition]}
			<RunCellCard
				cell={cells[selected.condition]}
				seed={selected.seed}
				evaluation={results[selected.condition] ?? null}
				onclose={() => (selected = null)}
			/>
		{/if}
	</div>
{/if}

<style>
	.heat {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		min-width: 0;
	}

	.chart {
		position: relative;
		/* Fills the card's width; the height gives the seed rows room to read as squares-ish across the
		   run sizes the cap allows (2–32 conditions × 2–12 seeds). NO padding on purpose: the canvas
		   fills this box exactly, so `cellAt` (which measures this box) and `paint` (which draws in the
		   canvas box) share one coordinate space and a hover resolves to the cell under the pointer. */
		width: 100%;
		height: clamp(140px, 22vh, 220px);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel2);
		overflow: hidden;
	}

	.chart :global(canvas:focus-visible) {
		outline: var(--focus-ring);
		outline-offset: -2px;
	}

	.tip-cond {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.tip-val {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.scale {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
		font-variant-numeric: tabular-nums;
	}

	.ramp {
		width: 72px;
		height: 6px;
		border-radius: 3px;
		background: linear-gradient(90deg, var(--data-coral), var(--data-teal));
	}

	.scale-note {
		margin-left: var(--sp-2);
		font-variant-numeric: normal;
	}

	.empty {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ink3);
	}
</style>
