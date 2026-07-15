<!--
  The brain — 8 → 6 → 2, drawn from this fish's actual 68 evolved weights.

  Not a diagram of a neural network: THIS network. Edge colour is the weight's sign, thickness is
  its magnitude, and the pulses travelling along it are the live signal, |weight × activation|, this
  frame. A sense that has been cut dims its input node and sends nothing, which is what makes the
  ablation visible rather than merely asserted.

  It paints from the RAW world, like the tank does — the genome is 68 floats and the signal changes
  every frame; there is nothing here for reactivity to do.
-->
<script lang="ts">
	import Canvas from '../common/Canvas.svelte';
	import { drawBrain } from '$lib/render';
	import { bench, theme, prefersReducedMotion } from '$lib/state';
	import type { WorldEntry } from '$lib/state';
	import { GLEN } from '$lib/engine';

	interface Props {
		entry: WorldEntry;
	}

	let { entry }: Props = $props();

	// 'always': the inspector rides on top of the bench AND on top of a playing scene alike.
	const register = (render: () => void) => bench.painters.add(render, 'always');

	function paint(ctx: CanvasRenderingContext2D, width: number, height: number) {
		// The tick that ends a selection (the fish is eaten, or its generation turns) paints in
		// that SAME frame, before the effect flush unmounts this canvas — and `entry` chains to
		// the page's derived selection lookup, which is already undefined by then. Skip the one
		// orphaned frame; the unmount is a microtask away. (This froze the whole bench once: the
		// throw killed the sim loop's timer chain.)
		if (!entry) return;

		/*
		 * The world the fish is actually SWIMMING IN — which, while an exhibit is up, is the exhibit
		 * and not the run beneath it.
		 *
		 * This read `entry.world` and drew a brain with no edges at all: the selected fish lives in the
		 * exhibit, so the real world's `sense` snapshot is null, and a null snapshot draws the empty
		 * scaffold — eight input nodes, six hidden, two out, and not one weight between them. The
		 * sense bars beside it were full of numbers the whole time, because they read the store's
		 * published mind (which does use the shown world). One panel was looking at the clone and the
		 * other at the population; only one of them said so.
		 */
		const world = bench.shownOrNull(entry.id);
		if (!world) return;
		drawBrain(ctx, width, height, {
			senses: world.cfg.senses,
			sense: world.sense,
			t: world.t,
			theme: theme.name,
			reducedMotion: prefersReducedMotion()
		});
	}
</script>

<div class="head">
	<span class="field-label">The brain: real evolved weights</span>
	<span class="genes tabular">{GLEN} genes</span>
</div>

<div class="net">
	<Canvas
		{paint}
		{register}
		label="The fish's brain: 8 inputs to 6 hidden neurons to 2 outputs, drawn from its {GLEN}
		evolved weights. Edges that excite (+) and edges that inhibit (−) are drawn in different
		colours; the thicker the edge, the stronger the weight."
	/>
</div>

<div class="legend">
	<span><span class="swatch excite"></span>excite (+)</span>
	<span><span class="swatch inhibit"></span>inhibit (−)</span>
	<span>thickness = weight</span>
</div>

<style>
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.genes {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-medium);
		color: var(--ink3);
	}

	.net {
		height: 224px;
		margin-top: var(--sp-3);
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--panel2);
		overflow: hidden;
	}

	.legend {
		display: flex;
		gap: 12px;
		margin-top: var(--sp-2);
		font-size: var(--fs-label);
		font-weight: var(--fw-medium);
		color: var(--ink3);
	}

	.legend span {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
	}

	.swatch {
		width: 14px;
		height: 2px;
		border-radius: 2px;
	}

	/* The same two colours the canvas paints with — see ThemePalette for why they are their own. */
	.excite {
		background: var(--excite);
	}

	.inhibit {
		background: var(--inhibit);
	}
</style>
