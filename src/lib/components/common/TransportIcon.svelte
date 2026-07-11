<!--
  The play/pause glyph. It appears in the top bar and again in the story's transport, and a pair of
  hand-drawn SVGs copied between them is a pair that will eventually disagree.
-->
<script lang="ts">
	interface Props {
		/** Showing the PAUSE bars means the thing is currently playing. */
		playing: boolean;
		size?: number;
	}

	let { playing, size = 10 }: Props = $props();

	const height = $derived(size * 1.1);
</script>

{#if playing}
	<svg width={size} {height} viewBox="0 0 10 12" aria-hidden="true">
		<rect x="0" y="0" width="3.4" height="12" rx="1" fill="currentColor" />
		<rect x="6.6" y="0" width="3.4" height="12" rx="1" fill="currentColor" />
	</svg>
{:else}
	<svg width={size} {height} viewBox="0 0 10 12" aria-hidden="true">
		<polygon points="0,0 10,6 0,12" fill="currentColor" />
	</svg>
{/if}
