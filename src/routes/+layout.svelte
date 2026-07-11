<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import { theme } from '$lib/state';
	// Fonts are self-hosted (no Google Fonts request, no layout shift on a cold cache). Only the
	// weight axis is shipped for Inter; Bricolage also carries its optical-size axis, which the
	// browser applies automatically by font-size. Unused unicode subsets are never fetched.
	import '@fontsource-variable/bricolage-grotesque/opsz.css';
	import '@fontsource-variable/inter/wght.css';
	import '$lib/styles/tokens.css';
	import '$lib/styles/app.css';

	let { children } = $props();

	// Adopt the theme the pre-paint script in app.html already stamped on <html>. It is the shell's
	// job, not the page's: every screen is themed, including ones that never touch the bench.
	onMount(() => theme.init());
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
