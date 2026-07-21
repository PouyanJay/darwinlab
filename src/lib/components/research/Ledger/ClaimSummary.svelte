<!--
  The Ledger's claim context, for the console's right sidebar: the active claim and — once it has been
  run — a quiet summary of its latest verdict (the record's numbers, not a colour; the coloured verdict
  lives on the VerdictCard in the workspace). Reads only the ledger store. Until the claim has been
  tested it says so, rather than inventing a verdict.
-->
<script lang="ts">
	import { ledger, findings } from '$lib/state';
	import { formatSignedSeconds } from '$lib/format';
	import ReportButton from '../ReportButton.svelte';

	const claim = $derived(ledger.active);
	// The latest settled record for this claim (its name is `entry`, matching VerdictCard — the field
	// on it called `verdict` is the outcome word, which is exactly why the variable is not).
	const entry = $derived(ledger.latestFor(claim.id));

	// One finding per claim per subject — so the button tracks THIS claim, not the Ledger in general.
	const inReport = $derived(findings.has('ledger', claim.id));

	function addToReport(): void {
		if (!entry) return;
		findings.add({
			source: 'ledger',
			variant: claim.id,
			title: claim.text,
			detail: `${entry.verdict} · Δ ${formatSignedSeconds(entry.delta)} · d ${entry.d.toFixed(1)}`,
			status: entry.verdict === 'supported' ? 'ok' : 'limit',
			seeds: entry.seeds,
			configHash: entry.configHash
		});
	}
</script>

<div class="panel">
	<span class="eyebrow">This claim</span>
	<div class="lead">
		<b class="claim-text">{claim.text}</b>
	</div>
	{#if entry}
		<dl class="statgrid">
			<div>
				<dt>Verdict</dt>
				<dd class="cap">{entry.verdict}</dd>
			</div>
			<div>
				<dt>Δ effect</dt>
				<dd class="tabular">{formatSignedSeconds(entry.delta)}</dd>
			</div>
			<div>
				<dt>Cohen's d</dt>
				<dd class="tabular">{entry.d.toFixed(1)}</dd>
			</div>
			<div>
				<dt>Seeds</dt>
				<dd class="tabular">{entry.seeds}</dd>
			</div>
		</dl>
		<p class="note">
			Run <b class="tabular">{entry.configHash}</b> · pre-registered contrast, re-runs identical.
		</p>
		<ReportButton {inReport} onadd={addToReport} />
	{:else}
		<p class="empty">Not tested yet — run this claim to settle it.</p>
	{/if}
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.lead {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--panel2);
	}

	.lead b.claim-text {
		font-family: var(--font-display);
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}

	.statgrid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		margin: 0;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--line);
	}

	.statgrid > div {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--sp-3) var(--sp-4);
		background: var(--panel);
	}

	.statgrid dt {
		font-size: var(--fs-sm);
		color: var(--ink3);
	}

	.statgrid dd {
		margin: 0;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.statgrid dd.cap {
		text-transform: capitalize;
	}

	.note {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.note b {
		color: var(--ink2);
		font-weight: var(--fw-semibold);
	}

	.empty {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}
</style>
