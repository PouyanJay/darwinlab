<!--
  The lab's control column — organised as an instrument panel: a read-only STATUS header on top,
  then the controls split by what they ARE, not by an arbitrary topic. You read the state first, then
  reach for the kind of control you want:

    STATUS      what is running and how far — the run/seed manifest and a progress meter (read-only)
    TRANSPORT   the live now — evolve/pause and speed, the two things you touch every few seconds
    SETTINGS    the knobs you set and leave — the deploy generation and the tank lens
    ACTIONS     the one-shot commands — train to the end, add an environment, play the story, reset

  Status is stated once, at the top, so "how far along am I" never means hunting through the controls.
  The knobs are apart from the commands so a value you nudge can't be confused with a button that
  fires. The top bar keeps only what is not a control (identity, the scenario) plus settings and
  theme, so there is exactly one place to look for an action.

  It is DOCKED at one fixed width on a desktop, and an OVERLAY on a phone, where there is no room to
  dock anything. Collapsed, it leaves a rail behind rather than vanishing: the run controls are what you
  reach for mid-experiment, and a control you have to re-open a panel to press is a control you stop
  using. Which of the three it is doing is the shell store's answer, not this component's.
-->
<script lang="ts">
	import Button from '../common/Button.svelte';
	import Icon from '../common/Icon.svelte';
	import Segmented from '../common/Segmented.svelte';
	import TransportIcon from '../common/TransportIcon.svelte';
	import RunManifest from './RunManifest.svelte';
	import SidebarRail from './SidebarRail.svelte';
	import { trainTarget, trainLabel } from './train';
	import { DISCLAIMER } from '../common/disclaimer';
	import { bench, shell, SPEEDS } from '$lib/state';
	import { MAX_GENERATIONS } from '$lib/engine';
	import type { Lens } from '$lib/render';

	/** The lenses the bench offers. One list, so the control and the store cannot disagree. */
	const LENSES: { value: Lens; label: string }[] = [
		{ value: 'none', label: 'Off' },
		{ value: 'flee', label: 'Flee error' }
	];

	interface Props {
		onaddworld: () => void;
		onplaystory: () => void;
	}

	let { onaddworld, onplaystory }: Props = $props();

	const target = $derived(trainTarget(bench.generationsEvolved, bench.maxGenerations));
	const label = $derived(trainLabel(bench.maxGenerations));

	// The status meter. A deploy generation of 0 means "train forever" — there is no finish line to
	// fill toward, so the bar stays empty and the caption drops the "/ N" it would otherwise imply.
	const deployAt = $derived(bench.maxGenerations);
	const hasTarget = $derived(deployAt > 0);
	const progress = $derived(
		hasTarget ? Math.min(100, (bench.generationsEvolved / deployAt) * 100) : 0
	);
	// The one honest word for where the run is: past its finish line it has DEPLOYED (population now
	// decays, nothing more evolves); otherwise it is either evolving or sitting paused.
	const phase = $derived(
		hasTarget && bench.generationsEvolved >= deployAt
			? 'deployed'
			: bench.running
				? 'evolving'
				: 'paused'
	);

	// "Close" on a phone, where the panel is OVER the bench; "collapse" on a desktop, where it is
	// beside it. The same press, and two honest words for what it does.
	const dismiss = $derived(shell.narrow ? 'close the controls' : 'collapse the controls');

	/**
	 * On the narrow layout the panel floats over the bench, so anything that TAKES the screen has to
	 * shut it on the way out — otherwise the film plays behind an open control panel, and a new world
	 * scrolls into view underneath one.
	 */
	function andClose(run: () => void) {
		return () => {
			run();
			shell.closeOverlay();
		};
	}
</script>

<!--
  The rail is docked whenever the panel is not filling its place: shut, it IS the sidebar; on a phone
  it stays put under the open overlay, because removing it there would shift the whole bench sideways
  every time the panel opened.
