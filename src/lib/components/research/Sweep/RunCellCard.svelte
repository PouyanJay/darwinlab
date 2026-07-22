<!--
  A drilled cell of the run grid, opened as a full-width card below both result cards. A cell is a RUN
  (condition × seed), but the world is the CONDITION — so the card answers two scientific questions about
  that condition, from data the sweep already measured (no re-run):

    · HOW do the fish here survive? — the behavioural signature (flee accuracy, dodging, distance kept,
      bolting, cornering), the mechanism behind the number. This is the product's whole thesis, per cell.
    · Is this world any GOOD? — where its survival ranks among every condition the sweep measured, plus
      how tightly its own seeds agree.

  "Watch this world" opens the real, evolving tank in Studio — the card is the evidence, Studio is the
  live thing. Nothing here is invented; every value is read from the condition's evaluation.
-->
<script lang="ts">
	import Button from '../../common/Button.svelte';
	import Icon from '../../common/Icon.svelte';
	import { sweep } from '$lib/state';
	import { heatColor } from '$lib/render';
	import { formatSeconds } from '$lib/format';
	import type { SweepCell } from '$lib/lab/sweep';
	import type { Evaluation } from '$lib/lab/evaluator';

	let {
		cell,
		seed,
		evaluation,
		allResults,
		onclose
	}: {
		cell: SweepCell;
		/** 0-indexed seed row the cell sits on. */
		seed: number;
		evaluation: Evaluation | null;
		/** Every condition's result, so this one can be placed among them (the rank + distribution). */
		allResults: (Evaluation | null)[];
		onclose: () => void;
	} = $props();

	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const deg = (v: number) => `${Math.round(v)}°`;
	const px = (v: number) => `${Math.round(v)}px`;

	/** This run's survival — the one seed clicked. */
	const value = $derived(evaluation?.returns[seed]);

	/** The factor levels that define the condition, named for a human (the factor's label, not its key). */
	const levels = $derived(
		Object.entries(cell.levels).map(([key, level]) => ({
			factor: sweep.factors.find((f) => f.key === key)?.label ?? key,
			level
		}))
	);

	/** How the fish in THIS condition survive — the measured mechanism (behaviour.ts), averaged over its
	 *  seeds. Each row is a value plus what it MEANS, so a reader knows which direction is competence. */
	const signature = $derived.by(() => {
		const b = evaluation?.behavior;
		if (!b) return [];
		return [
			{
				label: 'Flee heading',
				value: `${deg(b.fleeAngleErrorDeg)} off`,
				note: '90° is aimless drift — lower is a true escape heading'
			},
			{
				label: 'Dodge rate',
				value: pct(b.dodgeRate),
				note: 'share of the shark’s lunges that end in a whiff'
			},
			{
				label: 'Distance kept',
				value: px(b.meanPredDistance),
				note: 'mean gap held to the nearest shark'
			},
			{
				label: 'Bolt response',
				value: `${b.boltRatio.toFixed(1)}×`,
				note: 'speed near the shark vs. when it is unseen — over 1× bolts'
			},
			{
				label: 'Cornering',
				value: pct(b.cornerTimeShare),
				note: 'time boxed against two walls — lower is safer'
			}
		];
	});

	// This condition's seeds, for the "does it reproduce" spread.
	const returns = $derived(evaluation?.returns ?? []);
	const seedLo = $derived(returns.length ? Math.min(...returns) : 0);
	const seedHi = $derived(returns.length ? Math.max(...returns) : 1);

	// Every measured condition's mean survival, for the "is this world any good" rank + distribution.
	const condMeans = $derived(
		allResults.map((r) => r?.meanReturn).filter((m): m is number => m != null && Number.isFinite(m))
	);
	const thisMean = $derived(evaluation?.meanReturn ?? NaN);
	const condLo = $derived(condMeans.length ? Math.min(...condMeans) : 0);
	const condHi = $derived(condMeans.length ? Math.max(...condMeans) : 1);
	/** 1 = the best-surviving condition. Ties share the higher rank. */
	const rank = $derived(condMeans.filter((m) => m > thisMean).length + 1);

	/** Position a value along a [lo, hi] track as a percentage; centres a degenerate range. */
	const along = (v: number, lo: number, hi: number) =>
		hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50;
	const shade = (v: number, lo: number, hi: number) =>
		heatColor(hi > lo ? (v - lo) / (hi - lo) : 0.5);
</script>

