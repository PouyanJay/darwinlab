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
	import Button from '../common/Button.svelte';
	import Modal from '../common/Modal.svelte';
	import Slider from '../common/Slider.svelte';
	import Stepper from '../common/Stepper.svelte';
	import { SENSES } from '../senses';
	import { bench } from '$lib/state';
	import type { WorldEntry } from '$lib/state';
	import { ACCENTS, ACCENT_NAMES, WORLD_LIMITS, CROWDED_OCEAN } from '$lib/engine';

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
	 * The line that tells you what the speed slider is really doing. A fish tops out at MAXSPEED
	 * (176 px/s) and the shark cruises at 200 × predSpeed, so the crossing point is ~0.88 — and it
	 * is the most consequential number on the bench: above it no fish can outrun the shark, so
	 * knowing which way to flee buys a delay and never an escape, and every sense stops paying.
	 */
	const cruise = $derived(Math.round(200 * config.predSpeed));
	const outruns = $derived(cruise > 176);

	/** Already crowded — the preset would change nothing, and a button that does nothing is a lie. */
	const crowded = $derived(
		config.preds >= CROWDED_OCEAN.preds && config.vision >= CROWDED_OCEAN.vision
	);
</script>

<Modal
	open
	title="Conditions"
	subtitle="changes apply live to this world; brains keep evolving from where they are"
	accent={config.accent}
	{onclose}
>
	<!--
		The one preset on the bench, and it is not a shortcut to a better world — it is an EXHIBIT of
		the lab's own thesis, and its copy has to carry both halves or it is propaganda.

		Measured (50 generations × 3 seeds, before a line of this UI existed): crowding the ocean widens
		the gap between a blind world and a bearing-sensing one from +34% to +67% of a life, and lifts
		the share of fish that turn the RIGHT way from 51% to 64%. And it collapses everything above
		bearing: full-sense fish fall below corner-wise ones. A harsher world does not make more senses
		pay. It makes ONE sense decisive and drowns the rest.

		The obvious idea — slow the shark down so that fleeing "genuinely works" — was measured first
		and was simply wrong: everyone survives, selection has nothing to sort, and the ladder dies.
		Mercy is not pressure. See CROWDED_OCEAN in engine/defaults.ts.
	-->
	<section class="preset">
		<div>
			<h3>Raise the stakes</h3>
			<p>
				Five hunters and long sight, so <b>no fish survives by never meeting a shark</b>. Bearing
				becomes decisive: blind and bearing worlds pull 33 points apart on survival, and the share
				of fish turning the right way climbs from 51% to 64%.
			</p>
			<p class="cost">
				It also <b>collapses the rungs above bearing</b> — in an ocean this lethal, the extra senses stop
				paying. That is the finding, not a side effect.
			</p>
		</div>
		<Button variant="primary" size="sm" disabled={crowded} onclick={() => bench.crowdTheOcean(id)}>
			{crowded ? 'Ocean is crowded' : 'Crowd the ocean'}
		</Button>
	</section>

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
			hint={outruns ? '(the shark outruns the fish)' : '(a fish can outrun the shark)'}
			value={config.predSpeed}
			{...WORLD_LIMITS.predSpeed}
			format={times}
			tone="danger"
			onchange={(value) => bench.setCondition(id, 'predSpeed', value)}
		/>
		<!-- The single most consequential number on the bench, said plainly: above a 176 px/s cruise
		     no fish can get away, so knowing WHICH WAY to flee buys a delay and never an escape —
		     and every sense stops paying for itself. Drag it across the line and watch. -->
		<p class="speed-note" class:warn={outruns}>
			{cruise} px/s against a fish's 176.
			{#if outruns}
				Nothing can outswim it, so fleeing correctly only delays the end — this is the setting under
				which no sense pays.
			{:else}
				A fish that flees the right way can actually get away, which is what makes its senses worth
				having.
			{/if}
		</p>
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

	<!-- The hunger ramp. OFF by default, and that is a product decision, not a default that
	     happened: with it on, the shark gets faster and wider-jawed until it kills, so no fish is
	     ever allowed to look safe and a population that genuinely learned looks exactly like one
	     that did not. Off, the shark is the same hunter all run long — and evolved evasion finally
	     reads on screen. Switch it on and the three knobs beneath it say how hard it escalates. -->
	<fieldset class="persistence">
		<legend class="field-label">Predator persistence — the hunger ramp</legend>

		<label class="sense">
			<input
				type="checkbox"
				checked={config.persistence}
				onchange={(event) => bench.setPersistence(id, event.currentTarget.checked)}
			/>
			<span>
				<b>Escalate while hungry</b>
				<span class="description">
					The longer the shark goes without a kill, the faster it swims and the wider it bites — so
					no stalemate lasts forever, and no fish stays safe. Off, it hunts the same all run long,
					which is the only way a population that has genuinely learned can look it.
				</span>
			</span>
		</label>

		{#if config.persistence}
			<div class="sliders">
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
	.preset {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
		margin-bottom: var(--sp-6);
		padding: var(--sp-5);
		border: 1px solid var(--line);
		border-radius: var(--radius-input);
		background: var(--panel2);
	}

	.preset h3 {
		margin: 0 0 var(--sp-2);
		font-family: var(--font-display);
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
	}

	.preset p {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink2);
	}

	.preset b {
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}

	/* The honest half. It is not a footnote — it is half the finding. */
	.preset .cost {
		margin-top: var(--sp-2);
		color: var(--ink3);
	}

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

	.persistence {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		margin-top: var(--sp-5);
	}

	.persistence legend {
		margin-bottom: var(--sp-3);
	}

	/* The ramp's own knobs sit indented under the switch that turns them on, so it reads as one
	   decision with its dials rather than four unrelated controls. */
	.persistence .sliders {
		margin: 0 0 0 26px;
		padding-left: var(--sp-5);
		border-left: 2px solid var(--line);
	}

	.speed-note {
		margin: calc(-1 * var(--sp-2)) 0 0;
		font-size: var(--fs-label);
		color: var(--ink3);
	}

	/* The one setting that decides whether ANY sense can pay — say so when it crosses the line. */
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
