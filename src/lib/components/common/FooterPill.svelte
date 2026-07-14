<!--
  The standing disclaimer, bottom-left of every screen: what you are watching is real evolution, and
  it is still a caricature. It stays visible on purpose — the honesty is part of the product, not a
  footnote to be scrolled past.
-->
<script lang="ts">
	import { shell, story } from '$lib/state';
</script>

<!-- Hidden under a story, which carries the same line in its own header — the film is a takeover,
     and the pill would otherwise sit on top of the scene's progress bar. -->
<!-- an <aside>, so the one line of content that floats outside header/main still lives in a
     landmark (the axe `region` rule — content a screen reader can't situate is content lost) -->
<!-- Also stands down while a phone's control panel covers the bench: the pill is pinned above
     everything, so it would otherwise print itself across the open panel. The disclaimer stays with
     the thing it is disclaiming. -->
{#if !story.active && !shell.overlaying}
	<aside aria-label="disclaimer">
		<p class="pill">real neuroevolution · a teaching caricature, not biology</p>
	</aside>
{/if}

<style>
	.pill {
		position: fixed;
		/* Clear of the sidebar, whatever width it is currently holding — see --shell-gutter on the
		   page. The fallback is for anywhere this pill is rendered without the shell around it. */
		left: calc(var(--shell-gutter, 0px) + var(--sp-6));
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
