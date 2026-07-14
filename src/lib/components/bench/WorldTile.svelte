<!--
  One world: a card containing a living population, its controls, and its evidence.

  Everything on it is live and everything on it is editable. The sense pills are the sharp end —
  clicking one cuts or grows an input neuron on every brain in the world, and the learning curve
  underneath answers over the next few generations. That is the experiment the product exists to
  let you run, so it is one click deep, on the tile, not buried in a settings panel.

  All mutation goes through the bench store (README §7); this component never touches a world.
-->
<script lang="ts">
	import Tank from './Tank.svelte';
	import TileStats from './TileStats.svelte';
	import EvalPanel from './EvalPanel.svelte';
	import AblationMatrix from './AblationMatrix.svelte';
	import SensePill from './SensePill.svelte';
	import Button from '../common/Button.svelte';
	import Chip from '../common/Chip.svelte';
	import EditableLabel from '../common/EditableLabel.svelte';
	import { SENSES } from '../senses';
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

	/**
	 * How this environment differs from what it was created as. An eval card's job is to say what is
	 * DIFFERENT about it; without this, a bench of five cards all look equally default and a reader
	 * has to open five dialogs to find the one you changed.
	 *
	 * Derived from the REACTIVE config view, never from `entry.world.cfg` — the world is
	 * `$state.raw`, so a diff read off it would never update. (It didn't; the e2e caught it.)
	 */
	const baseline = $derived(bench.baselineOf(entry.id));
	const diff = $derived(baseline ? configDiff(config, baseline) : {});
	const diffKeys = $derived(Object.keys(diff));
	const diffText = $derived(
		diffKeys.map((k) => `${k} = ${JSON.stringify(diff[k as keyof typeof diff])}`).join(' · ')
	);

	// The ENGINE decides when a world is deployed; the tile does not re-derive it. Two copies of that
	// rule would eventually disagree, and the "· trained" pill would say one thing while the
	// real-world run row said another.
	const trained = $derived(entry.stats.deployed);
</script>

<section class="tile" aria-label="world {index}: {config.name}">
	<header>
		<Chip tone="accent" style="--chip-accent: {config.accent}" class="badge">{badge}</Chip>

		<EditableLabel
			value={config.name}
			label="world name"
			onchange={(name) => bench.renameWorld(entry.id, name)}
		/>

		<Chip tabular data-testid="gen">Gen {entry.stats.gen}{trained ? ' · trained' : ''}</Chip>

		<!-- The destructive controls stay quiet until you are actually on this tile. -->
		<div class="actions">
			<Button
				variant="icon"
				size="sm"
				title="restart evolution from random brains"
				aria-label="reset world"
				onclick={() => bench.resetWorld(entry.id)}
			>
				↻
			</Button>
			<Button
				variant="icon"
				size="sm"
				title="duplicate world"
				aria-label="duplicate world"
				onclick={() => bench.duplicateWorld(entry.id)}
			>
				⧉
			</Button>
			<Button
				variant="icon"
				size="sm"
				tone="danger"
				title="remove world"
				aria-label="remove world"
				onclick={() => bench.removeWorld(entry.id)}
			>
				✕
			</Button>
		</div>
	</header>

	<div class="chips">
		<Chip>{meta}</Chip>
		{#if diffKeys.length}
			<!-- What this environment is, said as a DIFF from the bench it launched with. "Same as the
			     baseline except three adversaries" is the sentence a reader actually needs, and a card
			     that cannot say it is a picture rather than an experiment. -->
			<Chip
				tone="accent"
				style="--chip-accent: {config.accent}"
				title="overrides vs the launched baseline — {diffText}"
			>
				▲ {diffKeys.length} override{diffKeys.length > 1 ? 's' : ''}
			</Chip>
		{/if}
		<div class="senses" role="group" aria-label="observation space — the policy's input channels">
			{#each SENSES as sense (sense.key)}
				<SensePill
					label={sense.short}
					name={sense.name}
					on={!!config.senses[sense.key]}
					accent={config.accent}
					onclick={() => bench.toggleSense(entry.id, sense.key)}
				/>
			{/each}
		</div>
	</div>

	<!-- The tank keeps the WORLD's shape (640×400, or whatever this one was resized to). It used to be
	     a fixed 300px-tall box that the water was letterboxed inside, so a wide card painted a margin
	     of dead pixels around the experiment. -->
	<div class="tank" style:--tank-aspect="{config.bw} / {config.bh}">
		<Tank {entry} onselect={(picked) => bench.select(entry.id, picked)} />
	</div>

	<!-- The card's actions, on a bar of their own. Champion used to float ON the water, which put a
	     button over the one thing on this card you are meant to be watching — and over any fish that
	     swam beneath it. A control that obscures its own subject is in the wrong place. -->
	<div class="toolbar">
		<Button
			size="sm"
			title="inspect the best brain alive"
			onclick={() => bench.selectChampion(entry.id)}
		>
			<span aria-hidden="true">★</span>
			<span>Champion</span>
		</Button>

		<Button size="sm" onclick={() => bench.openConditions(entry.id)}>Conditions</Button>
	</div>

	<TileStats {entry} />
	<EvalPanel {entry} />
	<!-- On the CARD, because the answer belongs to the environment: a channel is worth exactly what
	     ITS OWN conditions make it worth, and a matrix run in some other card's tank answers a
	     question nobody asked. -->
	<AblationMatrix {entry} />
</section>

<style>
	.tile {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
		box-shadow: var(--shadow);
		overflow: hidden;
		animation: fade-up var(--dur-slow) var(--ease) both;
		transition: transform var(--dur) var(--ease);
	}

	.tile:hover {
		transform: translateY(-2px);
	}

	header {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: var(--sp-4) var(--sp-5) 7px;
	}

	/* The name field is the only thing here that should take the slack. */
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
		opacity: 0.6;
		transition: opacity var(--dur-fast) var(--ease);
	}

	/* Revealed on hover — but never hidden from the keyboard, which cannot hover. */
	.tile:hover .actions,
	.actions:focus-within {
		opacity: 1;
	}

	/* Touch cannot hover either: for a coarse pointer the actions are simply visible. */
	@media (pointer: coarse) {
		.actions {
			opacity: 1;
		}
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 5px;
		padding: 0 var(--sp-5) 9px;
	}

	.senses {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-left: 5px;
	}

	.tank {
		aspect-ratio: var(--tank-aspect);
		margin: 0 var(--sp-4);
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
		padding: var(--sp-4) var(--sp-5) var(--sp-2);
	}
</style>
