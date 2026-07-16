<!--
  The transport: the controls of a film, not of a simulation.

  The progress bar is one segment per scene, and it is the film's table of contents — it fills as
  the current scene plays, shows which scenes have been, and every segment is clickable, so a
  presenter can jump straight to the one they came to show.
-->
<script lang="ts">
	import Segmented from '../common/Segmented.svelte';
	import TransportIcon from '../common/TransportIcon.svelte';
	import { bench, story, SPEEDS } from '$lib/state';

	const accent = $derived(story.source?.config.accent ?? '#4f56d3');

	/** How full each segment is: past scenes are done, the current one is filling, the rest wait. */
	const fill = (index: number) =>
		index < story.index ? 1 : index === story.index ? story.progress : 0;
</script>

<div class="transport">
	<div class="buttons">
		<button
			type="button"
			class="round"
			aria-label="previous scene"
			disabled={story.index === 0}
			onclick={() => story.previous()}
		>
			‹
		</button>

		<button
			type="button"
			class="round play"
			style:background={accent}
			aria-label={bench.running ? 'pause story' : 'play story'}
			onclick={() => bench.togglePlay()}
		>
			<TransportIcon playing={bench.running} size={13} />
		</button>

		<button
			type="button"
			class="round"
			aria-label="next scene"
			disabled={story.isLastScene}
			onclick={() => story.next()}
		>
			›
		</button>

		<div class="speed">
			<Segmented
				label="story speed"
				options={SPEEDS}
				value={bench.speed}
				onchange={(speed) => bench.setSpeed(speed)}
			/>
		</div>
	</div>

	<div class="segments">
		{#each Array.from({ length: story.total }, (_, index) => index) as index (index)}
			<button
				type="button"
				class="segment"
				aria-label="scene {index + 1}"
				aria-current={index === story.index}
				onclick={() => story.goTo(index)}
			>
				<span
					class="fill"
					style:width="{fill(index) * 100}%"
					style:background={story.entry && index <= story.index ? accent : 'transparent'}
				></span>
			</button>
		{/each}
	</div>
</div>

<style>
	.transport {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
	}

	.buttons {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--sp-3);
	}

	.round {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		padding: 0;
		border: 1px solid var(--story-line);
		border-radius: 50%;
		background: var(--story-surface);
		color: var(--story-ink);
		font-size: 17px;
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition: background var(--dur-fast) var(--ease);
	}

	.round:not(:disabled):hover {
		background: var(--story-surface-hover);
	}

	.round:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.play {
		width: 48px;
		height: 48px;
		border: none;
		color: #fff;
	}

	.speed {
		margin-left: 12px;
	}

	/* The story runs on a dark stage, so the speed control's track has to come with it. */
	.speed :global(.segmented) {
		background: var(--story-line-soft);
	}

	.speed :global(button) {
		color: var(--story-ink2);
	}

	.speed :global(.checked) {
		background: rgba(255, 255, 255, 0.92);
		color: #12141c;
	}

	.segments {
		display: flex;
		gap: var(--sp-2);
	}

	/* Each segment is a scene AND a jump: the progress bar doubles as the table of contents. */
	.segment {
		flex: 1;
		height: 5px;
		padding: 0;
		border: none;
		border-radius: 3px;
		background: var(--story-surface-hover);
		cursor: pointer;
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: 3px;
	}

	@media (pointer: coarse) {
		.round {
			width: 44px;
			height: 44px;
		}

		/* The bar still DRAWS 5px tall — background-clip keeps the track inside the content box —
		   but the button around it grows into something a thumb can actually land on. */
		.segment {
			height: 21px;
			padding-block: 8px;
			background-clip: content-box;
		}
	}
</style>
