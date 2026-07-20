<!--
  The expanded world, as a WORKBENCH — the alternative to the tile's one long column.

  A world you are giving your full attention to is not read top to bottom; it is operated. So it is
  laid out as a bench in three zones:

    STAGE      the tank, large — the thing you are watching — with the tools you RUN (flee assay,
               evaluation, ablation) on a shelf directly beneath it.
    METRICS    the champion clones and, below them, a GRID of the world's metrics, each curve on its
               own little chart instead of packed into one block.
    MIND       the champion's brain, docked open — senses, escape map, motor outputs — live.

  It is one stacked column on a phone; the mind docks to the side as soon as there is room; and the
  metrics take a column of their own on a wide monitor. It composes the same live pieces the tile
  does — nothing here is a second copy of that logic, only a second arrangement of it.
-->
<script lang="ts">
	import Tank from './Tank.svelte';
	import ExhibitControl from './ExhibitControl.svelte';
	import MetricCard from './MetricCard.svelte';
	import AssayPanel from './AssayPanel.svelte';
	import EvalPanel from './EvalPanel.svelte';
	import AblationMatrix from './AblationMatrix.svelte';
	import LensStrip from './LensStrip.svelte';
	import SensePill from './SensePill.svelte';
	import BrainInspector from '../inspector/BrainInspector.svelte';
	import Button from '../common/Button.svelte';
	import Chip from '../common/Chip.svelte';
	import Icon from '../common/Icon.svelte';
	import EditableLabel from '../common/EditableLabel.svelte';
	import { sensesFor } from '../senses';
	import { describeWorld } from './describeWorld';
	import { bench } from '$lib/state';
	import { drawCurve, drawDecay, drawSchoolCurve } from '$lib/render';
	import { configDiff } from '$lib/lab/run';
	import type { WorldEntry } from '$lib/state';

	interface Props {
		entry: WorldEntry;
		/** Its place in the bench, for the badge — 1-based, shown as "01". */
		index: number;
	}

	let { entry, index }: Props = $props();

	const config = $derived(entry.config);
	const badge = $derived(String(index).padStart(2, '0'));
	const meta = $derived(describeWorld(config));

	const baseline = $derived(bench.baselineOf(entry.id));
	const diff = $derived(baseline ? configDiff(config, baseline) : {});
	const diffKeys = $derived(Object.keys(diff));
	const diffText = $derived(
		diffKeys.map((k) => `${k} = ${JSON.stringify(diff[k as keyof typeof diff])}`).join(' · ')
	);

	const trained = $derived(entry.stats.deployed);
	const status = $derived(trained ? 'trained' : bench.running ? 'evolving' : 'paused');

	// The held-out run's one-line state, short enough for a metric card's corner (the full sentence
	// lives in the deploy readout the tile carries; here it is the value on the Held-out chart).
	const deployValue = $derived.by(() => {
		const { deployed, extinctT, halfLife, deployT } = entry.stats;
		if (!deployed) return '—';
		if (extinctT !== null) return `wiped ${extinctT.toFixed(0)}s`;
		if (halfLife !== null) return `½ ${halfLife.toFixed(0)}s`;
		return `${deployT.toFixed(0)}s`;
	});
	const bestValue = $derived(
		entry.stats.bestFitness ? `${entry.stats.bestFitness.toFixed(1)}s` : '—'
	);

	// Open the champion's mind the moment this world takes the bench, and again whenever we switch to a
	// different world (the component is keyed on the world id, so this re-runs on a fresh mount). Let go
	// of the selection when the workbench leaves, so collapsing back to the canvas does not pop the
	// overlay inspector open over the tree. selectChampion no-ops when nothing is alive to watch.
	$effect(() => {
		void entry.id;
		bench.selectChampion(entry.id);
		return () => bench.clearSelection();
	});

	// The mind panel shows a fish from THIS world; a selection belonging to another world (or none)
	// leaves the dock in its empty state rather than showing a stranger.
	const mindSelection = $derived(
		bench.selection && bench.selection.worldId === entry.id ? bench.selection : null
	);
</script>

