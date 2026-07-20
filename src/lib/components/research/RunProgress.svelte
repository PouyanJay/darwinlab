<!--
  A batch's progress + cancel — the "something is running" strip every Research instrument shows while
  its sweep, evaluation or landscape is measuring. Extracted so the Sweep, the Ledger and the Atlas
  read the same, and a change to how progress looks lands in one place.
-->
<script lang="ts">
	import Button from '../common/Button.svelte';

	interface Props {
		/** 0–1 across the whole batch. */
		progress: number;
		oncancel: () => void;
	}

	let { progress, oncancel }: Props = $props();
</script>

<div class="run-progress" role="status">
	<div class="track"><div class="fill" style:width="{progress * 100}%"></div></div>
	<span class="pct tabular">{Math.round(progress * 100)}%</span>
	<Button size="sm" variant="ghost" onclick={oncancel}>Cancel</Button>
</div>

<style>
	.run-progress {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}

	.track {
		width: 90px;
		height: 4px;
		border-radius: 2px;
		background: var(--chip);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: var(--ink);
		transition: width var(--dur-fast) linear;
	}

	.pct {
		font-size: var(--fs-sm);
		color: var(--ink2);
		font-variant-numeric: tabular-nums;
	}
</style>
