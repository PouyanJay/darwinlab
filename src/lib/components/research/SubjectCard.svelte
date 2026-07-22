<!--
  The world the whole console is pointed at, shown in the rail.

  Every instrument — the Sweep, the Ledger, the Atlas — builds its runs on ONE base world
  (`app.subjectBase`), so the rail leads with it: a mini-tank of that world, its name, and the
  conditions that make it the world it is. When a Studio world was carried in via "Analyse", the card
  also names it as the analysis subject and offers the way back to a generic world — so the subject is
  never a trap you can see but not leave.

  No survival number is shown: that is a MEASUREMENT (the Ledger and the Report produce it), and the
  card will not invent one it has not run.
-->
<script lang="ts">
	import Canvas from '../common/Canvas.svelte';
	import { app, theme } from '$lib/state';
	import type { Senses } from '$lib/engine';
	import { previewWorld } from '$lib/render';

	// The analysis subject (null on a generic world), and the base every instrument actually runs on.
	// Both are derived so the card follows an "Analyse" hand-off or a "use a generic world" without a
	// manual repaint — the `{#key}` below reframes the tank when the base identity changes.
	const subject = $derived(app.subject);
	const base = $derived(app.subjectBase('Subject'));

	/** The senses that are switched on — the science-relevant knob, so they lead the config chips.
	    Listed in slot order; the optional schooling senses only appear on worlds that carry them. */
	const SENSE_CHIPS: { key: keyof Senses; label: string }[] = [
		{ key: 'dist', label: 'distance' },
		{ key: 'dir', label: 'direction' },
		{ key: 'closing', label: 'closing' },
		{ key: 'walls', label: 'walls' },
		{ key: 'speed', label: 'speed' },
		{ key: 'cohesion', label: 'cohesion' },
		{ key: 'align', label: 'alignment' }
	];
	const senses = $derived(SENSE_CHIPS.filter((sense) => base.senses[sense.key]));

	/**
	 * A still of the base world: a fresh population stepped a couple of sim-seconds so the fish have
	 * scattered and the shark is hunting — a preview of the place, not an evolved result. Painted once
	 * per base (the block is keyed), so there is no loop to tear down.
	 */
	function paintMini(ctx: CanvasRenderingContext2D, w: number, h: number): void {
		previewWorld(base, ctx, w, h, theme.name);
	}
</script>

<div class="subject">
	<div class="tank">
		{#key `${subject?.name ?? 'generic'}-${theme.name}`}
			<Canvas paint={paintMini} label="preview of the subject world" />
		{/key}
	</div>

	<div class="body">
		<div class="name">
			<span class="dot" aria-hidden="true"></span>
			{subject ? subject.name : 'Generic world'}
		</div>

		<div class="cfg">
			<span class="pill tabular">{base.prey} prey</span>
			<span class="pill tabular">vision {Math.round(base.vision)}px</span>
			{#each senses as sense (sense.key)}
				<span class="pill">{sense.label}</span>
			{/each}
		</div>

		{#if subject}
			<!-- Only when a Studio world was carried in: name it as the subject and offer the way back.
			     The testid + copy are the cross-link banner's contract (crosslink.e2e reads them). -->
			<div class="analysing" data-testid="research-subject">
				<span class="analysing-text"
					>Analysing <b>{subject.name}</b> — every instrument runs on it.</span
				>
				<button class="clear" onclick={() => app.clearSubject()}>Use a generic world</button>
			</div>
		{/if}
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
		gap: var(--sp-3);
		padding: var(--sp-3) var(--sp-4) var(--sp-4);
	}

	.name {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		font-weight: var(--fw-semibold);
		font-size: var(--fs-md);
		color: var(--ink);
	}

	.dot {
		flex: none;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ink3);
	}

	.cfg {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2);
	}

	.pill {
		font-size: var(--fs-eyebrow);
		color: var(--ink2);
		border: 1px solid var(--line);
		border-radius: var(--radius-chip);
		padding: 2px 7px;
		background: var(--panel);
	}

	.analysing {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		margin-top: 2px;
		padding-top: var(--sp-3);
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

	.clear {
		align-self: flex-start;
		border: 1px solid var(--line);
		border-radius: var(--radius-pill);
		background: none;
		padding: 4px var(--sp-3);
		color: var(--ink2);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition: border-color var(--dur-fast) var(--ease);
	}

	.clear:hover {
		border-color: var(--accent);
		color: var(--ink);
	}

	.clear:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}
</style>
