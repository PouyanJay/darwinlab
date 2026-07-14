<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import touchIcon from '$lib/assets/brand/apple-touch-icon.png';
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

<!-- Both icons are IMPORTED, not written as "/favicon.svg": the app also ships under a GitHub Pages
     sub-path, and an absolute href would resolve against the origin and 404 there. -->
<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="apple-touch-icon" href={touchIcon} />
</svelte:head>

{@render children()}
