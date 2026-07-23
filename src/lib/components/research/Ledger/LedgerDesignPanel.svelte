<!--
  The Ledger's DESIGN PANEL — the console's second sidebar, where a sentence is composed into an
  experiment.

  Top to bottom: TEMPLATE (the seven families as a radio list — the shape of the question), SLOTS
  (dropdowns from a closed vocabulary, never free text), THE CLAIM (the composed sentence with its
  slot words marked, both arms as chips, and what "supported" would mean — spelled out BEFORE the
  run), EVIDENCE (seeds per arm, the one budget knob), the LIBRARY (the lab's own findings; one
  click refills the composer), and a STICKY COMMIT BAR — the plan readout and Test claim pinned at
  the panel's foot, with the anti-fishing line on the receipt: the run is recorded either way.
  Everything reads and writes the ledger store; the panel is the store's face, not a second brain.
-->
<script lang="ts">
	import Button from '../../common/Button.svelte';
	import Icon from '../../common/Icon.svelte';
	import RunProgress from '../RunProgress.svelte';
	import { ledger, app } from '$lib/state';
	import { buildClaim, optionsFor, senseDisabledReason } from '$lib/lab/hypothesis';

	const template = $derived(ledger.template);
	const values = $derived(ledger.values);
	const claim = $derived(ledger.active);
	const parts = $derived(template.parts(values));

	// What "supported" would mean, per reading — the lead word is bolded by the template, so the
	// text here starts after it (no string arithmetic to fall out of sync with a copy edit).
	const MEANS: Record<typeof template.expect, string> = {
		'A>B':
			'= arm A reliably outlives arm B — the whole 95% interval clears zero. ' +
			'A shortfall or a straddle both refute it.',
		'A≈B':
			'= the two arms are indistinguishable — the interval straddles zero. ' +
			'An interval that clears zero, either way, refutes it.'
	};

	// A slot's dropdown never offers its sibling's pick — a sense cannot rival itself. The gated
	// own-speed option stays VISIBLE but disabled, with the reason in its label (never silently
	// dropped — the Sweep panel's discipline).
	function slotOptions(slot: (typeof template.slots)[number]) {
		const rival = slot.excl ? values[slot.excl] : null;
		return optionsFor(slot.pool)
			.filter((option) => option.id !== rival)
			.map((option) => {
				const reason = slot.pool === 'sense' ? senseDisabledReason(option.id, app.base) : null;
				return {
					...option,
					disabled: reason !== null,
					label: reason ? `${option.label} — ${reason}` : option.label
				};
			});
	}

	const hasSenseSlot = $derived(template.slots.some((slot) => slot.pool === 'sense'));
	const hasExclSlot = $derived(template.slots.some((slot) => slot.excl));
	const isSenseGated = $derived(hasSenseSlot && senseDisabledReason('speed', app.base) !== null);

	// The slot caveats as ONE derived line — assembling it in markup once jammed three inline ifs
	// together and hid the joining logic in the template.
	const slotNote = $derived(
		[
			isSenseGated && 'own speed is disabled: this subject has the 8-input brain',
			hasExclSlot && 'a sense cannot rival itself — the second slot drops your first pick'
		]
			.filter(Boolean)
			.join(' · ')
	);

	const estLabel = $derived(
		ledger.estimatedSeconds < 60 ? '< 1 min' : `≈ ${Math.round(ledger.estimatedSeconds / 60)} min`
	);

	// The shelf shows each library claim with its latest verdict — the state of the argument, not
	// just a menu. Built per render from the static library; `latestFor` is the reactive part.
	const shelf = $derived(
		ledger.library.map((item) => {
			const libClaim = buildClaim(
				ledger.templates.find((t) => t.id === item.templateId) ?? ledger.templates[0],
				item.values
			);
			return { item, text: libClaim.text, latest: ledger.latestFor(libClaim.id) };
		})
	);
</script>

