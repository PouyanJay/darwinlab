<!--
  The Research stage — the console the lab becomes in Research mode.

  Three zones, not a tab bar: a left RAIL (the subject, the instrument nav, the compute readout), a
  confined WORKSPACE that holds the active instrument, and a persistent right SIDEBAR of context for
  whatever the workspace shows. The rail drives which instrument is active; the workspace renders it as
  a tabpanel; the sidebar adapts to it. Monochrome chrome throughout — teal and coral live in the
  instruments' own graphs, never in this furniture.

  `active` is owned here and passed down, so the rail (the tablist), the workspace (the panel) and the
  sidebar all read one truth. The `research-panel` id wires the rail's tabs to the workspace's panel
  across the two subtrees.
-->
<script lang="ts">
	import ResearchRail from './ResearchRail.svelte';
	import ResearchWorkspace from './ResearchWorkspace.svelte';
	import ResearchSidebar from './ResearchSidebar.svelte';
	import Sweep from './Sweep/Sweep.svelte';
	import Ledger from './Ledger/Ledger.svelte';
	import Atlas from './Atlas/Atlas.svelte';
	import Trace from './Trace/Trace.svelte';
	import ReportView from './Report/ReportView.svelte';
	import QuestionTags from './QuestionTags.svelte';
	import { instrumentMeta, answersOf, type Instrument } from './instruments';
	import { SCENARIO } from '$lib/lab/scenario';

	let active = $state<Instrument>('sweep');
	const meta = $derived(instrumentMeta(active));
	const answers = $derived(answersOf(active));
</script>

<div class="console" data-testid="research-stage">
	<div class="zone zone-rail">
		<ResearchRail {active} onselect={(key) => (active = key)} />
	</div>

	<div class="zone zone-work">
		<ResearchWorkspace>
			<header class="ws-head">
				<span class="eyebrow">Research · {SCENARIO.index} · {SCENARIO.name}</span>
				<div class="ws-title">
					<h2>{meta.name}</h2>
					<QuestionTags questions={answers} />
				</div>
				<p class="blurb">{meta.blurb}</p>
			</header>

			<div id="research-panel" role="tabpanel" aria-labelledby="rtab-{active}">
				{#if active === 'sweep'}
					<Sweep />
				{:else if active === 'ledger'}
					<Ledger />
				{:else if active === 'atlas'}
					<Atlas />
				{:else if active === 'trace'}
					<Trace />
				{:else if active === 'report'}
					<ReportView />
				{/if}
			</div>
		</ResearchWorkspace>
	</div>

	<div class="zone zone-side">
		<ResearchSidebar {active} />
	</div>
</div>

<style>
	.console {
		/* The redesign's zone widths (the mock is the contract): a slimmer rail and sidebar buy the
		   workspace room — the design panel joins as a fourth zone in the next phase. */
		--rail-w: 240px;
		--side-w: 276px;
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-columns: var(--rail-w) minmax(0, 1fr) var(--side-w);
		grid-template-rows: minmax(0, 1fr);
		background: var(--bgfx);
		/* The shared card-entrance as the console swaps in from Studio. Reduced-motion is handled
		   globally in app.css (a blanket animation: none). */
		animation: fade-up var(--dur-slow) var(--ease) both;
	}

	/* Each zone is a grid cell that fills its column and lets its instrument scroll inside it — the
	   console never grows the page; the zones do. `display: grid` makes the single child fill the cell. */
	.zone {
		display: grid;
		min-width: 0;
		min-height: 0;
	}

	.ws-head {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	/* Title and its "answers Q…" tags on one line — the tags ride the heading's baseline, wrapping
	   under it only when the workspace is too narrow to hold both. */
	.ws-title {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--sp-3);
	}

	.ws-head h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-wordmark);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-tight);
		color: var(--ink);
	}

	.blurb {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ink3);
	}

	#research-panel {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	/* Below the sidebar's comfortable width: keep the rail on the left, and drop the context sidebar to
	   a capped strip under the workspace so the drilled point is still reachable, never hidden. */
	@media (max-width: 1200px) {
		.console {
			grid-template-columns: var(--rail-w) minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr) auto;
		}

		.zone-rail {
			grid-row: 1 / span 2;
		}

		.zone-side {
			grid-column: 2;
			grid-row: 2;
			max-height: 42vh;
			border-top: 1px solid var(--line);
		}
	}

	/* Narrow: one column, everything stacked — rail, then the instrument, then its context. */
	@media (max-width: 760px) {
		.console {
			grid-template-columns: 1fr;
			grid-template-rows: auto minmax(0, 1fr) auto;
		}

		.zone-rail {
			grid-row: 1;
		}

		.zone-side {
			grid-column: 1;
			grid-row: 3;
			max-height: 40vh;
		}
	}
</style>
