<!--
  A −/value/+ field for the small integer counts (prey, predators).

  Controlled, like Slider: it reports the next value and holds nothing. It clamps to [min, max] and
  disables the button that would leave the range, so the count can never be nudged somewhere the
  engine won't accept.

  The value is an <output aria-live="polite">, so pressing − or + announces the new count instead
  of leaving a screen-reader user with a button press and silence.
-->
<script lang="ts">
	interface Props {
		/** Shown above the control, and the noun in the button labels ("fewer prey"). */
		label: string;
		value: number;
		min: number;
		max: number;
		step: number;
		onchange: (value: number) => void;
	}

	let { label, value, min, max, step, onchange }: Props = $props();

	// Unique per instance, so two steppers on the same screen can't collide on an id.
	const id = $props.id();
	const noun = $derived(label.toLowerCase());
	const canDecrement = $derived(value - step >= min);
	const canIncrement = $derived(value + step <= max);

	const nudge = (delta: number) => onchange(Math.min(max, Math.max(min, value + delta)));
</script>

<div class="field">
	<span class="label" {id}>{label}</span>
	<div class="row" role="group" aria-labelledby={id}>
		<button
			type="button"
			aria-label="fewer {noun}"
			disabled={!canDecrement}
			onclick={() => nudge(-step)}
		>
			−
		</button>
		<output class="value tabular" aria-live="polite">{value}</output>
		<button
			type="button"
			aria-label="more {noun}"
			disabled={!canIncrement}
			onclick={() => nudge(step)}
		>
			+
		</button>
	</div>
</div>

<style>
	.label {
		display: block;
		font-size: var(--fs-label);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-eyebrow);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		margin-top: var(--sp-2);
	}

	button {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--panel2);
		color: var(--ink);
		font-size: var(--fs-stat);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition: background var(--dur-fast) var(--ease);
	}

	button:not(:disabled):hover {
		background: var(--chip);
	}

	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.value {
		min-width: 26px;
		text-align: center;
		font-size: var(--fs-stat);
		font-weight: var(--fw-semibold);
	}
</style>
