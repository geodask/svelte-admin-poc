// The demo backend: a small REST server over in-memory seed data, speaking the convention of
// the bundled REST Provider. Start it with `bun backend/server.ts` from `apps/demo`.
//
//   GET  /{resource}?page=&perPage=   one page: { data, total }, or { data, hasNextPage } for
//                                     posts, which stand in for a backend that can't count
//   POST /reset                       restore the seed data and clear the request log
//                                     (e2e tests call it first)
//   GET  /requests                    the resource requests since the last reset, so a test can
//                                     check that the Provider was or wasn't called
import { BACKEND_PORT } from './config.ts';
import * as seed from './seed.ts';

type Records = { id: number | string }[];

function fresh(): Record<string, Records> {
	return { recipes: structuredClone(seed.recipes), posts: structuredClone(seed.posts) };
}

/** The Resources answered with `hasNextPage` instead of `total`. */
const uncounted = new Set(['posts']);

let db = fresh();
let requests: string[] = [];

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
			requests = [];
			return new Response(null, { status: 204 });
		}

		if (request.method === 'GET' && url.pathname === '/requests') {
			return json(requests);
		}

		requests.push(`${request.method} ${url.pathname}${url.search}`);

		if (request.method === 'GET' && segments.length === 1 && Object.hasOwn(db, segments[0])) {
			const name = segments[0];
			const records = db[name];
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
