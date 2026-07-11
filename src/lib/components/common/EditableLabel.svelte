<!--
  A name that edits in place — the world title on a tile.

  It reads as a heading (display face, no chrome) until you hover or focus it, at which point it
  admits it is a text field. Renaming is live: every keystroke reports up, because a world's name
  is a label, not a form to submit.

  Two keys make it feel like a field rather than a trap:
    Enter   commit — blur, back to reading
    Escape  abandon this edit and put back the name the field had when it was focused
-->
<script lang="ts">
	interface Props {
		value: string;
		onchange: (value: string) => void;
		/** What AT calls it, e.g. "world name". */
		label: string;
	}

	let { value, onchange, label }: Props = $props();

	/** The value to restore on Escape — captured on focus, so it survives the whole edit. */
	let committed = '';

	function onfocus(event: FocusEvent & { currentTarget: HTMLInputElement }) {
		committed = event.currentTarget.value;
	}

	function onkeydown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (event.key === 'Enter') {
			event.currentTarget.blur();
		} else if (event.key === 'Escape') {
			onchange(committed);
			event.currentTarget.value = committed;
			event.currentTarget.blur();
		}
	}
</script>

<input
	class="editable"
	type="text"
	aria-label={label}
	{value}
	{onfocus}
	{onkeydown}
	oninput={(event) => onchange(event.currentTarget.value)}
/>

<style>
	.editable {
		width: 100%;
		min-width: 40px;
		padding: 2px 5px;
		border: none;
		border-radius: var(--radius-chip);
		background: transparent;
		color: var(--ink);
		font-family: var(--font-display);
		font-size: var(--fs-name);
		font-weight: var(--fw-semibold);
		transition: background var(--dur-fast) var(--ease);
	}

	/* Only on the way in does it look like a field — otherwise it is just the tile's title. */
	.editable:hover,
	.editable:focus {
		background: var(--chip);
	}

	.editable:focus {
		outline: none; /* the chip fill is the focus signal here; the ring would double it */
	}

	.editable:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}
</style>
