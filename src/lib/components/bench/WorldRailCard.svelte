<!--
  A world as a rail card — the shrunk form it takes in the focus view while another world is blown
  up to fill the pane.

  It carries exactly what you COMPARE across worlds and nothing you operate: a live tank preview, the
  name and generation, and the one graph the whole product argues about (mean return per episode)
  next to how many are still alive. The buttons — Champion, Branch, Conditions — live on the focused
  card only; acting on a world you are not looking at is rare, and a rail of tiny toolbars is noise.
  Click the card to bring this world into focus. The tank preview is PASSIVE: no picking, no arrow
  keys — the whole card is one target, "look at this one".
-->
<script lang="ts">
	import Canvas from '../common/Canvas.svelte';
	import Chip from '../common/Chip.svelte';
	import { paintOnChange } from '../common/paintOnChange';
	import { drawWorld, drawCurve } from '$lib/render';
	import { bench, theme, prefersReducedMotion } from '$lib/state';
	import type { WorldEntry } from '$lib/state';

	interface Props {
		entry: WorldEntry;
		/** Its place in the bench, for the badge — 1-based, shown as "01". */
		index: number;
		/** True when this is the world currently blown up in the detail pane. */
		active: boolean;
		onfocus: () => void;
	}

	let { entry, index, active, onfocus }: Props = $props();

	const config = $derived(entry.config);
	const accent = $derived(config.accent);
	const badge = $derived(String(index).padStart(2, '0'));

	// A PASSIVE preview of the same water the tile paints — the exhibit while one is up, the real run
	// otherwise. No picking and no keyboard: the card is the widget, the tank is just its picture.
	function paintTank(ctx: CanvasRenderingContext2D, width: number, height: number) {
		const world = bench.shownOrNull(entry.id);
		if (!world) return;
		drawWorld(world, ctx, width, height, {
			theme: theme.name,
			detail: 'performance',
			big: false,
			lens: bench.lens,
			reducedMotion: prefersReducedMotion(),
			accent
		});
	}

	// Stable identity, like every other painter host — a new fn each render would churn the attach.
	const register = (render: () => void) => bench.painters.add(render);

	// The learning curve, painted straight from engine data — repainted only when a point lands, not
	// 60×/s (see TileStats for the both-ends signature that catches a scrolled window).
	const paintCurve = paintOnChange(
		() =>
			`${entry.world.lifeCurve.length}|${entry.world.lifeCurve.at(0)}|${entry.world.lifeCurve.at(-1)}|${accent}|${theme.name}`,
		(ctx, width, height) => drawCurve(ctx, width, height, entry.world.lifeCurve, accent, theme.name)
	);
</script>

<button
	class="card"
	class:active
	style:--tile-accent={accent}
	aria-pressed={active}
	aria-label="focus world {index}: {config.name}"
	onclick={onfocus}
>
	<div class="head">
		<Chip class="badge">{badge}</Chip>
		<span class="name">{config.name}</span>
		<span class="gen tabular">Gen {entry.stats.gen}</span>
	</div>

	<div class="thumb" style:aspect-ratio="{config.bw} / {config.bh}">
		<Canvas paint={paintTank} {register} label="{config.name} tank preview" />
	</div>

	<div class="foot">
		<span class="alive">alive <b class="tabular">{entry.stats.alive}</b></span>
		<div class="spark">
			<Canvas
				paint={paintCurve}
				{register}
				label="{config.name}: mean return per episode across {entry.stats.gen} generations"
			/>
		</div>
		<b class="pct tabular">{entry.stats.survivalPct}%</b>
	</div>
</button>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 7px;
		width: 100%;
		padding: 8px 8px 9px;
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
		color: var(--ink);
		text-align: left;
		cursor: pointer;
		transition:
			border-color var(--dur-fast) var(--ease),
			box-shadow var(--dur-fast) var(--ease);
	}

	.card:hover {
		border-color: var(--ink3);
	}

	/* The one in focus: a full-ink hairline, the way the tile marks the champion — no colour, this
	   theme's emphasis is lightness and weight. */
	.card.active {
		border-color: var(--ink);
		box-shadow: 0 0 0 1px var(--ink);
	}

	.card:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	.head {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 1px 2px 0;
	}

	.card :global(.badge) {
		flex: none;
		min-width: 22px;
		justify-content: center;
		border-radius: var(--radius-chip);
		font-size: 9px;
		font-weight: var(--fw-bold);
	}

	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
	}

	.gen {
		flex: none;
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.thumb {
		width: 100%;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--canvas-bg);
	}

	.foot {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 2px;
	}

	.alive {
		flex: none;
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.alive b {
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
		color: var(--ink);
		margin-left: 2px;
	}

	.spark {
		flex: 1;
		min-width: 0;
		height: 22px;
	}

	.pct {
		flex: none;
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
		/* the accent, run toward the ink so it holds AA at this size — the card's one coloured number */
		color: color-mix(in srgb, var(--tile-accent) 60%, var(--ink));
	}
</style>
