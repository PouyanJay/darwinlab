<!--
  The Atlas's DESIGN PANEL — the console's second sidebar, where the plane is designed.

  Top to bottom: AXES (two dropdowns that can never face each other, each with a continuous
  from → to range — the Atlas's whole difference from the Sweep's chips), RESOLUTION (a fixed menu,
  priced honestly: finer costs quadratically), the PINNED BACKGROUND (two-state off·on rows — the
  axes are the only things that vary on this instrument), the BUDGET, and a STICKY COMMIT BAR with
  the plan readout and Paint landscape pinned at the panel's foot. Everything reads and writes the
  landscape store, which owns every clamp and snap; the panel is the store's face, not a second brain.
-->
<script lang="ts">
	import Button from '../../common/Button.svelte';
	import Icon from '../../common/Icon.svelte';
	import Segmented from '../../common/Segmented.svelte';
	import RunProgress from '../RunProgress.svelte';
	import { landscape } from '$lib/state';
	import { GUARD_WARN_MINUTES } from '$lib/state';
	import { LANDSCAPE_DEFAULTS, ATLAS_PIN_GROUPS } from '$lib/lab/landscape';
	import { BOOL_KNOBS } from '$lib/lab/sweep';

	const STATES: { value: 'off' | 'on'; label: string }[] = [
		{ value: 'off', label: 'off' },
		{ value: 'on', label: 'on' }
	];

	const knob = (key: string) => BOOL_KNOBS.find((k) => k.key === key);

	// The two slots, uniformly: which axis each holds, and the setter a pick commits through.
	const slots = $derived([
		{
			tag: 'X →',
			label: 'x axis',
			axis: landscape.axisX,
			set: (key: string) => landscape.setX(key)
		},
		{
			tag: 'Y ↑',
			label: 'y axis',
			axis: landscape.axisY,
			set: (key: string) => landscape.setY(key)
		}
	]);

	/** The other slot's pick — an axis can never face itself, so it leaves the dropdown. */
	const rivalOf = (label: string) =>
		label === 'x axis' ? landscape.axisY.key : landscape.axisX.key;

	const estMinutes = $derived(landscape.estimatedSeconds / 60);
	const estLabel = $derived(estMinutes < 1 ? '< 1 min' : `≈ ${Math.round(estMinutes)} min`);
</script>

