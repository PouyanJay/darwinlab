<!--
  "What it senses right now" — the four inputs, live, exactly as the network receives them.

  The bars fill to the NORMALISED value the brain was actually fed (0–1), while the label reads the
  raw quantity a person can think in ("164 px", "-37°"). Both come from the engine's own snapshot;
  neither is recomputed here.

  The labels are honest about the three different ways a sense can be quiet, because they mean
  completely different things and the panel would be lying if it showed 0 for all of them:

    "off"               the input neuron is cut — this brain evolved without it
    "nothing in range"  the sense works; there is simply no predator within vision
    "receding"          the predator is there and moving AWAY, which the network reads as no threat

  A cut sense is dimmed rather than hidden: its absence is the experiment.
-->
<script lang="ts">
	import { bench } from '$lib/state';
	import type { WorldEntry } from '$lib/state';

	interface Props {
		entry: WorldEntry;
	}

	let { entry }: Props = $props();

	const mind = $derived(bench.mind);
	const senses = $derived(entry.config.senses);

	const round = (value: number) => Math.round(value);

	/** Each bar: how full, what it reads, and whether its neuron is even wired in. */
	const bars = $derived([
		{
			key: 'dist',
			label: 'predator distance',
			on: senses.dist,
			fill: senses.dist && mind.inVision ? mind.distanceInput : 0,
			tone: 'accent',
			value: !senses.dist
				? 'off'
				: mind.inVision
					? `${round(mind.distance)} px`
					: 'nothing in range'
		},
		{
			key: 'dir',
			label: 'direction to threat',
			on: senses.dir,
			// Direction has no magnitude — you either know which way it is or you do not.
			fill: senses.dir && mind.inVision ? 1 : 0,
			tone: 'accent',
			value: !senses.dir ? 'off' : mind.inVision ? `${round(mind.directionDeg)}°` : '—'
		},
		{
			key: 'closing',
			label: 'closing speed',
			on: senses.closing,
			fill: senses.closing && mind.inVision ? mind.closingInput : 0,
			tone: 'danger',
			value: !senses.closing
				? 'off'
				: !mind.inVision
					? '—'
					: mind.closing > 0
						? `+${round(mind.closing)}`
						: 'receding'
		},
		{
			key: 'walls',
			label: 'wall ahead',
			on: senses.walls,
			fill: senses.walls ? mind.wallInput : 0,
			tone: 'accent',
			value: senses.walls ? `${round(mind.wallAhead)} px` : 'off'
		}
	]);
</script>

<div class="bars">
	{#each bars as bar (bar.key)}
		<div class="bar" class:cut={!bar.on}>
			<div class="head">
				<span>{bar.label}</span>
				<b class="tabular">{bar.value}</b>
			</div>
			<div class="track">
				<div
					class="fill"
					class:danger={bar.tone === 'danger'}
					style:width="{Math.min(100, Math.max(0, bar.fill * 100))}%"
				></div>
			</div>
		</div>
	{/each}
</div>

<style>
	.bars {
		display: flex;
		flex-direction: column;
		gap: 9px;
	}

	/* Dimmed, not hidden: a cut sense is the experiment, so it stays on screen saying "off". */
	.cut {
		opacity: 0.35;
	}

	.head {
		display: flex;
		justify-content: space-between;
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		color: var(--ink2);
	}

	.head b {
		color: var(--ink);
	}

	.track {
		height: 5px;
		margin-top: var(--sp-1);
		border-radius: 3px;
		background: var(--chip);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		border-radius: 3px;
		background: var(--accent);
	}

	.danger {
		background: var(--danger);
	}
</style>
