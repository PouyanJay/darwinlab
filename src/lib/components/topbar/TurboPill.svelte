<!--
  The training indicator: while a turbo burst is running, the bench is fast-forwarding generations
  in time-sliced chunks and the tanks are not being animated. This says so — and says how far it
  has got, because "nothing is moving" and "it froze" look identical without it.

  role="status" so the progress is announced, not just drawn.
-->
<script lang="ts">
	import { bench, story } from '$lib/state';

	// Hidden during a story: training cannot be under way then (playStory refuses to start one), and
	// the film owns the screen regardless.
	const target = $derived(story.active ? null : bench.turboTarget);
</script>

{#if target !== null}
	<p class="turbo" role="status" data-testid="turbo">
		<span class="spinner" aria-hidden="true"></span>
		<span class="tabular">
			training to gen {target} · now {bench.generationsEvolved}
		</span>
	</p>
{/if}

<style>
	.turbo {
		position: fixed;
		top: calc(var(--topbar-height) + var(--sp-1));
		left: 50%;
		transform: translateX(-50%);
		z-index: var(--z-turbo);
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		margin: 0;
		padding: 9px var(--sp-6);
		border-radius: var(--radius-pill);
		background: var(--btn);
		color: var(--btnink);
		box-shadow: var(--shadow-turbo);
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
	}

	.spinner {
		width: 13px;
		height: 13px;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}
</style>
