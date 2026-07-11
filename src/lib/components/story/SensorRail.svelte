<!--
  "Brain inputs this world" — the left rail, and the reason the scenes are in this order.

  Each scene hands its fish one more sense than the last, and the rail tags the new one. That tag is
  the argument: watch what difference it makes to the creatures in front of you. Sometimes the
  answer is "everything" (direction), and twice it is "almost nothing" (closing speed, walls) —
  which is the finding the whole product exists to be honest about.
-->
<script lang="ts">
	import { story } from '$lib/state';

	const accent = $derived(story.source?.config.accent ?? 'var(--accent)');
</script>

<div class="rail">
	<h2 class="eyebrow">Brain inputs this world</h2>

	{#each story.senses as sense (sense.key)}
		<div class="sense" class:on={sense.on} class:new={sense.isNew}>
			<!-- Which senses this world gives its brains is the POINT of the rail, and a dimmed border
			     says that to no one who cannot see it. -->
			<span class="visually-hidden"
				>{sense.on ? 'wired in' : 'not given'}{sense.isNew ? ', new this scene' : ''}:</span
			>
			<span class="dot" style:background={sense.isNew ? 'var(--gold)' : sense.on ? accent : ''}
			></span>
			<span class="name">{sense.name}</span>
			{#if sense.isNew}
				<span class="tag">new</span>
			{/if}
		</div>
	{/each}
</div>

<style>
	.rail {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: var(--sp-3);
		width: 196px;
		flex: none;
	}

	h2 {
		margin: 0 0 2px;
		font-size: var(--fs-label);
		letter-spacing: 0.1em;
		color: var(--story-ink3);
	}

	.sense {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 9px var(--sp-5);
		border: 1px solid var(--story-line-soft);
		border-radius: var(--radius-control);
		background: var(--story-surface);
		opacity: 0.4;
	}

	/* A sense this world does NOT have stays on the rail, dimmed. Its absence is the experiment. */
	.on {
		border-color: var(--story-line);
		opacity: 1;
	}

	.new {
		border-color: rgba(240, 178, 94, 0.55);
	}

	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--story-ink3);
	}

	.name {
		flex: 1;
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
		color: var(--story-ink);
	}

	.tag {
		font-size: 9px;
		font-weight: var(--fw-bold);
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--gold);
		animation: pulse 1.6s var(--ease) infinite;
	}
</style>
