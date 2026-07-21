import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadText } from './download';

/**
 * The shared "save this text as a file" primitive, in a real browser (so Blob / URL.createObjectURL /
 * an anchor all exist). It backs BOTH the Report's Markdown export and the Ledger's JSON export, and
 * neither call site had a source-level test — a regression in filename, mime or content would slip
 * past. We spy the two side effects it has no business doing for real in a test (minting an object URL,
 * clicking a link) and assert the file it hands the browser.
 */
describe('downloadText', () => {
	afterEach(() => vi.restoreAllMocks());

	/** Capture the Blob and the anchor without actually downloading anything. The click spy records the
	 *  anchor as its `this` (mock.instances), so we read it back rather than aliasing `this` ourselves. */
	function intercept() {
		const blobs: Blob[] = [];
		const revoked: string[] = [];
		vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
			blobs.push(blob as Blob);
			return 'blob:fake-url';
		});
		vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
			revoked.push(url);
		});
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		return {
			blobs,
			revoked,
			get anchor(): HTMLAnchorElement | null {
				return (clickSpy.mock.instances[0] as HTMLAnchorElement) ?? null;
			}
		};
	}

	it('hands the browser a named file with the given text and mime, then frees the url', async () => {
		const spy = intercept();

		downloadText('darwin-lab-report.md', '# Research report', 'text/markdown');

		expect(spy.anchor).not.toBeNull();
		expect(spy.anchor!.download).toBe('darwin-lab-report.md'); // the filename the user gets
		expect(spy.anchor!.getAttribute('href')).toBe('blob:fake-url'); // pointed at the minted blob
		expect(spy.blobs).toHaveLength(1);
		expect(spy.blobs[0].type).toBe('text/markdown');
		expect(await spy.blobs[0].text()).toBe('# Research report'); // the actual bytes
		expect(spy.revoked).toEqual(['blob:fake-url']); // no leaked object URL
	});

	it('defaults the mime to text/plain when the caller omits it', () => {
		const spy = intercept();
		downloadText('notes.txt', 'hello');
		expect(spy.blobs[0].type).toBe('text/plain');
	});
});
