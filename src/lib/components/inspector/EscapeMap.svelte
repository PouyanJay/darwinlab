<!--
  The escape map — this fish's evolved RULE, not its wiring.

  The brain canvas next door shows the 68 weights; this shows what they DO. `probePolicy` has already
  asked the brain "shark here: what do you do?" at every bearing and distance, and this paints those
  answers on one disc, drawn in the fish's own frame (top = the way it faces). Hue is which way it
  steers, brightness is how hard it bolts, so the strategy reads at a glance.

  It paints from the memoised map the store holds (recomputed only when the genome or the conditions
  change) plus the RAW world, for the one live thing on the picture: where the real shark sits right
  now. Like the tank, it reads the unreactive world directly — there is nothing here for reactivity
  to drive frame to frame.
-->
<script lang="ts">
	import Canvas from '../common/Canvas.svelte';
	import { drawEscapeMap, type EscapeMarker } from '$lib/render';
	import { bench, theme, prefersReducedMotion } from '$lib/state';
	import type { WorldEntry } from '$lib/state';
	import { SCENARIO } from '$lib/lab/scenario';

	interface Props {
		entry: WorldEntry;
	}

	let { entry }: Props = $props();

	// The scenario's own words — "shark", "fish", "Escape map" — so a maze lab reuses this panel
	// with only scenario.ts changed (the sandbox pattern from Phase 12).
	const agent = SCENARIO.agent.one;
	const adversary = SCENARIO.adversary.one;
	const policyMap = SCENARIO.policyMap;

	// 'always': the map rides on top of the bench AND a playing scene alike, like the brain canvas.
	const register = (render: () => void) => bench.painters.add(render, 'always');

	// The map is a property of the brain; this badge is reactive so it flips the instant a sense is
	// cut and the fish's rule collapses to "ignores the shark".
	const flat = $derived(bench.escape.map?.flat ?? false);

	function paint(ctx: CanvasRenderingContext2D, width: number, height: number) {
		if (!entry) return; // the orphaned frame between a selection ending and this unmounting
		const map = bench.escape.map;
		if (!map) return;

		const world = bench.shownOrNull(entry.id);
		// The one live thing on the map: the real shark, resolved into the fish's own frame. dirDeg
		// and d are the ungated true geometry from the snapshot; heading is the fish's own facing.
		let marker: EscapeMarker | null = null;
		const s = world?.sense;
		const f = world?.selFish;
		if (world && s && f && s.inVis) {
			marker = {
				bearing: (s.dirDeg * Math.PI) / 180 - f.heading,
				dist01: Math.min(1, s.d / world.cfg.vision)
			};
		}

		drawEscapeMap(ctx, width, height, {
			map,
			marker,
			t: world?.t ?? 0,
			theme: theme.name,
			reducedMotion: prefersReducedMotion()
		});
	}
</script>

<div class="head">
	<span class="field-label">{policyMap.name}: {policyMap.caption}</span>
</div>

<div class="disc" class:flat>
	<Canvas
		{paint}
		{register}
		label="A polar map of this {agent}'s evolved policy. The {agent} is at the centre facing up; each
		point around it is a possible {adversary} position (angle = bearing, distance from centre =
		range). The colour is which way the {agent} steers there — cool turns left, warm turns right —
		and the brightness is how hard it accelerates. A red ring marks where the {adversary} actually
		is now."
	/>
	{#if flat}
		<p class="ignores">This {agent} ignores where the {adversary} is.</p>
	{/if}
</div>

<div class="caveat">
	Varies the {adversary}'s <b>bearing</b> and <b>distance</b> only; closing rate and wall pressure
	are held fixed, so a {agent} that reads just those senses shows flat here.
</div>

<div class="legend">
	<span><span class="swatch left"></span>turns left</span>
	<span><span class="swatch right"></span>turns right</span>
	<span>bright = bolts</span>
	<span><span class="dot"></span>{adversary} now</span>
</div>

<style>
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.disc {
		position: relative;
		height: 260px;
		margin-top: var(--sp-3);
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--panel2);
		overflow: hidden;
	}

	/* A flat disc says nothing on its own — the badge names what the uniform colour means. */
	.ignores {
		position: absolute;
		inset: auto 0 12px;
		margin: 0 auto;
		width: fit-content;
		max-width: 90%;
		padding: 4px 10px;
		border-radius: 999px;
		background: var(--panel);
		border: 1px solid var(--line);
		font-size: var(--fs-label);
		font-weight: var(--fw-medium);
		color: var(--ink2);
		text-align: center;
	}

	.caveat {
		margin-top: var(--sp-2);
		font-size: var(--fs-label);
		line-height: 1.4;
		color: var(--ink3);
	}

	.caveat b {
		font-weight: var(--fw-semibold);
		color: var(--ink2);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
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
		height: 10px;
		border-radius: 3px;
	}

	/* The same two hues the disc paints with — cool = left, warm = right (see drawEscapeMap). */
	.left {
		background: var(--excite);
	}

	.right {
		background: var(--inhibit);
	}

	.dot {
		width: 9px;
		height: 9px;
		border-radius: 999px;
		border: 1.5px solid var(--danger);
	}
</style>
