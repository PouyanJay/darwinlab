<!--
  The drilled record, opened in the console's right sidebar. The card answers, in order: WHICH claim
  (the sentence, its verdict, when it was settled), WHICH two worlds (arm chips loud, the shared
  background quiet — the reader can see the arms differ in the claimed knob only, all frozen at
  measurement), WHAT the numbers were (both intervals re-plotted, Δ with its CI, effect size, seeds,
  fingerprint), WHY the verdict fell that way (the pre-registered reading, in plain words) — and the
  doors: load the record back into the composer, re-test the same claim at today's base, or send the
  finding to the notebook, where the Report's Q3 picks it up.
-->
<script lang="ts">
	import Button from '../../common/Button.svelte';
	import ReportButton from '../ReportButton.svelte';
	import IntervalPlot from '../viz/IntervalPlot.svelte';
	import { ledger, findings, toArmRows } from '$lib/state';
	import { rationaleFor } from '$lib/lab/hypothesis';
	import { formatSignedSeconds } from '$lib/format';

	const entry = $derived(ledger.selected);
	const fmt = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1);

	/** Pre-composer records carry no template pick — their claims may no longer be composable, so
	 *  the composer doors close rather than guess. */
	const composable = $derived(entry?.templateId != null && entry?.slots != null);

	const rationale = $derived(
		entry?.expect ? rationaleFor(entry.expect, entry.verdict, entry.ci) : null
	);

	function loadIntoComposer(): void {
		if (!entry?.templateId || !entry.slots) return;
		ledger.compose(entry.templateId, entry.slots);
	}

	function retest(): void {
		if (!entry?.templateId || !entry.slots) return;
		ledger.compose(entry.templateId, entry.slots);
		ledger.run();
	}

	// One finding per claim per subject — keyed by the CLAIM, so re-testing updates the same slot.
	const inReport = $derived(entry ? findings.has('ledger', entry.claimId) : false);

	function addToReport(): void {
		if (!entry) return;
		findings.add({
			source: 'ledger',
			variant: entry.claimId,
			title: entry.text,
			detail: `${entry.verdict} · Δ ${formatSignedSeconds(entry.delta)} · d ${entry.d.toFixed(1)}`,
			status: entry.verdict === 'supported' ? 'ok' : 'limit',
			seeds: entry.seeds,
			configHash: entry.configHash,
			evidence: { kind: 'contrast', arms: toArmRows(entry.arms) }
		});
	}
</script>

{#if entry}
	<div class="drill" data-testid="ledger-drill">
		<span class="eyebrow">The record — this verdict</span>
		<p class="sentence">{entry.text}</p>
		<div class="vrow">
			<span class="badge verdict-{entry.verdict}">{entry.verdict}</span>
			<span class="when tabular"
				>recorded {entry.recorded ? entry.recorded.slice(0, 10) : '—'} · {entry.seeds} seeds/arm</span
			>
		</div>

		<hr class="sep" />

		{#each entry.arms as arm, i (arm.label)}
			<div class="armline">
				<span class="ab">Arm {i === 0 ? 'A' : 'B'}</span>
				<span class="chip hot">{arm.label}</span>
			</div>
		{/each}
		{#if entry.shared?.length}
			<div class="chips">
				{#each entry.shared as chip (chip)}
					<span class="chip">{chip}</span>
				{/each}
			</div>
			<p class="frozen">
				quiet chips = the shared background, frozen at measurement — the arms differ in the loud
				chips only
			</p>
		{/if}

		<hr class="sep" />

		<IntervalPlot arms={toArmRows(entry.arms)} />
		<div class="row">
			<span>Δ · A over B</span>
			<b class="tabular">{formatSignedSeconds(entry.delta)}</b>
		</div>
		<div class="row">
			<span>95% interval</span>
			<b class="tabular">[{fmt(entry.ci.lo)}, {fmt(entry.ci.hi)}]</b>
		</div>
		{#if !Number.isNaN(entry.d)}
			<div class="row">
				<span>effect size d</span>
				<b class="tabular">{entry.d.toFixed(1)}</b>
			</div>
		{/if}
		<div class="row">
			<span>fingerprint</span>
			<b class="tabular">{entry.configHash}</b>
		</div>
		{#if rationale}
			<p class="rationale" data-testid="drill-rationale">{rationale}</p>
		{/if}

		<!-- the doors -->
		<div class="doors">
			{#if composable}
				<Button
					variant="primary"
					class="wide"
					data-testid="drill-load-composer"
					onclick={loadIntoComposer}
				>
					<span>Load into composer</span>
				</Button>
				<Button class="wide" disabled={ledger.running} onclick={retest}>
					<span>Re-test at today's base</span>
				</Button>
			{:else}
				<p class="frozen">
					settled before the composer existed — re-compose it from the templates to re-test
				</p>
			{/if}
			<ReportButton {inReport} onadd={addToReport} />
		</div>
	</div>
{/if}

<style>
	.drill {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel2);
		padding: var(--sp-4);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.sentence {
		margin: 0;
		font-size: var(--fs-md);
		font-weight: var(--fw-bold);
		line-height: 1.4;
		color: var(--ink);
		text-wrap: balance;
	}

	.vrow {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		flex-wrap: wrap;
	}

	.badge {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		border-radius: var(--radius-chip);
		padding: 2px 8px;
	}

	.badge.verdict-supported {
		color: var(--ink);
		background: color-mix(in oklab, var(--data-teal) 20%, transparent);
		border: 1px solid var(--data-teal);
	}

	.badge.verdict-refuted {
		color: var(--danger-ink);
		border: 1px solid color-mix(in oklab, var(--danger) 45%, transparent);
	}

	.when {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.sep {
		border: 0;
		border-top: 1px solid var(--line);
		margin: var(--sp-1) 0;
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

	.frozen {
		margin: 0;
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
		line-height: 1.5;
	}

	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--sp-3);
		font-size: var(--fs-sm);
		color: var(--ink2);
	}

	.row b {
		color: var(--ink);
		font-size: var(--fs-md);
	}

	.rationale {
		margin: 0;
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
		line-height: 1.5;
	}

	.doors {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding-top: var(--sp-2);
	}

	.drill :global(.btn.wide) {
		width: 100%;
	}
</style>
