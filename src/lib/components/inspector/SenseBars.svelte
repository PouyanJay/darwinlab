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
	import Meter from '../common/Meter.svelte';
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
				<span id="sense-{bar.key}">{bar.label}</span>
				<!-- The reading is labelled by its row, so it can be found by name rather than by walking
				     the DOM — and so a screen reader hears "predator distance: 164 px". aria-live is
				     OFF: this number changes every frame, and a status you can ask for must not be a
				     firehose that interrupts. -->
				<b class="tabular" role="status" aria-live="off" aria-labelledby="sense-{bar.key}"
					>{bar.value}</b
				>
			</div>
			<div class="meter">
				<Meter value={bar.fill} tone={bar.tone === 'danger' ? 'danger' : 'accent'} />
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

	/*
	 * Dimmed, not hidden: a cut sense is the experiment, so it stays on screen saying "off".
	 *
	 * But the dimming is on the BAR, never on the words. It used to be `opacity: .35` on the whole
	 * row, which put the label at 1.7:1 against the panel — text no one with less than perfect sight
	 * could read, and a serious axe failure the moment the surface behind it lightened. Faded text is
	 * not a state; it is just text you cannot read. The row says "off" in a colour that holds AA, and
	 * the meter — which carries no words — is what goes quiet.
	 */
	.cut .meter {
		opacity: 0.3;
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

	/* AA-held muted, rather than a fade: --ink3 is the token tuned for exactly this on both panels. */
	.cut .head,
	.cut .head b {
		color: var(--ink3);
	}

	.meter {
		margin-top: var(--sp-1);
	}
</style>
