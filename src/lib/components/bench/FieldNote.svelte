<!--
  The field note (README §5.2) — the intellectual point of the product, stated before you look at a
  single tank: more senses is not more intelligence.

  The copy is the reference's, verbatim. Do not soften it and do not cut it. It exists because the
  measured result is unflattering (§8) and the product ships the real finding rather than a tuned
  one — the banner is what makes that a lesson instead of a bug.
-->
<aside class="note">
	<span class="icon" aria-hidden="true">i</span>
	<p>
		<b>More senses is not more intelligence.</b> Watch the learning curves as they evolve: noticing
		a threat and knowing <i>which way</i> it is (Distance → Direction) is where survival leaps.
		Adding closing-speed and wall sense on top barely moves the needle — this predator simply
		doesn't create dangers those inputs uniquely solve, so evolution never learns to use them. An
		input the world doesn't reward is just noise a brain has to overcome.
		<span class="aside">
			Real neuroevolution — nothing here is scripted or tuned to flatter the result.
		</span>
	</p>
</aside>

<style>
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

	.aside {
		color: var(--ink3);
	}
</style>
