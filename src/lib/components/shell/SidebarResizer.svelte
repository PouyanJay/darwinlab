<!--
  The divider you drag to widen the sidebar.

  It is a `separator` with `aria-valuenow`, not a decorative strip with a mousedown handler: a
  resizer that only answers to a pointer is a control half the users cannot reach. ←/→ move it a
  step, Home/End take it to the ends, and the value it reports is the width in px.

  Pointer capture is what makes the drag survive the pointer leaving the 6px hit area — without it,
  a fast drag detaches from the divider the moment it outruns it.
-->
<script lang="ts">
	import { shell, SIDEBAR_MIN, SIDEBAR_MAX, SIDEBAR_STEP } from '$lib/state';

	let dragging = $state(false);

	function onpointerdown(event: PointerEvent) {
		event.preventDefault(); // a drag must not select the text it passes over
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		dragging = true;
	}

	function onpointermove(event: PointerEvent) {
		if (!dragging) return;
		// The panel is flush to the shell's left edge, so the pointer's x IS the width it asks for.
		shell.setWidth(event.clientX);
	}

	function onpointerup(event: PointerEvent) {
		if (!dragging) return;
		(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		dragging = false;
	}

	function onkeydown(event: KeyboardEvent) {
		const moves: Record<string, number> = {
			ArrowLeft: shell.width - SIDEBAR_STEP,
			ArrowRight: shell.width + SIDEBAR_STEP,
			Home: SIDEBAR_MIN,
			End: SIDEBAR_MAX
		};
		const next = moves[event.key];
		if (next === undefined) return;
		event.preventDefault();
		shell.setWidth(next);
	}
</script>

<!--
	Svelte's a11y rules know one kind of separator — the decorative <hr> — and reject the other in
	both directions: a focusable div may not take keys, and a button may not take the role. But ARIA
	defines BOTH, and the one with `aria-valuenow` is explicitly a widget (the window splitter), which
	is exactly what this is. The rule is wrong here, so it is silenced here, and only here.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	role="separator"
	class="resizer"
	class:dragging
	aria-label="sidebar width"
	aria-orientation="vertical"
	aria-valuenow={shell.width}
	aria-valuemin={SIDEBAR_MIN}
	aria-valuemax={SIDEBAR_MAX}
	tabindex="0"
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	{onkeydown}
></div>

<style>
	.resizer {
		flex: none;
		width: 7px;
		padding: 0;
		border: none;
		margin-right: -4px; /* overhangs the border, so the hit area straddles the seam it moves */
		background: transparent;
		cursor: col-resize;
		touch-action: none; /* the drag is ours; do not hand it to the scroller */
	}

	/* The line only shows itself when you are on it — a permanent grab handle would be a third
	   vertical rule next to the panel border and the rail border. */
	.resizer::after {
		content: '';
		display: block;
		width: 2px;
		height: 100%;
		margin-left: 2px;
		background: var(--accent);
		opacity: 0;
		transition: opacity var(--dur-fast) var(--ease);
	}

	.resizer:hover::after,
	.resizer:focus-visible::after,
	.resizer.dragging::after {
		opacity: 1;
	}

	.resizer:focus-visible {
		outline: none; /* the accent line IS the focus indicator here, and it is a clearer one */
	}
</style>
