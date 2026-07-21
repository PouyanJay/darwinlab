<!--
  Q5 — how do they DO it (the mechanism)? Small-multiples of the paths a whole population traced through
  one frozen bout, one mini-arena per population, so the shape of one behaviour sits beside another
  (evolved against a random-brain control). A survivor ends its path in a teal dot; a fish that was
  eaten ends in a coral ✕ where its path stops; the hunter is the dashed grey line threading between
  them. The arena frame and the paths are monochrome — teal (survived) and coral (died) are the only
  colours, because the outcome is the data.
-->
<script lang="ts">
	import type { BoutTrace, Point } from '$lib/harness/trace';
	import Figure from './Figure.svelte';
	import DataTable from './DataTable.svelte';
	import { formatSeconds } from '$lib/format';

	let { panels }: { panels: { title: string; trace: BoutTrace }[] } = $props();

	/** Half-length of an outcome mark (✕ arm / dot radius), in arena units — small and fixed. */
	const MARK = 8;

	const points = (path: Point[]) =>
		path.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

	const survived = (t: BoutTrace) => t.fish.filter((f) => !f.died).length;
	const meanLife = (t: BoutTrace) =>
		t.fish.reduce((a, f) => a + f.life, 0) / Math.max(1, t.fish.length);

	const label = $derived(
		`Fish trajectories: ${panels
			.map((p) => `${p.title} ${survived(p.trace)}/${p.trace.fish.length} survived`)
			.join('; ')}.`
	);

	const rows = $derived(
		panels.map((p) => ({
			population: p.title,
			survived: `${survived(p.trace)} / ${p.trace.fish.length}`,
			meanLife: formatSeconds(meanLife(p.trace))
		}))
	);
</script>

<Figure {label}>
	<div class="panels">
		{#each panels as panel (panel.title)}
			<div class="panel">
				<div class="title">{panel.title}</div>
				<svg
					class="arena"
					viewBox="0 0 {panel.trace.bw} {panel.trace.bh}"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<rect
						class="border"
						x="0.5"
						y="0.5"
						width={panel.trace.bw - 1}
						height={panel.trace.bh - 1}
					/>
					{#each panel.trace.fish as fish, i (i)}
						{@const last = fish.path.at(-1)}
						{#if last}
							<polyline class="path" points={points(fish.path)} />
							{#if fish.died}
								<g class="mark died">
									<line
										x1={last.x - MARK}
										y1={last.y - MARK}
										x2={last.x + MARK}
										y2={last.y + MARK}
									/>
									<line
										x1={last.x - MARK}
										y1={last.y + MARK}
										x2={last.x + MARK}
										y2={last.y - MARK}
									/>
								</g>
							{:else}
								<circle class="mark alive" cx={last.x} cy={last.y} r={MARK * 0.7} />
							{/if}
						{/if}
					{/each}
					{#if panel.trace.pred.length > 1}
						<polyline class="pred" points={points(panel.trace.pred)} />
					{/if}
				</svg>
			</div>
		{/each}
	</div>

	{#snippet table()}
		<DataTable
			caption="Survival by population"
			columns={[
				{ key: 'population', label: 'Population', numeric: false },
				{ key: 'survived', label: 'Survived' },
				{ key: 'meanLife', label: 'Mean life' }
			]}
			{rows}
		/>
	{/snippet}
</Figure>

<style>
	.panels {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4);
		min-width: 0;
	}

	.panel {
		flex: 1 1 0;
		min-width: 160px;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	.title {
		font-size: var(--fs-sm);
		color: var(--ink2);
	}

	.arena {
		display: block;
		width: 100%;
		height: auto;
	}

	.border {
		fill: none;
		stroke: var(--line);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}

	.path {
		fill: none;
		stroke: var(--ink3);
		stroke-width: 1;
		stroke-linejoin: round;
		stroke-linecap: round;
		opacity: 0.6;
		vector-effect: non-scaling-stroke;
	}

	.pred {
		fill: none;
		stroke: var(--ink2);
		stroke-width: 1.25;
		stroke-dasharray: 4 3;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}

	/* Outcome IS the data: coral where a fish was caught, teal where one made it to the end. */
	.died line {
		stroke: var(--data-coral);
		stroke-width: 1.5;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}

	.alive {
		fill: var(--data-teal);
	}
</style>
