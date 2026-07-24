<!--
  A confirm-or-cancel dialog for a destructive action — built on the app's Modal, so it inherits the
  real focus trap, Esc, the top layer and focus return. It only ASKS: the owner drives `open` and
  decides what confirm and cancel do. The message spells out what will be lost, because these actions
  delete findings that persist across sessions; the confirm button leads and reddens, so the
  destructive choice is the one that reads.
-->
<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';

	let {
		open,
		title,
		message,
		confirmLabel = 'Remove',
		confirmTestid = 'confirm-action',
		onconfirm,
		oncancel
	}: {
		open: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		/** Distinguishes this dialog's confirm button when more than one ConfirmDialog is on the page. */
		confirmTestid?: string;
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();
</script>

<Modal {open} {title} onclose={oncancel}>
	<p class="msg">{message}</p>
	<div class="row">
		<Button variant="ghost" onclick={oncancel}>Cancel</Button>
		<button class="confirm" onclick={onconfirm} data-testid={confirmTestid}>{confirmLabel}</button>
	</div>
</Modal>

<style>
	.msg {
		margin: var(--sp-2) 0 var(--sp-6);
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink2);
	}

	.row {
		display: flex;
		justify-content: flex-end;
		gap: var(--sp-3);
	}

	/* The destructive lead — a solid coral so the button itself says "this deletes", not just the copy. */
	.confirm {
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		padding: var(--sp-3) 14px;
		font: inherit;
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
		background: var(--data-coral);
		color: var(--panel);
		cursor: pointer;
	}

	.confirm:hover {
		background: color-mix(in oklab, var(--data-coral) 88%, black);
	}

	.confirm:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}
</style>
