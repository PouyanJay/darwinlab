<!--
  Where this brain sits on a ladder of things minds can do — and, just as importantly, how far up
  that ladder it is NOT.

  The rung follows from the senses the world gives it, because a brain cannot integrate information
  it never receives. It climbs no further than "prediction" no matter what you switch on, and the
  caption says so: what evolved here is real, but it is a 2D caricature with fixed generations and
  an explicit survival goal — unlike the thing it is a caricature of.
-->
<script lang="ts">
	import { RUNGS, rungFor } from './ladder';
	import type { WorldEntry } from '$lib/state';

	interface Props {
		entry: WorldEntry;
	}

	let { entry }: Props = $props();

	const rung = $derived(rungFor(entry.config.senses));
</script>

<div class="field-label">Intelligence ladder</div>

<div class="rungs" role="img" aria-label="intelligence ladder: rung {rung} of 6, {RUNGS[rung]}">
	{#each RUNGS as label, index (label)}
		<span
			class="rung"
			class:current={index === rung}
			class:climbed={index < rung}
			title="{index} · {label}"
		></span>
	{/each}
</div>

<p class="caption">
	rung {rung} · {RUNGS[rung]}
	<span class="quiet">
		what evolved here is real, but it is a 2D caricature: fixed generations and an explicit survival
		goal, unlike real evolution.
	</span>
</p>

<style>
	.rungs {
		display: flex;
		align-items: center;
		gap: 5px;
		margin-top: var(--sp-3);
	}

	.rung {
		width: 14px;
		height: 8px;
		border-radius: 4px;
		background: var(--chip);
		transition: width var(--dur) var(--ease);
	}

	/* The rung it reached is wider — the eye should land on it before reading the caption. */
	.current {
		width: 26px;
		background: var(--accent);
	}

	.climbed {
		background: color-mix(in srgb, var(--accent) 35%, transparent);
	}

	.caption {
		margin: var(--sp-2) 0 0;
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		line-height: 1.5;
		color: var(--ink2);
	}

	.quiet {
		color: var(--ink3);
	}
</style>
