<!--
  The app's button, in the four shapes the design uses:

    primary  the dark/light solid — Pause/Evolve, Ablate
    accent   the coloured call to action — Play story
    ghost    a panel-coloured button with a hairline border — Train, theme, + add, Conditions
    icon     a bare square that only holds a glyph — ↻ ⧉ ✕ (`tone="danger"` reddens ✕ on hover)

  Anything a <button> takes (onclick, disabled, title, aria-*, style) passes straight through.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		children: Snippet;
		variant?: 'primary' | 'accent' | 'ghost' | 'icon';
		size?: 'sm' | 'md';
		/** Icon buttons that destroy something go red on hover, so the ✕ reads before it's clicked. */
		tone?: 'default' | 'danger';
	}

	let {
		children,
		variant = 'ghost',
		size = 'md',
		tone = 'default',
		type = 'button',
		...rest
	}: Props = $props();
</script>

<button {type} class={['btn', variant, size, tone]} {...rest}>
	{@render children()}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--sp-3);
		padding: var(--sp-3) 14px;
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
		white-space: nowrap;
		cursor: pointer;
		transition:
			transform var(--dur-fast) var(--ease),
			background var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease);
	}

	.btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	/* The lift is a hover affordance; pressing must feel like the button goes back down. */
	.btn:not(:disabled):active {
		transform: none;
	}

	.primary {
		background: var(--btn);
		color: var(--btnink);
	}

	.accent {
		background: var(--accent);
		color: var(--accentink);
		box-shadow: 0 4px 14px -4px var(--accent);
	}

	.primary:not(:disabled):hover,
	.accent:not(:disabled):hover {
		transform: translateY(-1px);
	}

	.ghost {
		background: var(--panel);
		border-color: var(--line);
		color: var(--ink);
	}

	.ghost:not(:disabled):hover {
		background: var(--chip);
	}

	.icon {
		width: 28px;
		height: 28px;
		padding: 0;
		border: none;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--ink3);
		font-size: var(--fs-body);
	}

	.icon:not(:disabled):hover {
		background: var(--chip);
		color: var(--ink);
	}

	.icon.danger:not(:disabled):hover {
		color: var(--danger);
	}

	.icon.sm {
		width: 26px;
		height: 26px;
	}

	/* `sm` only changes the box of a text button; an icon button is already square. */
	.sm:not(.icon) {
		padding: var(--sp-2) 12px;
		border-radius: var(--radius-sm);
		font-size: var(--fs-md);
	}

	/* A fingertip is not a cursor: when the pointer is coarse, every button offers a full-size
	   target. Visual density is a desktop luxury. */
	@media (pointer: coarse) {
		.btn {
			min-height: 44px;
		}

		.icon {
			width: 44px;
			height: 44px;
		}

		.icon.sm {
			width: 40px;
			height: 40px;
		}

		.sm:not(.icon) {
			min-height: 40px;
		}
	}
</style>
