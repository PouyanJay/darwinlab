<!--
  The drilled cell, opened in the console's right sidebar (the mock is the contract). A cell is a
  RUN (condition × seed); the card answers, in order: WHICH world (the recipe — swept levels loud,
  pinned quiet, all frozen in the cell's own config), WHAT happened (this run → the seed spread →
  the cell mean → its rank among every condition), HOW they survive (the behaviour fingerprint the
  harness already measured, with the sweep-wide average ticked), whether THIS world converged, the
  champion beside its population when Live scoring ran — and the door into Studio.

  NO decorative world preview, on purpose (the owner's call): every pixel here is a measurement —
  "measured, not watched". Watching is what the door is for.
-->
<script lang="ts">
	import Button from '../../common/Button.svelte';
	import Icon from '../../common/Icon.svelte';
	import { sweep, findings } from '$lib/state';
	import { configHash } from '$lib/lab/run';
	import { cellRecipe, isUnderTrained } from '$lib/lab/sweep';
	import { mean } from '$lib/lab/stats';
	import { formatSeconds, formatSignedSeconds } from '$lib/format';
	import type { SweepCell } from '$lib/lab/sweep';
	import type { Evaluation } from '$lib/lab/evaluator';
	import type { BehaviorStats } from '$lib/harness/behavior';

	let {
		cell,
		conditionIndex,
		seed,
		evaluation,
		allResults,
		championScored,
		onclose
	}: {
		cell: SweepCell;
		conditionIndex: number;
		seed: number;
		evaluation: Evaluation | null;
		allResults: (Evaluation | null)[];
		/** Whether the run scored champion clones (the receipt's flag, frozen at run time). */
		championScored: boolean;
		onclose: () => void;
	} = $props();

	/** This run's survival — the one seed clicked. */
	const value = $derived(evaluation?.returns[seed]);
	const chips = $derived(cellRecipe(cell));

	// The seed spread: this condition's returns on a shared track, this run's dot ringed.
	const returns = $derived(evaluation?.returns ?? []);
	const seedLo = $derived(returns.length ? Math.min(...returns) : 0);
	const seedHi = $derived(returns.length ? Math.max(...returns) : 1);
	const along = (v: number, lo: number, hi: number) =>
		hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50;

	// Rank among every measured condition — identity by index, ties share the higher rank.
	const condMeans = $derived(
		allResults
			.map((r, index) => ({ index, value: r?.meanReturn }))
			.filter((e): e is { index: number; value: number } => Number.isFinite(e.value))
	);
	const thisMean = $derived(evaluation?.meanReturn ?? NaN);
	const rank = $derived(condMeans.filter((e) => e.value > thisMean).length + 1);

	// The champion beside its population — a paired comparison the evaluator measured. The delta
	// is vs the CELL MEAN: both are means over the same seeds and arenas; a single run's value
	// would mix baselines.
	const championMean = $derived(
		evaluation?.championReturns?.length ? mean(evaluation.championReturns) : null
	);

	/** The behaviour fingerprint: each metric's value on a bar scaled across EVERY condition, with
	 *  the sweep-wide average ticked — "this world bolts harder than a typical cell", readable. */
	const FINGERPRINT: {
		label: string;
		note: string;
		pick: (b: BehaviorStats) => number;
		format: (v: number) => string;
	}[] = [
		{
			label: 'bolts when seen',
			pick: (b) => b.boltRatio,
			format: (v) => `${v.toFixed(1)}×`,
			note: 'speed near the shark vs unseen'
		},
		{
			label: 'flees the right way',
			pick: (b) => b.fleeAngleErrorDeg,
			format: (v) => `${Math.round(v)}° err`,
			note: '90° is aimless drift'
		},
		{
			label: 'dodges the lunge',
			pick: (b) => b.dodgeRate,
			format: (v) => `${Math.round(v * 100)}%`,
			note: 'lunges that end in a whiff'
		},
		{
			label: 'dies cornered',
			pick: (b) => b.cornerDeathShare,
			format: (v) => `${Math.round(v * 100)}%`,
			note: 'deaths boxed by two walls'
		},
		{
			label: 'keeps distance',
			pick: (b) => b.meanPredDistance,
			format: (v) => `${Math.round(v)}px`,
			note: 'mean gap to the nearest shark'
		}
	];

	const fingerprint = $derived.by(() => {
		const b = evaluation?.behavior;
		if (!b) return [];
		const others = allResults.filter((r): r is Evaluation => r != null).map((r) => r.behavior);
		return FINGERPRINT.map((row) => {
			const values = others.map(row.pick);
			const lo = values.length ? Math.min(...values) : 0;
			const hi = values.length ? Math.max(...values) : 1;
			return {
				label: row.label,
				note: row.note,
				text: row.format(row.pick(b)),
				width: along(row.pick(b), lo, hi),
				tick: along(mean(values), lo, hi)
			};
		});
	});

	// The notebook door: one finding per drilled CONDITION (variant-keyed), its own curve as the
	// evidence — a cell the drill found interesting becomes citable in the Report.
	const inReport = $derived(findings.has('sweep', `cell-${conditionIndex}`));

	function addToReport(): void {
		if (!evaluation) return;
		findings.add({
			source: 'sweep',
			variant: `cell-${conditionIndex}`,
			title: `Condition ${conditionIndex + 1} · ${formatSeconds(evaluation.meanReturn)} ± ${evaluation.sdReturn.toFixed(1)}`,
			detail: chips
				.filter((c) => c.swept)
				.map((c) => c.text)
				.join(' · '),
			status: 'ok',
			seeds: evaluation.n,
			configHash: configHash([cell.cfg]),
			...(evaluation.curve ? { evidence: { kind: 'curve', curve: evaluation.curve } } : {})
		});
	}

	const curve = $derived(evaluation?.curve ?? []);
	const underTrained = $derived(isUnderTrained(curve));
	const sparkPath = $derived.by(() => {
		if (curve.length < 2) return '';
		const lo = Math.min(...curve);
		const hi = Math.max(...curve);
		const span = hi - lo || 1;
		return curve
			.map((v, i) => `${(i / (curve.length - 1)) * 240},${44 - ((v - lo) / span) * 40}`)
			.join(' ');
	});
</script>

<div class="drill" data-testid="sweep-drill">
	<header class="head">
		<span class="title tabular">Condition {conditionIndex + 1} · seed {seed + 1}</span>
		<Button variant="icon" aria-label="close drilled run" onclick={onclose}>
			<Icon name="close" size={13} />
		</Button>
	</header>

	<!-- 1 · identity, frozen in the cell's own config -->
	<div class="chips">
		{#each chips as chip (chip.text)}
			<span class="chip" class:hot={chip.swept}>{chip.text}</span>
		{/each}
	</div>
	<p class="frozen">frozen at measurement — later panel edits can't relabel it</p>

	<hr class="sep" />

	<!-- 2 · the number, three layers deep -->
	{#if evaluation}
		<div class="row">
			<span>this run</span>
			<b class="tabular">{value != null ? formatSeconds(value) : '—'}</b>
		</div>
		<svg class="strip" viewBox="0 0 240 26" aria-label="this condition's seeds; this run ringed">
			<line x1="4" y1="14" x2="236" y2="14" class="track" />
			{#each returns as r, i (i)}
				<circle
					cx={4 + (along(r, seedLo, seedHi) * 232) / 100}
					cy="14"
					r={i === seed ? 4 : 3}
					class="dot"
					class:me={i === seed}
				>
					<title>seed {i + 1} · {formatSeconds(r)}</title>
				</circle>
			{/each}
		</svg>
		<div class="row">
			<span>cell mean · {evaluation.n} seeds</span>
			<b class="tabular"
				>{formatSeconds(evaluation.meanReturn)} ± {evaluation.sdReturn.toFixed(1)}</b
			>
		</div>
		<div class="row">
			<span>rank among {condMeans.length} cells</span>
			<b class="tabular">{rank}{rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'}</b
			>
		</div>
		{#if championScored}
			<div class="row" data-testid="drill-champion">
				<span>champion clones</span>
				<b class="tabular">
					{championMean != null
						? `${formatSeconds(championMean)} `
						: '—'}{#if championMean != null}<i class="delta" class:up={championMean > thisMean}
							>{formatSignedSeconds(championMean - thisMean)}</i
						>{/if}
				</b>
			</div>
		{:else}
			<div class="row hint" data-testid="drill-champion-hint">
				<span>champion clones</span>
				<span class="quiet">enable Live scoring</span>
			</div>
		{/if}

		<hr class="sep" />

		<!-- 3 · how they survive — measured, not watched -->
		<div class="row">
			<span class="eyebrow">How they survive</span><span class="quiet">measured, not watched</span>
		</div>
		<div class="fp">
			{#each fingerprint as row (row.label)}
				<div class="fprow" title={row.note}>
					<span class="fpl">{row.label}</span>
					<span class="fpbar"
						><i style:width="{row.width}%"></i><u style:left="{row.tick}%"></u></span
					>
					<b class="tabular">{row.text}</b>
				</div>
			{/each}
		</div>
		<p class="fpread">
			gold ticks = the run's average cell — how this world differs from a typical one.
		</p>

		{#if curve.length >= 2}
			<hr class="sep" />
			<!-- 4 · did THIS world converge -->
			<svg class="spark" viewBox="0 0 240 52" aria-label="this cell's learning curve">
				<polyline points={sparkPath} class="curve" />
			</svg>
			{#if underTrained}
				<p class="fpread warn" data-testid="drill-under-trained">
					⚠ still climbing at the budget's edge — under-trained
				</p>
			{:else}
				<p class="fpread">converged ✓ — the curve plateaus before the budget ends</p>
			{/if}
		{/if}
	{:else}
		<p class="frozen">
			This cell was cancelled before it was measured — there is nothing to report.
		</p>
	{/if}

	<!-- 5 · the doors -->
	<div class="doors">
		<Button variant="primary" class="wide" onclick={() => sweep.watch(cell)}>
			<span>Watch this world</span>
			<Icon name="forward" size={13} />
		</Button>
		{#if evaluation}
			<Button class="wide" disabled={inReport} onclick={addToReport} data-testid="drill-add-report">
				<span>{inReport ? 'In the report' : 'Send to notebook'}</span>
			</Button>
		{/if}
	</div>
</div>

<style>
	.drill {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel2);
		padding: var(--sp-4);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
	}

	.title {
		font-size: var(--fs-md);
		font-weight: var(--fw-bold);
		color: var(--ink);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
	}

	.chip {
		font-size: var(--fs-eyebrow);
		border: 1px solid var(--line);
		border-radius: var(--radius-chip);
		padding: 1px 6px;
		color: var(--ink3);
		background: var(--panel);
		white-space: nowrap;
	}

	/* a swept chip is the cell's identity — full-ink hairline, the platform's loud */
	.chip.hot {
		border-color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--ink);
		color: var(--ink);
	}

	.frozen {
		margin: 0;
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.sep {
		border: 0;
		border-top: 1px solid var(--line);
		margin: var(--sp-1) 0;
	}

	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--sp-3);
		font-size: var(--fs-sm);
		color: var(--ink2);
	}

	.row b {
		color: var(--ink);
		font-size: var(--fs-md);
	}

	.delta {
		font-style: normal;
		font-size: var(--fs-xs);
		color: var(--data-coral);
	}

	.delta.up {
		color: var(--data-teal);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.quiet {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.strip {
		width: 100%;
		height: auto;
		display: block;
	}

	.track {
		stroke: var(--line);
	}

	.dot {
		fill: var(--ink3);
	}

	.dot.me {
		fill: var(--data-teal);
		stroke: var(--ink);
		stroke-width: 1.5;
	}

	.fp {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	.fprow {
		display: grid;
		grid-template-columns: 88px minmax(0, 1fr) auto;
		gap: var(--sp-2);
		align-items: center;
	}

	.fpl {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.fprow b {
		font-size: var(--fs-xs);
		color: var(--ink);
		white-space: nowrap;
	}

	.fpbar {
		position: relative;
		height: 6px;
		border-radius: 3px;
		background: var(--chip);
	}

	.fpbar i {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		border-radius: 3px;
		background: color-mix(in srgb, var(--ink) 45%, transparent);
	}

	.fpbar u {
		position: absolute;
		top: -2px;
		bottom: -2px;
		width: 2px;
		border-radius: 1px;
		background: var(--gold-ink);
	}

	.fpread {
		margin: 0;
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
		line-height: 1.5;
	}

	.fpread.warn {
		color: var(--gold-ink);
	}

	.spark {
		width: 100%;
		height: auto;
		display: block;
	}

	.curve {
		fill: none;
		stroke: var(--data-teal);
		stroke-width: 1.8;
	}

	.doors {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding-top: var(--sp-2);
	}

	.drill :global(.btn.wide) {
		width: 100%;
	}
</style>
