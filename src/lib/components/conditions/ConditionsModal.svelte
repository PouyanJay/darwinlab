<!--
  Conditions — the dialog that edits an experiment while it is running.

  Nothing here restarts anything. Every field writes straight through to the live world: the
  generation counter keeps counting, the learning curve keeps its history, the champion stays on
  record, and the population you have spent fifteen generations breeding carries on from exactly
  where it was. That is what makes this an instrument rather than a settings screen.

  The knobs are grouped the way the scenario is described — ENVIRONMENT, AGENTS, ADVERSARY — because
  that is the vocabulary the whole product uses (scenario.ts), and a reader who thinks "the shark is
  too fast" should not have to hunt for the shark's speed among the tank's dimensions and the fish's
  senses. A selector switches between the three; identity (name, accent) stays visible above it,
  because it is not a condition of the experiment, it is which experiment this is.
-->
<script lang="ts">
	import Modal from '../common/Modal.svelte';
	import Slider from '../common/Slider.svelte';
	import Stepper from '../common/Stepper.svelte';
	import Segmented from '../common/Segmented.svelte';
	import { sensesFor } from '../senses';
	import { bench } from '$lib/state';
	import type { WorldEntry } from '$lib/state';
	import { ACCENTS, ACCENT_NAMES, WORLD_LIMITS, BRAIN_MAX_LAYERS } from '$lib/engine';
	import { SCENARIO } from '$lib/lab/scenario';

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
	const perSecond = (value: number) => `+${(value * 100).toFixed(0)}% / s`;
	const boost = (value: number) => `up to ${(1 + value).toFixed(2)}×`;
	const jaw = (value: number) => `up to ${14 + value} px`;

	/**
	 * The crossover, now with BOTH sides editable. The adversary cruises at 200 × predSpeed; the agent
	 * tops out at maxSpeed. Whether a correct escape gets away or merely delays the end is decided
	 * here, and it is the most consequential comparison on the bench — so it is stated in whichever
	 * group you are looking at the two halves from.
	 */
	const cruise = $derived(Math.round(200 * config.predSpeed));
	const outruns = $derived(cruise > config.maxSpeed);

	type Group = 'environment' | 'agents' | 'adversary';
	let group = $state<Group>('environment');

	// Titled with the scenario's own words: "Environment (tank)", "Agents (fish)", "Adversary (shark)".
	const GROUPS: { value: Group; label: string }[] = [
		{ value: 'environment', label: 'Environment' },
		{ value: 'agents', label: 'Agents' },
		{ value: 'adversary', label: 'Adversary' }
	];
	const subject = $derived(
		group === 'environment'
			? SCENARIO.environment.one
			: group === 'agents'
				? SCENARIO.agent.many
				: SCENARIO.adversary.many
	);

	/** The scenario's own words, capitalised for a field label — "Fish", "Sharks". */
	const cap = (word: string) => word[0].toUpperCase() + word.slice(1);
	const agentNoun = cap(SCENARIO.agent.many);
	const adversaryNoun = cap(SCENARIO.adversary.many);

	// The brain's hidden-layer architecture. Every edit resets the world (the genome shape changes),
	// so these route through setBrainLayers, not the live setCondition path.
	const setLayer = (i: number, n: number) => {
		const next = [...config.brainHidden];
		next[i] = n;
		bench.setBrainLayers(id, next);
	};
	const addLayer = () => bench.setBrainLayers(id, [...config.brainHidden, 6]);
	const removeLayer = (i: number) =>
		bench.setBrainLayers(
			id,
			config.brainHidden.filter((_, j) => j !== i)
		);
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

	<div class="group-select">
		<Segmented
			label="which part of the experiment to edit"
			options={GROUPS}
			value={group}
			onchange={(next) => (group = next)}
		/>
		<span class="subject">the {subject}</span>
	</div>

	{#if group === 'environment'}
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
		</div>

		<label class="field">
			<span class="field-label">Story caption</span>
			<textarea
				rows="2"
				placeholder="the narration shown when this world is on screen in story mode"
				value={config.caption}
				oninput={(event) => bench.setCaption(id, event.currentTarget.value)}></textarea>
		</label>
	{:else if group === 'agents'}
		<div class="pair">
			<Stepper
				label={agentNoun}
				value={config.prey}
				{...WORLD_LIMITS.prey}
				onchange={(value) => bench.setCondition(id, 'prey', value)}
			/>
		</div>

		<div class="sliders">
			<Slider
				label="Top speed"
				hint={outruns
					? '(slower than the adversary cruises)'
					: '(faster than the adversary cruises)'}
				value={config.maxSpeed}
				{...WORLD_LIMITS.maxSpeed}
				format={px}
				onchange={(value) => bench.setCondition(id, 'maxSpeed', value)}
			/>
			<!-- The single most consequential comparison on the bench: is the agent faster than the
			     adversary's cruise? Below the line, a correct escape only delays the end, and every
			     sense stops paying for itself. Both halves are editable now — drag either across it. -->
			<p class="speed-note" class:warn={outruns}>
				{config.maxSpeed} px/s vs the adversary's {cruise} cruise.
				{#if outruns}
					Slower than the cruise: fleeing only delays the end, and no sense pays.
				{:else}
					Faster than the cruise: fleeing can escape, so the senses can pay.
				{/if}
			</p>
			<Slider
				label="Vision range"
				hint="(how far it can sense the adversary)"
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
			<Slider
				label="Episode length"
				hint="(sim-seconds per generation — more time to learn)"
				value={config.genDuration}
				{...WORLD_LIMITS.genDuration}
				format={(v) => `${v}s`}
				onchange={(value) => bench.setCondition(id, 'genDuration', value)}
			/>
		</div>

		<!-- The brain's architecture: one stepper per hidden layer, plus add/remove. A deeper or wider
		     brain has more capacity but more weights to tune, so it is not automatically better — and
		     changing the shape restarts evolution (the genome is rebuilt at the new wiring). -->
		<fieldset class="persistence">
			<legend class="field-label">Brain: hidden layers</legend>
			<div class="layers">
				{#each config.brainHidden as neurons, i (i)}
					<div class="layer-row">
						<Stepper
							label="Layer {i + 1}"
							value={neurons}
							{...WORLD_LIMITS.brainHidden}
							onchange={(value) => setLayer(i, value)}
						/>
						{#if config.brainHidden.length > 1}
							<button
								type="button"
								class="layer-remove"
								aria-label="remove hidden layer {i + 1}"
								onclick={() => removeLayer(i)}>Remove</button
							>
						{/if}
					</div>
				{/each}
				{#if config.brainHidden.length < BRAIN_MAX_LAYERS}
					<button type="button" class="add-layer" onclick={addLayer}>+ Add a hidden layer</button>
				{/if}
			</div>
			<p class="description">
				Neurons per hidden layer — the brain's capacity and depth. More is not automatically better:
				a bigger brain has more weights to tune, so it needs more generations to converge. Changing
				the shape restarts evolution.
			</p>
		</fieldset>

		<!-- Schooling as a config option on ANY world: wire in the shoal senses and give the adversary
		     the confusion effect that makes grouping pay. Restarts evolution (the brain gains slots). -->
		<fieldset class="persistence">
			<legend class="field-label">Schooling: the shoal senses</legend>
			<label class="sense">
				<input
					type="checkbox"
					checked={config.schooling}
					onchange={(event) => bench.setSchooling(id, event.currentTarget.checked)}
				/>
				<span>
					<b>Sense the shoal</b>
					<span class="description">
						Wires two more inputs into the brain — where the neighbours are, and which way they
						point — and gives the adversary a confusion effect: it loses its target in a dense swarm
						and cannot grab a packed fish. Grouping starts to PAY, so a school can evolve. Restarts
						evolution (the brain gains slots), and pays best against a shark you cannot outswim.
						With it on, the two shoal pills below can be ablated like any other sense.
					</span>
				</span>
			</label>

			{#if config.schooling}
				<div class="sliders indented">
					<Slider
						label="Confusion strength"
						hint="(how much a crowd protects)"
						value={config.confusionStrength}
						{...WORLD_LIMITS.confusionStrength}
						format={(v) => `${v}`}
						onchange={(value) => bench.setCondition(id, 'confusionStrength', value)}
					/>
				</div>
			{/if}
		</fieldset>

		<fieldset class="senses">
			<legend class="field-label">Senses: the brain's input neurons</legend>
			{#each sensesFor(config.senses) as sense (sense.key)}
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
	{:else}
		<div class="pair">
			<Stepper
				label={adversaryNoun}
				value={config.preds}
				{...WORLD_LIMITS.preds}
				onchange={(value) => bench.setCondition(id, 'preds', value)}
			/>
		</div>

		<div class="sliders">
			<Slider
				label="Cruise speed"
				hint={outruns ? '(faster than the agent)' : '(slower than the agent)'}
				value={config.predSpeed}
				{...WORLD_LIMITS.predSpeed}
				format={times}
				tone="danger"
				onchange={(value) => bench.setCondition(id, 'predSpeed', value)}
			/>
			<p class="speed-note" class:warn={outruns}>
				{cruise} px/s vs the agent's {config.maxSpeed} top speed.
				{#if outruns}
					Faster than the agent: nothing escapes, and no sense pays.
				{:else}
					Slower than the agent: a good swimmer escapes, so the senses can pay.
				{/if}
			</p>
		</div>

		<!-- The dart — the cruise → aim → lunge strike. Off, the adversary only pursues at cruise and
		     eats what it catches up to. It is a real ablation, and it has an honest edge stated on it:
		     a cruise-only adversary below the agent's speed can never run a good one down. -->
		<fieldset class="toggle">
			<label class="sense">
				<input
					type="checkbox"
					checked={config.lunge}
					onchange={(event) => bench.setLunge(id, event.currentTarget.checked)}
				/>
				<span>
					<b>Darts at its target</b>
					<span class="description">
						The strike: it winds up, then lunges, a burst several times its cruise speed, and where
						most of the killing comes from. Off, it only chases at cruise and eats whatever it
						reaches: a far weaker hunter. Measured on an evolved bearing world, the strike catches
						most of a generation while the cruise alone lets a good share get away, so a
						well-evolved agent that could never dodge the lunge can simply outlast the chase. That
						is the answer to "what does the strike buy?", not a bug.
					</span>
				</span>
			</label>
		</fieldset>

		<!-- The hunger ramp. OFF by default, and that is a product decision: with it on, the adversary
		     gets faster and wider-jawed until it kills, so no agent is ever allowed to look safe. Off,
		     it is the same hunter all run long — and evolved evasion finally reads on screen. -->
		<fieldset class="persistence">
			<legend class="field-label">Persistence: the hunger ramp</legend>

			<label class="sense">
				<input
					type="checkbox"
					checked={config.persistence}
					onchange={(event) => bench.setPersistence(id, event.currentTarget.checked)}
				/>
				<span>
					<b>Escalate while hungry</b>
					<span class="description">
						The longer it goes without a kill, the faster it swims and the wider it bites, so no
						stalemate lasts. Off, it hunts the same all run long, which is the only way evolved
						evasion can look safe.
					</span>
				</span>
			</label>

			{#if config.persistence}
				<div class="sliders indented">
					<Slider
						label="Ramp"
						hint="(how fast hunger builds)"
						value={config.persistRamp}
						{...WORLD_LIMITS.persistRamp}
						format={perSecond}
						tone="danger"
						onchange={(value) => bench.setCondition(id, 'persistRamp', value)}
					/>
					<Slider
						label="Top speed when starving"
						value={config.persistMaxBoost}
						{...WORLD_LIMITS.persistMaxBoost}
						format={boost}
						tone="danger"
						onchange={(value) => bench.setCondition(id, 'persistMaxBoost', value)}
					/>
					<Slider
						label="Widest bite"
						hint="(catch radius, from 14 px)"
						value={config.persistMaxJaw}
						{...WORLD_LIMITS.persistMaxJaw}
						format={jaw}
						tone="danger"
						onchange={(value) => bench.setCondition(id, 'persistMaxJaw', value)}
					/>
				</div>
			{/if}
		</fieldset>
	{/if}

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

	/* The selector that switches the three groups — with a quiet reminder of what each one IS. */
	.group-select {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		margin-top: var(--sp-6);
	}

	.subject {
		font-size: var(--fs-sm);
		color: var(--ink3);
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

	.toggle {
		margin-top: var(--sp-6);
	}

	.persistence {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		margin-top: var(--sp-6);
	}

	.persistence legend {
		margin-bottom: var(--sp-3);
	}

	.layers {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.layer-row {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}

	.layer-remove,
	.add-layer {
		border: 1px solid var(--line);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--ink3);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		padding: 4px 12px;
		cursor: pointer;
		transition:
			color var(--dur) var(--ease),
			border-color var(--dur) var(--ease);
	}

	.layer-remove:hover,
	.add-layer:hover {
		color: var(--danger-ink);
		border-color: var(--danger-ink);
	}

	.add-layer {
		align-self: flex-start;
	}

	.add-layer:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	/* The ramp's own knobs sit indented under the switch that turns them on, so it reads as one
	   decision with its dials rather than three unrelated controls. */
	.sliders.indented {
		margin: 0 0 0 26px;
		padding-left: var(--sp-5);
		border-left: 2px solid var(--line);
	}

	.speed-note {
		margin: calc(-1 * var(--sp-2)) 0 0;
		font-size: var(--fs-label);
		color: var(--ink3);
	}

	/* The one comparison that decides whether ANY sense can pay — say so when it crosses the line. */
	.speed-note.warn {
		color: var(--danger-ink);
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
