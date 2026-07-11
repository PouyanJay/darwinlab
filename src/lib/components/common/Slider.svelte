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
	/** How far along the track the thumb sits — the track paints its own fill from this. */
	const progress = $derived(((value - min) / (max - min)) * 100);

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
		class:danger={tone === 'danger'}
		style:--progress="{progress}%"
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

	/*
	 * The track is painted by hand rather than left to `accent-color`.
	 *
	 * `accent-color` colours the FILLED part and lets the browser derive the rest — and Chrome
	 * derives that from the accent's contrast, so a warm red (the predator-speed slider) came out
	 * with a near-black empty track while the blue ones stayed light grey. Two sliders side by side
	 * in the same dialog, built the same way, looking nothing alike. Painting the fill from the
	 * value gives one appearance across both tones and both themes.
	 */
	input {
		--slider-tone: var(--accent);
		width: 100%;
		height: 18px; /* the hit area — bigger than the 6px it draws, so it is easy to grab */
		margin-top: var(--sp-1);
		appearance: none;
		background: transparent;
		cursor: pointer;
	}

	.danger {
		--slider-tone: var(--danger);
	}

	/* WebKit and Firefox will not accept these in one selector list: an unknown pseudo-element
	   invalidates the whole rule, so the track and the thumb are each declared twice. */
	input::-webkit-slider-runnable-track {
		height: 6px;
		border-radius: var(--radius-pill);
		background: linear-gradient(
			to right,
			var(--slider-tone) var(--progress),
			var(--chip) var(--progress)
		);
	}

	input::-moz-range-track {
		height: 6px;
		border-radius: var(--radius-pill);
		background: linear-gradient(
			to right,
			var(--slider-tone) var(--progress),
			var(--chip) var(--progress)
		);
	}

	input::-webkit-slider-thumb {
		appearance: none;
		width: 14px;
		height: 14px;
		margin-top: -4px; /* centre the thumb on the 6px track */
		border: 2px solid var(--panel);
		border-radius: 50%;
		background: var(--slider-tone);
		box-shadow: var(--shadow-segment);
	}

	input::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border: 2px solid var(--panel);
		border-radius: 50%;
		background: var(--slider-tone);
		box-shadow: var(--shadow-segment);
	}
</style>
