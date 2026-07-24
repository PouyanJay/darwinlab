<!--
  The top bar: who this is and what it is pointed at. Not what you can do to it.

  Every control that DRIVES the bench lives in the sidebar now, so the bar carries only identity (the
  mark, the wordmark, and the Studio/Research mode — which instrument the lab is presenting) and the
  scenario — the lab is the instrument, the scenario is what it is aimed at, and saying both is what
  keeps this from reading as a fish game with charts on it. Point it at a maze tomorrow and only the
  binding changes.

  What is left on the right is the two things that are about the APP rather than the experiment:
  settings, and the theme.
-->
<script lang="ts">
	import Button from '../common/Button.svelte';
	import Chip from '../common/Chip.svelte';
	import Icon from '../common/Icon.svelte';
	import LogoMark from './LogoMark.svelte';
	import ModeSwitch from './ModeSwitch.svelte';
	import LabSettings from './LabSettings.svelte';
	import { theme } from '$lib/state';
	import { SCENARIO } from '$lib/lab/scenario';

	/**
	 * Publish the bar's REAL height as `--topbar-height`.
	 *
	 * The sidebar, the drawer and the turbo pill all have to sit clear of the bar, and its height is
	 * not a constant they can assume: it grows when the content wraps on a narrow screen. Measuring it
	 * and letting them anchor off the result is the only version of this that cannot go stale.
	 */
	function publishHeight(bar: HTMLElement) {
		const root = document.documentElement;
		const write = () => root.style.setProperty('--topbar-height', `${bar.offsetHeight}px`);

		write();
		const observer = new ResizeObserver(write);
		observer.observe(bar);

		return () => {
			observer.disconnect();
			root.style.removeProperty('--topbar-height'); // back to the token's fallback
		};
	}
</script>

<header {@attach publishHeight}>
	<div class="brand">
		<LogoMark size={22} />
		<!-- The page's h1: the bench has real h2s (dialogs, drawers), and a page whose headings start
		     at level two reads as if its top is missing. -->
		<h1 class="wordmark">Darwin Lab</h1>
		<Chip variant="tag" class="live-tag">agent sandbox</Chip>
	</div>

	<!-- The top-level lens; see ModeSwitch.svelte for why a mode lives in the top bar. -->
	<ModeSwitch />

	<span class="divider" aria-hidden="true"></span>

	<div class="lab">
		<span class="lab-name">{SCENARIO.index} · {SCENARIO.name}</span>
		<span class="lab-blurb">
			<b>agents</b>
			{SCENARIO.agent.many} · <b>adversary</b>
			{SCENARIO.adversary.many} ·
			<b>policy</b>
			{SCENARIO.policy.one} (68 params) · <b>objective</b>
			{SCENARIO.objective}
		</span>
	</div>

	<div class="spacer"></div>

	<!--
		Theme first, lab settings second — reading order matches how often they are pressed and how
		much they weigh: a theme flip is a whim, the lab settings decide when evolution STOPS FOR GOOD
		(the deploy generation). The heavier switch sits at the end, where a hand does not land on it
		by accident on the way to the light switch.

		And both now say what they are. A half-filled circle ◐ is a shape, not a meaning; the button
		shows the theme you would GET — a sun to go light, a moon to go dark — which is the only one of
		the two conventions a user can act on without pressing it to find out.
	-->
	<!-- The repo, one click away. A real <a> (not a Button firing window.open) so it middle-clicks,
	     opens in a new tab, and reads as a link to assistive tech. Styled to match the ghost buttons
	     beside it, so the three read as one control cluster. -->
	<a
		class="gh"
		href="https://github.com/PouyanJay/darwinlab"
		target="_blank"
		rel="noopener noreferrer"
		aria-label="Darwin Lab on GitHub"
		title="Source on GitHub"
	>
		<Icon name="github" />
	</a>

	<Button
		aria-label={theme.name === 'light' ? 'switch to dark theme' : 'switch to light theme'}
		title={theme.name === 'light' ? 'dark theme' : 'light theme'}
		onclick={() => theme.toggle()}
	>
		<Icon name={theme.name === 'light' ? 'moon' : 'sun'} />
	</Button>

	<LabSettings />
</header>

<style>
	header {
		position: sticky;
		top: 0;
		z-index: var(--z-topbar);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-5);
		padding: var(--sp-4) var(--sp-6);
		border-bottom: 1px solid var(--line);
		background: var(--glass);
		backdrop-filter: blur(var(--blur-glass));
	}

	.brand {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}

	.wordmark {
		margin: 0; /* an h1 for the outline, not for h1's browser styling */
		font-family: var(--font-display);
		font-size: var(--fs-wordmark);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-tight);
	}

	.divider {
		flex: none;
		width: 1px;
		height: 26px;
		background: var(--line);
	}

	.lab {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.lab-name {
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
	}

	.lab-blurb {
		font-size: var(--fs-sm);
		color: var(--ink3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.spacer {
		flex: 1;
	}

	/* The GitHub link wears the ghost-button box (matching the theme + settings buttons it sits
	   beside), so the three read as one control cluster. It is an <a>, not a Button, so its look
	   is matched here rather than inherited. */
	.gh {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: var(--sp-3) 14px;
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		background: var(--panel);
		color: var(--ink);
		transition:
			background var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease);
	}

	.gh:hover {
		background: var(--chip);
	}

	.gh:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	/* A fingertip is not a cursor — full-size target on coarse pointers, as Button does. */
	@media (pointer: coarse) {
		.gh {
			min-height: 44px;
		}
	}

	/*
	 * The lab blurb is the first thing to go when the bar runs out of room: it is context, not a
	 * control, and the two buttons on the right are not negotiable.
	 */
	@media (max-width: 720px) {
		.lab-blurb {
			display: none;
		}
	}

	@media (max-width: 560px) {
		.lab,
		.divider {
			display: none;
		}

		header :global(.live-tag) {
			display: none;
		}
	}
</style>
