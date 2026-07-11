<!--
  What the brain decided to DO with what it sensed: the two numbers its output layer produced.

  Turn is bidirectional, so its bar grows out from the centre — left of the tick means the fish is
  turning left, right means right. Thrust only ever goes one way, so it fills from the left.
-->
<script lang="ts">
	import { bench } from '$lib/state';

	const mind = $derived(bench.mind);

	/** Anything smaller than this is a twitch, not a decision — don't claim a direction for it. */
	const DEADZONE = 0.03;

	const turn = $derived(mind.turn);
	const turnLabel = $derived(
		`${turn > DEADZONE ? 'right ' : turn < -DEADZONE ? 'left ' : ''}${Math.abs(turn).toFixed(2)}`
	);
	// The bar occupies half the track per side: full lock is 50%, from the centre outwards.
	const turnOffset = $derived(turn >= 0 ? 50 : 50 + turn * 50);
	const turnWidth = $derived(Math.abs(turn) * 50);
</script>

<div class="output">
	<div class="head">
		<span>turn</span>
		<b class="tabular">{turnLabel}</b>
	</div>
	<div class="track">
		<span class="centre" aria-hidden="true"></span>
		<div class="fill" style:left="{turnOffset}%" style:width="{turnWidth}%"></div>
	</div>
</div>

<div class="output">
	<div class="head">
		<span>thrust</span>
		<b class="tabular">{mind.thrust.toFixed(2)}</b>
	</div>
	<div class="track">
		<div class="fill" style:width="{Math.min(100, Math.max(0, mind.thrust * 100))}%"></div>
	</div>
</div>

<style>
	.output {
		margin-top: 9px;
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
		position: relative;
		height: 5px;
		margin-top: var(--sp-1);
		border-radius: 3px;
		background: var(--chip);
	}

	/* The zero tick — without it, "turning slightly left" and "going straight" look the same. */
	.centre {
		position: absolute;
		left: 50%;
		top: -2px;
		width: 1px;
		height: 9px;
		background: var(--ink3);
	}

	.fill {
		position: absolute;
		height: 100%;
		border-radius: 3px;
		background: var(--accent);
	}
</style>
