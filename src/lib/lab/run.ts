/**
 * The run manifest — what turns a simulation into an experiment you can cite.
 *
 * A demo runs. An instrument runs SOMETHING SPECIFIC: this seed, this configuration, this many
 * episodes, and it can be handed to someone else who gets the same numbers back. That is the
 * whole difference, and it is three fields and a hash.
 *
 * The hash is over the configuration ONLY — never the live state — so two runs whose worlds have
 * diverged still show the same config hash if they were set up the same way. That is the point:
 * it identifies the EXPERIMENT, not the moment.
 */

import type { WorldConfig } from '../engine';

/** The config fields that change what a run DOES. Labels and colours are excluded on purpose. */
const MEANINGFUL: (keyof WorldConfig)[] = [
	'prey',
	'preds',
	'bw',
	'bh',
	'predSpeed',
	'vision',
	'mutation',
	'senses',
	'persistence',
	'persistRamp',
	'persistMaxBoost',
	'persistMaxJaw',
	'lungeCommit',
	'aimCharge',
	'lungeFerocity',
	'wallInstinct',
	'genDuration',
	'agility',
	'stamina',
	'brainInputs'
];

/**
 * A short, stable fingerprint of an experiment's configuration.
 *
 * FNV-1a over the canonical JSON: deterministic across machines and reloads, so the same setup
 * always prints the same six characters. Not cryptographic, and it does not need to be — its job
 * is to let two people say "I ran a3f19c" and mean the same thing.
 */
export function configHash(configs: WorldConfig[]): string {
	const canonical = JSON.stringify(
		configs.map((cfg) =>
			MEANINGFUL.map((key) => [key, cfg[key] ?? null] as const).sort(([a], [b]) => (a < b ? -1 : 1))
		)
	);
	let hash = 2166136261;
	for (let i = 0; i < canonical.length; i++) {
		hash ^= canonical.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

/**
 * What a user can actually change from the UI — and therefore what an "override" can be. A diff
 * taken over EVERY field would compare things the reactive config view does not carry and report
 * phantom overrides; a diff over what the dialog offers is the diff a reader means.
 */
export const EDITABLE = [
	'prey',
	'preds',
	'bw',
	'bh',
	'predSpeed',
	'vision',
	'mutation',
	'senses',
	'persistence',
	'persistRamp',
	'persistMaxBoost',
	'persistMaxJaw'
] as const;

/** One field of a config, as the reactive view carries it. */
type EditableFields = Pick<WorldConfig, (typeof EDITABLE)[number]>;

/**
 * What the engine falls back to when a field is absent. Applied to BOTH sides of a diff: the
 * reactive view resolves these as it projects (`persistRamp ?? 0.04`) while a stored config leaves
 * them `undefined`, and compared raw every card would announce three overrides it never had.
 */
const FALLBACKS: Partial<Record<(typeof EDITABLE)[number], unknown>> = {
	persistence: true,
	persistRamp: 0.04,
	persistMaxBoost: 0.85,
	persistMaxJaw: 20
};

/**
 * Read one field, with the engine's fallback applied.
 *
 * Reads the key DIRECTLY rather than spreading the object first, and that is load-bearing: one side
 * of this diff is a Svelte `$state` class, whose fields compile to accessors on the PROTOTYPE. A
 * spread copies own enumerable properties only, so `{...view}` is empty and every field comes back
 * undefined — which is precisely what shipped for one commit, and what the e2e caught.
 */
function read(cfg: EditableFields, key: (typeof EDITABLE)[number]): unknown {
	const value = cfg[key];
	return value === undefined ? FALLBACKS[key] : value;
}

/**
 * How this environment differs from the one it was created as. Only the ones that MOVED, because
 * a diff is what someone actually needs to read: "same as the baseline, but three adversaries."
 *
 * Takes the REACTIVE view, not the raw world: a world is `$state.raw` and mutating its cfg wakes
 * nothing, so a card deriving its overrides from `world.cfg` would simply never update. (It did
 * not, and the e2e caught it.)
 */
export function configDiff(cfg: EditableFields, baseline: EditableFields): Record<string, unknown> {
	const diff: Record<string, unknown> = {};
	for (const key of EDITABLE) {
		const mine = read(cfg, key);
		if (JSON.stringify(mine) !== JSON.stringify(read(baseline, key))) diff[key] = mine;
	}
	return diff;
}

/** The full manifest, as JSON — what "copy config" hands over. */
export function manifest(
	configs: WorldConfig[],
	seed: number | null,
	episodes: number
): Record<string, unknown> {
	return {
		lab: 'darwin-lab',
		config: configHash(configs),
		// null means "unseeded" — the run is NOT reproducible, and saying so is the honest thing
		seed,
		episodes,
		environments: configs.map((cfg) => ({
			name: cfg.name,
			observations: cfg.senses,
			...Object.fromEntries(MEANINGFUL.filter((k) => k !== 'senses').map((k) => [k, cfg[k]]))
		}))
	};
}
