/**
 * Resolve the app's base path from the environment — the single place BASE_PATH is judged.
 *
 * GitHub Pages serves a project site from /<repo>, not the domain root: the deploy pipeline
 * sets BASE_PATH=/darwinlab; local dev and plain builds stay at "".
 */
export function resolveBasePath(env: Record<string, string | undefined>): '' | `/${string}` {
	// Vitest extends the same vite config this feeds. Under the browser runner a base path
	// 404s the runner's OWN assets (/darwinlab/__vitest__/... — zero tests run, minutes of
	// hang), so test runs always get the root base regardless of BASE_PATH.
	if (env.VITEST) return '';
	const raw = env.BASE_PATH ?? '';
	if (raw === '') return '';
	if (!raw.startsWith('/') || raw.endsWith('/')) {
		throw new Error(`BASE_PATH must start with "/" and must not end with "/" (got "${raw}")`);
	}
	return raw as `/${string}`;
}
