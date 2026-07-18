<!--
  The expanded world, as a WORKBENCH — the alternative to the tile's one long column.

  A world you are giving your full attention to is not read top to bottom; it is operated. So it is
  laid out as a bench: the tank is a stage (shrunk, not stretched wall to wall), the champion's mind
  is docked open on the right where the eye already goes for detail, the graphs sit with the tank as
  the evidence of what it is doing, and the things you RUN — the flee assay, the evaluation, the
  ablation matrix — are separated onto a shelf along the bottom, read as tools rather than more
  readouts. Reached from a world's expand control; the header's collapse drops back to the canvas.

  It composes the same live pieces the tile does (Tank, ExhibitControl, TileStats, the service
  panels, the Brain Inspector) — nothing here is a second copy of that logic, only a second
  arrangement of it. All mutation still goes through the bench store.
-->
<script lang="ts">
	import Tank from './Tank.svelte';
	import ExhibitControl from './ExhibitControl.svelte';
	import TileStats from './TileStats.svelte';
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
	<div class="main">
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
			<div class="senses" role="group" aria-label="observation space: the policy's input channels">
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

		<!-- The stage: a shrunk tank, sized to the world's shape, capped so a wide monitor does not turn
		     it back into a wall. -->
		<div class="stage" style:--tank-aspect="{config.bw} / {config.bh}">
			<Tank {entry} big onselect={(picked) => bench.select(entry.id, picked)} />
		</div>

		{#if bench.lens === 'flee'}
			<LensStrip {entry} />
		{/if}

		<!-- Evidence: the graphs, on their own, separated from the tools below. -->
		<section class="panel evidence" aria-label="evidence">
			<h2 class="panel-title">Evidence</h2>
			<TileStats {entry} />
		</section>

		<!-- Champion clones + the world's primary actions. -->
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

		<!-- The shelf: the things you RUN, each its own panel, side by side. -->
		<div class="shelf">
			<AssayPanel {entry} />
			<EvalPanel {entry} />
			<AblationMatrix {entry} />
		</div>
	</div>

	<!-- The mind, docked open — the champion's brain by default, or whichever fish you click in the
	     tank. Its own scroll, so a long inspector never grows the whole bench. -->
	<aside class="inspector" aria-label="the mind">
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
	.workbench {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 340px;
		gap: var(--sp-6);
		height: 100%;
		min-height: 0;
	}

	/* The bench proper scrolls: the shelf lives at the bottom, reached by scrolling past the stage. */
	.main {
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		padding-right: 4px;
		padding-bottom: var(--sp-6);
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
		max-height: 46vh;
		border-radius: var(--radius-card);
		overflow: hidden;
		background: var(--tank, #000);
	}

	/* A titled surface — the shared shape of every panel on the bench. */
	.panel {
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
	}

	.panel-title {
		margin: 0;
		padding: var(--sp-3) var(--sp-5) 0;
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
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

	/* The service shelf — three tools, equal width, wrapping to a stack when the bench is narrow. */
	.shelf {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: var(--sp-5);
	}

	.shelf :global(.assay),
	.shelf :global(.eval),
	.shelf :global(.ablation) {
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
	}

	.inspector {
		min-height: 0;
		height: 100%;
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
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

	/* On a narrow bench the mind cannot keep a side of its own: it drops below the stage, full width. */
	@media (max-width: 1000px) {
		.workbench {
			grid-template-columns: 1fr;
			height: auto;
		}

		.main {
			overflow-y: visible;
		}

		.inspector {
			height: auto;
			overflow: visible;
		}
	}
</style>
