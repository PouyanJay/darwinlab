<!--
  A segmented control - one choice out of a few (½× / 1× / 2×).

  It is a RADIO GROUP, not a row of toggle buttons: exactly one option is always chosen, which is
  what `role="radio"` + `aria-checked` tells a screen reader. That also buys the keyboard behaviour
  users expect from a segmented control - Tab enters the group once (roving tabindex: only the
  chosen segment is in the tab order), then ←/→/↑/↓ move the choice, Home/End jump to the ends.
-->
<script lang="ts" generics="T extends string | number">
	interface Option {
		value: T;
		label: string;
	}

	interface Props {
		options: Option[];
		value: T;
		onchange: (value: T) => void;
		/** Names the group for assistive tech, e.g. "simulation speed". */
		label: string;
		/**
		 * The whole choice is unavailable - every segment goes quiet and none of them can be picked.
		 * A control that silently refuses is worse than one that says it cannot: the champion-clones
		 * selector used to snap back to Off with no explanation whenever there was no brain to clone.
		 */
		disabled?: boolean;
		/** 'xs' is the design panel's row size - many controls in a narrow column. */
		size?: 'md' | 'xs';
	}

	let { options, value, onchange, label, disabled = false, size = 'md' }: Props = $props();

	let group = $state<HTMLDivElement>();

	/** Move the selection and take focus with it - a radio group's selection *is* its focus. */
	function select(index: number) {
		if (disabled) return;
		const wrapped = (index + options.length) % options.length;
		onchange(options[wrapped].value);
		// The chosen segment is the only tabbable one, so it is the one that must hold focus.
		group?.querySelectorAll('button')[wrapped]?.focus();
	}

	function onkeydown(event: KeyboardEvent) {
		const current = options.findIndex((option) => option.value === value);
		const moves: Record<string, number> = {
			ArrowRight: current + 1,
			ArrowDown: current + 1,
			ArrowLeft: current - 1,
			ArrowUp: current - 1,
			Home: 0,
			End: options.length - 1
		};
		const target = moves[event.key];
		if (target === undefined) return;
		event.preventDefault();
		select(target);
	}
</script>

<div
	bind:this={group}
	class={['segmented', size]}
	class:disabled
	role="radiogroup"
	aria-label={label}
	aria-disabled={disabled}
>
	{#each options as option, index (option.value)}
		{@const checked = option.value === value}
		<button
			type="button"
			role="radio"
			aria-checked={checked}
			{disabled}
			class:checked
			tabindex={checked ? 0 : -1}
			onclick={() => select(index)}
			{onkeydown}
		>
			{option.label}
		</button>
	{/each}
</div>

<style>
	.segmented {
		display: flex;
		gap: 2px;
		padding: 3px;
		border-radius: var(--radius-control);
		background: var(--chip);
	}

	button {
		padding: 5px var(--sp-4);
		border: none;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--ink2);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition:
			background var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease);
	}

	button:hover:not(.checked) {
		color: var(--ink);
	}

	/* The chosen segment reads through a clean, FLAT fill that is a step lighter than the track. The
	   track is `--chip` (panel tinted toward the ink - lighter in dark, darker in light), so a plain
	   `--panel` fill lifts in light but SINKS in dark (the selected segment came out darker than the
	   track, a recessed hole). Mixing a touch of white in makes the thumb sit clearly ABOVE the track in
	   both themes. NO shadow: on the near-black dark track its blur leaked past the rounded corners and
	   read as a crooked/offset box - the lightness step alone is the signal. */
	.checked {
		background: color-mix(in srgb, var(--panel), #fff 18%);
		color: var(--ink);
	}

	/* The panel's compact rows: eyebrow-sized type, tight padding - same roles, less chrome. */
	.segmented.xs {
		padding: 2px;
	}

	.segmented.xs button {
		padding: 2px 7px;
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
	}

	.segmented.disabled {
		opacity: 0.5;
	}

	.segmented.disabled button {
		cursor: not-allowed;
	}

	/* Taller segments for a fingertip. The min-height is what actually guarantees the target: the
	   padding alone left a 34px segment, because the type inside it is 11.5px. */
	@media (pointer: coarse) {
		button {
			min-height: 40px;
			padding: 10px var(--sp-5);
		}
	}
</style>
