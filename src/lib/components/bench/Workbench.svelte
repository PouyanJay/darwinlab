<!--
  The expanded world, as a WORKBENCH — the alternative to the tile's one long column.

  A world you are giving your full attention to is not read top to bottom; it is operated. So it is
  laid out as a bench in three zones:

    STAGE      the tank, and almost nothing else — as large as the pane allows, filling the height
               the column gives it at the water's own aspect, with the world's identity and controls
               as one caption bar beneath it.
    METRICS    the champion clones, then every learning curve as its own WIDE chart stacked down the
               column, and the tools you RUN (flee assay, evaluation, ablation) shelved below them.
    MIND       the champion's brain, docked open — senses, escape map, motor outputs — live.

  It is one stacked column on a phone; the mind docks to the side as soon as there is room; and the
  metrics take a column of their own on a wide monitor, where all three zones share one top line and
  none of them scrolls the page. It composes the same live pieces the tile does — nothing here is a
  second copy of that logic, only a second arrangement of it.
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
		<!-- ZONE 1 · STAGE: the world, large, with only its caption bar beneath it. -->
		<div class="stage-zone">
			<!-- The stage: sized by WIDTH in the stacked layouts (the tank at the water's aspect), and by
			     the column's HEIGHT on a wide bench — a size container, so the tank box can take
			     min(full width, full height × aspect) and the water reaches every edge either way. -->
			<div class="stage" style:--tank-w={config.bw} style:--tank-h={config.bh}>
				<div class="tank-box">
					<Tank {entry} big onselect={(picked) => bench.select(entry.id, picked)} />
				</div>
			</div>

			{#if bench.lens === 'flee'}
				<LensStrip {entry} />
			{/if}

			<!-- The caption bar: whose water this is and everything you do TO the world (rename, senses,
			     reset / duplicate / collapse / remove) — one wrapping row under the tank, so the stage
			     starts at the very top of the bench, level with the other two zones. -->
			<div class="bar">
				<Chip class="badge">{badge}</Chip>
				<div class="name">
					<EditableLabel
						value={config.name}
						label="world name"
						onchange={(name) => bench.renameWorld(entry.id, name)}
					/>
				</div>
				<Chip tabular data-testid="gen">
					<span class="status {status}" aria-hidden="true"></span>
					Gen {entry.stats.gen}{trained ? ' · trained' : ''}
				</Chip>
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
			</div>
		</div>

		<!-- ZONE 2 · METRICS: the champion clones, the learning curves as a stack of wide charts, and
		     the tools you RUN on the shelf beneath them — the stage keeps only the water itself. -->
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

			<!-- The metrics: every learning curve as its own WIDE chart, stacked — the quick scalars
			     (alive, eaten, best) live on the rail card and in the mind panel, so here the column
			     spends its whole height on the curves. On a wide bench the stack stretches to fill. -->
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
					title="Survival rate"
					value="{entry.stats.aliveRatePct}%"
					series={() => entry.world.curve}
					draw={drawCurve}
					accent={config.accent}
					label="{config.name}: fraction of the population alive when a generation ends, across {entry
						.stats.gen} generations"
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

			<!-- The shelf: the things you RUN, each its own panel, under the charts they feed. -->
			<div class="shelf">
				<AssayPanel {entry} />
				<EvalPanel {entry} />
				<AblationMatrix {entry} />
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

	/* Stacked inside a BOUNDED pane (the focus view's detail is overflow: hidden), the workbench must
	   scroll itself or everything below the shelf is simply unreachable. Guarded to viewports above
	   the focus view's phone breakpoint: on a phone the detail is auto-height and the whole focus
	   column is the one scroll — a nested scroller there would trap it in a short inner pane. */
	@media (width > 720px) {
		@container detail (width < 760px) {
			.workbench {
				height: 100%;
				min-height: 0;
				overflow-y: auto;
				padding-right: 4px;
			}
		}
	}

	.stage-zone,
	.metrics-zone {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		min-width: 0;
	}

	.stage {
		min-width: 0;
	}

	.tank-box {
		width: 100%;
		aspect-ratio: var(--tank-w) / var(--tank-h);
		border-radius: var(--radius-card);
		overflow: hidden;
		background: var(--tank, #000);
	}

	/* The caption bar: one wrapping row — identity on the left, the icon actions pinned right. */
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 5px 9px;
	}

	.bar .name {
		flex: 0 1 220px;
		min-width: 110px;
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

	.bar :global(.badge) {
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
		margin-left: auto;
	}

	.senses {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
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
		flex-wrap: wrap; /* a narrow metrics column drops Conditions to a second row, not off the edge */
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

	/* The metrics — one column of WIDE charts, each curve its own rectangular card. */
	.metrics-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
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

	/*
		The wide arrangements, AFTER every base rule — these override base declarations (the tank box's
		width, the metrics grid's tracks) at equal specificity, so they must win on source order.
	*/

	/* Two-pane: the bench (stage over metrics) scrolls as one column; the mind is its own scroll. */
	@container detail (min-width: 760px) {
		.workbench {
			grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
			gap: var(--sp-6);
			height: 100%;
			min-height: 0;
		}

		.bench-main {
			min-height: 0;
			overflow-y: auto;
			padding-right: 4px;
			padding-bottom: var(--sp-6);
		}

		.inspector-zone {
			max-width: none;
			min-height: 0;
			height: 100%;
			overflow: hidden;
		}
	}

	/* Three columns: the stage takes the lion's share (the tank is the hero), the metrics a column of
	   their own, and each zone scrolls independently ONLY if it must — at this size the bench is built
	   to fit the height with no page scroll, every zone starting on the same top line. */
	@container detail (min-width: 1240px) {
		.workbench {
			grid-template-columns: minmax(0, 2.6fr) minmax(280px, 1fr) minmax(300px, 340px);
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
			/* an inline-size container, so the stage below can say "no taller than the full-width tank"
			   in terms of the column's own width (cqw) */
			container-type: inline-size;
		}

		.metrics-zone {
			grid-area: metrics;
			min-height: 0;
			overflow-y: auto;
			padding-right: 4px;
		}

		.inspector-zone {
			grid-area: inspector;
		}

		/* The stage becomes a SIZE container taking the height left over by the bar and the shelf —
		   but never more than the full-width tank can use (the cqw cap), so on a tall column the bar
		   and shelf hug the tank instead of being pinned below a void. Inside it the tank box takes
		   min(full width, full height × aspect): as large as the column can physically show the
		   water, whichever axis binds, with nothing letterboxed. */
		.stage {
			flex: 1 1 auto;
			min-height: 220px;
			max-height: calc(100cqw * var(--tank-h) / var(--tank-w));
			container-type: size;
		}

		.tank-box {
			width: min(100%, calc(100cqh * var(--tank-w) / var(--tank-h)));
			margin-inline: auto;
		}

		/* The chart stack stretches to take whatever height the clones and the shelf leave, so the
		   charts grow into rectangles instead of leaving a void. minmax keeps a floor; past it the
		   zone scrolls. */
		.metrics-grid {
			flex: 1;
			min-height: 0;
			grid-auto-rows: minmax(112px, 1fr);
		}

		/* In the side column the tools stack one per row — a 2+1 wrap reads as clutter there. */
		.shelf {
			grid-template-columns: minmax(0, 1fr);
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
