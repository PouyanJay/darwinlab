/**
 * The Atlas's one notebook door, shared by the workspace's exports row and the drill card — one
 * builder, so the two buttons can never shape the Q4 evidence differently. The finding is the whole
 * landscape's answer (the cliff, or the honest "no sharp threshold"), carried as the X-marginal
 * strip the Report's Q4 draws.
 */

import { landscape, app, findings } from '$lib/state';
import { configHash } from '$lib/lab/run';
import { xMarginal } from '$lib/lab/landscape';

export function addLandscapeFinding(): void {
	const field = landscape.field;
	if (!field) return;
	const falloff = landscape.falloff;
	findings.add({
		source: 'atlas',
		variant: '',
		title: falloff
			? `Cliff at ${field.axisX.format(falloff.x)}`
			: `No sharp threshold in ${field.axisX.label}`,
		detail: falloff
			? `survival drops ${falloff.drop.toFixed(1)}s across the step`
			: `survival holds ${field.min.toFixed(1)}–${field.max.toFixed(1)}s across the plane`,
		status: 'ok',
		seeds: landscape.receipt?.seeds ?? landscape.seeds,
		configHash: configHash([app.subjectBase('Atlas')]),
		evidence: {
			kind: 'landscape',
			axisLabel: field.axisX.label,
			axisKey: field.axisX.key,
			band: xMarginal(field),
			cliffX: falloff?.x
		}
	});
}
