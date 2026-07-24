<!--
  Q7 · reproduce this study — the method as a panel, not a footnote. It states the subject the findings
  are about, the brain that ran, and the fingerprint that reproduces them, then offers to load that
  exact world back into the lab or copy its config. Provenance you can click.

  Reads the subject config the report is scoped to; the fingerprint + seeds come from the report's
  method (any finding carries them). When nothing has been studied, it says so — no invented method.
-->
<script lang="ts">
	import type { WorldConfig } from '$lib/engine';
	import Button from '../../common/Button.svelte';
	import Icon from '../../common/Icon.svelte';

	let {
		config,
		configHash,
		seeds,
		configJson,
		onload
	}: {
		config: WorldConfig;
		configHash: string;
		seeds: number;
		configJson: string;
		/** Load the subject back into Studio — the round-trip the report store owns (`report.watch`). */
		onload: () => void;
	} = $props();

	const inputs = $derived(config.brainInputs ?? 8);
	// brainHidden persists as a single number or a per-layer array — normalise to a layer list.
	const hidden = $derived(
		(Array.isArray(config.brainHidden) ? config.brainHidden : [config.brainHidden ?? 6]).join('·')
	);

	let copied = $state(false);

	async function copyConfig(): Promise<void> {
		try {
			await navigator.clipboard.writeText(configJson);
			copied = true;
			// A brief confirmation, then back — no timers persisted, purely cosmetic.
			setTimeout(() => (copied = false), 1600);
		} catch {
			// Clipboard blocked (insecure context, denied permission) — leave the label unchanged.
		}
	}
</script>

<div class="methods" data-testid="report-qQ7">
	<h3>Methods · reproduce this study</h3>
	<div class="grid">
		<div class="mrow">
			<span class="ml">Subject</span>
			<span class="mv"
				>{config.prey} prey · {config.preds} predator{config.preds === 1 ? '' : 's'} · {config.bw}×{config.bh}</span
			>
		</div>
		<div class="mrow">
			<span class="ml">Brain</span>
			<span class="mv">{inputs} inputs → {hidden} hidden → 2</span>
		</div>
		<div class="mrow">
			<span class="ml">Fingerprint</span>
			<span class="mv">config {configHash} · {seeds} seeds</span>
		</div>
		<div class="mrow">
			<span class="ml">Determinism</span>
			<span class="mv">seeded → re-runs identical</span>
		</div>
	</div>
	<div class="actions">
		<Button variant="primary" size="sm" onclick={onload} data-testid="report-reproduce">
			<Icon name="forward" size={13} />
			<span>Load this exact world</span>
		</Button>
		<Button size="sm" variant="ghost" onclick={copyConfig} data-testid="report-copy-config">
			{copied ? 'Copied ✓' : 'Copy config JSON'}
		</Button>
		<span class="note">every export carries the fingerprint that reproduces the result.</span>
	</div>
</div>

<style>
	.methods {
		border-top: 1px solid var(--line);
		padding-top: var(--sp-5);
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}

	h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--sp-3);
	}

	.mrow {
		display: flex;
		flex-direction: column;
		gap: 2px;
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
		padding: var(--sp-3) var(--sp-4);
	}

	.ml {
		font-size: var(--fs-eyebrow);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.mv {
		font-size: var(--fs-sm);
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		flex-wrap: wrap;
	}

	.note {
		font-size: var(--fs-xs);
		color: var(--ink3);
	}

	@media (max-width: 620px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