<div class="panel no-scrollbar" data-testid="ledger-design">
	<header class="head">
		<span class="eyebrow">Claim design</span>
		<span class="sub">template + slots → two arms · committed before the run</span>
	</header>

	<section class="dsec">
		<header class="dsec-head">
			<span class="eyebrow">Template</span>
			<span class="hint">the shape of the question</span>
		</header>
		<div class="tpl" role="radiogroup" aria-label="claim templates">
			{#each ledger.templates as family (family.id)}
				<button
					class="trow pick"
					class:sel={family.id === template.id}
					role="radio"
					aria-checked={family.id === template.id}
					onclick={() => ledger.selectTemplate(family.id)}
				>
					<span class="tl">
						<span class="tname">{family.name}</span>
						<span class="tsub">{family.sub}</span>
					</span>
				</button>
			{/each}
		</div>
		<p class="lnote">
			every template maps to <b>one</b> contrast the stats can judge — the vocabulary is fixed, so a claim
			can never be reworded after the data is in.
		</p>
	</section>

	<section class="dsec">
		<header class="dsec-head">
			<span class="eyebrow">Slots</span>
			<span class="hint">dropdowns — a closed vocabulary</span>
		</header>
		{#each template.slots as slot (slot.key)}
			<label class="slotrow">
				<span class="slotlabel">{slot.label}</span>
				<select
					value={values[slot.key]}
					onchange={(e) => ledger.setSlot(slot.key, e.currentTarget.value)}
				>
					{#each slotOptions(slot) as option (option.id)}
						<option value={option.id} disabled={option.disabled}>{option.label}</option>
					{/each}
				</select>
			</label>
		{/each}
		{#if slotNote}
			<p class="lnote">{slotNote}</p>
		{/if}
	</section>

	<section class="dsec">
		<header class="dsec-head"><span class="eyebrow">The claim</span></header>
		<p class="claimprev" data-testid="ledger-claim-preview" aria-live="polite">
			{#each parts as part, i (i)}<span class:sw={part.isSlot}>{part.text}</span>{/each}
		</p>
		<div class="armline">
			<span class="ab">Arm A</span>
			<span class="chips"><span class="chip hot">{claim.a.label}</span></span>
		</div>
		<div class="armline">
			<span class="ab">Arm B</span>
			<span class="chips"><span class="chip hot">{claim.b.label}</span></span>
		</div>
		<p class="means"><b>supported</b> {MEANS[template.expect]}</p>
	</section>

	<section class="dsec">
		<header class="dsec-head"><span class="eyebrow">Evidence</span></header>
		<label class="brow">
			<span class="bl">Seeds per arm <i>independent replicate universes</i></span>
			<input
				type="number"
				inputmode="numeric"
				data-testid="ledger-seeds"
				min="4"
				max="16"
				value={ledger.seeds}
				onchange={(e) => ledger.setSeeds(Number(e.currentTarget.value))}
			/>
		</label>
		<div class="brow">
			<span class="bl">Training + scoring <i>fixed — records stay comparable</i></span>
			<span class="fixed tabular">30 gens · 4 bouts</span>
		</div>
	</section>

	<section class="dsec">
		<header class="dsec-head">
			<span class="eyebrow">Library</span>
			<span class="hint">the lab's findings — click to refill</span>
		</header>
		<div class="tpl">
			{#each shelf as row (row.text)}
				<button
					class="trow pick lib"
					onclick={() => ledger.compose(row.item.templateId, row.item.values)}
				>
					<span class="libtext">{row.text}</span>
					<span
						class="libverdict"
						class:sup={row.latest?.verdict === 'supported'}
						class:ref={row.latest?.verdict === 'refuted'}
					>
						<span class="vdot" aria-hidden="true"></span>
						{row.latest
							? row.latest.verdict === 'supported'
								? 'Supported'
								: 'Refuted'
							: 'Untested'}
					</span>
				</button>
			{/each}
		</div>
	</section>

	<div class="commit">
		<div class="plan" aria-live="polite">
			<span class="cells" data-testid="ledger-plan">
				2 arms × {ledger.seeds} seeds = <b class="tabular">{ledger.seeds * 2}</b> runs
			</span>
			<span class="detail tabular"
				>30 gens × 10s + 4 scoring bouts each · est. {estLabel} wall clock</span
			>
			<span class="detail"
				>recorded either way — supported or refuted, the run enters the record</span
			>
		</div>

		{#if ledger.running}
			<RunProgress progress={ledger.progress} oncancel={() => ledger.cancel()} />
		{:else}
			<Button variant="primary" class="wide" data-testid="ledger-run" onclick={() => ledger.run()}>
				<Icon name="forward" size={14} />
				<span>Test claim</span>
			</Button>
		{/if}
	</div>
</div>

<style>
	/* The panel is the console's second sidebar: its own scroller, chrome-free, with the commit bar
	   sticky at its foot — the same skeleton as the Sweep's panel, so the console keeps one grammar. */
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

	/* ---- the template radio list: the picked family is loud, the rest quiet ---- */
	.tpl {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.trow {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: 5px 7px;
		border-radius: var(--radius-sm);
	}

	.trow.pick {
		cursor: pointer;
		border: 1px solid transparent;
		background: none;
		text-align: left;
		width: 100%;
		font-family: inherit;
	}

	.trow.pick:hover {
		background: var(--chip);
	}

	.trow.pick:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	.trow.pick.sel {
		background: var(--panel);
		border-color: var(--line);
		box-shadow: inset 0 0 0 1px var(--ink);
	}

	.tl {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.tname {
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		color: var(--ink3);
	}

	.trow.pick.sel .tname {
		color: var(--ink);
		font-weight: var(--fw-semibold);
	}

	.tsub {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
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

	/* ---- slot dropdowns — a closed vocabulary, never free text ---- */
	.slotrow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
	}

	.slotlabel {
		font-size: var(--fs-sm);
		color: var(--ink2);
	}

	select {
		appearance: none;
		min-width: 128px;
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

	/* ---- the composed claim: the panel's centrepiece ---- */
	.claimprev {
		margin: 0;
		font-size: var(--fs-stat);
		font-weight: var(--fw-semibold);
		line-height: 1.5;
		color: var(--ink);
		text-wrap: balance;
	}

	/* Slot words are dash-underlined — the fillable parts of the sentence, marked in monochrome
	   (teal and coral live in the evidence, never in this furniture). */
	.sw {
		border-bottom: 1px dashed color-mix(in oklab, var(--ink) 45%, transparent);
		padding-bottom: 1px;
	}

	.armline {
		display: flex;
		align-items: baseline;
		gap: var(--sp-2);
	}

	.ab {
		flex: none;
		width: 38px;
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
	}

	.chip {
		font-size: var(--fs-eyebrow);
		border: 1px solid var(--line);
		border-radius: var(--radius-chip);
		padding: 1px 6px;
		color: var(--ink3);
		background: var(--panel);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.chip.hot {
		border-color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--ink);
		color: var(--ink);
	}

	.means {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ink3);
		line-height: 1.5;
	}

	.means b {
		color: var(--ink2);
	}

	/* ---- evidence budget ---- */
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

	.fixed {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--ink);
		white-space: nowrap;
	}

	/* ---- the library shelf ---- */
	.trow.pick.lib {
		align-items: center;
	}

	.libtext {
		flex: 1;
		min-width: 0;
		font-size: var(--fs-xs);
		color: var(--ink2);
		line-height: 1.4;
	}

	.libverdict {
		flex: none;
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink3);
	}

	.vdot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--ink3);
	}

	.libverdict.sup {
		color: var(--ink2);
	}

	.libverdict.sup .vdot {
		background: var(--data-teal);
	}

	.libverdict.ref {
		color: var(--danger-ink);
	}

	.libverdict.ref .vdot {
		background: var(--danger);
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

	.panel :global(.btn.wide) {
		width: 100%;
	}
</style>
