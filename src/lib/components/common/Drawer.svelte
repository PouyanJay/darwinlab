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

		// The tank's creature cycler opens this drawer as a side effect of WALKING — stealing focus
		// would end the walk after one step. The walker keeps their place; everyone else is moved
		// in, and put back on close.
		if (invoker?.getAttribute('role') === 'application') return;

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
		<!-- a div, not a <header>: an html header outside main/section is a BANNER landmark, and the
		     page already has one — the top bar. (axe: landmark-no-duplicate-banner) -->
		<div class="head">
			{#if live}
				<span class="dot" aria-hidden="true"></span>
			{/if}
			<h2>{title}</h2>
			<Button variant="icon" aria-label="close inspector" onclick={onclose}>✕</Button>
		</div>
		{#if subtitle}
			<p class="subtitle">{subtitle}</p>
		{/if}
		{@render children()}
	</div>
{/if}

<style>
	.drawer {
		position: fixed;
		top: calc(var(--topbar-height) + var(--sp-5));
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
		backdrop-filter: blur(var(--blur-glass));
		box-shadow: var(--shadow-drawer);
		animation: slide-in-right var(--dur-enter) var(--ease) both;
	}

	/* On a phone the inset side panel becomes a full-width overlay rising from the bottom edge —
	   still non-modal, still over a running bench, just no longer pretending there is a "side". */
	@media (max-width: 560px) {
		.drawer {
			left: 0;
			right: 0;
			bottom: 0;
			width: auto;
			max-width: none;
			/* the footer disclaimer deliberately outranks every panel (z-footer) — leave its line
			   of the viewport to it rather than letting it sit on the drawer's own legend */
			padding-bottom: 46px;
			border-left: none;
			border-right: none;
			border-bottom: none;
			border-radius: var(--radius-card) var(--radius-card) 0 0;
		}
	}

	/* The drawer takes focus on open; a ring around the whole panel would be noise, and the
	   slide-in is what tells a sighted user where they now are. Keyboard focus then moves on to
	   the close button, which does show its ring. */
	.drawer:focus {
		outline: none;
	}

	.head {
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
