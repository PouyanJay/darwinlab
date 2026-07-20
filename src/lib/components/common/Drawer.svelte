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
	import { untrack } from 'svelte';
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
		/**
		 * DOCKED: render in the normal flow (a column of the workbench) instead of floating fixed on
		 * the right. Same panel, same content, no overlay chrome — no fixed inset, no slide-in, no
		 * focus-takeover (it is always present, so opening it is not an event to move focus for).
		 */
		docked?: boolean;
		/**
		 * Whether opening moves focus into the panel (and returns it on close). The default; the
		 * caller passes false when the open is a SIDE EFFECT of something mid-flight — the tank's
		 * keyboard walk opens the inspector, and stealing focus would end the walk one step in.
		 * An explicit prop, not an inference from the invoker: the caller knows what opened it.
		 */
		takeFocus?: boolean;
	}

	let {
		open,
		onclose,
		title,
		children,
		subtitle,
		live = false,
		takeFocus = true,
		docked = false
	}: Props = $props();

	let panel = $state<HTMLElement>();

	$effect(() => {
		// A docked panel is part of the page, not an overlay that arrives — it never takes focus, and
		// Esc is not its to close (it has no "closed" state to return to).
		if (docked) return;
		if (!open || !panel) return;
		// untracked: the decision is made when the drawer OPENS. If the selection later changes
		// kind while it stays open, re-running this would yank focus back to a stale invoker.
		if (!untrack(() => takeFocus)) return;

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
		if (docked) return; // a docked panel does not answer Esc — there is nothing to close
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
		class:docked
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
		/* Scrolls, but the bar stays out of sight — the mind is a tall reading panel and a native
		   scrollbar down its edge reads as chrome. Scrolling (wheel, trackpad, keys) is untouched. */
		scrollbar-width: none; /* Firefox */
		padding: 17px 19px 19px;
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--glass);
		backdrop-filter: blur(var(--blur-glass));
		box-shadow: var(--shadow-drawer);
		animation: slide-in-right var(--dur-enter) var(--ease) both;
	}

	.drawer::-webkit-scrollbar {
		display: none; /* WebKit / Blink */
	}

	/* DOCKED: part of the workbench flow, not an overlay. It fills the column it is given and scrolls
	   inside it; no fixed inset, no glass/blur, no slide-in — it was always here. */
	.drawer.docked {
		position: static;
		inset: auto;
		width: 100%;
		max-width: none;
		height: 100%;
		z-index: auto;
		background: var(--panel);
		backdrop-filter: none;
		box-shadow: none;
		animation: none;
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
