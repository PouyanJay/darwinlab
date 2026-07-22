<!--
  The Trace instrument — the console's second discovery type: did this population LEARN, and HOW?

  One button evolves a single population at the subject's config and keeps it; when the study is in, the
  conclusion leads with the learning curve (Q1 — did it climb and converge?), then the mechanism (Q5) —
  the evolved population's behaviour against a random-brain control, as bars and as the paths each school
  actually traced. Everything reads off the trace store; nothing measures here. The evolved-vs-control
  contrast is the honest point: "it survives" only means something beside a baseline that doesn't.
-->
<script lang="ts">
	import Button from '../../common/Button.svelte';
	import Icon from '../../common/Icon.svelte';
	import RunProgress from '../RunProgress.svelte';
	import LearningCurve from '../viz/LearningCurve.svelte';
	import BehaviorBars from '../viz/BehaviorBars.svelte';
	import Trajectories from '../viz/Trajectories.svelte';
	import { trace } from '$lib/state';
	import { behaviorMetrics } from '$lib/harness/traceStudy';

	const result = $derived(trace.result);
	const metrics = $derived(
		result ? behaviorMetrics(result.evolved.behavior, result.control.behavior) : []
	);
	const panels = $derived(
		result
			? [
					{ title: 'Evolved', trace: result.evolved.trace },
					{ title: 'Random control', trace: result.control.trace }
				]
			: []
	);
</script>

<div class="trace" data-testid="trace">
	<div class="runbar">
		<p class="lead">
			Evolve one population at the subject's config, then watch how it survives — beside a
			random-brain control that never learned.
		</p>
		{#if trace.running}
			<RunProgress progress={trace.progress} oncancel={() => trace.cancel()} />
		{:else}
			<Button variant="primary" size="sm" onclick={() => trace.run()} data-testid="run-trace">
				<Icon name="forward" size={13} />
				<span>{result ? 'Run again' : 'Run a behaviour trace'}</span>
			</Button>
		{/if}
	</div>

	{#if result}
		<section class="block">
			<span class="eyebrow">Did it learn? · survival per generation</span>
			<LearningCurve curve={result.curve} />
		</section>

		<section class="block">
			<span class="eyebrow">How? · evolved vs a random-brain control</span>
			<BehaviorBars {metrics} />
		</section>

		<section class="block">
			<span class="eyebrow">The paths each school traced · one frozen bout</span>
			<Trajectories {panels} />
		</section>
	{:else}
		<p class="hint">
			Run a behaviour trace to evolve a population and see whether it learned — and how it survives,
			next to brains that never did.
		</p>
	{/if}
</div>

<style>
	.trace {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
	}

	.runbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-5);
		flex-wrap: wrap;
	}

	.lead {
		margin: 0;
		max-width: 52ch;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		min-width: 0;
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.hint {
		margin: 0;
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink3);
		max-width: 60ch;
	}
</style>
