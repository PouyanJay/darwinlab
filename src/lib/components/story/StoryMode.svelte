<!--
  Story mode — the bench as a film.

  A full-screen takeover, one scene per world, tinted with that world's accent. The centre is the
  same tank the bench uses, drawn big; the rails say what the brains in it were given and how many
  are still alive; the bottom says which scene this is and what it means.

  Everything on screen is still the simulation. The fish are a fresh generation of that world's
  evolved brains, being hunted in real time, and you can click one mid-scene and read its mind —
  the inspector works over a scene exactly as it works over the bench. Nothing here is a recording.
-->
<script lang="ts">
	import Tank from '../bench/Tank.svelte';
	import SensorRail from './SensorRail.svelte';
	import StoryStats from './StoryStats.svelte';
	import StoryTransport from './StoryTransport.svelte';
	import { bench, story } from '$lib/state';

	const source = $derived(story.source);
	const accent = $derived(source?.config.accent ?? '#4f56d3');
	const number = $derived(String(story.index + 1).padStart(2, '0'));

	let stage = $state<HTMLElement>();

	/**
	 * A takeover takes focus.
	 *
	 * Without this, focus stays on the "Play story" button in the top bar — now behind a full-screen
	 * film — and the keyboard breaks in a way that is worse than "nothing happens": Space would press
	 * that button again and re-cut the story from scene one, right under the presenter. Focus moves
	 * into the film, and returns to where it came from on the way out.
	 */
	$effect(() => {
		if (!story.active || !stage) return;
		const invoker = document.activeElement as HTMLElement | null;
		stage.focus();
		return () => {
			if (invoker?.isConnected) invoker.focus();
		};
	});

	/**
	 * The keyboard IS the transport for anyone presenting this: Esc to get out, arrows to move
	 * through the scenes, Space to hold on one. It stands down for a focused control, so Space on
	 * the play button still means "press this button" (Phase 3's lesson).
	 */
	function onkeydown(event: KeyboardEvent) {
		if (!story.active) return;
		const target = event.target as HTMLElement | null;
		const onControl = target?.closest('button, input, [role="radio"]');

		if (event.key === 'Escape') {
			bench.exitStory();
		} else if (event.key === 'ArrowRight') {
			story.next();
		} else if (event.key === 'ArrowLeft') {
			story.previous();
		} else if (event.key === ' ' && !onControl) {
			event.preventDefault();
			bench.togglePlay();
		} else {
			return;
		}
		event.stopPropagation(); // the bench's own Space shortcut must not also fire
	}
</script>

<svelte:window {onkeydown} />

{#if story.active && story.entry && source}
	<section
		bind:this={stage}
		class="story"
		aria-label="story mode"
		tabindex="-1"
		style:--scene-accent={accent}
		style:background="radial-gradient(1100px at 50% -10%, color-mix(in srgb, {accent} 14%, #0d1018), #0a0c12
		62%)"
	>
		<header>
			<button type="button" class="exit" onclick={() => bench.exitStory()}>← Bench</button>
			<span class="disclaimer">real neuroevolution · a teaching caricature, not biology</span>
			<span class="counter">Story · scene {story.index + 1} of {story.total}</span>
		</header>

		<!-- Keyed on the scene, so a cut genuinely re-mounts the stage and re-plays its entrance. -->
		{#key story.index}
			<div class="stage">
				<SensorRail />

				<div class="tank">
					<Tank
						entry={story.entry}
						detail="cinematic"
						big
						onselect={(picked) => bench.select(story.entry!.id, picked)}
					/>
				</div>

				<StoryStats />
			</div>
		{/key}

		<footer>
			<div class="caption">
				<span class="number">{number}</span>
				<div>
					<h1>{source.config.name}</h1>
					<p>{source.config.caption || '—'}</p>
				</div>
			</div>

			<StoryTransport />
		</footer>
	</section>
{/if}

<style>
	.story:focus {
		outline: none; /* it is a screen, not a control — the film arriving is the signal */
	}

	.story {
		position: fixed;
		inset: 0;
		z-index: var(--z-story);
		display: flex;
		flex-direction: column;
		color: #f2f4fa;
	}

	header {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: var(--sp-5) 22px;
	}

	.exit {
		padding: var(--sp-3) 14px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: var(--radius-control);
		background: rgba(255, 255, 255, 0.06);
		color: #f2f4fa;
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
		cursor: pointer;
	}

	.exit:hover {
		background: rgba(255, 255, 255, 0.12);
	}

	/* The honesty line travels with the film. A presentation is exactly when it matters most. */
	.disclaimer {
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		color: rgba(242, 244, 250, 0.35);
	}

	.counter {
		margin-left: auto;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: rgba(242, 244, 250, 0.5);
	}

	.stage {
		flex: 1;
		display: flex;
		gap: var(--sp-7);
		min-height: 0;
		padding: 0 22px;
		animation: scene-in 0.5s var(--ease) both;
	}

	.tank {
		flex: 1;
		min-width: 0;
	}

	footer {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		padding: 10px var(--sp-9) var(--sp-8);
	}

	.caption {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--sp-6);
	}

	.number {
		font-family: var(--font-display);
		font-size: 46px;
		font-weight: var(--fw-bold);
		line-height: 1;
		color: color-mix(in srgb, var(--scene-accent) 65%, transparent);
	}

	.caption > div {
		max-width: 720px;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: var(--fw-semibold);
		color: #fff;
	}

	p {
		margin: 2px 0 0;
		font-size: 14px;
		line-height: 1.5;
		text-wrap: pretty;
		color: rgba(242, 244, 250, 0.66);
	}
</style>