-->
{#if !shell.open || shell.narrow}
	<SidebarRail {onaddworld} {onplaystory} />
{/if}

{#if shell.open}
	<!-- Only the OVERLAY gets a scrim; a docked panel is part of the page, not on top of it. -->
	{#if shell.narrow}
		<button
			type="button"
			class="scrim"
			aria-label="dismiss the controls"
			onclick={() => shell.closeOverlay()}
		></button>
	{/if}

	<!-- An <aside>, not a <nav>: these are controls, not links, and a landmark is what keeps a screen
	     reader able to jump to them (and what stops the axe `region` rule finding orphaned content).
	     The rail carries the same label — only ever one of the two is live, the other is inert. -->
	<aside
		class="sidebar"
		class:overlay={shell.narrow}
		style:width="{shell.width}px"
		aria-label="lab controls"
	>
		<div class="panel">
			<header>
				<span class="title">Controls</span>
				<Button
					variant="icon"
					size="sm"
					aria-label={dismiss}
					aria-expanded={true}
					title={dismiss}
					onclick={() => shell.toggle()}
				>
					<Icon name="chevron-left" size={15} />
				</Button>
			</header>

			<!--
				STATUS — read, don't touch. What this run IS (the manifest chip, which opens the seed
				editor) and how far it has got (the meter). It sits above every control so "where am I"
				is answered before "what can I press", and it is the only block here you look at rather
				than operate.
			-->
			<div class="status">
				<RunManifest />

				<div class="meter">
					<div
						class="track"
						role="progressbar"
						aria-label="training progress"
						aria-valuemin={0}
						aria-valuemax={hasTarget ? deployAt : undefined}
						aria-valuenow={hasTarget ? bench.generationsEvolved : undefined}
					>
						<div class="fill" style:width="{progress}%"></div>
					</div>
					<div class="cap">
						<span>
							<b class="tabular" data-testid="generations">{bench.generationsEvolved}</b>
							{#if hasTarget}<span class="of">/ {deployAt}</span>{/if}
							episodes
						</span>
						<span class="phase" data-phase={phase}>{phase}</span>
					</div>
				</div>
			</div>

			<!--
				TRANSPORT — the live now. ONE full-width button, and it is the transport: the thing you
				press most, and the only control that earns the whole measure. Speed sits under it on a
				label-left / control-right row.

				No aria-label on a button that carries visible text: an aria-label REPLACES the label a
				sighted user reads with a different one AT hears. Only the glyph-only buttons get one.
			-->
			<section>
				<h2 class="field-label">Transport</h2>

				<Button variant="primary" class="transport" onclick={() => bench.togglePlay()}>
					<TransportIcon playing={bench.running} />
					<span>{bench.running ? 'Pause' : 'Evolve'}</span>
				</Button>

				<div class="field">
					<!-- Decorative: the Segmented control carries its own accessible name ("simulation
					     speed"). Wiring it up as a second label would announce the group twice. -->
					<span class="field-label" aria-hidden="true">Speed</span>
					<Segmented
						label="simulation speed"
						options={SPEEDS}
						value={bench.speed}
						onchange={(speed) => bench.setSpeed(speed)}
					/>
				</div>
			</section>

			<!--
				SETTINGS — the knobs you set and leave. The deploy generation the run climbs toward, and
				the lens that recolours the tanks. A LENS is a way of looking, not a way of changing: it
				repaints what is already there and touches nothing that evolved, which is why it is safe
				to leave on. Both are values, not commands — so they live apart from the Actions below.
			-->
			<section>
				<h2 class="field-label">Settings</h2>

				<div class="field">
					<label class="field-label" for="deploy-gen">Deploy at gen</label>
					<input
						id="deploy-gen"
						class="num"
						type="number"
						inputmode="numeric"
						min={MAX_GENERATIONS.min}
						max={MAX_GENERATIONS.max}
						value={bench.maxGenerations}
						onchange={(event) => bench.setMaxGenerations(Number(event.currentTarget.value))}
					/>
				</div>

				<div class="field">
					<span class="field-label" aria-hidden="true">Colour by</span>
					<Segmented
						label="tank lens"
						options={LENSES}
						value={bench.lens}
						onchange={(lens) => bench.setLens(lens)}
					/>
				</div>

				{#if bench.lens === 'flee'}
					<p class="lens-note">
						Each fish is painted by how wrong its escape is: away from the shark at one end, into
						its mouth at the other. Grey means no reading.
					</p>
				{/if}
			</section>

			<!--
				ACTIONS — the one-shot commands, gathered so every button that DOES something lives in one
				place. Train fills the row (it is the one you reach for); add + play share the next; reset
				is set apart and reddens on hover, because it throws every evolved brain away.
			-->
			<section>
				<h2 class="field-label">Actions</h2>

				<div class="cluster">
					<Button
						size="sm"
						class="full"
						disabled={bench.training}
						onclick={() => bench.trainTo(target)}
					>
						<Icon name="forward" size={14} />
						<span>{label}</span>
					</Button>

					<Button size="sm" onclick={andClose(onaddworld)}>
						<Icon name="plus" size={14} />
						<span>Add environment</span>
					</Button>

					<Button
						variant="accent"
						size="sm"
						disabled={bench.training}
						onclick={andClose(onplaystory)}
					>
						<TransportIcon playing={false} size={12} />
						<span>Play story</span>
					</Button>

					<Button
						size="sm"
						class="full reset"
						title="reset every world to random brains"
						onclick={() => bench.resetAll()}
					>
						<Icon name="reset" size={15} />
						<span>Reset all brains</span>
					</Button>
				</div>
			</section>

			<!-- The disclaimer, at the foot of the chrome rather than floating over somebody's tank.
			     FooterPill shows the same line as a pill whenever this column is shut. -->
			<p class="disclaimer">{DISCLAIMER}</p>
		</div>
	</aside>
{/if}

<style>
	.sidebar {
		position: sticky;
		top: var(--topbar-height);
		z-index: var(--z-sidebar);
		flex: none;
		align-self: flex-start;
		display: flex;
		height: calc(100vh - var(--topbar-height));
		border-right: 1px solid var(--line);
		background: var(--panel);
	}

	/* No room to dock: the panel comes over the bench, off the left edge, above its own scrim. */
	.overlay {
		position: fixed;
		top: var(--topbar-height);
		left: 0;
		z-index: var(--z-sidebar-overlay);
		/* The rail stays uncovered, so the way out stays visible — measured off the rail's own token,
		   not off a 64 that would quietly go stale the day the rail changes width. */
		max-width: calc(100vw - var(--rail-width) - var(--sp-3));
		box-shadow: var(--shadow-drawer);
		animation: slide-in-left var(--dur-enter) var(--ease) both;
	}

	.scrim {
		position: fixed;
		inset: var(--topbar-height) 0 0;
		z-index: var(--z-sidebar-scrim);
		border: none;
		padding: 0;
		background: var(--scrim);
		backdrop-filter: blur(var(--blur-scrim));
		cursor: default;
		animation: fade-in var(--dur-fast) var(--ease) both;
	}

	.panel {
		flex: 1;
		min-width: 0; /* a dragged-narrow panel clips its content instead of pushing the divider */
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		padding: var(--sp-4) var(--sp-5) var(--sp-6);
		overflow-y: auto;
	}

	/* A hairline between each group and the next, so the sections read as separate things rather than
	   one long stack. The status header sits straight under the header, undivided — it is the label
	   for everything below, not a peer of it. */
	section + section {
		padding-top: var(--sp-5);
		border-top: 1px solid var(--line);
	}

	.panel > header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: calc(-1 * var(--sp-3)); /* the section gap is enough on its own */
	}

	.title {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--ink3);
	}

	/* Pushed to the bottom of the column, however tall the column is. */
	.disclaimer {
		margin: auto 0 0;
		padding-top: var(--sp-6);
		font-size: var(--fs-xs);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	section h2 {
		margin: 0 0 var(--sp-1);
	}

	/*
		STATUS header — a recessed plate that reads as a readout, not a control surface. The manifest
		chip is stretched to fill it; the meter sits under it.
	*/
	.status {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding: var(--sp-3) var(--sp-4) var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel2);
	}

	.sidebar :global(.manifest) {
		width: 100%;
		justify-content: flex-start;
		background: transparent; /* the status plate is already the recessed surface */
	}

	.meter {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.track {
		height: 6px;
		border-radius: var(--radius-chip);
		background: var(--chip);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		border-radius: var(--radius-chip);
		background: var(--ink);
		transition: width var(--dur) var(--ease);
	}

	.cap {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--sp-3);
		font-size: var(--fs-label);
		color: var(--ink3);
	}

	.cap b {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}

	.cap .of {
		color: var(--ink3);
	}

	/* The phase word sits quietly with the caption — same muted grey — except "deployed", the one
	   notable state (the run is over and the population is decaying), which carries the danger hue. */
	.phase {
		font-size: var(--fs-label);
		color: var(--ink3);
	}

	.phase[data-phase='deployed'] {
		color: var(--danger-ink);
	}

	/* The one control that takes the whole measure — see the note in the markup. */
	.sidebar :global(.transport) {
		width: 100%;
		height: 40px;
		justify-content: center;
		font-size: var(--fs-md);
		letter-spacing: 0.01em;
	}

	/* A label on the left, the control it names on the right — the shape of a settings row, and the
	   reason nothing here has to be stretched to fill a line it does not need. */
	.field {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
		min-height: 30px;
	}

	/*
		ACTIONS — a two-column cluster of one-shot commands. Train and Reset each take the full width
		(one is the primary reach, the other is set apart on purpose); add + play share the middle row.
	*/
	.cluster {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-2);
	}

	.sidebar :global(.cluster .full) {
		grid-column: 1 / -1;
	}

	.sidebar :global(.cluster .btn) {
		justify-content: center;
	}

	/* Reset throws every evolved brain away, so it is set apart from the framed commands above: no
	   border, danger ink, flush left — a quiet red line, not a button competing for the press. It
	   deepens on hover. Scoped under `.cluster` so it outweighs the `.cluster .btn` centring rule
	   rather than losing to it on specificity. */
	.sidebar :global(.cluster .reset) {
		justify-content: flex-start;
		padding-left: var(--sp-3);
		border-color: transparent;
		background: transparent;
		color: var(--danger-ink);
	}

	.sidebar :global(.cluster .reset:not(:disabled):hover) {
		background: transparent;
		color: var(--danger);
	}

	/* A compact number field, sized to a few digits and right-aligned so the value reads as a value. */
	.num {
		width: 68px;
		padding: var(--sp-2) var(--sp-3);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--panel2);
		color: var(--ink);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.num:focus {
		outline: none;
		border-color: var(--accent);
	}

	.lens-note {
		margin: var(--sp-1) 0 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}
</style>
