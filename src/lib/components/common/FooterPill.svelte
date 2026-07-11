<!--
  The standing disclaimer, bottom-left of every screen: what you are watching is real evolution, and
  it is still a caricature. It stays visible on purpose — the honesty is part of the product, not a
  footnote to be scrolled past.
-->
<script lang="ts">
	import { story } from '$lib/state';
</script>

<!-- Hidden under a story, which carries the same line in its own header — the film is a takeover,
     and the pill would otherwise sit on top of the scene's progress bar. -->
{#if !story.active}
	<p class="pill">real neuroevolution · a teaching caricature, not biology</p>
{/if}

<style>
	.pill {
		position: fixed;
		left: var(--sp-6);
		bottom: 14px;
		z-index: var(--z-footer);
		margin: 0;
		padding: 5px var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-pill);
		background: var(--panel);
		box-shadow: var(--shadow-pill);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		color: var(--ink3);
	}
</style>
