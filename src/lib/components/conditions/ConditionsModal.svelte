<!--
  Conditions — the dialog that edits an experiment while it is running.

  Nothing here restarts anything. Every field writes straight through to the live world: the
  generation counter keeps counting, the learning curve keeps its history, the champion stays on
  record, and the population you have spent fifteen generations breeding carries on from exactly
  where it was. That is what makes this an instrument rather than a settings screen — you can widen
  the tank, double the sharks, and then watch the curve answer.

  Which is also why it says so, out loud, under the title.
-->
<script lang="ts">
	import Modal from '../common/Modal.svelte';
	import Slider from '../common/Slider.svelte';
	import Stepper from '../common/Stepper.svelte';
	import { SENSES } from '../senses';
	import { bench } from '$lib/state';
	import type { WorldEntry } from '$lib/state';
	import { ACCENTS, ACCENT_NAMES, WORLD_LIMITS } from '$lib/engine';

	interface Props {
		entry: WorldEntry;
		onclose: () => void;
	}

	let { entry, onclose }: Props = $props();

	const id = $derived(entry.id);
	const config = $derived(entry.config);

	// The numbers as a person reads them, not as a float prints itself.
	const px = (value: number) => `${value} px`;
	const times = (value: number) => `${value.toFixed(2)}×`;
	const rate = (value: number) => value.toFixed(3);
</script>

<Modal
	open
	title="Conditions"
	subtitle="changes apply live to this world; brains keep evolving from where they are"
	accent={config.accent}
	{onclose}
>
	<label class="field">
		<span class="field-label">World name</span>
		<input
			type="text"
			value={config.name}
			oninput={(event) => bench.renameWorld(id, event.currentTarget.value)}
		/>
	</label>

	<label class="field">
		<span class="field-label">Story caption</span>
		<textarea
			rows="2"
			placeholder="the narration shown when this world is on screen in story mode"
			value={config.caption}
			oninput={(event) => bench.setCaption(id, event.currentTarget.value)}></textarea>
	</label>

	<div class="pair">
		<Stepper
			label="Prey"
			value={config.prey}
			{...WORLD_LIMITS.prey}
			onchange={(value) => bench.setCondition(id, 'prey', value)}
		/>
		<Stepper
			label="Predators"
			value={config.preds}
			{...WORLD_LIMITS.preds}
			onchange={(value) => bench.setCondition(id, 'preds', value)}
		/>
	</div>

	<div class="sliders">
		<Slider
			label="Container width"
			value={config.bw}
			{...WORLD_LIMITS.bw}
			format={px}
			onchange={(value) => bench.setCondition(id, 'bw', value)}
		/>
		<Slider
			label="Container height"
			value={config.bh}
			{...WORLD_LIMITS.bh}
			format={px}
			onchange={(value) => bench.setCondition(id, 'bh', value)}
		/>
		<Slider
			label="Predator speed"
			value={config.predSpeed}
			{...WORLD_LIMITS.predSpeed}
			format={times}
			tone="danger"
			onchange={(value) => bench.setCondition(id, 'predSpeed', value)}
		/>
		<Slider
			label="Prey vision range"
			value={config.vision}
			{...WORLD_LIMITS.vision}
			format={px}
			onchange={(value) => bench.setCondition(id, 'vision', value)}
		/>
		<Slider
			label="Mutation rate"
			hint="(genetic drift per birth)"
			value={config.mutation}
			{...WORLD_LIMITS.mutation}
			format={rate}
			onchange={(value) => bench.setCondition(id, 'mutation', value)}
		/>
	</div>

	<fieldset class="senses">
		<legend class="field-label">Senses — the brain's input neurons</legend>
		{#each SENSES as sense (sense.key)}
			<label class="sense">
				<input
					type="checkbox"
					checked={config.senses[sense.key]}
					onchange={(event) => bench.setSense(id, sense.key, event.currentTarget.checked)}
				/>
				<span>
					<b>{sense.name}</b>
					<span class="description">{sense.description}</span>
				</span>
			</label>
		{/each}
	</fieldset>

	<fieldset class="accents">
		<legend class="field-label">Accent</legend>
		{#each ACCENTS as accent (accent)}
			<label class="swatch" style:--swatch={accent}>
				<input
					type="radio"
					name="accent-{id}"
					value={accent}
					checked={config.accent === accent}
					onchange={() => bench.setAccent(id, accent)}
				/>
				<span class="visually-hidden">{ACCENT_NAMES[accent]}</span>
			</label>
		{/each}
	</fieldset>
</Modal>

<style>
	.field {
		display: block;
		margin-top: var(--sp-5);
	}

	input[type='text'],
	textarea {
		width: 100%;
		margin-top: 5px;
		padding: var(--sp-3) var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-input);
		background: var(--panel2);
		color: var(--ink);
		font-size: var(--fs-body);
		font-weight: var(--fw-medium);
		transition: border-color var(--dur-fast) var(--ease);
	}

	textarea {
		resize: vertical;
	}

	input[type='text']:focus,
	textarea:focus {
		border-color: var(--accent);
	}

	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-top: var(--sp-6);
	}

	.sliders {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		margin-top: var(--sp-6);
	}

	fieldset {
		margin: var(--sp-7) 0 0;
		padding: 0;
		border: none;
	}

	legend {
		padding: 0;
	}

	.senses {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-3);
	}

	/* A legend inside a grid would take a cell; span it back across the row. */
	.senses legend,
	.accents legend {
		grid-column: 1 / -1;
		margin-bottom: var(--sp-3);
	}

	.sense {
		display: flex;
		align-items: flex-start;
		gap: 9px;
		padding: 9px var(--sp-4);
		border: 1px solid var(--line);
		border-radius: 12px;
		cursor: pointer;
		transition: border-color var(--dur-fast) var(--ease);
	}

	.sense:hover,
	.sense:focus-within {
		border-color: var(--accent);
	}

	.sense input {
		margin-top: 2px;
		accent-color: var(--accent);
	}

	.sense b {
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
	}

	.description {
		display: block;
		font-size: var(--fs-xs);
		color: var(--ink3);
	}

	.accents {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-3);
	}

	/* The swatch IS the radio: the real input stays, invisible but focusable and arrow-keyable. */
	.swatch {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--swatch);
		border: 2px solid transparent;
		box-shadow: 0 0 0 2px var(--panel);
		cursor: pointer;
		display: grid;
		place-items: center;
	}

	.swatch input {
		appearance: none;
		width: 100%;
		height: 100%;
		margin: 0;
		border-radius: 50%;
		cursor: pointer;
	}

	.swatch:has(input:checked) {
		box-shadow:
			0 0 0 2px var(--panel),
			0 0 0 4px var(--ink);
	}

	.swatch:has(input:focus-visible) {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	/* A fingertip-sized colour dot. */
	@media (pointer: coarse) {
		.swatch {
			width: 34px;
			height: 34px;
		}
	}
</style>
