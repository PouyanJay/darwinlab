/**
 * CSV plumbing shared by the instruments' exports — one escaper, so the Sweep's and the Atlas's
 * files can never quote differently.
 */

/** Escape one CSV field — quotes doubled, wrapped when the text needs it. */
export function csvField(value: string | number): string {
	const text = String(value);
	return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
