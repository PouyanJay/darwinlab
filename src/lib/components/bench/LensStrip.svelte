<!--
  What the flee lens is saying about THIS tank, in words and in numbers.

  The colours in the water are for the eye; this strip is for the argument. Both are the same
  quantity (engine/flee.ts), so a reader can check one against the other — and the number is what
  survives a screenshot, a comparison, and a sceptic.

  The scale it explains is diverging around 90°, because 90° is not a design choice: it is what a
  fish that ignores the shark scores. Left of it the fish is fleeing; right of it, it is swimming
  into the mouth. That is the whole reading, and it is why a blind tank hovers at chance while a
  bearing tank sits clearly to the left of it.
-->
<script lang="ts">
	import { WorldStats, type WorldEntry } from '$lib/state';
	import { FLEE_CHANCE_DEG } from '$lib/render';

	/** The card refuses to print a mean until it has this much fish-time behind it. */
	const MIN_SAMPLES = WorldStats.LENS_MIN_SAMPLES;
	/** What a fish that ignores the shark scores — the null this reading is measured against. */
	const CHANCE_DEG = FLEE_CHANCE_DEG;

	interface Props {
		entry: WorldEntry;
	}

	let { entry }: Props = $props();

	// The RUNNING mean (see WorldStats.syncLens) — an instantaneous one flips its own verdict between
	// frames. `readable` is how many fish can be read right now, which is what makes the number
	// trustworthy or not: a mean over two fish is not a mean.
	const mean = $derived(entry.stats.fleeNow);
	const samples = $derived(entry.stats.fleeSamples);
	const readable = $derived(entry.stats.fleeReadable);

	/** Where the tank's mean sits on the 0..180 scale, as a percentage across the bar. */
	const marker = $derived(mean === null ? null : Math.min(100, Math.max(0, (mean / 180) * 100)));

	/**
	 * How far this population is from CHANCE, in degrees.
	 *
	 * Not a word. The first version printed a verdict — "fleeing" under 84°, "chance" above it — and a
	 * blind tank measuring 83° was labelled as FLEEING, which is a lie told by a threshold: 83° is
	 * chance with a rounding error. A distance from the null is the honest form, it needs no cutoff to
	 * argue about, and it makes the comparison arithmetic instead of rhetorical: blind comes out 7°
	 * better than a coin toss, bearing comes out 36°.
	 */
	const fromChance = $derived(mean === null ? null : CHANCE_DEG - mean);
</script>

<div class="lens" role="group" aria-label="flee lens">
	<div class="scale">
		<div class="bar" aria-hidden="true">
			{#if marker !== null}
				<span class="marker" style:left="{marker}%"></span>
			{/if}
			<span class="chance" aria-hidden="true"></span>
		</div>
		<div class="ticks" aria-hidden="true">
			<span>0° away</span>
			<span class="mid">90° chance</span>
			<span>180° into</span>
		</div>
	</div>

	<p class="reading">
		{#if mean === null}
			<b class="waiting">measuring…</b>
			<span class="tabular">{readable ? `${samples} of ${MIN_SAMPLES}` : 'nothing in vision'}</span>
		{:else}
			<b class="tabular" data-testid="flee-now">{mean}°</b>
			<span class="tabular">
				{Math.abs(fromChance!)}° {fromChance! >= 0 ? 'better' : 'worse'} than chance · n≈{samples}
			</span>
		{/if}
	</p>
</div>

<style>
	.lens {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
		margin: var(--sp-4) var(--sp-5) 0;
		padding: var(--sp-3) var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-input);
		background: var(--panel2);
		animation: fade-up var(--dur-fast) var(--ease) both;
	}

	.scale {
		flex: 1;
		min-width: 0;
	}

	/* The ramp itself — the same three colours the tank paints with (render/theme.ts). */
	.bar {
		position: relative;
		height: 7px;
		border-radius: 4px;
		background: linear-gradient(
			90deg,
			var(--lens-good) 0%,
			var(--lens-mid) 50%,
			var(--lens-bad) 100%
		);
	}

	/* Chance is a LINE on the scale, not a shade of it: the eye needs the null marked. */
	.chance {
		position: absolute;
		top: -2px;
		bottom: -2px;
		left: 50%;
		width: 1px;
		background: var(--ink);
		opacity: 0.35;
	}

	.marker {
		position: absolute;
		top: 50%;
		width: 9px;
		height: 9px;
		border: 2px solid var(--panel);
		border-radius: 50%;
		background: var(--ink);
		transform: translate(-50%, -50%);
		transition: left var(--dur) var(--ease);
	}

	.ticks {
		display: flex;
		justify-content: space-between;
		margin-top: 3px;
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.mid {
		font-weight: var(--fw-semibold);
	}

	.reading {
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 1px;
		margin: 0;
		text-align: right;
	}

	.reading b {
		font-size: var(--fs-stat);
		font-weight: var(--fw-semibold);
	}

	/* Still filling the window: say so, rather than printing a mean of nine samples. */
	.waiting {
		font-size: var(--fs-body);
		font-weight: var(--fw-medium);
		color: var(--ink3);
	}

	.reading span {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}
</style>
