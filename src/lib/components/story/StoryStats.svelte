<!--
  The right rail: the count that matters, and the curve that explains it.

  "Still swimming" is the whole scene in one number — how many of this world's evolved brains are
  still alive right now. Under it, the generation they were bred to and the learning curve that got
  them there, so the number has a history rather than just a value.
-->
<script lang="ts">
	import Canvas from '../common/Canvas.svelte';
	import { paintOnChange } from '../common/paintOnChange';
	import { drawCurve } from '$lib/render';
	import { bench, story, theme } from '$lib/state';

	const entry = $derived(story.entry);
	const accent = $derived(story.source?.config.accent ?? '#4f56d3');

	const register = (render: () => void) => bench.painters.add(render, 'story');

	// The curve only gains a point at a generation boundary — don't repaint it 60×/s. Both ends
	// in the signature: a capped series shift()s as it push()es (see TileStats).
	const paintCurve = paintOnChange(
		() =>
			`${entry?.world.lifeCurve.length}|${entry?.world.lifeCurve.at(0)}|${entry?.world.lifeCurve.at(-1)}|${accent}|${theme.name}`,
		(ctx, width, height) => {
			if (entry) drawCurve(ctx, width, height, entry.world.lifeCurve, accent, theme.name);
		}
	);
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

		{#if entry.stats.schooling}
			<!-- Only in the Shoal scenes: how tightly they pack. Beside the tank's own density glow,
			     this is the number that tells the "scatter → ball" story as it happens. -->
			<div>
				<h2 class="eyebrow">Packed to</h2>
				<p class="count small">
					<b class="tabular" data-testid="story-school">{entry.stats.schoolNND ?? '—'}</b>
					<span>px apart · {entry.stats.schoolAlignPct}% aligned</span>
				</p>
			</div>
		{/if}

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

	/* Stacked under the tank on a narrow stage (see StoryMode) — the fixed rail width goes. */
	@media (max-width: 820px) {
		.rail {
			width: auto;
		}
	}

	h2,
	.eyebrow {
		margin: 0;
		font-size: var(--fs-label);
		letter-spacing: 0.1em;
		color: var(--story-ink3);
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
		color: var(--story-ink);
	}

	.count span {
		font-size: var(--fs-body);
		font-weight: var(--fw-medium);
		color: var(--story-ink3);
	}

	/* The school line is a secondary stat, not the 50px headline the alive count is. */
	.count.small b {
		font-size: 30px;
	}

	.curve-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.curve-head b {
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
		color: var(--story-ink);
	}

	.curve {
		height: 40px;
		margin-top: var(--sp-1);
	}

	.hint {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: 1.5;
		color: var(--story-ink3);
	}
</style>
