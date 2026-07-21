<!--
  The app's icons — one drawn set, one geometry, one weight.

  Before this, the UI signed its controls with EMOJI (⚙ ⏩ ★ ↻ ⧉ ✕). An emoji is not an icon: the
  operating system paints it, in its own colour, at its own weight, in its own house style — a
  full-colour gear next to a hairline-drawn interface, refusing the ink colour around it and looking
  like a different app pasted in. Every glyph here is a stroke path on the same 24px grid, drawn in
  `currentColor` at the same weight, so an icon inherits the colour of the control it sits in and a
  disabled button's icon dims with it.

  Filled shapes (play, pause, star) are the deliberate exception: a hollow play triangle at 12px
  reads as noise, and the star is a state — a champion — not an outline.
-->
<script lang="ts">
	export type IconName =
		| 'play'
		| 'pause'
		| 'forward'
		| 'sliders'
		| 'sun'
		| 'moon'
		| 'star'
		| 'reset'
		| 'duplicate'
		| 'close'
		| 'plus'
		| 'check'
		| 'chevron-left'
		| 'chevron-right'
		| 'episodes'
		| 'flask'
		| 'compass'
		| 'branch'
		| 'minus'
		| 'crosshair'
		| 'expand'
		| 'collapse'
		| 'grip';

	interface Props {
		name: IconName;
		/** Rendered box in px. The stroke is scaled with it, so a 14px icon is not a hairline. */
		size?: number;
	}

	let { name, size = 16 }: Props = $props();

	/** Solid glyphs: outlines of these read as smudges at control sizes. */
	const FILLED = new Set<IconName>(['play', 'pause', 'star']);

	const filled = $derived(FILLED.has(name));
</script>

<svg
	class="icon"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill={filled ? 'currentColor' : 'none'}
	stroke={filled ? 'none' : 'currentColor'}
	stroke-width="1.9"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#if name === 'play'}
		<path d="M8 5.5v13l11-6.5z" />
	{:else if name === 'pause'}
		<rect x="7" y="5" width="3.6" height="14" rx="1.2" />
		<rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
	{:else if name === 'forward'}
		<!-- fast-forward: two chevrons and a bar. Not the ⏩ emoji, which the OS paints blue. -->
		<path d="M4 6l7 6-7 6z" fill="currentColor" stroke="none" />
		<path d="M12 6l7 6-7 6z" fill="currentColor" stroke="none" />
		<path d="M21 5v14" stroke="currentColor" stroke-width="1.9" fill="none" />
	{:else if name === 'sliders'}
		<!-- Settings as SLIDERS, not a gear: this panel holds the lab's knobs, and a gear is what
		     every app on earth uses for "preferences" — a different promise. -->
		<path d="M5 7h9M18 7h1M5 12h3M12 12h7M5 17h9M18 17h1" />
		<circle cx="16" cy="7" r="2" />
		<circle cx="10" cy="12" r="2" />
		<circle cx="16" cy="17" r="2" />
	{:else if name === 'sun'}
		<circle cx="12" cy="12" r="4.2" />
		<path
			d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"
		/>
	{:else if name === 'moon'}
		<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
	{:else if name === 'star'}
		<path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
	{:else if name === 'reset'}
		<!-- counter-clockwise: evolution starts over from random brains -->
		<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
		<path d="M3 3v5h5" />
	{:else if name === 'duplicate'}
		<rect x="8.5" y="8.5" width="11" height="11" rx="2.4" />
		<path d="M15.5 5.5h-9a2.5 2.5 0 0 0-2.5 2.5v9" />
	{:else if name === 'close'}
		<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
	{:else if name === 'plus'}
		<path d="M12 5.5v13M5.5 12h13" />
	{:else if name === 'check'}
		<path d="M5 12.5l4.5 4.5L19 7" />
	{:else if name === 'chevron-left'}
		<path d="M14.5 5.5L8 12l6.5 6.5" />
	{:else if name === 'chevron-right'}
		<path d="M9.5 5.5L16 12l-6.5 6.5" />
	{:else if name === 'episodes'}
		<!-- a generation: the loop that keeps coming round -->
		<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
		<path d="M21 3v5h-5" />
	{:else if name === 'compass'}
		<circle cx="12" cy="12" r="9" />
		<path d="M15.5 8.5l-2.1 5-5 2.1 2.1-5z" />
	{:else if name === 'flask'}
		<path
			d="M9.5 3.5h5M10.5 3.5v6L5.8 17a2.4 2.4 0 0 0 2 3.5h8.4a2.4 2.4 0 0 0 2-3.5l-4.7-7.5v-6"
		/>
		<path d="M8 14.5h8" />
	{:else if name === 'branch'}
		<!-- a lineage fork: a trunk that splits off to a branched child -->
		<line x1="6" y1="3" x2="6" y2="15" />
		<circle cx="6" cy="18" r="2.6" />
		<circle cx="18" cy="6" r="2.6" />
		<path d="M18 8.6a9 9 0 0 1-9 9" />
	{:else if name === 'minus'}
		<path d="M5.5 12h13" />
	{:else if name === 'crosshair'}
		<circle cx="12" cy="12" r="7.5" />
		<path d="M12 1.5v3.5M12 19v3.5M1.5 12h3.5M19 12h3.5" />
	{:else if name === 'expand'}
		<!-- blow a world up to fill the pane: four corner brackets opening outward -->
		<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
	{:else if name === 'collapse'}
		<!-- drop the focused world back to the bench: the same brackets, closing inward -->
		<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />
	{:else if name === 'grip'}
		<!-- a drag handle: two columns of dots, the universal "grab me" affordance -->
		<g fill="currentColor" stroke="none">
			<circle cx="9" cy="6" r="1.5" />
			<circle cx="9" cy="12" r="1.5" />
			<circle cx="9" cy="18" r="1.5" />
			<circle cx="15" cy="6" r="1.5" />
			<circle cx="15" cy="12" r="1.5" />
			<circle cx="15" cy="18" r="1.5" />
		</g>
	{/if}
</svg>

<style>
	.icon {
		flex: none;
		display: block;
	}
</style>
