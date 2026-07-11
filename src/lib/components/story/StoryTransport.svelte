<!--
  The transport: the controls of a film, not of a simulation.

  The progress bar is one segment per scene, and it is the film's table of contents — it fills as
  the current scene plays, shows which scenes have been, and every segment is clickable, so a
  presenter can jump straight to the one they came to show.
-->
<script lang="ts">
	import Segmented from '../common/Segmented.svelte';
	import { bench, story, type Speed } from '$lib/state';

	const SPEEDS: { value: Speed; label: string }[] = [
		{ value: 0.5, label: '½×' },
		{ value: 1, label: '1×' },
		{ value: 2, label: '2×' }
	];

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
			style:box-shadow="0 6px 22px -6px {accent}"
			aria-label={bench.running ? 'pause story' : 'play story'}
			onclick={() => bench.togglePlay()}
		>
			{#if bench.running}
				<svg width="13" height="14" viewBox="0 0 10 12" aria-hidden="true">
					<rect x="0" y="0" width="3.4" height="12" rx="1" fill="currentColor" />
					<rect x="6.6" y="0" width="3.4" height="12" rx="1" fill="currentColor" />
				</svg>
			{:else}
				<svg width="13" height="14" viewBox="0 0 10 12" aria-hidden="true">
					<polygon points="0,0 10,6 0,12" fill="currentColor" />
				</svg>
			{/if}
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
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.06);
		color: #f2f4fa;
		font-size: 17px;
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition: background var(--dur-fast) var(--ease);
	}

	.round:not(:disabled):hover {
		background: rgba(255, 255, 255, 0.12);
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
		background: rgba(255, 255, 255, 0.08);
	}

	.speed :global(button) {
		color: rgba(242, 244, 250, 0.55);
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
		background: rgba(255, 255, 255, 0.12);
		cursor: pointer;
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: 3px;
	}
</style>
