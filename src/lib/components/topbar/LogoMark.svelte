<!--
  The lab's mark: a fish carrying a three-node network where its eye would be — the product in one
  glyph, a creature whose behaviour IS a tiny neural net.

  Inlined rather than <img src="…svg">, and painted in TOKENS rather than in the hex values the
  source artwork carries, so ONE file serves both themes: the body follows the ink, the network
  follows the accent, and a theme flip repaints it with the rest of the page instead of swapping an
  asset (which would flash, and would go stale the day a token moves).
-->
<script lang="ts">
	interface Props {
		/** Rendered height in px. The width follows the artwork's 640:340 aspect. */
		size?: number;
	}

	let { size = 20 }: Props = $props();
</script>

<svg
	class="mark"
	viewBox="0 0 640 340"
	height={size}
	width={(size * 640) / 340}
	aria-hidden="true"
	focusable="false"
>
	<path
		class="body"
		d="M 600 170 C 508 52 356 52 196 170 C 356 288 508 288 600 170 Z M 296 170 L 66 74 Q 118 170 66 266 L 296 170 Z"
		fill-rule="nonzero"
	/>
	<line class="net" x1="506" y1="178" x2="432" y2="146" stroke-width="11" stroke-linecap="round" />
	<line class="net" x1="506" y1="178" x2="432" y2="210" stroke-width="11" stroke-linecap="round" />
	<circle class="node" cx="432" cy="146" r="18" />
	<circle class="node" cx="432" cy="210" r="18" />
	<circle class="node" cx="506" cy="178" r="18" />
</svg>

<style>
	.mark {
		flex: none;
		display: block;
	}

	.body {
		fill: var(--ink);
	}

	.net {
		stroke: var(--accent);
	}

	.node {
		fill: var(--accent);
	}
</style>
