<!--
  A drilled cell of the run grid, opened below it: one CONDITION's world (the whole column shares it),
  and the SEED you clicked within that condition's spread. It shows a peek at the arena, the factor
  levels that define the condition, how this one run did against the condition's mean, and the
  round-trip into Studio. A cell is a run; the world is the condition — so "Watch this world" opens the
  condition, and the spread strip shows where this run sits among its siblings.
-->
<script lang="ts">
	import Button from '../../common/Button.svelte';
	import Icon from '../../common/Icon.svelte';
	import Canvas from '../../common/Canvas.svelte';
	import { sweep, theme } from '$lib/state';
	import { previewWorld, heatColor } from '$lib/render';
	import { formatSeconds } from '$lib/format';
	import type { SweepCell } from '$lib/lab/sweep';
	import type { Evaluation } from '$lib/lab/evaluator';

	let {
		cell,
		seed,
		evaluation,
		onclose
	}: {
		cell: SweepCell;
		/** 0-indexed seed row the cell sits on. */
		seed: number;
		evaluation: Evaluation | null;
		onclose: () => void;
	} = $props();

	/** This run's survival — the one seed clicked. */
	const value = $derived(evaluation?.returns[seed]);

	/** The factor levels that define the condition, named for a human (the factor's label, not its key). */
	const levels = $derived(
		Object.entries(cell.levels).map(([key, level]) => ({
			factor: sweep.factors.find((f) => f.key === key)?.label ?? key,
			level
		}))
	);

	// The condition's own spread, for placing this run among its siblings on a min→max scale.
	const returns = $derived(evaluation?.returns ?? []);
	const lo = $derived(returns.length ? Math.min(...returns) : 0);
	const hi = $derived(returns.length ? Math.max(...returns) : 1);
	const at = (v: number) => (hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50);

	// A peek at the arena for this condition — a preview of the place, not the evolved result; "Watch
	// this world" opens the real, evolving tank in Studio. Painted once per drill (the block is keyed).
	function paintMini(ctx: CanvasRenderingContext2D, w: number, h: number): void {
		previewWorld(cell.cfg, ctx, w, h, theme.name);
	}
</script>

<div class="cellcard" data-testid="sweep-cell">
	<div class="head">
		<span class="eyebrow">Drilled run · seed {seed + 1}</span>
		<button class="close" aria-label="close drilled run" onclick={onclose}>
			<Icon name="close" size={14} />
		</button>
	</div>

	<div class="body">
		<div class="mini">
			{#key `${cell.index}-${theme.name}`}
				<Canvas paint={paintMini} label="preview of the drilled condition's world" />
			{/key}
		</div>

		<div class="info">
			{#if levels.length}
				<div class="levels">
					{#each levels as lv (lv.factor)}
						<span class="lchip">{lv.factor} <b>{lv.level}</b></span>
					{/each}
				</div>
			{:else}
				<p class="levels-none">The base world — no factor varied in this cell.</p>
			{/if}

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

			{#if returns.length > 1}
				<div class="spread">
					<span class="spread-label">this run in the condition's spread</span>
					<div class="track" aria-hidden="true">
						{#each returns as r, i (i)}
							<span
								class="dot"
								class:me={i === seed}
								style:left="{at(r)}%"
								style:background={heatColor(hi > lo ? (r - lo) / (hi - lo) : 0.5)}
							></span>
						{/each}
					</div>
					<div class="ends tabular" aria-hidden="true">
						<span>{formatSeconds(lo)}</span>
						<span>{formatSeconds(hi)}</span>
					</div>
				</div>
			{/if}

			<Button variant="primary" size="sm" onclick={() => sweep.watch(cell)}>
				<Icon name="forward" size={13} />
				<span>Watch this world</span>
			</Button>
		</div>
	</div>
</div>

<style>
	.cellcard {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding: var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel2);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.eyebrow {
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

	.body {
		display: grid;
		grid-template-columns: minmax(0, 200px) minmax(0, 1fr);
		gap: var(--sp-4);
		align-items: start;
	}

	.mini {
		aspect-ratio: 8 / 5;
		width: 100%;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--canvas-bg);
		border: 1px solid var(--line);
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		min-width: 0;
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

	.spread {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.spread-label {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.track {
		position: relative;
		height: 12px;
		border-radius: var(--radius-pill);
		background: var(--panel);
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

	/* This run is ringed in ink — a lightness cue that says "you are here", the colour still the data. */
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
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
		font-variant-numeric: tabular-nums;
	}

	@container (max-width: 460px) {
		.body {
			grid-template-columns: 1fr;
		}
	}
</style>