<div class="workbench" aria-label="world {index}: {config.name}">
	<!-- bench-main: a flex column on small screens (stage over metrics, scrolling as one); at the
	     widest size it becomes `display: contents`, so the two zones drop straight into the workbench
	     grid as their own columns. -->
	<div class="bench-main">
		<!-- ZONE 1 · STAGE: the world large, its tools beneath it. -->
		<div class="stage-zone">
			<header>
				<Chip class="badge">{badge}</Chip>
				<EditableLabel
					value={config.name}
					label="world name"
					onchange={(name) => bench.renameWorld(entry.id, name)}
				/>
				<Chip tabular data-testid="gen">
					<span class="status {status}" aria-hidden="true"></span>
					Gen {entry.stats.gen}{trained ? ' · trained' : ''}
				</Chip>

				<div class="actions">
					<Button
						variant="icon"
						size="sm"
						title="restart evolution from random brains"
						aria-label="reset world"
						onclick={() => bench.resetWorld(entry.id)}
					>
						<Icon name="reset" size={15} />
					</Button>
					<Button
						variant="icon"
						size="sm"
						title="duplicate as a standalone world (no lineage link)"
						aria-label="duplicate world"
						onclick={() => bench.duplicateWorld(entry.id)}
					>
						<Icon name="duplicate" size={15} />
					</Button>
					<Button
						variant="icon"
						size="sm"
						title="collapse back to the bench"
						aria-label="collapse world"
						onclick={() => bench.unfocus()}
					>
						<Icon name="collapse" size={15} />
					</Button>
					<Button
						variant="icon"
						size="sm"
						tone="danger"
						title="remove world"
						aria-label="remove world"
						onclick={() => bench.removeWorld(entry.id)}
					>
						<Icon name="close" size={15} />
					</Button>
				</div>
			</header>

			<div class="chips">
				<Chip>{meta}</Chip>
				{#if diffKeys.length}
					<Chip title="overrides vs the launched baseline: {diffText}">
						▲ {diffKeys.length} override{diffKeys.length > 1 ? 's' : ''}
					</Chip>
				{/if}
				<div
					class="senses"
					role="group"
					aria-label="observation space: the policy's input channels"
				>
					{#each sensesFor(config.senses) as sense (sense.key)}
						<SensePill
							label={sense.short}
							name={sense.name}
							on={!!config.senses[sense.key]}
							onclick={() => bench.toggleSense(entry.id, sense.key)}
						/>
					{/each}
				</div>
			</div>

			<!-- The stage: the tank sized to the WATER's own aspect and filled by width, so the water
			     reaches every edge — no dead black bands. -->
			<div class="stage" style:--tank-aspect="{config.bw} / {config.bh}">
				<Tank {entry} big onselect={(picked) => bench.select(entry.id, picked)} />
			</div>

			{#if bench.lens === 'flee'}
				<LensStrip {entry} />
			{/if}

			<!-- The shelf: the things you RUN, each its own panel, directly under the world they act on. -->
			<div class="shelf">
				<AssayPanel {entry} />
				<EvalPanel {entry} />
				<AblationMatrix {entry} />
			</div>
		</div>

		<!-- ZONE 2 · METRICS: the champion clones, then the world's metrics as a grid of charts. -->
		<div class="metrics-zone">
			<section class="panel clones">
				<ExhibitControl {entry} />
				<div class="toolbar">
					<Button
						size="sm"
						class="champion"
						title="inspect the best brain alive"
						onclick={() => bench.selectChampion(entry.id)}
					>
						<Icon name="star" size={13} />
						<span>Champion</span>
					</Button>
					<Button size="sm" class="branch-btn" onclick={() => bench.branchWorld(entry.id)}>
						<Icon name="branch" size={13} />
						<span>Branch</span>
					</Button>
					<Button size="sm" onclick={() => bench.openConditions(entry.id)}>
						<Icon name="sliders" size={13} />
						<span>Conditions</span>
					</Button>
				</div>
			</section>

			<div class="stat-row">
				<div class="stat">
					<span class="sk">Alive</span>
					<b class="tabular" data-testid="alive"
						>{entry.stats.alive}<span class="dim"> / {config.prey}</span></b
					>
				</div>
				<div class="stat">
					<span class="sk">Eaten</span>
					<b class="tabular" data-testid="eaten">{entry.stats.eaten}</b>
				</div>
				<div class="stat">
					<span class="sk">Best this gen</span>
					<b class="tabular">{bestValue}</b>
				</div>
			</div>

			<div class="metrics-grid">
				<MetricCard
					title="Mean return / episode"
					value="{entry.stats.survivalPct}%"
					series={() => entry.world.lifeCurve}
					draw={drawCurve}
					accent={config.accent}
					label="{config.name}: mean return per episode across {entry.stats
						.gen} generations, now {entry.stats.survivalPct}%"
				/>
				<MetricCard
					title="Held-out run"
					value={deployValue}
					series={() => entry.world.decay}
					draw={drawDecay}
					accent={config.accent}
					label="{config.name}: how fast the deployed population is wiped out"
				/>
				{#if entry.stats.schooling}
					<MetricCard
						title="School tightness"
						value="{entry.stats.schoolNND ?? '—'}px"
						series={() => entry.world.schoolCurve}
						draw={drawSchoolCurve}
						accent={config.accent}
						label="{config.name}: how tightly the school packs across {entry.stats.gen} generations"
					/>
				{/if}
			</div>
		</div>
	</div>

	<!-- ZONE 3 · MIND: the champion's brain, docked open — or whichever fish you click in the tank. -->
	<aside class="inspector-zone" aria-label="the mind">
		{#if mindSelection}
			<BrainInspector docked selection={mindSelection} {entry} />
		{:else}
			<div class="mind-empty">
				<span class="dot" aria-hidden="true"></span>
				<h2>Fish mind</h2>
				<p>Click any fish in the tank — or press ★ Champion — to read a real evolved brain here.</p>
			</div>
		{/if}
	</aside>
</div>

<style>
	/*
		Mobile-first: ONE stacked column. The mind docks to the side once the pane is wide enough (760),
		and the metrics break out into a column of their own on a wide monitor (1240) — all measured
		against the workbench's own CONTAINER, not the viewport, because the sidebar and the rail eat
		into the width a viewport query cannot see.
	*/
	.workbench {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--sp-5);
		min-width: 0;
	}

	.bench-main {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		min-width: 0;
	}

	/* Two-pane: the bench (stage over metrics) scrolls as one column; the mind is its own scroll. */
	@container detail (min-width: 760px) {
		.workbench {
			grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
			gap: var(--sp-6);
			height: 100%;
			min-height: 0;
			max-width: 1760px;
			margin: 0 auto;
		}

		.bench-main {
			min-height: 0;
			overflow-y: auto;
			padding-right: 4px;
			padding-bottom: var(--sp-6);
		}

		.inspector-zone {
			min-height: 0;
			height: 100%;
			overflow: hidden;
		}
	}

	/* Three columns: the metrics take a column of their own beside the stage, and each zone scrolls
	   independently so the whole bench fits the height without a page scroll. */
	@container detail (min-width: 1240px) {
		.workbench {
			grid-template-columns: minmax(0, 1.7fr) minmax(320px, 1fr) minmax(300px, 360px);
			grid-template-areas: 'stage metrics inspector';
		}

		/* contents: the two zones drop into the workbench grid as real columns. */
		.bench-main {
			display: contents;
		}

		.stage-zone {
			grid-area: stage;
			min-height: 0;
			overflow-y: auto;
			padding-right: 4px;
			padding-bottom: var(--sp-6);
		}

		.metrics-zone {
			grid-area: metrics;
			min-height: 0;
			overflow-y: auto;
			padding-right: 4px;
			padding-bottom: var(--sp-6);
		}

		.inspector-zone {
			grid-area: inspector;
		}
	}

	.stage-zone,
	.metrics-zone {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		min-width: 0;
	}

	header {
		display: flex;
		align-items: center;
		gap: 9px;
	}

	.status {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ink3);
	}

	.status.evolving {
		background: var(--accent);
		animation: pulse 1.6s var(--ease) infinite;
	}

	.status.trained {
		background: var(--gold);
	}

	header :global(.badge) {
		flex: none;
		min-width: 24px;
		justify-content: center;
		border-radius: var(--radius-chip);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
	}

	.actions {
		display: flex;
		flex: none;
		gap: 2px;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 5px;
		margin-top: calc(-1 * var(--sp-2));
	}

	.senses {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-left: 5px;
	}

	.stage {
		aspect-ratio: var(--tank-aspect);
		width: 100%;
		border-radius: var(--radius-card);
		overflow: hidden;
		background: var(--tank, #000);
	}

	.panel {
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
	}

	.clones {
		display: flex;
		flex-direction: column;
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		margin: 0 var(--sp-5) var(--sp-4);
	}

	.toolbar :global(.branch-btn) {
		margin-left: auto;
	}

	.clones :global(.champion) :global(.icon) {
		color: var(--gold-ink);
	}

	/* Three quick scalars in a row, ahead of the charts. */
	.stat-row {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--sp-3);
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: var(--sp-3) var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
	}

	.stat .sk {
		font-size: var(--fs-eyebrow);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--ink3);
	}

	.stat b {
		font-size: var(--fs-stat);
		font-weight: var(--fw-semibold);
	}

	.stat .dim {
		font-size: var(--fs-sm);
		font-weight: var(--fw-regular);
		color: var(--ink3);
	}

	/* The metrics grid — each curve its own card; two across when there is room, one when there isn't. */
	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
		gap: var(--sp-3);
	}

	/* The service shelf, directly under the stage. Cards want ~280px so the flee assay's label, blurb
	   and Run button sit on one comfortable line; below that they wrap, and stack on a phone. */
	.shelf {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
		gap: var(--sp-4);
	}

	.shelf :global(.assay),
	.shelf :global(.eval),
	.shelf :global(.ablation) {
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
	}

	/* The mind: stacked (default) it flows below the bench, capped to a reading column so its escape
	   map never stretches into a billboard; docked, it is an independently scrolling side column. */
	.inspector-zone {
		min-width: 0;
		max-width: 480px;
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
	}

	@container detail (min-width: 760px) {
		.inspector-zone {
			max-width: none;
		}
	}

	.mind-empty {
		padding: var(--sp-6);
		color: var(--ink3);
	}

	.mind-empty .dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ink3);
		margin-right: 7px;
	}

	.mind-empty h2 {
		display: inline;
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: var(--fw-semibold);
		color: var(--ink2);
	}

	.mind-empty p {
		margin: var(--sp-4) 0 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
	}
</style>