<div class="cellcard" data-testid="sweep-cell">
	<div class="head">
		<span class="eyebrow">Drilled run · seed {seed + 1}</span>
		<button class="close" aria-label="close drilled run" onclick={onclose}>
			<Icon name="close" size={14} />
		</button>
	</div>

	{#if levels.length}
		<div class="levels">
			{#each levels as lv (lv.factor)}
				<span class="lchip">{lv.factor} <b>{lv.level}</b></span>
			{/each}
		</div>
	{:else}
		<p class="levels-none">The base world — no factor varied in this cell.</p>
	{/if}

	<div class="panels">
		<!-- HOW they survive: the behavioural signature (the mechanism). -->
		<section class="panel">
			<span class="ptitle">How they survive · behavioural signature</span>
			{#if signature.length}
				<ul class="sig">
					{#each signature as row (row.label)}
						<li>
							<span class="sig-label">{row.label}</span>
							<span class="sig-val tabular">{row.value}</span>
							<span class="sig-note">{row.note}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">This condition was not measured, so it has no behavioural signature.</p>
			{/if}
		</section>

		<!-- Is this world any good: rank among all conditions, and its own seed spread. -->
		<section class="panel">
			<span class="ptitle">Survival, in context</span>

			<dl class="stats">
				<div>
					<dt>This run</dt>
					<dd class="tabular">{value != null ? formatSeconds(value) : '—'}</dd>
				</div>
				<div>
					<dt>Condition mean</dt>
					<dd class="tabular">
						{#if evaluation}
							{formatSeconds(evaluation.meanReturn)} ± {formatSeconds(evaluation.sdReturn)}
							<span class="over">· {evaluation.n} seeds</span>
						{:else}
							—
						{/if}
					</dd>
				</div>
			</dl>

			{#if condMeans.length > 1 && Number.isFinite(thisMean)}
				<div class="strip">
					<span class="strip-label">
						ranks <b>{rank} of {condMeans.length}</b> conditions for survival
					</span>
					<div class="track" aria-hidden="true">
						{#each condMeans as m, i (i)}
							<span
								class="dot"
								class:me={m === thisMean}
								style:left="{along(m, condLo, condHi)}%"
								style:background={shade(m, condLo, condHi)}
							></span>
						{/each}
					</div>
					<div class="ends tabular" aria-hidden="true">
						<span>{formatSeconds(condLo)}</span>
						<span>worst → best condition</span>
						<span>{formatSeconds(condHi)}</span>
					</div>
				</div>
			{/if}

			{#if returns.length > 1}
				<div class="strip">
					<span class="strip-label">this run among the condition’s {returns.length} seeds</span>
					<div class="track" aria-hidden="true">
						{#each returns as r, i (i)}
							<span
								class="dot"
								class:me={i === seed}
								style:left="{along(r, seedLo, seedHi)}%"
								style:background={shade(r, seedLo, seedHi)}
							></span>
						{/each}
					</div>
					<div class="ends tabular" aria-hidden="true">
						<span>{formatSeconds(seedLo)}</span>
						<span>{formatSeconds(seedHi)}</span>
					</div>
				</div>
			{/if}
		</section>
	</div>

	<div class="foot">
		<Button variant="primary" size="sm" onclick={() => sweep.watch(cell)}>
			<Icon name="forward" size={13} />
			<span>Watch this world evolve</span>
		</Button>
	</div>
</div>

<style>
	.cellcard {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		padding: var(--sp-5);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.eyebrow,
	.ptitle {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.close {
		display: inline-flex;
		padding: 2px;
		border: none;
		background: none;
		color: var(--ink3);
		cursor: pointer;
		border-radius: var(--radius-chip);
	}

	.close:hover {
		color: var(--ink);
	}

	.close:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	.levels {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2);
	}

	.lchip {
		font-size: var(--fs-sm);
		color: var(--ink3);
		border: 1px solid var(--line);
		border-radius: var(--radius-chip);
		padding: 2px 8px;
	}

	.lchip b {
		color: var(--ink);
		font-weight: var(--fw-semibold);
	}

	.levels-none {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ink3);
	}

	/* Two science panels side by side; they stack when the card is narrow (container query on .sweep). */
	.panels {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--sp-5) var(--sp-7);
	}

	@container (max-width: 620px) {
		.panels {
			grid-template-columns: 1fr;
		}
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		min-width: 0;
	}

	.sig {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.sig li {
		display: grid;
		grid-template-columns: minmax(0, 108px) 64px;
		grid-template-areas: 'label val' 'note note';
		align-items: baseline;
		gap: 1px var(--sp-3);
	}

	.sig-label {
		grid-area: label;
		font-size: var(--fs-sm);
		color: var(--ink);
	}

	.sig-val {
		grid-area: val;
		text-align: right;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.sig-note {
		grid-area: note;
		font-size: var(--fs-eyebrow);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2) var(--sp-6);
		margin: 0;
	}

	.stats div {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	dt {
		font-size: var(--fs-eyebrow);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	dd {
		margin: 0;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	dd .over {
		font-size: var(--fs-sm);
		font-weight: var(--fw-regular);
		color: var(--ink3);
	}

	.strip {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.strip-label {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.strip-label b {
		color: var(--ink);
		font-weight: var(--fw-semibold);
	}

	.track {
		position: relative;
		height: 12px;
		border-radius: var(--radius-pill);
		background: var(--panel2);
		border: 1px solid var(--line);
	}

	.dot {
		position: absolute;
		top: 50%;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		transform: translate(-50%, -50%);
	}

	/* This run / this condition is ringed in ink — a "you are here" lightness cue, the colour still data. */
	.dot.me {
		width: 9px;
		height: 9px;
		box-shadow:
			0 0 0 2px var(--panel),
			0 0 0 3px var(--ink);
	}

	.ends {
		display: flex;
		justify-content: space-between;
		gap: var(--sp-3);
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
		font-variant-numeric: tabular-nums;
	}

	.empty {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ink3);
	}

	.foot {
		display: flex;
		justify-content: flex-end;
	}
</style>
