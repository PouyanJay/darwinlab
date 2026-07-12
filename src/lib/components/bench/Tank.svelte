<!--
  One world's tank: the canvas the simulation is drawn into, with creature picking.

  Reads the RAW engine world (not a reactive proxy — see state/bench.svelte.ts) and hands it
  straight to the renderer each frame, driven by the sim loop. All sim mutation (hover) goes
  through the bench store, never directly into the world.
-->
<script lang="ts">
	import Canvas from '../common/Canvas.svelte';
	import { drawWorld, pickCreature } from '$lib/render';
	import type { Picked } from '$lib/render';
	import { bench, theme, prefersReducedMotion } from '$lib/state';
	import type { WorldEntry } from '$lib/state';

	interface Props {
		entry: WorldEntry;
		/** 'performance' scales god-rays/particulate down so many tanks stay smooth. */
		detail?: 'cinematic' | 'performance';
		/** Big/cinematic rendering — richer light and detail. One tank on screen can afford it. */
		big?: boolean;
		/**
		 * What the click landed on — `null` for empty water, which is a real answer: clicking the
		 * background is how you put a creature down again.
		 */
		onselect?: (picked: Picked | null) => void;
		/**
		 * Which paint group this tank belongs to. Bench tanks sleep while a story plays — the film
		 * covers them; the film's own stage registers as 'story' so it is the one that keeps moving.
		 */
		group?: 'bench' | 'story';
	}

	let { entry, detail = 'performance', big = false, group = 'bench', onselect }: Props = $props();

	let cursor = $state('default');

	function paint(ctx: CanvasRenderingContext2D, width: number, height: number) {
		drawWorld(entry.world, ctx, width, height, {
			theme: theme.name,
			detail,
			big,
			reducedMotion: prefersReducedMotion()
		});
	}

	// Stable identity: Canvas's attachment re-runs if this changes, which would churn the
	// ResizeObserver and re-register the painter on every re-render.
	const register = (render: () => void) => bench.painters.add(render, group);

	function pick(x: number, y: number) {
		onselect?.(pickCreature(entry.world, x, y));
	}

	function hover(x: number, y: number) {
		const hit = pickCreature(entry.world, x, y);
		bench.setHover(entry.id, hit ? hit.obj : null);
		cursor = hit ? 'pointer' : 'default';
	}

	function leave() {
		bench.setHover(entry.id, null);
		cursor = 'default';
	}

	/**
	 * The keyboard's click: arrows walk the creatures, Esc puts the current one down. A handled
	 * key stops here — on the story stage the same arrow would otherwise ALSO skip a scene, and
	 * an Esc that just closed the inspector must not exit the film in the same press.
	 */
	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			bench.cycleSelection(entry.id, 1);
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			bench.cycleSelection(entry.id, -1);
		} else if (event.key === 'Escape' && bench.selection?.worldId === entry.id) {
			bench.clearSelection();
		} else {
			return; // not ours — Space (play/pause) and the film's Esc keep working from here
		}
		event.preventDefault();
		event.stopPropagation();
	}
</script>

<Canvas
	{paint}
	{cursor}
	{register}
	onpick={pick}
	onhover={hover}
	onleave={leave}
	{onkeydown}
	label="{entry.config.name} tank — {entry.stats.alive} prey alive, generation {entry.stats
		.gen}. Click a creature — or focus the tank and use the arrow keys — to inspect its brain."
/>
