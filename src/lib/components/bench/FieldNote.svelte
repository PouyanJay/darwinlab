<!--
  The field note — the intellectual point of the product, stated before you look at a single tank.

  IT USED TO SAY "more senses is not more intelligence", which was the measured truth of the
  ORIGINAL ocean: there, a fish with all four senses survives LESS than a blind one. But that was a
  fact about the world, not about intelligence — the shark outran every fish (so knowing which way
  to flee only delayed death), wall-avoidance was a free instinct (so the wall sense solved nothing),
  and the strike re-aimed mid-flight (so nothing could be anticipated). Give each sense a danger only
  it can solve and the same brains climb a real ladder. Do not soften this copy, and do not let it
  drift from the measurements.

  HOW IT IS SAID (this is the design, and it is deliberate):

  It was one grey paragraph with a dictionary bolted underneath — a wall of prose above the only
  thing on the page that moves, which is a thing nobody reads twice and most people never read once.
  It is now shaped like what it actually is: a FINDING, and the method behind it.

    • the finding, in display type, big enough to be the headline it is;
    • the reasoning, once, in a single readable measure (~70ch — prose set to the full width of a
      2000px monitor is prose the eye loses its place in);
    • the method as a SPEC STRIP — four labelled facts, ruled apart, scannable in a glance and never
      competing with the argument above them;
    • and it FOLDS. It is the same sentence every time you load the bench; the tenth visit should be
      able to put it away, and a <details> remembers nothing, asks nothing, and needs no state.
-->
<script lang="ts">
	import Icon from '../common/Icon.svelte';

	const METHOD = [
		{ term: 'policy', fact: '8→6→2 MLP · 68 evolved params · no memory' },
		{ term: 'selection', fact: 'fitness = seconds survived · elitism + tournament + crossover' },
		{ term: 'ablation', fact: 'a cut channel feeds 0, so the network shape never changes' },
		{ term: 'evidence', fact: 'each tank is ONE run; use Evaluate for n-seed means ± sd' }
	];
</script>

<aside class="note">
	<details open>
		<summary>
			<span class="badge" aria-hidden="true"><Icon name="flask" size={15} /></span>
			<span class="eyebrow">What you're watching</span>
			<span class="fold" aria-hidden="true"><Icon name="chevron-right" size={14} /></span>
		</summary>

		<div class="body">
			<!-- The claim leads, its reasoning sits beside it. One column of prose across a 1400px
			     panel leaves half the panel empty and still runs the eye off the end of every line. -->
			<div class="argument">
				<h2>Behaviour that evolved, not behaviour that was coded.</h2>

				<p>
					Every fish has a tiny neural network for a brain, and nothing about how it swims is
					written down. The sharks cull the ones that flee badly, generation after generation, until
					what is left is real evolved behaviour. The lab asks one question: <b
						>which senses actually help?</b
					>
					And a sense is worth only what the environment makes it worth. Give the fish a danger that bearing
					alone can solve and bearing pays; take it away and no sense does.
				</p>
			</div>

			<!-- METHODS, not marketing. The panel that says how a number was got is the difference between
			     a claim and a result — and the bench's own tanks are single runs, which is exactly the
			     thing a reader would otherwise mistake for evidence. -->
			<dl class="method">
				{#each METHOD as { term, fact } (term)}
					<div>
						<dt>{term}</dt>
						<dd>{fact}</dd>
					</div>
				{/each}
			</dl>
		</div>
	</details>
</aside>

<style>
	.note {
		position: relative;
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--panel);
		box-shadow: var(--shadow);
	}

	/* The light this whole product is lit by, landing on the one panel that speaks for it. */
	.note::before {
		content: '';
		position: absolute;
		inset: 0 0 auto;
		height: 100%;
		pointer-events: none;
		background:
			radial-gradient(
				620px at 0% 0%,
				color-mix(in srgb, var(--accent) 8%, transparent),
				transparent 70%
			),
			radial-gradient(
				520px at 100% 0%,
				color-mix(in srgb, var(--gold) 9%, transparent),
				transparent 68%
			);
	}

	summary {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: var(--sp-4) var(--sp-6);
		cursor: pointer;
		list-style: none; /* the default triangle is not the disclosure we drew */
	}

	summary::-webkit-details-marker {
		display: none;
	}

	.badge {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: var(--radius-xs);
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		color: var(--accent);
	}

	.fold {
		display: grid;
		place-items: center;
		margin-left: auto;
		color: var(--ink3);
		transition: transform var(--dur) var(--ease);
	}

	details[open] .fold {
		transform: rotate(90deg);
	}

	summary:hover .fold {
		color: var(--ink);
	}

	.body {
		padding: 0 var(--sp-6) var(--sp-6);
		animation: fade-up var(--dur) var(--ease) both;
	}

	/* Claim on the left, reasoning on the right — and one column under a narrow panel, where two
	   columns of anything is two columns of nothing. */
	.argument {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
		gap: var(--sp-6) var(--sp-9);
		align-items: start;
	}

	@media (max-width: 900px) {
		.argument {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: var(--fw-semibold);
		line-height: 1.22;
		letter-spacing: var(--tracking-tight);
		text-wrap: balance; /* no orphan word hanging off the headline's last line */
		color: var(--ink);
	}

	p {
		/* A readable measure. Prose run to the width of a 2000px monitor is prose nobody finishes. */
		max-width: 66ch;
		margin: 0;
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink2);
	}

	/* The spec strip: four facts, ruled apart, read in a glance. */
	.method {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		gap: var(--sp-5);
		margin: var(--sp-6) 0 0;
		padding-top: var(--sp-5);
		border-top: 1px solid var(--line);
	}

	.method > div {
		padding-left: var(--sp-4);
		border-left: 2px solid color-mix(in srgb, var(--accent) 22%, transparent);
	}

	.method dt {
		margin-bottom: 2px;
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-eyebrow);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.method dd {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: 1.45;
		color: var(--ink2);
	}
</style>
