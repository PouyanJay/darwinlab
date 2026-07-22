<!--
  A glass tooltip anchored to a chart's last pointer position — the shell both canvas charts (the Atlas
  landscape and the Sweep run grid) hang their own content in, so the "float a readout by the cursor"
  box lives in one place. The caller supplies the lines; this owns the position, the glass and the
  offset from the pointer. Decorative (the meaning is always in the chart's aria-label too).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { x, y, children }: { x: number; y: number; children: Snippet } = $props();
</script>

<div class="tip" style:left="{x}px" style:top="{y}px" aria-hidden="true">
	{@render children()}
</div>

<style>
	.tip {
		position: absolute;
		z-index: 3;
		transform: translate(12px, 12px);
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 6px 9px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--glass);
		backdrop-filter: blur(var(--blur-glass));
		box-shadow: var(--shadow-pill);
		pointer-events: none;
		white-space: nowrap;
	}
</style>
