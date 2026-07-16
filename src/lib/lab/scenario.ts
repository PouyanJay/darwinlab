/**
 * The scenario layer — what makes this an agent sandbox rather than a fish game.
 *
 * The lab's vocabulary is generic and permanent: there are AGENTS with a POLICY and an
 * OBSERVATION SPACE, an ADVERSARY, an ENVIRONMENT, and EPISODES. A scenario BINDS those roles to
 * the concrete thing a particular experiment is made of — here, agents are fish and the adversary
 * is a shark. Add a foraging or maze lab later and only the binding changes; every panel, readout
 * and metric keeps working, because none of them knows what a fish is.
 *
 * The UI leads with the generic term and shows the binding beside it ("AGENTS · fish"), so it
 * always reads as an instrument pointed at an example, never as the example itself.
 */

/** One role in the lab, and what this scenario calls it. */
export interface RoleBinding {
	/** What the LAB calls it — stable across every scenario. */
	generic: string;
	/** What THIS scenario calls it. */
	one: string;
	many: string;
}

/** One observation channel: what the lab calls it, and what it means in this scenario. */
export interface ObservationBinding {
	/** The engine's sense key — the thing that is actually ablated. */
	key: 'dist' | 'dir' | 'closing' | 'walls' | 'speed' | 'cohesion' | 'align';
	/** Short label for a chip. */
	short: string;
	/** What the lab calls this channel, scenario-independent. */
	generic: string;
	/** What it is, in this scenario's terms. */
	binding: string;
}

export interface Scenario {
	id: string;
	/** "Lab 01" — the slot, so a bench of several scenarios reads as a suite. */
	index: string;
	name: string;
	/** One line: what question this scenario is an instrument for. */
	question: string;
	agent: RoleBinding;
	adversary: RoleBinding;
	environment: RoleBinding;
	episode: RoleBinding;
	policy: RoleBinding;
	/** What "return" means here — the scalar selection maximises. */
	objective: string;
	observations: ObservationBinding[];
	/**
	 * The POLICY MAP — the agent's policy swept over the adversary's relative position and painted as
	 * one readable disc. Generic across scenarios (a maze lab would sweep the goal's position instead);
	 * these are the words THIS scenario gives it. `name` titles the panel and its toggle segment.
	 */
	policyMap: {
		name: string;
		/** The one-line description under the heading, in this scenario's terms. */
		caption: string;
	};
}

/**
 * Lab 01 — the only scenario so far. Everything the UI says about "fish" and "sharks" comes from
 * here, which is what makes the next scenario a data change rather than a rewrite.
 */
export const PREDATOR_PREY: Scenario = {
	id: 'predator-prey',
	index: 'Lab 01',
	name: 'Predator & Prey',
	question: 'What is a sense worth, when the world decides whether it can be used?',
	agent: { generic: 'agents', one: 'fish', many: 'fish' },
	adversary: { generic: 'adversary', one: 'shark', many: 'sharks' },
	environment: { generic: 'environment', one: 'tank', many: 'tanks' },
	episode: { generic: 'episode', one: 'generation', many: 'generations' },
	policy: { generic: 'policy', one: 'brain', many: 'brains' },
	objective: 'seconds survived',
	observations: [
		{
			key: 'dist',
			short: 'dist',
			generic: 'range to adversary',
			binding: 'how close the shark is'
		},
		{
			key: 'dir',
			short: 'dir',
			generic: 'bearing to adversary',
			binding: 'which way the shark is'
		},
		{
			key: 'closing',
			short: 'close',
			generic: 'closing rate',
			binding: 'how fast it is gaining'
		},
		{ key: 'walls', short: 'walls', generic: 'boundary rays', binding: 'how near the glass is' },
		{
			key: 'cohesion',
			short: 'shoal',
			generic: 'neighbour field',
			binding: 'where the other fish are'
		},
		{
			key: 'align',
			short: 'align',
			generic: 'neighbour heading',
			binding: 'which way the shoal points'
		}
	],
	policyMap: {
		name: 'Escape map',
		caption: 'what it does at every shark position'
	}
};

/** The scenario the bench is currently pointed at. One today; a registry when there are more. */
export const SCENARIO: Scenario = PREDATOR_PREY;

/**
 * Episodes the bench evolves before the first paint, so it opens on competent agents rather than
 * on twenty random ones being eaten. It lives here, not in the page, because RELAUNCHING a run
 * has to reproduce the opening exactly — and a prewarm the relaunch did not know about would make
 * the manifest a lie.
 */
export const PREWARM_GENERATIONS = 15;
