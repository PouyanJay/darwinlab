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
	import SensePill from './SensePill.svelte';
	import Button from '../common/Button.svelte';
	import Chip from '../common/Chip.svelte';
	import EditableLabel from '../common/EditableLabel.svelte';
	import { SENSES } from '../senses';
	import { describeWorld } from './describeWorld';
	import { bench } from '$lib/state';
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
		<div class="senses" role="group" aria-label="senses — the brain's input neurons">
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

	<div class="tank">
		<Tank {entry} onselect={(picked) => bench.select(entry.id, picked)} />
		<div class="champion">
			<Button
				variant="ghost"
				size="sm"
				title="inspect the best brain alive"
				onclick={() => bench.selectChampion(entry.id)}
			>
				★ Champion
			</Button>
		</div>
	</div>

	<TileStats {entry} />
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
		position: relative;
		height: 300px;
		margin: 0 9px;
	}

	.champion {
		position: absolute;
		left: 14px;
		bottom: 10px;
	}

	/* Glass, so the tank reads through it — it floats ON the water, it is not a hole in it. */
	.champion :global(button) {
		border-radius: var(--radius-pill);
		background: var(--glass);
		backdrop-filter: blur(8px);
		font-size: var(--fs-xs);
	}
</style>
