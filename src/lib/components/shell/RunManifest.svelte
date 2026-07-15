<!--
  The run manifest — the chip that turns a simulation into an experiment.

  A demo runs. An instrument runs SOMETHING SPECIFIC, and can hand it to someone else who gets the
  same numbers back. That is three facts: the config fingerprint, the seed, and how far it has got.

  It states the uncomfortable one plainly. The bench opens UNSEEDED (Math.random), so the opening
  run is genuinely not reproducible — the chip says "unseeded", not a number that would reproduce
  nothing. Click it and you can pin a seed, which relaunches the bench: a seeded run is a fresh
  experiment, not the old one relabelled.
-->
<script lang="ts">
	import Button from '../common/Button.svelte';
	import Modal from '../common/Modal.svelte';
	import { bench } from '$lib/state';
	import { DEFAULT_WORLDS } from '$lib/engine';
	import { PREWARM_GENERATIONS } from '$lib/lab/scenario';

	let open = $state(false);
	let draft = $state('');
	let copied = $state(false);

	const seed = $derived(bench.seed);
	const hash = $derived(bench.configHash);

	function launch() {
		const parsed = Number(draft);
		const next = draft.trim() === '' ? null : Number.isFinite(parsed) ? Math.trunc(parsed) : null;
		bench.reseed(next, DEFAULT_WORLDS, PREWARM_GENERATIONS);
		open = false;
	}

	async function copyManifest() {
		await navigator.clipboard.writeText(JSON.stringify(bench.manifest, null, 2));
		copied = true;
		setTimeout(() => (copied = false), 1600);
	}
</script>

<button
	class="manifest"
	onclick={() => {
		draft = seed === null ? '' : String(seed);
		open = true;
	}}
	aria-label="run manifest: seed and configuration"
	data-testid="run-manifest"
>
	<span class="key">run</span>
	<span class="hash tabular">{hash}</span>
	<span class="sep" aria-hidden="true">·</span>
	<span class="key">seed</span>
	<span class="seed tabular" class:unseeded={seed === null} data-testid="seed">
		{seed ?? 'unseeded'}
	</span>
</button>

{#if open}
	<Modal
		{open}
		title="Run manifest"
		subtitle="what this run is, and what someone else would need to reproduce it"
		onclose={() => (open = false)}
	>
		<dl class="facts">
			<div>
				<dt>config</dt>
				<dd class="tabular">{hash}</dd>
			</div>
			<div>
				<dt>episodes</dt>
				<dd class="tabular">{bench.maxGenerations || '∞'}</dd>
			</div>
			<div>
				<dt>environments</dt>
				<dd class="tabular">{bench.worlds.length}</dd>
			</div>
		</dl>

		<label class="field">
			<span class="field-label">Seed</span>
			<input
				type="text"
				inputmode="numeric"
				placeholder="unseeded: this run cannot be reproduced"
				bind:value={draft}
				aria-label="seed"
			/>
			<p class="note">
				Pinning a seed <b>relaunches the bench</b>: same seed and same configuration give the same
				run, every time. Leave it empty to run unseeded.
			</p>
		</label>

		<div class="actions">
			<Button variant="ghost" onclick={copyManifest}>{copied ? 'Copied' : 'Copy manifest'}</Button>
			<Button variant="primary" onclick={launch}>Relaunch</Button>
		</div>
	</Modal>
{/if}

<style>
	/* Reads as a readout, not a button: monospace facts on a recessed plate. */
	.manifest {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		padding: 5px 10px;
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		background: var(--panel2);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: var(--fs-label);
		color: var(--ink2);
		cursor: pointer;
	}

	.manifest:hover {
		border-color: var(--ink3);
	}

	.key {
		color: var(--ink3);
	}

	.hash {
		color: var(--ink);
		font-weight: var(--fw-medium);
	}

	.seed {
		color: var(--ink);
		font-weight: var(--fw-medium);
	}

	/* An unseeded run is not reproducible, and the chip should not pretend otherwise. */
	.seed.unseeded {
		color: var(--ink3);
		font-style: italic;
		font-weight: var(--fw-regular);
	}

	.sep {
		color: var(--line);
	}

	.facts {
		display: flex;
		gap: var(--sp-6);
		margin: var(--sp-5) 0 var(--sp-6);
	}

	.facts dt {
		font-size: var(--fs-eyebrow);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink3);
	}

	.facts dd {
		margin: 2px 0 0;
		font-size: var(--fs-stat);
		font-weight: var(--fw-semibold);
	}

	.note {
		margin: var(--sp-2) 0 0;
		font-size: var(--fs-label);
		color: var(--ink3);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--sp-3);
		margin-top: var(--sp-6);
	}
</style>
