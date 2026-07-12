<!--
  The one-time hint. The bench's most important interaction — click a fish, read its evolved
  mind — is painted pixels with no affordance at all, so the first visit gets one line of help.

  It leaves two ways and never comes back (localStorage): the ✕, or the moment the user opens a
  mind on their own — at which point the hint's job is done and repeating it would be nagging.
-->
<script lang="ts">
	import { bench, story } from '$lib/state';

	const HINT_STORAGE_KEY = 'darwinlab:hint-dismissed';

	// Client-only app (ssr=false), so localStorage is safe to read at init — same as the theme.
	let dismissed = $state(localStorage.getItem(HINT_STORAGE_KEY) !== null);

	function dismiss() {
		dismissed = true;
		localStorage.setItem(HINT_STORAGE_KEY, 'true');
	}

	// Watching the selection is the only way to know the lesson landed without the store knowing
	// this component exists.
	$effect(() => {
		if (!dismissed && bench.selection) dismiss();
	});
</script>

{#if !dismissed && !story.active}
	<div class="hint">
		<span>click any fish to open its mind</span>
		<button type="button" aria-label="dismiss hint" onclick={dismiss}>✕</button>
	</div>
{/if}

<style>
	.hint {
		position: fixed;
		left: 50%;
		bottom: 14px;
		z-index: var(--z-footer);
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: 5px var(--sp-3) 5px var(--sp-5);
		border: 1px solid var(--accent);
		border-radius: var(--radius-pill);
		background: var(--panel);
		box-shadow: var(--shadow-pill);
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		color: var(--ink);
		animation: fade-up var(--dur-fast) var(--ease) both;
	}

	button {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: transparent;
		color: var(--ink3);
		font-size: var(--fs-sm);
		cursor: pointer;
	}

	button:hover {
		background: var(--panel2);
		color: var(--ink);
	}

	/* On a phone the footer disclaimer owns the bottom edge — stack the hint above it. */
	@media (max-width: 640px) {
		.hint {
			bottom: 54px;
		}
	}

	/* The dismiss must be tappable without hitting the hint itself. */
	@media (pointer: coarse) {
		button {
			width: 40px;
			height: 40px;
		}
	}
</style>
