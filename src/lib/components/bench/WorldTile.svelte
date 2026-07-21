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
	import AssayPanel from './AssayPanel.svelte';
	import ExhibitControl from './ExhibitControl.svelte';
	import LensStrip from './LensStrip.svelte';
	import TileStats from './TileStats.svelte';
	import EvalPanel from './EvalPanel.svelte';
	import AblationMatrix from './AblationMatrix.svelte';
	import SensePill from './SensePill.svelte';
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

	const status = $derived(trained ? 'trained' : bench.running ? 'evolving' : 'paused');
</script>

<section class="tile" style:--tile-accent={config.accent} aria-label="world {index}: {config.name}">
	<!-- The header is the node's title bar on the lineage canvas. The grip at its start is the DRAG
	     HANDLE — grab it (or any empty header space) and the whole world slides; the canvas reads the
	     data-drag-handle attribute to know a press here means "move the node", not "pan the plane". The
	     name field and the action buttons keep their own presses. -->
	<header data-drag-handle>
		<span class="grip" aria-hidden="true"><Icon name="grip" size={15} /></span>

		<!-- Neutral, whatever the world's accent is: the node chrome stays grey — the accent belongs
		     to the graphs and stats below. -->
		<Chip class="badge">{badge}</Chip>

		<EditableLabel
			value={config.name}
			label="world name"
			onchange={(name) => bench.renameWorld(entry.id, name)}
		/>

		<!-- The dot is the card's pulse: still evolving, standing still, or done training for good.
		     It is DECORATIVE, and deliberately silent — the chip already says "· trained" in words,
		     and whether the sim is running is what the transport button in the sidebar is for. A dot
		     that also spoke would be the third voice saying the same thing. -->
		<Chip tabular data-testid="gen">
			<span class="status {status}" aria-hidden="true"></span>
			Gen {entry.stats.gen}{trained ? ' · trained' : ''}
		</Chip>

		<!-- The destructive controls stay quiet until you are actually on this tile. -->
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
			<!-- A FREE-STANDING copy: same evolved brains, but NOT wired into the tree. Branch (in the
			     toolbar) makes a descendant; this makes an independent world for a separate line of work. -->
			<Button
				variant="icon"
				size="sm"
				title="duplicate as a standalone world (no lineage link)"
				aria-label="duplicate world"
				onclick={() => bench.duplicateWorld(entry.id)}
			>
				<Icon name="duplicate" size={15} />
			</Button>
			<!-- Expand blows this world up into the workbench, the rest becoming a rail. A VIEW action, so
			     it sits with the other view controls, just before the destructive remove. (The way back is
			     the collapse control in the workbench's own header.) -->
			<Button
				variant="icon"
				size="sm"
				title="expand this world"
				aria-label="expand world"
				onclick={() => bench.focus(entry.id)}
			>
				<Icon name="expand" size={15} />
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
			<!-- What this environment is, said as a DIFF from the bench it launched with. "Same as the
			     baseline except three adversaries" is the sentence a reader actually needs, and a card
			     that cannot say it is a picture rather than an experiment. -->
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

	<!-- The tank keeps the WORLD's shape (640×400, or whatever this one was resized to). It used to be
	     a fixed 300px-tall box that the water was letterboxed inside, so a wide card painted a margin
	     of dead pixels around the experiment. -->
	<div class="tank" style:--tank-aspect="{config.bw} / {config.bh}">
		<Tank {entry} onselect={(picked) => bench.select(entry.id, picked)} />
	</div>

	<!-- Champion clones: put ONE brain in the water and the strategy stops being a smear. -->
	<ExhibitControl {entry} />

	<!-- The lens's own reading for this tank, only while the lens is on. The colour in the water and
	     this number are the same quantity — one for the eye, one for the argument. -->
	{#if bench.lens === 'flee'}
		<LensStrip {entry} />
	{/if}

	<!-- The card's actions, on a bar of their own. Champion used to float ON the water, which put a
	     button over the one thing on this card you are meant to be watching — and over any fish that
	     swam beneath it. A control that obscures its own subject is in the wrong place. -->
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

		<!-- The headline action of the lineage canvas: fork a child that inherits these brains. It sits
		     with the primary actions, not among the destructive header icons, because it is the move the
		     canvas exists to make. -->
		<Button size="sm" class="branch-btn" onclick={() => bench.branchWorld(entry.id)}>
			<Icon name="branch" size={13} />
			<span>Branch</span>
		</Button>

		<Button size="sm" onclick={() => bench.openConditions(entry.id)}>
			<Icon name="sliders" size={13} />
			<span>Conditions</span>
		</Button>

		<!-- The Studio→Research round-trip: take THIS world into Research as the subject every instrument
		     then explores around. The mirror of the Atlas's "Watch this world" that comes back the other way. -->
		<Button size="sm" onclick={() => bench.analyzeWorld(entry.id)}>
			<Icon name="flask" size={13} />
			<span>Analyse</span>
		</Button>
	</div>

	<TileStats {entry} />

	<!-- The heavy evidence panels fold away by default: on the canvas a node has to stay compact
	     enough to see its neighbours, and this is the analysis you open when a node has your attention,
	     not the thing you read at a glance. Open, it grows the node; the edges follow. -->
	<details class="analysis">
		<summary>
			<Icon name="chevron-right" size={14} />
			<span>Analysis &amp; assays</span>
		</summary>
		<div class="analysis-body">
			<!-- Stage the question instead of waiting for the ocean to ask it. -->
			<AssayPanel {entry} />
			<EvalPanel {entry} />
			<!-- On the CARD, because the answer belongs to the environment: a channel is worth exactly
			     what ITS OWN conditions make it worth, and a matrix run in some other card's tank answers
			     a question nobody asked. -->
			<AblationMatrix {entry} />
		</div>
	</details>
</section>

<style>
	.tile {
		position: relative;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
		box-shadow: var(--shadow);
		overflow: hidden;
		animation: fade-up var(--dur-slow) var(--ease) both;
		transition:
			transform var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}

	/* The box stays GREY whatever the world's accent is — no header wash, no tint. The accent shows
	   only in the graphs and stat numbers below (via --tile-accent, set on the section above), so
	   the environments tell apart by their charts, not by a paint job on the chrome. */

	.tile:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-lift);
	}

	.status {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ink3);
	}

	/* A generation is running: the dot breathes. It is the only motion on the card's chrome, and it
	   stops the instant the sim does — which is how you tell a paused bench from a stalled one. */
	.status.evolving {
		background: var(--accent);
		animation: pulse 1.6s var(--ease) infinite; /* the app's one pulse rate — see Drawer, SensorRail */
	}

	/* Training is over for good. Gold, like the champion — this population is what is left. */
	.status.trained {
		background: var(--gold);
		animation: none;
	}

	header {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: var(--sp-4) var(--sp-5) 7px;
		/* The header is the node's drag handle on the canvas — grab it to move the world. The name and
		   the action buttons keep their own cursors, so this only shows on the empty header space. */
		cursor: grab;
		touch-action: none;
	}

	/* The grip: the visible "grab me" affordance at the head of the title bar, dimmed until the node
	   is hovered so it doesn't compete with the name at rest. */
	.grip {
		display: flex;
		flex: none;
		margin-left: -2px;
		color: var(--ink3);
		opacity: 0.45;
		transition: opacity var(--dur-fast) var(--ease);
	}

	.tile:hover .grip {
		opacity: 0.9;
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

	/*
	 * The card's action bar, ruled off from the readouts below it.
	 *
	 * Champion used to float ON the water — a button laid over the one thing on the card you are
	 * meant to be watching, and over any fish that swam beneath it. Here it is what a media card's
	 * actions always are: a strip directly under the media, on the tank's own measure, with the
	 * inspect action leading and the environment's settings trailing.
	 */
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
		margin: var(--sp-4) var(--sp-5) 0;
		padding-bottom: var(--sp-4);
		border-bottom: 1px solid var(--line);
	}

	/* The one gold thing on the card, because the champion is the one gold thing in the tank. */
	.toolbar :global(.champion) :global(.icon) {
		color: var(--gold-ink);
	}

	/*
	 * The folded evidence. A native <details>, so it holds its own open state and is keyboard- and
	 * screen-reader-operable for free — the summary is a real disclosure button.
	 */
	.analysis {
		border-top: 1px solid var(--line);
	}

	.analysis > summary {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: var(--sp-3) var(--sp-5);
		cursor: pointer;
		list-style: none;
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		color: var(--ink3);
		user-select: none;
	}

	.analysis > summary::-webkit-details-marker {
		display: none;
	}

	.analysis > summary :global(.icon) {
		transition: transform var(--dur-fast) var(--ease);
	}

	.analysis[open] > summary :global(.icon) {
		transform: rotate(90deg);
	}

	.analysis > summary:hover {
		color: var(--ink);
	}

	.analysis-body {
		display: flex;
		flex-direction: column;
	}
</style>
