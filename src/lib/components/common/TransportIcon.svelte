<!--
  The play/pause glyph — now a thin binding over the app's icon set rather than a second pair of
  hand-drawn paths. It exists because "playing → show PAUSE" is a rule worth stating once: every
  transport in the app reads its own state backwards, and the day one of them gets it right and the
  other doesn't is the day the bench says it is running while the film says it is stopped.
-->
<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		/** Showing the PAUSE bars means the thing is currently playing. */
		playing: boolean;
		size?: number;
	}

	let { playing, size = 15 }: Props = $props();
</script>

<Icon name={playing ? 'pause' : 'play'} {size} />
