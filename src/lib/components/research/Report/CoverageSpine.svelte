<!--
  The coverage spine — the honesty rail made visible, and the Report's navigation in one.

  A seven-segment ring shows how much of a rigorous study is settled (a filled arc per answered
  question, a hollow gold arc per gap), and the list below jumps to each section. It reads the same
  `sections` the brief does, so the ring can never disagree with the questions beneath it.
-->
<script lang="ts">
	import type { ReportSection } from '$lib/state';
	import type { QuestionId } from '$lib/lab/questions';

	let {
		sections,
		active,
		onjump
	}: {
		sections: ReportSection[];
		/** The question whose section is in view — highlighted in the list. */
		active: QuestionId | null;
		onjump: (id: QuestionId) => void;
	} = $props();

	const answered = $derived(sections.filter((s) => s.finding).length);

	// The ring: one arc per question, filled when answered. r and circumference are fixed; the segment
	// length is C/n minus a small gap, recomputed from the live section count inside the derived.
	const R = 16;
	const CIRC = 2 * Math.PI * R; // ≈ 100.53
	const GAP = 2;
	const arcs = $derived.by(() => {
		const seg = CIRC / sections.length;
		return sections.map((s, i) => ({
			id: s.question.id,
			answered: !!s.finding,
			dash: `${seg - GAP} ${CIRC - (seg - GAP)}`,
			offset: -(i * seg)
		}));
	});
</script>

<aside class="spine" aria-label="coverage and contents">
	<div class="cov">
		<svg
			viewBox="0 0 40 40"
			role="img"
			aria-label="{answered} of {sections.length} questions settled"
		>
			<g fill="none" stroke-width="4" transform="rotate(-90 20 20)">
				<circle cx="20" cy="20" r={R} stroke="var(--line)" />
				{#each arcs as arc (arc.id)}
					<circle
						cx="20"
						cy="20"
						r={R}
						stroke={arc.answered ? 'var(--data-teal)' : 'var(--gold-ink)'}
						stroke-opacity={arc.answered ? 1 : 0.5}
						stroke-dasharray={arc.dash}
						stroke-dashoffset={arc.offset}
					/>
				{/each}
			</g>
			<text x="20" y="19" text-anchor="middle" fill="var(--ink)" font-size="10" font-weight="700">
				{answered}/{sections.length}
			</text>
			<text
				x="20"
				y="27"
				text-anchor="middle"
				fill="var(--ink3)"
				font-size="4.2"
				letter-spacing="0.5"
			>
				SETTLED
			</text>
		</svg>
		<span class="lab">this subject</span>
	</div>

	<nav class="qnav" aria-label="the seven questions">
		{#each sections as s (s.question.id)}
			<button
				class="qrow"
				class:done={s.finding}
				class:on={active === s.question.id}
				onclick={() => onjump(s.question.id)}
			>
				<span class="qd" aria-hidden="true"></span>
				<span class="qk">{s.question.id}</span>
				<span class="qt">{s.question.short}</span>
			</button>
		{/each}
	</nav>
</aside>

<style>
	.spine {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
	}

	.cov {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-2);
		text-align: center;
	}

	.cov svg {
		width: 88px;
		height: 88px;
	}

	.cov text {
		font-family: var(--font);
	}

	.lab {
		font-size: var(--fs-eyebrow);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.qnav {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.qrow {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		width: 100%;
		background: none;
		border: 0;
		padding: var(--sp-1) var(--sp-2);
		border-radius: var(--radius-sm);
		text-align: left;
		cursor: pointer;
		color: var(--ink3);
		font: inherit;
		font-size: var(--fs-sm);
	}

	.qrow:hover {
		background: var(--chip);
		color: var(--ink2);
	}

	.qrow.on {
		color: var(--ink);
		background: var(--panel2);
		box-shadow: inset 0 0 0 1px var(--line);
	}

	.qrow:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	.qd {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex: none;
		border: 1.5px solid var(--ink3);
	}

	/* The dot is data: teal filled when answered, gold dashed hollow when it is the honest gap. */
	.qrow.done .qd {
		background: var(--data-teal);
		border-color: var(--data-teal);
	}

	.qrow:not(.done) .qd {
		border-color: var(--gold-ink);
		border-style: dashed;
	}

	.qk {
		font-variant-numeric: tabular-nums;
		font-weight: var(--fw-semibold);
		width: 22px;
	}

	.qt {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
