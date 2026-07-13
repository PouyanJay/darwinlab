<!--
  The field note — the intellectual point of the product, stated before you look at a single tank.

  IT USED TO SAY "more senses is not more intelligence", which was the measured truth of the
  ORIGINAL ocean: there, a fish with all four senses survives LESS than a blind one. But that was a
  fact about the world, not about intelligence — the shark outran every fish (so knowing which way
  to flee only delayed death), wall-avoidance was a free instinct (so the wall sense solved nothing),
  and the strike re-aimed mid-flight (so nothing could be anticipated). Give each sense a danger only
  it can solve and the same brains climb a real ladder. The lab now ships both oceans, because the
  contrast IS the lesson. Do not soften this copy, and do not let it drift from the measurements.
-->
<aside class="note">
	<span class="icon" aria-hidden="true">i</span>
	<div>
		<p>
			<b>An observation channel is worth exactly what the environment makes it worth.</b> Range to
			the adversary buys almost nothing — it never says <i>which way</i> to go. Bearing is the leap. Boundary
			rays and closing rate pay only because this environment holds a hazard each of them alone can solve.
			Take the hazard away — raise the adversary's speed past what an agent can swim, and fleeing correctly
			stops being an escape — and the ladder collapses: an input the world ignores is noise a policy must
			overcome, and mutation charges rent on it every episode.
		</p>
		<!-- METHODS, not marketing. The panel that says how a number was got is the difference between
		     a claim and a result — and the bench's own tanks are single runs, which is exactly the
		     thing a reader would otherwise mistake for evidence. -->
		<dl class="methods">
			<div>
				<dt>policy</dt>
				<dd>8→6→2 MLP · 68 evolved params · no memory</dd>
			</div>
			<div>
				<dt>selection</dt>
				<dd>fitness = seconds survived · elitism + tournament + crossover</dd>
			</div>
			<div>
				<dt>ablation</dt>
				<dd>a cut channel feeds 0 — the network shape never changes</dd>
			</div>
			<div>
				<dt>evidence</dt>
				<dd>each tank is <b>one</b> run; use Evaluate for n-seed means ± sd</dd>
			</div>
		</dl>
	</div>
</aside>

<style>
	.methods {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--sp-2) var(--sp-5);
		margin: var(--sp-4) 0 0;
		font-size: var(--fs-label);
	}

	.methods dt {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: var(--fs-xs);
		color: var(--ink3);
	}

	.methods dd {
		margin: 0;
		color: var(--ink2);
	}

	.note {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-5);
		padding: var(--sp-5) var(--sp-6);
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--panel);
		box-shadow: var(--shadow);
	}

	.icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 26px;
		height: 26px;
		border-radius: var(--radius-xs);
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--accent);
		font-family: var(--font-display);
		font-size: var(--fs-body);
		font-weight: var(--fw-bold);
	}

	p {
		margin: 0;
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink2);
	}

	b {
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}
</style>
