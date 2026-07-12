<!--
  The tile's readouts: how the population is doing now, how it has done across generations, and —
  once training ends — how fast the real world kills it.

  Two sparklines, both painted straight from engine data every frame:
    • the learning curve — how long a fish lives, per generation, in the world's accent. This is the graph
      the whole product is an argument about, so it is on every tile, not hidden in a detail view.
    • the decay curve — the deployed population draining away. Red, because that is what it is.
-->
<script lang="ts">
	import Canvas from '../common/Canvas.svelte';
	import Button from '../common/Button.svelte';
	import { paintOnChange } from '../common/paintOnChange';
	import { drawCurve, drawDecay } from '$lib/render';
	import { bench, theme } from '$lib/state';
	import type { WorldEntry } from '$lib/state';

	interface Props {
		entry: WorldEntry;
	}

	let { entry }: Props = $props();

	const accent = $derived(entry.config.accent);

	/**
	 * What the real-world run has come to. Before training ends there is nothing to report — the
	 * population is still being reset every generation, so no decay has happened yet.
	 */
	const deployment = $derived.by(() => {
		const { deployed, extinctT, halfLife, deployT, alive } = entry.stats;
		if (!deployed) return 'after training';
		if (extinctT !== null) return `wiped out · ${extinctT.toFixed(0)}s`;
		if (halfLife !== null) return `half-life ${halfLife.toFixed(0)}s · ${alive} left`;
		return `${deployT.toFixed(0)}s · ${alive} left`;
	});

	/**
	 * What AT hears about the real-world run. The visible readout ticks every second — announcing
	 * that firehose would be noise — so the live region speaks only when the run TURNS: deployed,
	 * half-life latched, wiped out. Each phrase is stable once said, so each is said once.
	 */
	const announcement = $derived.by(() => {
		const { deployed, extinctT, halfLife } = entry.stats;
		if (!deployed) return '';
		if (extinctT !== null)
			return `${entry.config.name}: population wiped out after ${extinctT.toFixed(0)} seconds`;
		if (halfLife !== null)
			return `${entry.config.name}: half the population gone at ${halfLife.toFixed(0)} seconds`;
		return `${entry.config.name}: deployed — the real-world run has started`;
	});

	// Stable identity: a new function each render would churn the Canvas attachment every frame.
	const register = (render: () => void) => bench.painters.add(render);

	// Both series only gain a point at a generation / sampling boundary — don't repaint 60×/s.
	// BOTH ends in the signature: once a series hits its cap it shift()s as it push()es, so the
	// length holds still and a repeated last value would hide a window that scrolled — the moving
	// head end is what still betrays the shift.
	const paintCurve = paintOnChange(
		() =>
			`${entry.world.lifeCurve.length}|${entry.world.lifeCurve.at(0)}|${entry.world.lifeCurve.at(-1)}|${accent}|${theme.name}`,
		(ctx, width, height) => drawCurve(ctx, width, height, entry.world.lifeCurve, accent, theme.name)
	);

	const paintDecay = paintOnChange(
		() =>
			`${entry.world.decay.length}|${entry.world.decay.at(0)}|${entry.world.decay.at(-1)}|${theme.name}`,
		(ctx, width, height) => drawDecay(ctx, width, height, entry.world.decay, theme.name)
	);
</script>

<div class="row">
	<div class="alive">
		<span class="eyebrow">alive</span>
		<span class="figures">
			<b class="tabular" data-testid="alive">{entry.stats.alive}</b>
			<b class="eaten tabular" data-testid="eaten">−{entry.stats.eaten}</b>
		</span>
	</div>

	<div class="curve">
		<div class="curve-head">
			<span class="eyebrow">life / generation</span>
			<!-- the number reads in the world's accent, run toward the ink so 12px stays AA -->
			<b class="tabular survival" style:--curve-accent={accent} data-testid="survival"
				>{entry.stats.survivalPct}%</b
			>
		</div>
		<div class="sparkline">
			<Canvas
				paint={paintCurve}
				{register}
				label="{entry.config
					.name}: how much of a generation a fish survives on average, across {entry.stats
					.gen} generations, now {entry.stats.survivalPct}%"
			/>
		</div>
	</div>

	<Button size="sm" onclick={() => bench.openConditions(entry.id)}>Conditions</Button>
</div>

<div class="row deploy">
	<span class="visually-hidden" role="status">{announcement}</span>
	<div class="deploy-stat">
		<div class="deploy-label">Real-world run</div>
		<div class="tabular" data-testid="deployment">{deployment}</div>
	</div>
	<div class="sparkline decay">
		<Canvas
			paint={paintDecay}
			{register}
			label="{entry.config.name}: how fast the deployed population is wiped out — {deployment}"
		/>
	</div>
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 9px var(--sp-5) 12px;
	}

	.deploy {
		gap: var(--sp-4);
		padding: 0 var(--sp-5) var(--sp-5);
	}

	.alive {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.figures {
		display: flex;
		align-items: baseline;
		gap: 5px;
		font-size: var(--fs-stat);
		font-weight: var(--fw-semibold);
	}

	.eaten {
		font-size: var(--fs-sm);
		color: var(--danger-ink); /* danger AS TEXT — see tokens.css */
	}

	.curve {
		flex: 1;
		min-width: 0;
	}

	.curve-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.curve-head b {
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
	}

	.survival {
		color: color-mix(in srgb, var(--curve-accent) 60%, var(--ink));
	}

	.sparkline {
		height: 34px;
		margin-top: 3px;
	}

	.deploy-stat {
		flex: none;
		width: 96px;
	}

	.deploy-label {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--danger-ink); /* danger AS TEXT — see tokens.css */
	}

	.deploy-stat div + div {
		margin-top: 1px;
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
	}

	.decay {
		flex: 1;
		min-width: 0;
		height: 30px;
		margin-top: 0;
	}
</style>
