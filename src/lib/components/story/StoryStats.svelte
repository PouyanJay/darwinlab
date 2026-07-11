<!--
  The right rail: the count that matters, and the curve that explains it.

  "Still swimming" is the whole scene in one number — how many of this world's evolved brains are
  still alive right now. Under it, the generation they were bred to and the learning curve that got
  them there, so the number has a history rather than just a value.
-->
<script lang="ts">
	import Canvas from '../common/Canvas.svelte';
	import { drawCurve } from '$lib/render';
	import { bench, story, theme } from '$lib/state';

	const entry = $derived(story.entry);
	const accent = $derived(story.source?.config.accent ?? '#4f56d3');

	const register = (render: () => void) => bench.painters.add(render);

	function paintCurve(ctx: CanvasRenderingContext2D, width: number, height: number) {
		if (entry) drawCurve(ctx, width, height, entry.world.curve, accent, theme.name);
	}
</script>

{#if entry}
	<div class="rail">
		<div>
			<h2 class="eyebrow">Still swimming</h2>
			<p class="count">
				<b class="tabular" data-testid="story-alive">{entry.stats.alive}</b>
				<span>/ {entry.config.prey}</span>
			</p>
		</div>

		<div>
			<div class="curve-head">
				<span class="eyebrow">evolved</span>
				<b class="tabular">Gen {entry.stats.gen}</b>
			</div>
			<div class="curve">
				<Canvas
					paint={paintCurve}
					{register}
					label="{entry.config.name}: survival rate across {entry.stats.gen} generations"
				/>
			</div>
		</div>

		<p class="hint">click any creature to open its mind</p>
	</div>
{/if}

<style>
	.rail {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 14px;
		width: 196px;
		flex: none;
	}

	h2,
	.eyebrow {
		margin: 0;
		font-size: var(--fs-label);
		letter-spacing: 0.1em;
		color: rgba(242, 244, 250, 0.45);
	}

	.count {
		display: flex;
		align-items: baseline;
		gap: var(--sp-2);
		margin: 0;
	}

	.count b {
		font-family: var(--font-display);
		font-size: 50px;
		font-weight: var(--fw-semibold);
		line-height: 1;
		color: #fff;
	}

	.count span {
		font-size: var(--fs-body);
		font-weight: var(--fw-medium);
		color: rgba(242, 244, 250, 0.45);
	}

	.curve-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.curve-head b {
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
		color: #fff;
	}

	.curve {
		height: 40px;
		margin-top: var(--sp-1);
	}

	.hint {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: 1.5;
		color: rgba(242, 244, 250, 0.42);
	}
</style>
