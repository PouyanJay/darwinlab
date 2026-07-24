<!--
  Q5 — how do they do it (the mechanism), as numbers? For each behavioural signature, the evolved
  population's bar beside a random-brain control's, so the mechanism reads as the GAP between them:
  evolved fish flee accurately and keep their distance where random brains don't. Each row is scaled to
  its own larger bar (the units differ — degrees, a rate, pixels — so an absolute scale would be
  meaningless); the number is printed, so the bar is the shape and the label the fact. Evolved is the
  survival teal (the behaviour that was selected for); the control is muted ink (the baseline it beat).
  A small "↑/↓ better" note says which direction is competence, since for flee-error the shorter bar wins.
-->
<script lang="ts">
	import type { BehaviorMetric } from '$lib/lab/evidence';
	import { formatBehavior } from '$lib/format';
	import Figure from './Figure.svelte';
	import DataTable from './DataTable.svelte';

	let {
		metrics,
		open
	}: {
		metrics: BehaviorMetric[];
		/** Force the data table open (the Report's "show data" toggle). */
		open?: boolean;
	} = $props();

	/** Bar width as a fraction of the row max — both bars share the row's scale so their gap is honest. */
	const frac = (value: number, max: number) => (max > 0 ? Math.max(0, value / max) : 0);
	const rowMax = (m: BehaviorMetric) => Math.max(m.evolved, m.control, 0);

	const label = $derived(
		`Behaviour, evolved vs a random-brain control: ${metrics
			.map(
				(m) =>
					`${m.label} ${formatBehavior(m.evolved, m.unit)} vs ${formatBehavior(m.control, m.unit)}`
			)
			.join('; ')}.`
	);

	const rows = $derived(
		metrics.map((m) => ({
			metric: m.label,
			evolved: formatBehavior(m.evolved, m.unit),
			control: formatBehavior(m.control, m.unit),
			better: m.higherIsBetter ? 'higher' : 'lower'
		}))
	);
</script>

<Figure {label} {open}>
	<div class="bars">
		{#each metrics as m (m.label)}
			{@const max = rowMax(m)}
			<div class="metric">
				<div class="head">
					<span class="mlabel">{m.label}</span>
					<span class="dir" aria-hidden="true">{m.higherIsBetter ? '↑' : '↓'} better</span>
				</div>
				<div class="row">
					<span class="who">evolved</span>
					<span class="track"
						><i class="fill evolved" style:width={`${frac(m.evolved, max) * 100}%`}></i></span
					>
					<span class="val tabular">{formatBehavior(m.evolved, m.unit)}</span>
				</div>
				<div class="row">
					<span class="who">random</span>
					<span class="track"
						><i class="fill control" style:width={`${frac(m.control, max) * 100}%`}></i></span
					>
					<span class="val tabular">{formatBehavior(m.control, m.unit)}</span>
				</div>
			</div>
		{/each}
	</div>

	{#snippet table()}
		<DataTable
			caption="Behaviour: evolved vs random-brain control"
			columns={[
				{ key: 'metric', label: 'Signature', numeric: false },
				{ key: 'evolved', label: 'Evolved' },
				{ key: 'control', label: 'Random' },
				{ key: 'better', label: 'Better when', numeric: false }
			]}
			{rows}
		/>
	{/snippet}
</Figure>

<style>
	.bars {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		min-width: 0;
	}

	.metric {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--sp-3);
	}

	.mlabel {
		font-size: var(--fs-sm);
		color: var(--ink2);
	}

	.dir {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.row {
		display: grid;
		grid-template-columns: 52px minmax(0, 1fr) 44px;
		align-items: center;
		gap: var(--sp-3);
	}

	.who {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.track {
		height: 8px;
		border-radius: 4px;
		background: var(--panel2);
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: 4px;
	}

	/* Evolved is the data (teal); the random control is the muted baseline it beat. */
	.fill.evolved {
		background: var(--data-teal);
	}

	.fill.control {
		background: var(--ink3);
		opacity: 0.5;
	}

	.val {
		font-size: var(--fs-sm);
		color: var(--ink2);
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