<div class="panel no-scrollbar" data-testid="atlas-design">
	<header class="head">
		<span class="eyebrow">Landscape design</span>
		<span class="sub">two axes × a range each → the plane the map paints</span>
	</header>

	<section class="dsec">
		<header class="dsec-head">
			<span class="eyebrow">Axes</span>
			<span class="hint">continuous ranges — not chips</span>
		</header>
		{#each slots as slot (slot.label)}
			<div class="axisrow">
				<div class="axhead">
					<span class="axtag">{slot.tag}</span>
					<select
						aria-label={slot.label}
						value={slot.axis.key}
						onchange={(e) => slot.set(e.currentTarget.value)}
					>
						{#each landscape.axes.filter((a) => a.key !== rivalOf(slot.label)) as axis (axis.key)}
							<option value={axis.key}>{axis.label}</option>
						{/each}
					</select>
				</div>
				<div class="rangerow">
					<input
						type="number"
						step="any"
						aria-label="{slot.label} from"
						value={slot.axis.min}
						onchange={(e) =>
							landscape.setSpan(slot.axis.key, Number(e.currentTarget.value), slot.axis.max)}
					/>
					<span class="to">→</span>
					<input
						type="number"
						step="any"
						aria-label="{slot.label} to"
						value={slot.axis.max}
						onchange={(e) =>
							landscape.setSpan(slot.axis.key, slot.axis.min, Number(e.currentTarget.value))}
					/>
				</div>
			</div>
		{/each}
		<p class="lnote">
			an axis can't face itself — picking one drops it from the other dropdown. Ranges are the map's
			edges; the resolution below slices them evenly.
		</p>
	</section>

	<section class="dsec">
		<header class="dsec-head">
			<span class="eyebrow">Resolution</span>
			<span class="hint">cells per side</span>
		</header>
		<div class="lvls" role="group" aria-label="grid resolution">
			{#each LANDSCAPE_DEFAULTS.resolutions as option (option)}
				<button
					class="lvl"
					aria-pressed={landscape.resolution === option}
					onclick={() => landscape.setResolution(option)}
				>
					{option} × {option}
				</button>
			{/each}
		</div>
		<p class="lnote">
			finer sees the cliff sharper and costs quadratically — <b
				>the estimate below is the honest price</b
			>.
		</p>
	</section>

	<section class="dsec">
		<header class="dsec-head">
			<span class="eyebrow">Pinned background</span>
			<span class="hint">held for every cell</span>
		</header>
		{#each ATLAS_PIN_GROUPS as group (group.label)}
			<div class="fgroup">
				<span class="glabel">{group.label}</span>
				{#each group.keys as key (key)}
					{@const k = knob(key)}
					{#if k}
						<div class="trow" class:off={!landscape.pin(key)}>
							<div class="tl">
								<span class="tname">{k.label}</span>
								<span class="tsub">{k.detail}</span>
							</div>
							<Segmented
								size="xs"
								label={k.label}
								options={STATES}
								value={landscape.pin(key) ? 'on' : 'off'}
								onchange={(state) => landscape.setPin(key, state === 'on')}
							/>
						</div>
					{/if}
				{/each}
			</div>
		{/each}
		<p class="lnote">
			two states, no “sweep” — <b>the axes are the only things that vary here</b>. An untouched pin
			follows the subject's own truth.
		</p>
	</section>

	<section class="dsec">
		<header class="dsec-head"><span class="eyebrow">Budget</span></header>
		<label class="brow">
			<span class="bl">Seeds per cell <i>independent replicate universes</i></span>
			<input
				type="number"
				inputmode="numeric"
				data-testid="atlas-seeds"
				min={LANDSCAPE_DEFAULTS.minSeeds}
				max={LANDSCAPE_DEFAULTS.maxSeeds}
				value={landscape.seeds}
				onchange={(e) => landscape.setSeeds(Number(e.currentTarget.value))}
			/>
		</label>
		<label class="brow">
			<span class="bl">Generations per run <i>training length before scoring</i></span>
			<input
				type="number"
				inputmode="numeric"
				data-testid="atlas-episodes"
				min={LANDSCAPE_DEFAULTS.minEpisodes}
				max={LANDSCAPE_DEFAULTS.maxEpisodes}
				value={landscape.episodes}
				onchange={(e) => landscape.setEpisodes(Number(e.currentTarget.value))}
			/>
		</label>
	</section>

	<div class="commit">
		<!-- The testid sits on the whole readout: the guards assert the cells line AND the budget
		     detail, and a testid scoped to one span made the second assertion unmatchable. -->
		<div class="plan" aria-live="polite" data-testid="atlas-plan">
			<span class="cells">
				{landscape.resolution} × {landscape.resolution} =
				<b class="tabular">{landscape.plannedCells}</b> cells × {landscape.seeds} seeds
			</span>
			<span class="detail tabular">
				{landscape.plannedCells * landscape.seeds} runs · {landscape.episodes} gens × 10s each
			</span>
			<span class="detail tabular">est. {estLabel} wall clock</span>
			{#if estMinutes >= GUARD_WARN_MINUTES}
				<span class="warn"
					>⚠ medium run: {estLabel} of compute — over {GUARD_WARN_MINUTES} min.</span
				>
			{/if}
		</div>

		{#if landscape.running}
			<RunProgress progress={landscape.progress} oncancel={() => landscape.cancel()} />
		{:else}
			<Button
				variant="primary"
				class="wide"
				data-testid="atlas-run"
				onclick={() => landscape.run()}
			>
				<Icon name="compass" size={14} />
				<span>Paint landscape</span>
			</Button>
		{/if}
	</div>
</div>

<style>
	/* The panel is the console's second sidebar: its own scroller, chrome-free, with the commit bar
	   sticky at its foot — the same skeleton as the Sweep's and the Ledger's panels. */
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

	/* ---- the axis slots ---- */
	.axisrow {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	.axisrow + .axisrow {
		border-top: 1px solid var(--line);
		padding-top: var(--sp-3);
	}

	.axhead {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}

	.axtag {
		flex: none;
		width: 34px;
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-bold);
		letter-spacing: var(--tracking-wide);
		color: var(--ink3);
	}

	select {
		appearance: none;
		flex: 1;
		min-width: 0;
		padding: 5px 24px 5px 10px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--panel)
			url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='5'><path d='M0 0l4 5 4-5z' fill='%23888b93'/></svg>")
			no-repeat right 8px center;
		color: var(--ink);
		font: inherit;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		cursor: pointer;
	}

	select:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	select option {
		background: var(--panel2);
		color: var(--ink);
	}

	.rangerow {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding-left: 42px;
	}

	.rangerow .to {
		color: var(--ink3);
		font-size: var(--fs-xs);
	}

	.rangerow input {
		width: 72px;
		padding: 4px 6px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--panel);
		color: var(--ink);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.rangerow input:focus {
		outline: none;
		border-color: var(--accent);
	}

	/* ---- resolution chips ---- */
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
		margin: 0;
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
		line-height: 1.5;
	}

	.lnote b {
		color: var(--ink2);
	}

	/* ---- pinned background ---- */
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

	.trow.off .tname {
		color: var(--ink3);
		font-weight: var(--fw-medium);
	}

	.tsub {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	/* ---- budget ---- */
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

	/* ---- the sticky commit bar ---- */
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

	.panel :global(.btn.wide) {
		width: 100%;
	}
</style>
