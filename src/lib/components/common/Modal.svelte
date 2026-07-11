<!--
  A centred modal dialog — the shell the Conditions editor (Phase 5) drops into.

  It is a NATIVE <dialog> opened with showModal(), which is the whole point: the browser gives us a
  real focus trap, a real Esc, the top layer (no z-index fights with the tanks), and it makes
  everything behind it inert and returns focus to whatever opened it. A hand-rolled div-with-a-
  backdrop has to fake all four, and usually fakes at least one of them badly.

  Closing is reported, never assumed: Esc, the ✕, and a backdrop click all call `onclose`, and the
  owner of `open` decides what happens. The dialog fills the viewport with a transparent box so a
  click that lands on it — rather than on the panel inside — is unambiguously a backdrop click.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
		title: string;
		children: Snippet;
		/** A line of context under the title, e.g. "changes apply live to this world". */
		subtitle?: string;
		/** A dot in the world's own accent, so the dialog says which world it is editing. */
		accent?: string;
	}

	let { open, onclose, title, children, subtitle, accent }: Props = $props();

	let dialog = $state<HTMLDialogElement>();

	// Drive the native element from the `open` prop. The guards matter: showModal() on an already
	// open dialog throws, and close() on a closed one would fire a spurious close event.
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-label={title}
	{onclose}
	onclick={(event) => {
		if (event.target === dialog) onclose(); // the click landed on the backdrop, not the panel
	}}
>
	<div class="panel">
		<header>
			{#if accent}
				<span class="dot" style:background={accent}></span>
			{/if}
			<h2>{title}</h2>
			<Button variant="icon" aria-label="close" onclick={onclose}>✕</Button>
		</header>
		{#if subtitle}
			<p class="subtitle">{subtitle}</p>
		{/if}
		{@render children()}
	</div>
</dialog>

<style>
	/* The dialog itself is an invisible full-viewport centring box, so any click that reaches it is
	   a backdrop click. `[open]` scopes the display, or it would show while closed. */
	dialog {
		max-width: none;
		max-height: none;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: var(--sp-6);
		border: none;
		background: transparent;
		overflow: hidden;
	}

	dialog[open] {
		display: grid;
		place-items: center;
	}

	dialog::backdrop {
		background: var(--scrim);
		backdrop-filter: blur(var(--blur-scrim));
	}

	.panel {
		width: var(--modal-width, 484px);
		max-width: 100%;
		max-height: 88vh;
		overflow: auto;
		padding: var(--sp-8) var(--sp-9) 22px;
		border: 1px solid var(--line);
		border-radius: var(--radius-modal);
		background: var(--panel);
		color: var(--ink);
		box-shadow: var(--shadow-modal);
		animation: fade-up 0.25s var(--ease) both;
	}

	header {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}

	.dot {
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	h2 {
		flex: 1;
		margin: 0;
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: var(--fw-semibold);
	}

	.subtitle {
		margin: var(--sp-1) 0 var(--sp-6);
		font-size: var(--fs-sm);
		color: var(--ink3);
	}
</style>
