<!--
  The Sweep's DESIGN PANEL — the console's second sidebar, where the whole experiment is designed.

  Top to bottom: FACTORS (every boolean knob as a pin-or-sweep three-state, grouped senses → body →
  predator → shoal), GRADED LEVELS (chips: one = pinned, two or more = swept), the BUDGET (seeds,
  generations, generation length, and the cap), and a STICKY COMMIT BAR — the plan readout and Run
  pinned together at the panel's foot, so a run can never be fired with its cost scrolled out of
  view. Everything reads and writes the sweep store, which owns every clamp and guard; the panel is
  the store's face, not a second brain.

  The own-speed sense is the one knob that can be impossible: it needs the 9-input brain, so on an
  8-wire subject its control is disabled and the row offers the switch instead — an explicit choice,
  never a silent change to the control world (the owner's call).
-->
<script lang="ts">
	import Segmented from '../../common/Segmented.svelte';
	import Button from '../../common/Button.svelte';
	import Icon from '../../common/Icon.svelte';
	import RunProgress from '../RunProgress.svelte';
	import { sweep, app } from '$lib/state';
	import { GUARD_CONFIRM_MINUTES, GUARD_WARN_MINUTES } from '$lib/state';
	import { hasNineWires, scalePreyPct } from '$lib/lab/sweep';
	import type { KnobGroupKey, KnobState } from '$lib/lab/sweep';

	const GROUPS: { key: KnobGroupKey; label: string }[] = [
		{ key: 'senses', label: 'Prey senses' },
		{ key: 'body', label: 'Prey body' },
		{ key: 'predator', label: 'Predator' },
		{ key: 'shoal', label: 'Shoal' }
	];

	const STATES: { value: KnobState; label: string }[] = [
		{ value: 'off', label: 'off' },
		{ value: 'on', label: 'on' },
		{ value: 'sweep', label: 'sweep' }
	];

	const nineWired = $derived(hasNineWires(app.base));

	// The plan, in the commit bar's words. Bool vs graded is decided by KEY, never by level count —
	// a two-chip graded knob has two levels exactly like a bool, and folding it into the exponent
	// once mislabelled the default design "2⁴ × 3 predators".
	const boolKeys = new Set(sweep.boolKnobs.map((k) => k.key));
	const boolCount = $derived(sweep.plannedFactors.filter((f) => boolKeys.has(f.key)).length);
	const gradedParts = $derived(
		sweep.plannedFactors
			.filter((f) => !boolKeys.has(f.key))
			.map(
				(f) =>
					`${f.levels.length} ${sweep.gradedKnobs.find((k) => k.key === f.key)?.short ?? f.key}`
			)
	);
	const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
	const sup = (n: number) =>
		String(n)
			.split('')
			.map((d) => SUP[Number(d)])
			.join('');

	const estMinutes = $derived(sweep.estimatedSeconds / 60);
	const estLabel = $derived(estMinutes < 1 ? '< 1 min' : `≈ ${Math.round(estMinutes)} min`);

	// The typed-confirm contract: a confirm-tier run only starts when the typed count matches.
	let typedCells = $state('');
	const confirmed = $derived(Number(typedCells) === sweep.cellsToRun);

	function run(): void {
		if (sweep.guard === 'confirm') {
			if (!confirmed) return;
			sweep.run(undefined, { confirmedCells: sweep.cellsToRun });
		} else {
			sweep.run();
		}
		typedCells = '';
	}
</script>

<div class="panel no-scrollbar" data-testid="sweep-design">
	<header class="head">
		<span class="eyebrow">Sweep design</span>
		<span class="sub">factors × levels → cells · every cell runs on the subject</span>
	</header>

	<section class="dsec">
		<header class="dsec-head">
			<span class="eyebrow">Factors</span>
			<span class="hint">pin it, or sweep it off ↔ on</span>
		</header>

		{#each GROUPS as group (group.key)}
			<div class="fgroup">
				<span class="glabel">{group.label}</span>
				{#each sweep.boolKnobs.filter((k) => k.group === group.key) as knob (knob.key)}
					{@const impossible = knob.needsNineInputs && !nineWired}
					<div class="trow" class:off={sweep.boolState(knob.key) !== 'sweep'}>
						<div class="tl">
							<span class="tname">{knob.label}</span>
							<span class="tsub">{knob.detail}</span>
							{#if impossible}
								<button class="offer" onclick={() => app.setBaseBrainInputs(9)}>
									switch the subject to the 9-input brain
								</button>
							{/if}
						</div>
						<Segmented
							size="xs"
							label={knob.label}
							options={STATES}
							value={sweep.boolState(knob.key)}
							disabled={impossible}
							onchange={(state) => sweep.setBoolState(knob.key, state)}
						/>
					</div>
				{/each}
			</div>
		{/each}
	</section>

	<section class="dsec">
		<header class="dsec-head">
			<span class="eyebrow">Graded levels</span>
			<span class="hint">1 chip = pinned · ≥2 = swept</span>
		</header>

		{#each sweep.gradedKnobs as knob (knob.key)}
			<div class="fgroup">
				<span class="glabel">{knob.label}</span>
				<div class="lvls" role="group" aria-label={knob.label}>
					{#each knob.values as value (value)}
						<button
							class="lvl"
							aria-pressed={sweep.isLevelSelected(knob.key, value)}
							onclick={() => sweep.toggleLevel(knob.key, value)}
						>
							{knob.format(value)}
						</button>
					{/each}
				</div>
				{#if knob.key === 'preyPct'}
					<span class="lnote tabular">
						on a {app.base.prey}-prey subject: {knob.values
							.filter((v) => sweep.isLevelSelected(knob.key, v))
							.map((v) => scalePreyPct(app.base.prey, v))
							.join(' · ')} fish
					</span>
				{/if}
			</div>
		{/each}
	</section>

	<section class="dsec">
		<header class="dsec-head"><span class="eyebrow">Budget</span></header>

		<label class="brow">
			<span class="bl">Seeds per cell <i>independent replicate universes</i></span>
			<input
				type="number"
				inputmode="numeric"
				data-testid="sweep-seeds"
				min="2"
				max="12"
				value={sweep.seeds}
				onchange={(e) => sweep.setSeeds(Number(e.currentTarget.value))}
			/>
		</label>
		<label class="brow">
			<span class="bl">Generations per run <i>training length before scoring</i></span>
			<input
				type="number"
				inputmode="numeric"
				min="5"
				max="120"
				value={sweep.episodes}
				onchange={(e) => sweep.setEpisodes(Number(e.currentTarget.value))}
			/>
		</label>
		<label class="brow">
			<span class="bl">Sim-seconds per generation <i>longer keeps selection sharpening</i></span>
			<input
				type="number"
				inputmode="numeric"
				min="10"
				max="60"
				step="5"
				value={sweep.genDuration}
				onchange={(e) => sweep.setGenDuration(Number(e.currentTarget.value))}
			/>
		</label>
		<div class="brow">
			<span class="bl">Cell cap <i>off = run the full factorial</i></span>
			<span class="caprow">
				<button
					class="switch"
					role="switch"
					aria-checked={sweep.capOn}
					aria-label="cap the cell count"
					onclick={() => sweep.setCapOn(!sweep.capOn)}
				></button>
				<input
					type="number"
					inputmode="numeric"
					aria-label="cell cap"
					min="8"
					max="256"
					value={sweep.capN}
					disabled={!sweep.capOn}
					onchange={(e) => sweep.setCapN(Number(e.currentTarget.value))}
				/>
			</span>
		</div>
	</section>

	<!-- The commit bar: the receipt and the trigger pinned together — the design scrolls beneath. -->
	<div class="commit">
		<div class="plan" aria-live="polite">
			<span class="cells" data-testid="sweep-summary">
				{#if boolCount}2{sup(boolCount)}{/if}{#if gradedParts.length}{boolCount
						? ' × '
						: ''}{gradedParts.join(' × ')}{/if}
				= <b class="tabular">{sweep.plannedCells}</b> cells × {sweep.seeds} seeds
			</span>
			<span class="detail tabular">
				{sweep.cellsToRun} cells run · {sweep.cellsToRun * sweep.seeds} runs · {sweep.episodes} gens ×
				{sweep.genDuration}s each
			</span>
			<span class="detail tabular">
				est. {estLabel} wall clock{#if !sweep.estimateCalibrated}
					· uncalibrated until a first run{/if}
			</span>
			{#if sweep.willSample}
				<span class="warn" data-testid="sweep-sampled-warn">
					⚠ capped: a random {sweep.capN} of {sweep.plannedCells} — every output will say “sampled”.
				</span>
			{:else if sweep.guard === 'confirm'}
				<span class="warn hard">
					⛔ large: {estLabel} — over {GUARD_CONFIRM_MINUTES} min. Type the cell count to run.
				</span>
			{:else if sweep.guard === 'warn'}
				<span class="warn"
					>⚠ medium run: {estLabel} of compute — over {GUARD_WARN_MINUTES} min.</span
				>
			{/if}
		</div>

		{#if sweep.running}
			<RunProgress progress={sweep.progress} oncancel={() => sweep.cancel()} />
		{:else}
			{#if sweep.guard === 'confirm'}
				<input
					class="confirm-input"
					type="text"
					inputmode="numeric"
					aria-label="type the cell count to confirm"
					placeholder={String(sweep.cellsToRun)}
					bind:value={typedCells}
				/>
			{/if}
			<Button
				variant="primary"
				class="wide"
				disabled={sweep.guard === 'confirm' && !confirmed}
				onclick={run}
			>
				<Icon name="forward" size={14} />
				<span>Run sweep</span>
			</Button>
		{/if}
	</div>
</div>

<style>
	/* The panel is the console's second sidebar: its own scroller, chrome-free, with the commit bar
	   sticky at its foot. A SOLID ground, not a tint — the sticky bar must match it exactly. */
	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		min-height: 0;
		overflow-y: auto;
		padding: var(--sp-6) var(--sp-5) 0;
		background: var(--panel);
		border-right: 1px solid var(--line);
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.sub,
	.hint {
		font-size: var(--fs-xs);
		color: var(--ink3);
	}

	.dsec {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--panel2);
		padding: var(--sp-4);
	}

	.dsec-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--sp-3);
	}

	.fgroup {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.fgroup + .fgroup {
		margin-top: var(--sp-2);
	}

	.glabel {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
		padding-bottom: 2px;
	}

	.trow {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: 3px 2px;
		border-radius: var(--radius-chip);
	}

	.tl {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.tname {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}

	/* A pinned knob reads quiet; the swept ones are the design's loud part. */
	.trow.off .tname {
		color: var(--ink3);
		font-weight: var(--fw-medium);
	}

	.tsub {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.offer {
		align-self: flex-start;
		margin-top: 2px;
		background: none;
		border: none;
		padding: 0;
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		color: var(--ink2);
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}

	.offer:hover {
		color: var(--ink);
	}

	.offer:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	.lvls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
	}

	.lvl {
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		border: 1px solid var(--line);
		border-radius: var(--radius-chip);
		background: var(--panel);
		color: var(--ink3);
		padding: 3px 9px;
		cursor: pointer;
		transition:
			border-color var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease);
	}

	.lvl:hover {
		border-color: var(--ink3);
		color: var(--ink2);
	}

	/* An on-chip is a full-ink hairline — emphasis by lightness, the platform's way. */
	.lvl[aria-pressed='true'] {
		border-color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--ink);
		color: var(--ink);
	}

	.lvl:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	.lnote {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.brow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
	}

	.bl {
		display: flex;
		flex-direction: column;
		font-size: var(--fs-sm);
		color: var(--ink2);
	}

	.bl i {
		font-style: normal;
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.brow input {
		width: 56px;
		padding: 5px 8px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--panel);
		color: var(--ink);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.brow input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.brow input:disabled {
		opacity: 0.45;
	}

	.caprow {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}

	/* the cap's switch — the pill-and-thumb the mock uses */
	.switch {
		flex: none;
		width: 28px;
		height: 16px;
		border-radius: var(--radius-pill);
		border: 1px solid var(--line);
		background: var(--panel);
		position: relative;
		cursor: pointer;
		padding: 0;
	}

	.switch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--ink3);
		transition:
			transform var(--dur-fast) var(--ease),
			background var(--dur-fast) var(--ease);
	}

	.switch[aria-checked='true'] {
		background: var(--ink);
		border-color: var(--ink);
	}

	.switch[aria-checked='true']::after {
		transform: translateX(12px);
		background: var(--btnink);
	}

	.switch:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	/* ---- the sticky commit bar: receipt + trigger, pinned; the design slides beneath ---- */
	.commit {
		position: sticky;
		bottom: 0;
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		background: var(--panel);
		padding: var(--sp-3) 0 var(--sp-5);
		box-shadow: 0 -16px 18px -12px rgba(0, 0, 0, 0.45);
	}

	.plan {
		display: flex;
		flex-direction: column;
		gap: 3px;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--panel2);
		padding: var(--sp-4);
	}

	.cells {
		font-size: var(--fs-body);
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.cells b {
		font-size: var(--fs-stat);
	}

	.detail {
		font-size: var(--fs-xs);
		color: var(--ink3);
	}

	.warn {
		font-size: var(--fs-xs);
		color: var(--gold-ink);
	}

	.warn.hard {
		color: var(--danger-ink);
	}

	.confirm-input {
		width: 100%;
		padding: 7px 10px;
		border: 1px solid var(--danger-ink);
		border-radius: var(--radius-sm);
		background: var(--panel2);
		color: var(--ink);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.confirm-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.panel :global(.btn.wide) {
		width: 100%;
	}
</style>
