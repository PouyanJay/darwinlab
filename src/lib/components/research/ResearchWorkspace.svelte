<!--
  The middle zone of the console — a confined, centred scroll column the active instrument lives in.

  It owns exactly two things the mock proved matter: it CAPS the content width so a map or an effect
  chart never stretches edge-to-edge on a large monitor, and it CENTRES that capped block so the
  instrument sits in a comfortable measure instead of clinging to the left rail. Everything scientific
  is in the instrument passed as `children`; this is only the frame that holds it well.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="workspace no-scrollbar" data-testid="research-workspace">
	<div class="confine">
		{@render children()}
	</div>
</div>

<style>
	.workspace {
		min-width: 0;
		min-height: 0;
		overflow-y: auto; /* chrome-free via the shared .no-scrollbar utility */
		background: var(--bgfx);
	}

	/* The cap + auto margins are the whole job: a comfortable measure on a wide monitor, and — because
	   auto margins collapse when the column is narrower than the cap — it still fills a small viewport. */
	.confine {
		width: 100%;
		max-width: 1080px;
		margin: 0 auto;
		padding: var(--sp-7) var(--sp-7) var(--sp-8);
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
	}
</style>
