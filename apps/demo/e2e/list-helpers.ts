import type { APIRequestContext, Page } from '@playwright/test';
import { BACKEND_URL } from '../backend/config.ts';
import { hydrated } from './fixtures.ts';

/** The value shown beside a top-level Field label on the detail View. */
export const valueOf = (page: Page, label: string) =>
	page.locator(`xpath=//dt[normalize-space(text())="${label}"]/following-sibling::dd[1]`).first();

/** The data rows of the list View's table, without its header row. */
export const dataRows = (page: Page) =>
	page
		.getByRole('table')
		.getByRole('row')
		.filter({ has: page.getByRole('cell') });

export const pager = (page: Page) => page.getByRole('navigation', { name: 'Pagination' });

/** The toolbar's count of selected rows, e.g. "2 selected". */
export const selectedCount = (page: Page) => page.getByText(/^\d+ selected$/);

/** Open a Resource's list View from the shell's sidebar, by its label. */
export const openInSidebar = (page: Page, label: string) =>
	page.getByRole('navigation', { name: 'Resources' }).getByRole('link', { name: label }).click();

/**
 * Re-encode a captured `getList` remote query payload with some args changed. A payload is
 * Kit's url-safe base64 of a devalue array, where an object maps each key to the index of its
 * value.
 */
function withArgs(payload: string, changes: Record<string, unknown>): string {
	const nodes = JSON.parse(Buffer.from(payload, 'base64url').toString()) as unknown[];
	const args = nodes.find(
		(node): node is Record<string, number> =>
			typeof node === 'object' && node !== null && !Array.isArray(node) && 'perPage' in node
	);
	if (!args) throw new Error(`No list params in the payload ${JSON.stringify(nodes)}`);
	for (const [key, value] of Object.entries(changes)) {
		args[key] = nodes.push(value) - 1;
	}
	return Buffer.from(JSON.stringify(nodes)).toString('base64url');
}

/**
 * Learn the URL of a list View's `getList` remote query from the browser's own call, made by
 * `navigate`, and return a function that calls it again with some args changed. Kit names
 * remote functions by a hash, so the URL can't be written by hand. It waits for hydration
 * first, since before it a link click is a full page load with no remote call, and it waits for
 * the browser's response, so that call is done before the test goes on (e.g. to reset the
 * backend).
 */
export async function captureGetList(
	page: Page,
	request: APIRequestContext,
	navigate: () => Promise<void>
) {
	await hydrated(page);
	const remoteResponse = page.waitForResponse((r) => r.url().includes('/_app/remote/'));
	await navigate();
	const captured = new URL((await remoteResponse).url());
	const payload = captured.searchParams.get('payload') ?? '';
	return (changes: Record<string, unknown>) =>
		request.get(`${captured.pathname}?payload=${withArgs(payload, changes)}`);
}

/**
 * A page number no other test asks for. Tests run in parallel against one demo backend, so a
 * test that checks the backend's request log asks for this page and looks only at its requests.
 */
export const uniquePage = () => 1000 + Math.floor(Math.random() * 1_000_000_000);

/** The requests the demo backend received for `page`, e.g. `GET /recipes?page=…&perPage=25`. */
export async function backendRequestsFor(request: APIRequestContext, page: number) {
	const log = (await (await request.get(`${BACKEND_URL}/requests`)).json()) as string[];
	return log.filter(
		(line) => new URL(line.split(' ')[1], BACKEND_URL).searchParams.get('page') === String(page)
	);
}
