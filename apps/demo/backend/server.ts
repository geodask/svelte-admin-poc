// The demo backend: a small REST server over in-memory seed data, speaking the convention of
// the bundled REST Provider. Start it with `bun backend/server.ts` from `apps/demo`.
//
//   GET  /{resource}?page=&perPage=&q=
//                                     one page: { data, total }, or { data, hasNextPage } for
//                                     posts, which stand in for a backend that can't count. q
//                                     searches recipes by their text Fields and users by name
//                                     and email; posts can't be searched, and q for them is a 400
//   GET  /{resource}/{id}             one record, or a 404. The id is one path segment, decoded,
//                                     and matched against each record's id written as text
//   POST /{resource}                  create a record from the JSON body, with the next id (the
//                                     highest plus one) and the Fields only the backend sets
//                                     (recipes' sourceId, reviewCount and internalNotes, posts'
//                                     viewCount), whatever the body says; answers 201 with the
//                                     created record. A user
//                                     whose email is already taken is a 422 with an issue on email
//   PUT  /{resource}/{id}             replace a record's editable Fields with the JSON body, keeping
//                                     its id and the Fields no edit can set (the backend's own, and
//                                     users' email, set once on create); a Field missing from the
//                                     body is removed. Answers with the saved record, or a 404
//   DELETE /{resource}/{id}           delete a record: a 204, or a 404
//   DELETE /posts?id=1&id=2           delete many posts at once, all or nothing: a 204, or a 404
//                                     (deleting none) when any id names no post, or a 400 with no
//                                     id. Only posts have this bulk route
//   POST /reset                       restore the seed data and clear any faults (e2e tests call
//                                     it first)
//   POST /faults                      test-only: make the next resource request(s) slow or fail.
//                                     The JSON body is a Fault (config.ts). Faults queue up, and each
//                                     one is used by the next resource request that matches it
//                                     (its path and method, when it names them)
//   GET  /requests                    every resource request since the server started, writes too,
//                                     so a test can check that the Provider was or wasn't called. Reset
//                                     keeps it, since tests run in parallel against one backend:
//                                     a test finds its own requests by a page no other test asks
//                                     for
import { BACKEND_PORT, type Fault } from './config.ts';
import * as seed from './seed.ts';

type Records = { id: number | string }[];

function fresh(): Record<string, Records> {
	return {
		recipes: structuredClone(seed.recipes),
		posts: structuredClone(seed.posts),
		users: structuredClone(seed.users)
	};
}

/** The Resources answered with `hasNextPage` instead of `total`. */
const uncounted = new Set(['posts']);

/** The Resources with a bulk delete route, `DELETE /{resource}?id=1&id=2`. */
const bulkDeletable = new Set(['posts']);

/**
 * The Fields only the backend sets, which no form sends, and their values for a record created
 * with `id`. A POST sets them, and a PUT keeps them as they are. (The id is always the
 * backend's.)
 */
const backendOwned: Record<string, (id: number) => Record<string, unknown>> = {
	recipes: (id) => ({
		reviewCount: 0,
		sourceId: `local-${id}`,
		internalNotes: 'Created in the admin'
	}),
	posts: () => ({ viewCount: 0 })
};

/** The Fields a PUT keeps as they are, since no edit can set them: the backend's own, and more. */
const keptOnUpdate: Record<string, string[]> = {
	recipes: ['reviewCount', 'sourceId', 'internalNotes'],
	posts: ['viewCount'],
	// Set once on create.
	users: ['email']
};

/**
 * The rules only the backend can check for a new record, by Resource: each returns the issues
 * a POST is answered with (a 422), or none.
 */
const createRules: Record<
	string,
	(body: Record<string, unknown>, records: Records) => { path: string[]; message: string }[]
> = {
	users: (body, records) => {
		const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
		const taken = records.some(
			(record) => String((record as { email?: unknown }).email).toLowerCase() === email
		);
		return email !== undefined && taken
			? [{ path: ['email'], message: 'A user with this email already exists' }]
			: [];
	}
};

