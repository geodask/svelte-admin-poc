// The demo backend: a small REST server over in-memory seed data, speaking the convention of
// the bundled REST Provider. Start it with `bun backend/server.ts` from `apps/demo`.
//
//   GET  /{resource}?page=&perPage=&q=
//                                     one page: { data, total }, or { data, hasNextPage } for
//                                     posts, which stand in for a backend that can't count. q
//                                     searches recipes by their text Fields; posts can't be
//                                     searched, and q for them is a 400
//   POST /reset                       restore the seed data (e2e tests call it first)
//   GET  /requests                    every resource request since the server started, so a test
//                                     can check that the Provider was or wasn't called. Reset
//                                     keeps it, since tests run in parallel against one backend:
//                                     a test finds its own requests by a page no other test asks
//                                     for
import { BACKEND_PORT } from './config.ts';
import * as seed from './seed.ts';

type Records = { id: number | string }[];

function fresh(): Record<string, Records> {
	return { recipes: structuredClone(seed.recipes), posts: structuredClone(seed.posts) };
}

/** The Resources answered with `hasNextPage` instead of `total`. */
const uncounted = new Set(['posts']);

/** The text Fields `q` is matched against, for each Resource that can be searched. */
const searchFields: Record<string, string[]> = {
	recipes: ['name', 'cuisine', 'instructions']
};

/** The records whose search Fields contain `q`, ignoring case and surrounding spaces. */
function search(records: Records, fields: string[], q: string): Records {
	const needle = q.trim().toLowerCase();
	return records.filter((record) =>
		fields.some((key) => {
			const value = (record as Record<string, unknown>)[key];
			return typeof value === 'string' && value.toLowerCase().includes(needle);
		})
	);
}

let db = fresh();
const requests: string[] = [];

function json(body: unknown, status = 200) {
	return Response.json(body, { status });
}

/** A positive integer query param, or `fallback` when it is missing. `null` when invalid. */
function positiveInt(url: URL, key: string, fallback: number): number | null {
	const raw = url.searchParams.get(key);
	if (raw === null) return fallback;
	const value = Number(raw);
	return Number.isInteger(value) && value >= 1 ? value : null;
}

const server = Bun.serve({
	port: Number(process.env.PORT ?? BACKEND_PORT),
	fetch(request) {
		const url = new URL(request.url);
		const segments = url.pathname.split('/').filter(Boolean);

		if (request.method === 'POST' && url.pathname === '/reset') {
			db = fresh();
			return new Response(null, { status: 204 });
		}

		if (request.method === 'GET' && url.pathname === '/requests') {
			return json(requests);
		}

		requests.push(`${request.method} ${url.pathname}${url.search}`);

		if (request.method === 'GET' && segments.length === 1 && Object.hasOwn(db, segments[0])) {
			const name = segments[0];
			let records = db[name];
			const q = url.searchParams.get('q');
			if (q !== null) {
				if (!Object.hasOwn(searchFields, name)) {
					return json({ message: `${name} cannot be searched` }, 400);
				}
				records = search(records, searchFields[name], q);
			}
			const page = positiveInt(url, 'page', 1);
			const perPage = positiveInt(url, 'perPage', 25);
			if (page === null || perPage === null) {
				return json({ message: 'page and perPage must be positive integers' }, 400);
			}
			const start = (page - 1) * perPage;
			const data = records.slice(start, start + perPage);
			if (uncounted.has(name)) return json({ data, hasNextPage: start + perPage < records.length });
			return json({ data, total: records.length });
		}

		return json({ message: 'Not found' }, 404);
	}
});

console.log(`Demo backend listening on ${server.url}`);
