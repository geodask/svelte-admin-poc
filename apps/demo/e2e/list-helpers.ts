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

/** The column header of the list View's table for a Field, by its label. */
export const columnHeader = (page: Page, label: string) =>
	page.getByRole('columnheader', { name: label, exact: true });

/** The link in a sortable Field's column header, which sorts the list by it. */
export const sortLink = (page: Page, label: string) =>
	columnHeader(page, label).getByRole('link', { name: label, exact: true });

/** The arrow a sorted column's header shows for its direction. */
export const sortArrow = (page: Page, label: string, order: 'asc' | 'desc') =>
	columnHeader(page, label).locator(
		order === 'asc' ? 'svg.lucide-arrow-up' : 'svg.lucide-arrow-down'
	);

/** The cells of one column of the list View's table, by its header's label, in row order. */
export async function columnCells(page: Page, label: string) {
	const labels = await page.getByRole('columnheader').allInnerTexts();
	const index = labels.findIndex((text) => text.trim() === label);
	if (index === -1) throw new Error(`No column "${label}" among ${JSON.stringify(labels)}`);
	return dataRows(page).locator(`td:nth-child(${index + 1})`);
}

/**
 * Add a value to a devalue array and return its index. A plain object maps each key to the
 * index of its value, and an array holds the indexes of its items; strings, numbers and
 * booleans are stored as they are.
 */
function addNode(nodes: unknown[], value: unknown): number {
	if (Array.isArray(value)) {
		const index = nodes.push(null) - 1;
		nodes[index] = value.map((item) => addNode(nodes, item));
		return index;
	}
	if (typeof value === 'object' && value !== null) {
		const index = nodes.push(null) - 1;
		nodes[index] = Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, addNode(nodes, item)])
		);
		return index;
	}
	return nodes.push(value) - 1;
}

/**
 * Re-encode a captured `getList` remote query payload with some args changed: a change to
 * `undefined` leaves that arg out. A payload is Kit's url-safe base64 of a devalue array, where
 * an object maps each key to the index of its value.
 */
function withArgs(payload: string, changes: Record<string, unknown>): string {
	const nodes = JSON.parse(Buffer.from(payload, 'base64url').toString()) as unknown[];
	const args = nodes.find(
		(node): node is Record<string, number> =>
			typeof node === 'object' && node !== null && !Array.isArray(node) && 'perPage' in node
	);
	if (!args) throw new Error(`No list params in the payload ${JSON.stringify(nodes)}`);
	for (const [key, value] of Object.entries(changes)) {
		if (value === undefined) delete args[key];
		else args[key] = addNode(nodes, value);
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
	const log = await backendLog(request);
	return log.filter(
		(line) => new URL(line.split(' ')[1], BACKEND_URL).searchParams.get('page') === String(page)
	);
}

/** The demo backend's request log so far: one line per request, e.g. `GET /recipes?page=1`. */
export async function backendLog(request: APIRequestContext): Promise<string[]> {
	return (await (await request.get(`${BACKEND_URL}/requests`)).json()) as string[];
}

/**
 * The requests the demo backend receives while `act` runs. Tests run in parallel, so it may
 * hold other tests' requests too: check it with `toContain`, never `toEqual`, for a request no
 * other test sends (e.g. at a page size no other test asks for).
 */
export async function backendRequestsDuring(request: APIRequestContext, act: () => Promise<void>) {
	const before = (await backendLog(request)).length;
	await act();
	return (await backendLog(request)).slice(before);
}
