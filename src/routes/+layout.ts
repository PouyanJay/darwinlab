// Client-only SPA on adapter-static.
//  - ssr=false   the app relies on <canvas> and a browser timer loop, so nothing renders server-side.
//  - prerender   adapter-static emits a static HTML shell at build time that hydrates on the client.
//  - csr         the app runs entirely in the browser.
//
// When dynamic routes arrive (shareable worlds, per-lab pages), switch the adapter to a
// fallback SPA — adapter({ fallback: 'index.html' }) in vite.config.ts — instead of
// prerendering each route.
export const ssr = false;
export const prerender = true;
export const csr = true;