/** The text Fields `q` is matched against, for each Resource that can be searched. */
const searchFields: Record<string, string[]> = {
	recipes: ['name', 'cuisine', 'instructions'],
	users: ['name', 'email']
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
let faults: Fault[] = [];
const requests: string[] = [];

/** The first queued fault for this request's method and pathname, used up by it. */
function takeFault(method: string, pathname: string): Fault | undefined {
	const fault = faults.find(
		(f) =>
			(f.path === undefined || f.path === pathname) &&
			(f.method === undefined || f.method.toUpperCase() === method)
	);
	if (fault === undefined) return undefined;
	fault.times = (fault.times ?? 1) - 1;
	if (fault.times <= 0) faults = faults.filter((f) => f !== fault);
	return fault;
}

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

/** A path segment, decoded (`..%2Fusers%2F1` is the id `../users/1`), or `undefined` if malformed. */
function decodeSegment(segment: string): string | undefined {
	try {
		return decodeURIComponent(segment);
	} catch {
		return undefined;
	}
}

const server = Bun.serve({
	port: Number(process.env.PORT ?? BACKEND_PORT),
	async fetch(request) {
		const url = new URL(request.url);
		const segments = url.pathname.split('/').filter(Boolean);

		if (request.method === 'POST' && url.pathname === '/reset') {
			db = fresh();
			faults = [];
			return new Response(null, { status: 204 });
		}

		if (request.method === 'POST' && url.pathname === '/faults') {
			faults.push((await request.json()) as Fault);
			return new Response(null, { status: 204 });
		}

		if (request.method === 'GET' && url.pathname === '/requests') {
			return json(requests);
		}

		requests.push(`${request.method} ${url.pathname}${url.search}`);

		const fault = takeFault(request.method, url.pathname);
		if (fault?.delayMs) await Bun.sleep(fault.delayMs);
		if (fault?.status) {
			return json(fault.body ?? { message: fault.message ?? 'Injected failure' }, fault.status);
		}

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

		if (request.method === 'POST' && segments.length === 1 && Object.hasOwn(db, segments[0])) {
			const records = db[segments[0]];
			const body: unknown = await request.json().catch(() => undefined);
			if (typeof body !== 'object' || body === null || Array.isArray(body)) {
				return json({ message: 'The body must be a JSON object' }, 400);
			}
			const issues = createRules[segments[0]]?.(body as Record<string, unknown>, records) ?? [];
			if (issues.length > 0) return json({ issues }, 422);
			// Every demo Resource has number ids, so the next one is the highest plus one.
			const id = Math.max(0, ...records.map((record) => Number(record.id))) + 1;
			const record = { ...body, ...backendOwned[segments[0]]?.(id), id };
			records.push(record);
			return json(record, 201);
		}

		if (request.method === 'PUT' && segments.length === 2 && Object.hasOwn(db, segments[0])) {
			const name = segments[0];
			const id = decodeSegment(segments[1]);
			const index = db[name].findIndex((r) => String(r.id) === id);
			if (index === -1) return json({ message: 'Not found' }, 404);
			const body: unknown = await request.json().catch(() => undefined);
			if (typeof body !== 'object' || body === null || Array.isArray(body)) {
				return json({ message: 'The body must be a JSON object' }, 400);
			}
			const current = db[name][index] as Record<string, unknown> & Records[number];
			const kept = Object.fromEntries(
				(keptOnUpdate[name] ?? []).filter((key) => key in current).map((key) => [key, current[key]])
			);
			const record = { ...body, ...kept, id: current.id };
			db[name][index] = record;
			return json(record);
		}

		if (request.method === 'DELETE' && segments.length === 1 && bulkDeletable.has(segments[0])) {
			const name = segments[0];
			const ids = new Set(url.searchParams.getAll('id'));
			if (ids.size === 0) return json({ message: 'Name at least one id' }, 400);
			const kept = db[name].filter((r) => !ids.has(String(r.id)));
			if (db[name].length - kept.length !== ids.size) return json({ message: 'Not found' }, 404);
			db[name] = kept;
			return new Response(null, { status: 204 });
		}

		if (request.method === 'DELETE' && segments.length === 2 && Object.hasOwn(db, segments[0])) {
			const name = segments[0];
			const id = decodeSegment(segments[1]);
			const index = db[name].findIndex((r) => String(r.id) === id);
			if (index === -1) return json({ message: 'Not found' }, 404);
			db[name].splice(index, 1);
			return new Response(null, { status: 204 });
		}

		if (request.method === 'GET' && segments.length === 2 && Object.hasOwn(db, segments[0])) {
			const id = decodeSegment(segments[1]);
			const record = db[segments[0]].find((r) => String(r.id) === id);
			if (record) return json(record);
		}

		return json({ message: 'Not found' }, 404);
	}
});

console.log(`Demo backend listening on ${server.url}`);
