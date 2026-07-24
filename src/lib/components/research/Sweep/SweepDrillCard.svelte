<!--
  The drilled cell, opened in the console's right sidebar (the mock is the contract). A cell is a
  RUN (condition × seed); the card answers, in order: WHICH world (the recipe — swept levels loud,
  pinned quiet, all frozen in the cell's own config), WHAT happened (this run → the seed spread →
  the cell mean → its rank among every condition), HOW they survive (the behaviour fingerprint the
  harness already measured, with the sweep-wide average ticked), whether THIS world converged, the
  champion beside its population when Live scoring ran, THE MICROSCOPE (the behaviour trace, folded
  in from the retired Trace instrument: re-evolve this exact recipe keeping the brains, then pit the
  evolved school against a random-brain control on one frozen bout — Q1 and Q5, on demand) — and the
  door into Studio.

  NO decorative world preview, on purpose (the owner's call): every pixel here is a measurement —
  "measured, not watched". Watching is what the door is for. The microscope keeps that rule: its
  paths panels are the traced bout, not an animation.
-->
<script lang="ts">
	import Button from '../../common/Button.svelte';
	import Icon from '../../common/Icon.svelte';
	import QuestionTags from '../QuestionTags.svelte';
	import RunProgress from '../RunProgress.svelte';
	import Trajectories from '../viz/Trajectories.svelte';
	import BehaviorBars from '../viz/BehaviorBars.svelte';
	import { sweep, findings, trace, traceKey } from '$lib/state';
	import { prefersReducedMotion } from '$lib/state/motion.svelte';
	import { configHash } from '$lib/lab/run';
	import { cellRecipe, isUnderTrained } from '$lib/lab/sweep';
	import { ANSWERS } from '$lib/lab/questions';
	import { mean } from '$lib/lab/stats';
	import { behaviorMetrics, traceSummary } from '$lib/harness/traceStudy';
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
		episodes,
		genDuration,
		onclose
	}: {
		cell: SweepCell;
		conditionIndex: number;
		seed: number;
		evaluation: Evaluation | null;
		allResults: (Evaluation | null)[];
		/** Whether the run scored champion clones (the receipt's flag, frozen at run time). */
		championScored: boolean;
		/** The run's training budget (the receipt's, frozen) — the microscope inherits it, which is
		 *  what makes the traced curve comparable to the cell's own. */
		episodes: number;
		/** Sim-seconds per generation, from the same frozen receipt — prices the trace estimate. */
		genDuration: number;
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
		const meanLabel = `${formatSeconds(evaluation.meanReturn)} ± ${evaluation.sdReturn.toFixed(1)}`;
		findings.add({
			source: 'sweep',
			variant: `cell-${conditionIndex}`,
			title: `Condition ${conditionIndex + 1} · ${meanLabel}`,
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

	// ---- the microscope: the behaviour trace, keyed to THIS recipe (config + budget) ----

	const microscopeKey = $derived(traceKey(cell.cfg, episodes));
	const study = $derived(trace.resultFor(microscopeKey));
	const tracing = $derived(trace.runningFor(microscopeKey));
	const summary = $derived(study ? traceSummary(study) : null);
	const metrics = $derived(
		study ? behaviorMetrics(study.evolved.behavior, study.control.behavior) : []
	);
	const panels = $derived(
		study
			? [
					{ title: 'Evolved', trace: study.evolved.trace },
					{ title: 'Random control', trace: study.control.trace }
				]
			: []
	);
	const estimate = $derived(Math.max(1, Math.round(trace.estimateSeconds(episodes, genDuration))));

	// The progress narrated as its stages: the evolve is 0–0.85, then the two frozen bouts (the same
	// split runTraceStudy reports) — so the strip says WHAT is happening, not just how much.
	const stage = $derived.by(() => {
		const p = trace.progress;
		if (p < 0.85) {
			const gen = Math.max(1, Math.min(episodes, Math.ceil((p / 0.85) * episodes)));
			return `evolving at this recipe · gen ${gen}/${episodes} — keeping the brains`;
		}
		return p < 0.93
			? 'frozen bout · tracing the evolved school'
			: 'frozen bout · tracing the random-brain control';
	});

	// The sidebar hides its scrollbar, so the microscope brings itself to the user instead of hoping
	// they scroll: once when the study starts (the progress strip) and again when the results land.
	// Driven from the click handler, not an effect — re-drilling an already-traced cell must NOT jump.
	let microscopeEl: HTMLElement | undefined = $state();

	function showMicroscope(): void {
		microscopeEl?.scrollIntoView({
			block: 'nearest',
			behavior: prefersReducedMotion() ? 'auto' : 'smooth'
		});
	}

	async function runTrace(): Promise<void> {
		showMicroscope();
		await trace.run({ cfg: cell.cfg, episodes, label: `Condition ${conditionIndex + 1}` });
		showMicroscope();
	}

	const traceInReport = $derived(study !== null && trace.inReport(microscopeKey));

	const curve = $derived(evaluation?.curve ?? []);
	const underTrained = $derived(isUnderTrained(curve));

	// The convergence spark, with the traced school overlaid once a study is in. The two curves share
	// one y-scale — the overlay is a comparison, and separate scales would fake agreement — and each
	// spans the full width on its own x (both trained for the same budget; lengths differ only by a
	// cancelled tail).
	const sparkScale = $derived.by(() => {
		const values = [...curve, ...(study?.curve ?? [])];
		const lo = values.length ? Math.min(...values) : 0;
		const hi = values.length ? Math.max(...values) : 1;
		return { lo, span: hi - lo || 1 };
	});

	const toPath = (points: number[]) =>
		points.length < 2
			? ''
			: points
					.map(
						(v, i) =>
							`${(i / (points.length - 1)) * 240},${44 - ((v - sparkScale.lo) / sparkScale.span) * 40}`
					)
					.join(' ');

	const sparkPath = $derived(toPath(curve));
	const tracedPath = $derived(toPath(study?.curve ?? []));
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
			<!-- 4 · did THIS world converge — after a trace, the traced school's own curve lands here
			     as a dashed gold line: one seed beside the cell mean, labeled, never averaged together -->
			<svg class="spark" viewBox="0 0 240 52" aria-label="this cell's learning curve">
				<polyline points={sparkPath} class="curve" />
				{#if tracedPath}
					<polyline points={tracedPath} class="curve traced" data-testid="drill-traced-curve" />
				{/if}
			</svg>
			{#if tracedPath}
				<p class="fpread legend">
					<i class="sw teal"></i> cell mean · {evaluation.n} seeds
					<i class="sw gold"></i> the traced school · 1 seed, same recipe &amp; budget
				</p>
			{/if}
			{#if underTrained}
				<p class="fpread warn" data-testid="drill-under-trained">
					⚠ still climbing at the budget's edge — under-trained
				</p>
			{:else}
				<p class="fpread">converged ✓ — the curve plateaus before the budget ends</p>
			{/if}
		{/if}

		<hr class="sep" />

		<!-- 5 · the microscope — the behaviour trace, folded in: re-evolve THIS recipe keeping the
		     brains, then the evolved school against a random-brain control on one frozen bout -->
		<div class="microscope" bind:this={microscopeEl} data-testid="drill-microscope">
			<div class="row">
				<span class="eyebrow">The microscope</span>
				<QuestionTags questions={ANSWERS.trace} />
			</div>

			{#if study && summary}
				<div class="row">
					<span>evolved · outlive the bout</span>
					<b class="tabular">{summary.evolvedSurvivors}/{summary.total}</b>
				</div>
				<div class="row">
					<span>random-brain control</span>
					<b class="tabular control">{summary.controlSurvivors}/{summary.total}</b>
				</div>

				<Trajectories {panels} />
				<BehaviorBars {metrics} />
				<p class="fpread">
					Same recipe, same frozen bout — only the brains differ. That contrast is the mechanism:
					learning, not luck.
				</p>

				<Button
					class="wide"
					disabled={traceInReport}
					onclick={() => trace.addToReport()}
					data-testid="drill-trace-report"
				>
					<span>{traceInReport ? 'Trace in the report' : 'Send trace to notebook · Q1 + Q5'}</span>
				</Button>
			{:else if tracing}
				<RunProgress progress={trace.progress} oncancel={() => trace.cancel()} />
				<p class="fpread" data-testid="drill-trace-stage">{stage}</p>
			{:else}
				<p class="fpread">
					The sweep scored this world, then discarded its brains. The microscope re-runs the exact
					recipe — same budget, fresh seed — <b>keeps the school it grew</b>, and pits it against a
					random-brain control on one frozen bout.
				</p>
				<Button
					variant="primary"
					class="wide"
					disabled={trace.busyElsewhere(microscopeKey)}
					onclick={runTrace}
					data-testid="drill-trace"
				>
					<span>Trace this world · ≈ {estimate} s</span>
				</Button>
				{#if trace.busyElsewhere(microscopeKey)}
					<p class="fpread">a trace is already running for another cell — it finishes first</p>
				{/if}
			{/if}
		</div>
	{:else}
		<p class="frozen">
			This cell was cancelled before it was measured — there is nothing to report.
		</p>
	{/if}

	<!-- 6 · the doors -->
	<div class="doors">
		<Button variant="primary" class="wide" onclick={() => sweep.watch(cell)}>
			<span>Watch this world</span>
			<Icon name="forward" size={13} />
		</Button>
		{#if evaluation}
			<Button class="wide" disabled={inReport} onclick={addToReport} data-testid="drill-add-report">
				<span>{inReport ? 'In the report' : 'Send cell finding to notebook'}</span>
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

	/* The traced school's curve rides the same axes as the cell mean — one seed, dashed gold, so the
	   comparison is visible without ever being averaged into the teal line. */
	.curve.traced {
		stroke: var(--gold-ink);
		stroke-width: 1.4;
		stroke-dasharray: 4 3;
	}

	.legend {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--sp-2);
	}

	.sw {
		width: 12px;
		height: 2px;
		border-radius: 1px;
		flex: none;
	}

	.sw.teal {
		background: var(--data-teal);
	}

	.sw.gold {
		background: repeating-linear-gradient(90deg, var(--gold-ink) 0 3px, transparent 3px 5px);
	}

	.microscope {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	/* The control's number is muted ink — the baseline that never learned gets no colour. */
	.row b.control {
		color: var(--ink3);
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
