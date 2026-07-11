<!--
  A labelled range field: caption on the left, live value on the right, track below.

  Controlled — it reports every change and never holds its own value. That is deliberate: sliders
  in this app edit a live world (`cfg` → `applyCfg`), so the world's value is the only truth, and a
  slider that kept a private copy could drift from the sim it is supposedly steering.

  The native <input type="range"> is kept (rather than a div dressed up as one) because it already
  is keyboard-operable, arrow-steppable and understood by assistive tech; `format` only changes how
  the value READS ("1.20×", "0.075"), and it is echoed into aria-valuetext so AT hears the same
  thing the eye sees.
-->
<script lang="ts">
	import { tick } from 'svelte';

	interface Props {
		label: string;
		value: number;
		min: number;
		max: number;
		step: number;
		onchange: (value: number) => void;
		/** How the number reads to a human — "640 px", "1.20×". Defaults to the bare number. */
		format?: (value: number) => string;
		/** A quieter aside on the label, e.g. "(genetic drift per birth)". */
		hint?: string;
		/** Predator settings are the world's threat, so their track is red, not accent-coloured. */
		tone?: 'accent' | 'danger';
	}

	let {
		label,
		value,
		min,
		max,
		step,
		onchange,
		format = String,
		hint,
		tone = 'accent'
	}: Props = $props();

	const display = $derived(format(value));

	/**
	 * Report the drag, then make the thumb agree with whatever the owner decided.
	 *
	 * Svelte only rewrites the DOM when `value` actually changes, so if the owner clamps or ignores
	 * what we reported, the prop comes back identical and the thumb would silently stay where the
	 * user dragged it — showing a number the world does not have. Re-asserting after `tick()` (once
	 * the owner's update, if any, has landed) keeps the control honest in both cases.
	 */
	async function drag(event: Event & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		onchange(input.valueAsNumber);
		await tick();
		if (input.valueAsNumber !== value) input.valueAsNumber = value;
	}
</script>

<label class="field">
	<span class="head">
		<span class="field-label">
			{label}{#if hint}<span class="hint">{hint}</span>{/if}
		</span>
		<span class="value tabular">{display}</span>
	</span>
	<input
		type="range"
		class={tone}
		{min}
		{max}
		{step}
		{value}
		aria-valuetext={display}
		oninput={drag}
	/>
</label>

<style>
	.field {
		display: block;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--sp-3);
	}

	/* The hint is prose inside a shouted label, so it drops the caps and the tracking. */
	.hint {
		margin-left: var(--sp-1);
		letter-spacing: normal;
		text-transform: none;
	}

	.value {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}

	input {
		width: 100%;
		margin-top: var(--sp-1);
		cursor: pointer;
	}

	.accent {
		accent-color: var(--accent);
	}

	.danger {
		accent-color: var(--danger);
	}
</style>
