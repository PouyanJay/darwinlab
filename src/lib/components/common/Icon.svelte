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
		| 'chevron-left'
		| 'chevron-right'
		| 'episodes'
		| 'flask'
		| 'bottleneck';

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
	{:else if name === 'chevron-left'}
		<path d="M14.5 5.5L8 12l6.5 6.5" />
	{:else if name === 'chevron-right'}
		<path d="M9.5 5.5L16 12l-6.5 6.5" />
	{:else if name === 'episodes'}
		<!-- a generation: the loop that keeps coming round -->
		<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
		<path d="M21 3v5h-5" />
	{:else if name === 'bottleneck'}
		<!-- a funnel: a whole population goes in, one lineage comes out -->
		<path d="M3.5 4.5h17l-6.5 7.5v7l-4 2.5v-9.5z" />
	{:else if name === 'flask'}
		<path
			d="M9.5 3.5h5M10.5 3.5v6L5.8 17a2.4 2.4 0 0 0 2 3.5h8.4a2.4 2.4 0 0 0 2-3.5l-4.7-7.5v-6"
		/>
		<path d="M8 14.5h8" />
	{/if}
</svg>

<style>
	.icon {
		flex: none;
		display: block;
	}
</style>
