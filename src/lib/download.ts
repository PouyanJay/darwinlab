/**
 * Save some text as a file — the browser-only "download this" gesture, one place so the Ledger's JSON
 * export and the Report's Markdown export share it rather than each hand-rolling a Blob and an anchor.
 */
export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
	const blob = new Blob([text], { type: mime });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}
