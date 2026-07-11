<!--
  What the brain decided to DO with what it sensed: the two numbers its output layer produced.

  Turn is bidirectional, so its bar grows out from the centre — left of the tick means the fish is
  turning left, right means right. Thrust only ever goes one way, so it fills from the left.
-->
<script lang="ts">
	import Meter from '../common/Meter.svelte';
	import { bench } from '$lib/state';

	const mind = $derived(bench.mind);

	/** Anything smaller than this is a twitch, not a decision — don't claim a direction for it. */
	const DEADZONE = 0.03;

	const turn = $derived(mind.turn);
	const turnLabel = $derived(
		`${turn > DEADZONE ? 'right ' : turn < -DEADZONE ? 'left ' : ''}${Math.abs(turn).toFixed(2)}`
	);
</script>

<div class="output">
	<div class="head">
		<span id="motor-turn">turn</span>
		<b class="tabular" role="status" aria-labelledby="motor-turn">{turnLabel}</b>
	</div>
	<div class="meter">
		<Meter value={turn} origin="centre" />
	</div>
</div>

<div class="output">
	<div class="head">
		<span id="motor-thrust">thrust</span>
		<b class="tabular" role="status" aria-labelledby="motor-thrust">{mind.thrust.toFixed(2)}</b>
	</div>
	<div class="meter">
		<Meter value={mind.thrust} />
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

	.meter {
		margin-top: var(--sp-1);
	}
</style>
