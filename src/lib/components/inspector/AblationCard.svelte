<!--
  "How would you test that?" — the epistemic beat, and the reason this product is a lab.

  Watching a fish swerve early, you will want to say it PREDICTS the attack. Maybe it does. The card
  hands you the way to find out instead of guessing: cut the closing-speed neuron and watch. If the
  prediction really lived there, the early dodge collapses — and then, over the next generations,
  the learning curve dips and re-heals as evolution routes around the loss.

  The button is not a demo. It is the same live ablation the tile's sense pill performs, on twenty
  real brains.
-->
<script lang="ts">
	import Button from '../common/Button.svelte';
	import { bench } from '$lib/state';
	import type { WorldEntry } from '$lib/state';

	interface Props {
		entry: WorldEntry;
	}

	let { entry }: Props = $props();

	const wired = $derived(entry.config.senses.closing);
</script>

<div class="card">
	<div class="field-label danger">How would you test that?</div>
	<p class="claim">“It looks like it predicts the attack.”</p>
	<p class="body">
		Cut the closing-speed input neuron. If prediction really lived there, the early dodge should
		collapse, then the line reheals as evolution routes around the loss.
	</p>
	<Button variant="primary" size="sm" onclick={() => bench.toggleSense(entry.id, 'closing')}>
		{wired ? 'Ablate: cut closing speed' : 'Restore closing speed'}
	</Button>
</div>

<style>
	.card {
		margin-top: 17px;
		padding: var(--sp-5) var(--sp-5);
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--panel2);
	}

	.danger {
		color: var(--danger-ink); /* danger AS TEXT — see tokens.css */
	}

	.claim {
		margin: var(--sp-2) 0 0;
		font-family: var(--font-display);
		font-size: var(--fs-quote);
		font-weight: var(--fw-semibold);
	}

	.body {
		margin: 5px 0 var(--sp-4);
		font-size: var(--fs-md);
		line-height: var(--leading-body);
		color: var(--ink2);
	}
</style>
