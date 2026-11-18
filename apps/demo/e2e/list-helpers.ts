import { readFile } from 'node:fs/promises';
import type { APIRequestContext, Page } from '@playwright/test';
import { BACKEND_URL } from '../backend/config.ts';
import { expect, hydrated, test } from './fixtures.ts';

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

/** The Name cell of each recipe row: the third cell, after the selection checkbox and the ID. */
export const names = (page: Page) => dataRows(page).locator('td:nth-child(3)');

/** The toolbar's "Filters" disclosure, which shows the count of filters on. */
export const filtersToggle = (page: Page) => page.locator('summary', { hasText: 'Filters' });

/** The filter panel's form. */
export const filterForm = (page: Page) => page.getByRole('form', { name: 'Filters' });

/** Open the filter panel, unless it is open already (with JavaScript it stays open after Apply). */
export async function openFilters(page: Page) {
	if (!(await filterForm(page).isVisible())) await filtersToggle(page).click();
	await expect(filterForm(page)).toBeVisible();
}

/** Open the filter panel, set its controls with `choose`, and apply them. */
export async function applyFilters(
	page: Page,
	choose: (form: ReturnType<typeof filterForm>) => Promise<void>
) {
	await openFilters(page);
	await choose(filterForm(page));
	await filterForm(page).getByRole('button', { name: 'Apply' }).click();
}

/** Whether the current test runs with JavaScript on. */
export const isJs = () => test.info().project.name === 'js';

/**
 * Expect the URL a filter form lands on: with JavaScript, the clean one; without, the same params
 * plus the empty ones the form posts for the controls left blank (or at "Any"), wherever they fall.
 */
export async function expectLanded(page: Page, clean: string) {
	if (isJs()) return expect(page).toHaveURL(clean);
	const sorted = (url: URL) => {
		const params = new URLSearchParams([...url.searchParams].filter(([, value]) => value !== ''));
		params.sort();
		return `${url.pathname}?${params}`;
	};
	await expect(page).toHaveURL((url) => sorted(url) === sorted(new URL(clean, url)));
}

/** The toolbar's export button, whatever it reads ("Export CSV", "Exporting…", "Try again"). */
export const exportButton = (page: Page) =>
	page.getByRole('button', { name: /^(Export CSV|Exporting…|Try again)$/ });

/**
 * The rows of a CSV file as the admin writes it: a byte order mark, then every cell quoted, with
 * `"` doubled, and every row ending in CRLF. It fails on anything else, so a test also checks
 * the format.
 */
export function parseCsv(text: string): string[][] {
	expect(text.startsWith('\uFEFF'), 'starts with a byte order mark').toBe(true);
	const rows: string[][] = [];
	const cell = /"((?:[^"]|"")*)"(,|\r\n)/y;
	let row: string[] = [];
	// After the byte order mark, cell after cell, up to the end of the text.
	let end = 1;
	cell.lastIndex = end;
	for (let match = cell.exec(text); match !== null; match = cell.exec(text)) {
		end = cell.lastIndex;
		row.push(match[1].replaceAll('""', '"'));
		if (match[2] === '\r\n') {
			rows.push(row);
			row = [];
		}
	}
	expect(end, 'every cell is quoted and every row ends with CRLF').toBe(text.length);
	return rows;
}

/**
 * Click the export button and wait for the file it downloads: its suggested name and its rows
 * (see `parseCsv`), the header row first.
 */
export async function exportCsv(page: Page) {
	await hydrated(page);
	const download = page.waitForEvent('download');
	await exportButton(page).click();
	const file = await download;
	const text = await readFile((await file.path()) ?? '', 'utf8');
	return { filename: file.suggestedFilename(), rows: parseCsv(text) };
}

/** One column of exported rows, by its header. */
export function csvColumn(rows: string[][], header: string): string[] {
	const [headers = [], ...records] = rows;
	const index = headers.indexOf(header);
	if (index === -1) throw new Error(`No column "${header}" among ${JSON.stringify(headers)}`);
	return records.map((record) => record[index]);
}
