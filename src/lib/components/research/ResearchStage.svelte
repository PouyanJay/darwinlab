<!--
  The Research stage — the main view while the lab is in Research mode.

  R0 ships the SHELL: the mode switch works, this stage takes the bench, and Studio is untouched
  behind it. The three instruments (the Sweep, the Ledger, the Atlas) land in later phases; until
  then this states plainly what Research is for and what is coming, so the mode is honest about being
  a frame that is not yet furnished rather than pretending to be finished.

  Monochrome on purpose: it matches the platform's plain dark identity (colour belongs to a world's
  own accent, not to chrome).
-->
<script lang="ts">
	import { SCENARIO } from '$lib/lab/scenario';

	// The instruments this stage will hold, in the order they are being built.
	const INSTRUMENTS = [
		{
			name: 'The Sweep',
			line: 'Name the factors and levels; run every combination across seeds and read which knobs move survival.'
		},
		{
			name: 'The Ledger',
			line: 'State a claim; the lab designs the smallest test that could disprove it and records the verdict.'
		},
		{
			name: 'The Atlas',
			line: 'Pick two axes; scatter simulations across the plane and see the survival landscape emerge.'
		}
	];
</script>

<div class="research" data-testid="research-stage">
	<div class="inner">
		<span class="eyebrow">Research · {SCENARIO.index} · {SCENARIO.name}</span>
		<h2>Run many simulations. Conclude once.</h2>
		<p class="lede">
			Studio shows one world evolving. Research asks the same question across many seeds and
			conditions until the answer holds or breaks — and keeps the record. The instruments below are
			being built; the studio keeps running underneath while you work here.
		</p>

		<ul class="instruments">
			{#each INSTRUMENTS as instrument (instrument.name)}
				<li class="instrument">
					<div class="head">
						<span class="name">{instrument.name}</span>
						<span class="soon">soon</span>
					</div>
					<p>{instrument.line}</p>
				</li>
			{/each}
		</ul>

		<p class="foot">
			The engine and every measurement are the ones the lab already ships — Research is where they
			get to run a thousand times.
		</p>
	</div>
</div>

<style>
	.research {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: grid;
		place-items: center;
		padding: var(--sp-8) var(--sp-7);
		background: var(--bgfx);
	}

	.inner {
		width: 100%;
		max-width: 760px;
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	h2 {
		font-family: var(--font-display);
		font-size: clamp(24px, 4vw, 34px);
		font-weight: var(--fw-semibold);
		letter-spacing: -0.01em;
		line-height: 1.1;
		margin: var(--sp-3) 0 var(--sp-4);
		color: var(--ink);
		text-wrap: balance;
	}

	.lede {
		margin: 0 0 var(--sp-7);
		max-width: 62ch;
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink2);
	}

	.instruments {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
		gap: var(--sp-4);
	}

	.instrument {
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
		padding: var(--sp-5);
	}

	.instrument .head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
		margin-bottom: var(--sp-3);
	}

	.instrument .name {
		font-family: var(--font-display);
		font-size: var(--fs-name);
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}

	.instrument .soon {
		flex: none;
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
		border: 1px solid var(--line);
		border-radius: var(--radius-chip);
		padding: 2px 7px;
	}

	.instrument p {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink2);
	}

	.foot {
		margin: var(--sp-7) 0 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}
</style>
