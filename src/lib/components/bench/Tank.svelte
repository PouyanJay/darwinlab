<!--
  One world's tank: the canvas the simulation is drawn into, with creature picking.

  Reads the RAW engine world (not a reactive proxy — see state/bench.svelte.ts) and hands it
  straight to the renderer each frame, driven by the sim loop.
-->
<script lang="ts">
	import Canvas from '../common/Canvas.svelte';
	import { drawWorld, pickCreature } from '$lib/render';
	import { bench, theme, prefersReducedMotion } from '$lib/state';
	import type { WorldEntry } from '$lib/state';
	import type { Fish, Predator } from '$lib/engine';

	interface Props {
		entry: WorldEntry;
		/** 'performance' scales god-rays/particulate down so many tanks stay smooth. */
		detail?: 'cinematic' | 'performance';
		onselect?: (picked: { type: 'fish'; obj: Fish } | { type: 'pred'; obj: Predator }) => void;
	}

	let { entry, detail = 'performance', onselect }: Props = $props();

	const reducedMotion = prefersReducedMotion();
	let cursor = $state('default');

	function paint(ctx: CanvasRenderingContext2D, width: number, height: number) {
		drawWorld(entry.world, ctx, width, height, {
			theme: theme.name,
			detail,
			reducedMotion
		});
	}

	function pick(x: number, y: number) {
		const hit = pickCreature(entry.world, x, y);
		if (hit) onselect?.(hit);
	}

	function hover(x: number, y: number) {
		const hit = pickCreature(entry.world, x, y);
		entry.world.hover = hit ? hit.obj : null;
		cursor = hit ? 'pointer' : 'default';
	}

	function leave() {
		entry.world.hover = null;
		cursor = 'default';
	}
</script>

<Canvas
	{paint}
	{cursor}
	register={(render) => bench.registerPainter(render)}
	onpick={pick}
	onhover={hover}
	onleave={leave}
	label="{entry.world.cfg.name} tank — {entry.stats.alive} prey alive, generation {entry.stats
		.gen}. Click a creature to inspect its brain."
/>
