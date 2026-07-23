<!--
  The world the whole console is pointed at, shown in the rail — and since the redesign, EDITED here.

  The subject is the place and the wiring: population, tank, brain. Everything about how fish and
  shark BEHAVE (senses, body, predator rules) lives in the instrument's design panel, where a knob is
  pinned or swept — one home per knob, so the card can never contradict the panel. The card edits the
  app store's base directly (`app.base` + the setBase* doors, which own the clamps); every instrument
  builds its runs on the same base through `subjectBase`.

  When a Studio world was carried in via "Analyse", the card names it as the analysis subject and
  offers the way back to a generic world — the subject is never a trap you can see but not leave.
  Presets are the durable form: save the current base under its name, apply one later.

  No survival number is shown: that is a MEASUREMENT (the instruments produce it), and the card will
  not invent one it has not run.
-->
<script lang="ts">
	import Canvas from '../common/Canvas.svelte';
	import EditableLabel from '../common/EditableLabel.svelte';
	import Segmented from '../common/Segmented.svelte';
	import Icon from '../common/Icon.svelte';
	import { app, theme, presets } from '$lib/state';
	import { WORLD_LIMITS } from '$lib/engine';
	import { previewWorld } from '$lib/render';

	// The analysis subject (null on a generic world), and the base every instrument actually runs on.
	// Both are derived so the card follows an "Analyse" hand-off, an edit, or a preset apply without
	// a manual repaint — the `{#key}` below reframes the tank when anything it paints changes.
	const subject = $derived(app.subject);
	const base = $derived(app.base);

	// The hidden layers as the text the input shows — "6", or "16, 8" for a deep brain. The store
	// clamps on the way back in, and this derived echoes the clamped truth after every commit.
	const layersText = $derived(
		Array.isArray(base.brainHidden)
			? base.brainHidden.join(', ')
			: String(base.brainHidden ?? WORLD_LIMITS.brainHidden.min + 2)
	);

	/** Parse "16, 8"-style text into layer sizes; the store owns the real clamp. */
	function commitLayers(text: string): void {
		app.setBaseBrainLayers(
			text
				.split(/[^0-9]+/)
				.filter(Boolean)
				.map(Number)
		);
	}

	/**
	 * A still of the base world: a fresh population stepped a couple of sim-seconds so the fish have
	 * scattered and the shark is hunting — a preview of the place, not an evolved result. Painted once
	 * per key (the block is keyed on everything it paints), so there is no loop to tear down.
	 */
	function paintMini(ctx: CanvasRenderingContext2D, w: number, h: number): void {
		previewWorld(base, ctx, w, h, theme.name);
	}
</script>

