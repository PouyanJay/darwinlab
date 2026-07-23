<!--
  One numeric knob of the subject base — an input wired to the app store's clamped door, with its
  bounds spread straight from WORLD_LIMITS so the input's hints and the store's clamp cannot drift.
  Extracted because the subject card wires this identically four times (prey, predators, tank w/h).
  Commit-on-change on purpose: mid-typing values are not edits.
-->
<script lang="ts">
	import { app } from '$lib/state';
	import { WORLD_LIMITS, type NumericCondition } from '$lib/engine';

	let { key, label }: { key: NumericCondition; label?: string } = $props();
</script>

<input
	type="number"
	inputmode="numeric"
	aria-label={label}
	min={WORLD_LIMITS[key].min}
	max={WORLD_LIMITS[key].max}
	step={WORLD_LIMITS[key].step}
	value={app.base[key]}
	onchange={(e) => app.setBaseCondition(key, Number(e.currentTarget.value))}
/>

<style>
	input {
		width: 58px;
		padding: 5px 8px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--panel);
		color: var(--ink);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	input:focus {
		outline: none;
		border-color: var(--accent);
	}
</style>
