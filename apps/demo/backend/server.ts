// The demo backend: a small REST server over in-memory seed data, speaking the convention of
// the bundled REST Provider. Start it with `bun backend/server.ts` from `apps/demo`.
//
//   GET  /{resource}?page=&perPage=   one page: { data, total }
//   POST /reset                       restore the seed data (e2e tests call it first)
import { BACKEND_PORT } from './config.ts';
import * as seed from './seed.ts';

type Collection = { id: number | string }[];

function fresh(): Record<string, Collection> {
	return { recipes: structuredClone(seed.recipes) };
}

let db = fresh();

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

		if (request.method === 'GET' && segments.length === 1 && Object.hasOwn(db, segments[0])) {
			const records = db[segments[0]];
			const page = positiveInt(url, 'page', 1);
			const perPage = positiveInt(url, 'perPage', 25);
			if (page === null || perPage === null) {
				return json({ message: 'page and perPage must be positive integers' }, 400);
			}
			const start = (page - 1) * perPage;
			return json({ data: records.slice(start, start + perPage), total: records.length });
		}

		return json({ message: 'Not found' }, 404);
	}
});

console.log(`Demo backend listening on ${server.url}`);
