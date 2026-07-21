<!--
  The two axes the landscape plots — X against Y. Choosing an axis that is already the other one
  swaps them (the store guards it), so the plane is always two DIFFERENT knobs, never one against
  itself. Disabled mid-run: the axes define the field being measured, so they can't change under it.
-->
<script lang="ts">
	import { landscape } from '$lib/state';
</script>

<div class="axes" role="group" aria-label="landscape axes">
	<label class="axis">
		<span class="tag">X</span>
		<select
			aria-label="horizontal axis"
			disabled={landscape.running}
			onchange={(event) => landscape.setX(event.currentTarget.value)}
		>
			{#each landscape.axes as axis (axis.key)}
				<option value={axis.key} selected={axis.key === landscape.axisX.key}>{axis.label}</option>
			{/each}
		</select>
	</label>

	<span class="vs" aria-hidden="true">against</span>

	<label class="axis">
		<span class="tag">Y</span>
		<select
			aria-label="vertical axis"
			disabled={landscape.running}
			onchange={(event) => landscape.setY(event.currentTarget.value)}
		>
			{#each landscape.axes as axis (axis.key)}
				<option value={axis.key} selected={axis.key === landscape.axisY.key}>{axis.label}</option>
			{/each}
		</select>
	</label>
</div>

<style>
	.axes {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		flex-wrap: wrap;
	}

	.axis {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}

	.tag {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: var(--radius-chip);
		background: var(--chip);
		color: var(--ink3);
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
	}

	select {
		padding: 6px 10px;
		border: 1px solid var(--line);
		border-radius: var(--radius-input);
		background: var(--panel2);
		color: var(--ink);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		cursor: pointer;
	}

	select:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	select:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.vs {
		font-size: var(--fs-sm);
		color: var(--ink3);
	}
</style>
