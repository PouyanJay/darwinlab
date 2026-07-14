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
	import { DISCLAIMER } from '../common/disclaimer';
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
	 * through the scenes, Space to hold on one.
	 *
	 * But a shortcut must never take a key out of the hands of the control the user is actually on —
	 * that was Phase 3's lesson, and it applies twice here, differently for each key:
	 *
	 *   Space   belongs to any focused BUTTON (it presses it) and to a radio (it picks it).
	 *   Arrows  belong to the speed control — a radio group navigates with them. They do NOT belong
	 *           to a button, so ‹ / › still move the film when the focus is sitting on one.
	 *
	 * Without the arrow guard, pressing → to go from 1× to 2× would ALSO skip the scene: the
	 * presenter changes pace and the film jumps out from under them.
	 */
	function onkeydown(event: KeyboardEvent) {
		if (!story.active) return;
		const target = event.target as HTMLElement | null;
		const takesArrows = target?.closest('[role="radio"], input, select, textarea');
		const takesSpace = target?.closest('button, a, [role="radio"], input, select, textarea');

		if (event.key === 'Escape') {
			// An open inspector owns this Esc (its own window listener closes it in this same
			// dispatch — stopPropagation cannot help between two listeners on one target). The
			// film only leaves on the NEXT press, or the inspector and the film would tear down
			// together in one keystroke.
			if (bench.selection) return;
			bench.exitStory();
		} else if (event.key === 'ArrowRight' && !takesArrows) {
			story.next();
		} else if (event.key === 'ArrowLeft' && !takesArrows) {
			story.previous();
		} else if (event.key === ' ' && !takesSpace) {
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
	<div
		bind:this={stage}
		class="story"
		role="dialog"
		aria-modal="true"
		aria-label="story mode"
		tabindex="-1"
		style:--scene-accent={accent}
		style:background="radial-gradient(1100px at 50% -10%, color-mix(in srgb, {accent} 14%, #0d1018), #0a0c12
		62%)"
	>
		<header>
			<button type="button" class="exit" onclick={() => bench.exitStory()}>← Bench</button>
			<span class="disclaimer">{DISCLAIMER}</span>
			<span class="counter">Story · scene {story.index + 1} of {story.total}</span>
		</header>

		<!-- Keyed on the scene, so a cut genuinely re-mounts the stage and re-plays its entrance. -->
		{#key story.index}
			<div class="stage">
				<SensorRail />

				<div class="tank">
					<Tank
						entry={story.entry}
						detail={bench.detail}
						big
						group="story"
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
	</div>
{/if}

<style>
	/*
	 * The stage's own palette.
	 *
	 * Story mode is a FIXED dark stage — it does not follow the app's light/dark theme, because a
	 * film is a film whichever way the room's lights are set. That is why these are not the usual
	 * tokens. But they are still tokens: four components draw on this stage, and the same six
	 * literals hand-copied between them is exactly the drift tokens.css exists to prevent. They
	 * cascade, so the children just say var(--story-ink).
	 */
	.story {
		--story-ink: #f2f4fa;
		--story-ink2: rgba(242, 244, 250, 0.55);
		--story-ink3: rgba(242, 244, 250, 0.42);
		--story-line: rgba(255, 255, 255, 0.14);
		--story-line-soft: rgba(255, 255, 255, 0.08);
		--story-surface: rgba(255, 255, 255, 0.06);
		--story-surface-hover: rgba(255, 255, 255, 0.12);
	}

	.story:focus {
		outline: none; /* it is a screen, not a control — the film arriving is the signal */
	}

	.story {
		position: fixed;
		inset: 0;
		z-index: var(--z-story);
		display: flex;
		flex-direction: column;
		color: var(--story-ink);
	}

	header {
		display: flex;
		flex-wrap: wrap; /* the honesty line WRAPS on a narrow stage — it never disappears */
		align-items: center;
		gap: var(--sp-3) 14px;
		padding: var(--sp-5) 22px;
	}

	.exit {
		padding: var(--sp-3) 14px;
		border: 1px solid var(--story-line);
		border-radius: var(--radius-control);
		background: var(--story-surface);
		color: var(--story-ink);
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
		cursor: pointer;
	}

	.exit:hover {
		background: var(--story-surface-hover);
	}

	/* The honesty line travels with the film. A presentation is exactly when it matters most. */
	.disclaimer {
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		color: var(--story-ink3);
	}

	.counter {
		margin-left: auto;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--story-ink2);
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
		color: var(--story-ink2);
	}

	/* A phone's film: the tank leads, the rails follow beneath it, and the whole stage scrolls
	   if it must. Two fixed 196px rails beside a tank cannot share 375 points of width. */
	@media (max-width: 820px) {
		.stage {
			flex-direction: column;
			gap: var(--sp-5);
			padding: 0 var(--sp-6);
			overflow-y: auto;
		}

		.tank {
			order: -1; /* the film opens with the water, not with a list of inputs */
			flex: none;
			height: 42vh;
			min-height: 200px;
		}

		header {
			padding: var(--sp-4) var(--sp-6);
		}

		footer {
			padding: 8px var(--sp-6) var(--sp-6);
		}

		.number {
			font-size: 30px;
		}

		h1 {
			font-size: 19px;
		}
	}
</style>
