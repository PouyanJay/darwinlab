<!--
  A panel that slides in from the right — the shell for the Brain Inspector (Phase 6).

  Deliberately NOT a modal, and that is a product decision, not a shortcut: you inspect a fish's
  brain *while watching it swim*, so the bench behind the drawer has to stay live and clickable.
  That rules out <dialog>.showModal(), which would make the whole page inert. So this is a plain
  non-modal panel, and it takes on by hand only the two things a keyboard user would otherwise
  lose:

    • focus moves into the drawer when it opens, and returns to whatever opened it when it closes
    • Esc closes it — unless a real modal is open on top, whose Esc it must not steal

  Focus is never trapped: Tab walks out of the drawer and back into the bench, which is right,
  because the bench is still usable.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
		title: string;
		children: Snippet;
		subtitle?: string;
		/** A pulsing dot next to the title — "this is live, not a snapshot". */
		live?: boolean;
	}

	let { open, onclose, title, children, subtitle, live = false }: Props = $props();

	let panel = $state<HTMLElement>();

	$effect(() => {
		if (!open || !panel) return;

		// Effects run after the DOM update, and nothing has stolen focus yet, so this is still the
		// element the user was on when they opened the drawer.
		const invoker = document.activeElement as HTMLElement | null;
		panel.focus();

		return () => {
			// Only hand focus back if the invoker is still on the page — on a full teardown it isn't,
			// and yanking focus to a detached node would just dump the user at the top of the document.
			if (invoker?.isConnected) invoker.focus();
		};
	});

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !open) return;
		// A modal on top owns Esc; it will close itself and this drawer must survive that keypress.
		if (document.querySelector('dialog[open]')) return;
		onclose();
	}
</script>

<svelte:window {onkeydown} />

{#if open}
	<!-- `aria-modal="false"` is the honest description: a dialog that does NOT make the rest inert.
	     tabindex="-1" makes it programmatically focusable without adding a tab stop. (A <div>, not an
	     <aside>: the complementary landmark and the dialog role are different claims, and the dialog
	     role is the true one.) -->
	<div
		bind:this={panel}
		role="dialog"
		aria-modal="false"
		aria-label={title}
		tabindex="-1"
		class="drawer"
	>
		<header>
			{#if live}
				<span class="dot" aria-hidden="true"></span>
			{/if}
			<h2>{title}</h2>
			<Button variant="icon" aria-label="close inspector" onclick={onclose}>✕</Button>
		</header>
		{#if subtitle}
			<p class="subtitle">{subtitle}</p>
		{/if}
		{@render children()}
	</div>
{/if}

<style>
	.drawer {
		position: fixed;
		top: 74px;
		right: var(--sp-6);
		bottom: var(--sp-6);
		z-index: var(--z-drawer);
		width: var(--drawer-width, 360px);
		max-width: calc(100vw - 32px);
		overflow: auto;
		padding: 17px 19px 19px;
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--glass);
		backdrop-filter: blur(16px);
		box-shadow: var(--shadow-drawer);
		animation: slide-in-right 0.28s var(--ease) both;
	}

	/* The drawer takes focus on open; a ring around the whole panel would be noise, and the
	   slide-in is what tells a sighted user where they now are. Keyboard focus then moves on to
	   the close button, which does show its ring. */
	.drawer:focus {
		outline: none;
	}

	header {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}

	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		animation: pulse 1.6s var(--ease) infinite;
	}

	h2 {
		flex: 1;
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: var(--fw-semibold);
	}

	.subtitle {
		margin: 3px 0 0;
		font-size: var(--fs-sm);
		color: var(--ink3);
	}
</style>