<div class="subject">
	<div class="tank">
		{#key `${base.prey}-${base.preds}-${base.bw}-${base.bh}-${subject?.name ?? 'generic'}-${theme.name}`}
			<Canvas paint={paintMini} label="preview of the subject world" />
		{/key}
	</div>

	<div class="body">
		<div class="name">
			<span class="dot" aria-hidden="true"></span>
			<EditableLabel
				value={base.name}
				label="subject name"
				onchange={(name) => app.renameBase(name)}
			/>
		</div>

		<details class="grp" open>
			<summary
				><span class="eyebrow">Population</span><span class="chev" aria-hidden="true">›</span
				></summary
			>
			<div class="grp-body">
				<label class="frow">
					<span>prey</span>
					<input
						type="number"
						inputmode="numeric"
						min={WORLD_LIMITS.prey.min}
						max={WORLD_LIMITS.prey.max}
						value={base.prey}
						onchange={(e) => app.setBaseCondition('prey', Number(e.currentTarget.value))}
					/>
				</label>
				<label class="frow">
					<span>predators</span>
					<input
						type="number"
						inputmode="numeric"
						min={WORLD_LIMITS.preds.min}
						max={WORLD_LIMITS.preds.max}
						value={base.preds}
						onchange={(e) => app.setBaseCondition('preds', Number(e.currentTarget.value))}
					/>
				</label>
			</div>
		</details>

		<details class="grp" open>
			<summary
				><span class="eyebrow">Tank</span><span class="chev" aria-hidden="true">›</span></summary
			>
			<div class="grp-body">
				<div class="frow">
					<span id="tank-size-label">size <i class="unit">px</i></span>
					<span class="duo" role="group" aria-labelledby="tank-size-label">
						<input
							type="number"
							inputmode="numeric"
							aria-label="tank width"
							min={WORLD_LIMITS.bw.min}
							max={WORLD_LIMITS.bw.max}
							step={WORLD_LIMITS.bw.step}
							value={base.bw}
							onchange={(e) => app.setBaseCondition('bw', Number(e.currentTarget.value))}
						/>
						<span class="x" aria-hidden="true">×</span>
						<input
							type="number"
							inputmode="numeric"
							aria-label="tank height"
							min={WORLD_LIMITS.bh.min}
							max={WORLD_LIMITS.bh.max}
							step={WORLD_LIMITS.bh.step}
							value={base.bh}
							onchange={(e) => app.setBaseCondition('bh', Number(e.currentTarget.value))}
						/>
					</span>
				</div>
			</div>
		</details>

		<details class="grp">
			<summary
				><span class="eyebrow">Brain</span><span class="chev" aria-hidden="true">›</span></summary
			>
			<div class="grp-body">
				<div class="frow">
					<span>inputs</span>
					<Segmented
						label="brain input slots"
						options={[
							{ value: 8, label: '8' },
							{ value: 9, label: '9 +own speed' }
						]}
						value={base.brainInputs ?? 8}
						onchange={(inputs) => app.setBaseBrainInputs(inputs as 8 | 9)}
					/>
				</div>
				<label class="frow">
					<span>hidden layers</span>
					<input
						type="text"
						class="wide"
						value={layersText}
						onchange={(e) => commitLayers(e.currentTarget.value)}
					/>
				</label>
			</div>
		</details>

		{#if subject}
			<!-- Only when a Studio world was carried in: name it as the subject and offer the way back.
			     The testid + copy are the cross-link banner's contract (crosslink.e2e reads them). -->
			<div class="analysing" data-testid="research-subject">
				<span class="analysing-text"
					>Analysing <b>{subject.name}</b> — every instrument runs on it.</span
				>
				<button class="linkbtn" onclick={() => app.clearSubject()}>Use a generic world</button>
			</div>
		{/if}

		<div class="foot">
			<p>
				The subject is the <b>place and the wiring</b>. How fish and shark behave is experiment
				design — it lives with each instrument, pinned or swept.
			</p>
			<div class="links">
				{#if !subject}
					<button class="linkbtn" onclick={() => app.resetBase()}>Reset to generic</button>
				{/if}
				<button class="linkbtn" onclick={() => presets.saveCurrent()}>Save as preset</button>
			</div>

			{#if presets.entries.length}
				<div class="presets" data-testid="base-presets">
					{#each presets.entries as preset (preset.name)}
						<span class="preset">
							<button class="papply" onclick={() => presets.apply(preset.name)}>
								{preset.name}
							</button>
							<button
								class="premove"
								aria-label="remove preset {preset.name}"
								onclick={() => presets.remove(preset.name)}
							>
								<Icon name="close" size={11} />
							</button>
						</span>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.subject {
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel2);
		overflow: hidden;
	}

	.tank {
		display: block;
		width: 100%;
		aspect-ratio: 8 / 5;
		background: var(--canvas-bg);
		border-bottom: 1px solid var(--line);
	}

	.body {
		display: flex;
		flex-direction: column;
		padding: var(--sp-3) var(--sp-4) var(--sp-4);
	}

	.name {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		font-weight: var(--fw-semibold);
		font-size: var(--fs-md);
		color: var(--ink);
		padding-bottom: var(--sp-3);
	}

	.dot {
		flex: none;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ink3);
	}

	/* ---- collapsible knob groups, the mock's rail pattern ---- */
	details.grp {
		border-top: 1px solid var(--line);
	}

	details.grp summary {
		list-style: none;
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--sp-3) 0;
		user-select: none;
	}

	details.grp summary::-webkit-details-marker {
		display: none;
	}

	details.grp summary:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	.chev {
		color: var(--ink3);
		font-size: var(--fs-xs);
		transition: transform var(--dur-fast) var(--ease);
	}

	details.grp[open] .chev {
		transform: rotate(90deg);
	}

	.grp-body {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding: 0 0 var(--sp-4);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.frow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
		font-size: var(--fs-sm);
		color: var(--ink2);
	}

	.unit {
		font-style: normal;
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.frow input {
		width: 58px;
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

	.frow input.wide {
		width: 76px;
	}

	.frow input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.duo {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
	}

	.duo .x {
		color: var(--ink3);
		font-size: var(--fs-xs);
	}

	/* ---- the analysing banner (contract: crosslink.e2e) ---- */
	.analysing {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding: var(--sp-3) 0;
		border-top: 1px solid var(--line);
	}

	.analysing-text {
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.analysing-text b {
		color: var(--ink);
		font-weight: var(--fw-semibold);
	}

	/* ---- foot: the card's one paragraph of intent + the base's doors ---- */
	.foot {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding-top: var(--sp-3);
		border-top: 1px solid var(--line);
	}

	.foot p {
		margin: 0;
		font-size: var(--fs-xs);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.foot p b {
		color: var(--ink2);
	}

	.links {
		display: flex;
		gap: var(--sp-4);
	}

	.linkbtn {
		align-self: flex-start;
		background: none;
		border: none;
		padding: 0;
		color: var(--ink2);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.linkbtn:hover {
		color: var(--ink);
	}

	.linkbtn:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	/* ---- saved presets, chips with a remove that appears on hover (the findings-list pattern) ---- */
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2);
	}

	.preset {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--line);
		border-radius: var(--radius-chip);
		background: var(--panel);
	}

	.papply {
		border: none;
		background: none;
		padding: 2px 4px 2px 8px;
		font-size: var(--fs-xs);
		color: var(--ink2);
		cursor: pointer;
	}

	.papply:hover {
		color: var(--ink);
	}

	.premove {
		display: inline-flex;
		border: none;
		background: none;
		padding: 2px 5px 2px 1px;
		color: var(--ink3);
		cursor: pointer;
	}

	.premove:hover {
		color: var(--danger-ink);
	}

	.papply:focus-visible,
	.premove:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}
</style>
