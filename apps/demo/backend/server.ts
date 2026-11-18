// The demo backend: a small REST server over in-memory seed data, speaking the convention of
// the bundled REST Provider. Start it with `bun backend/server.ts` from `apps/demo`.
//
//   GET  /{resource}?page=&perPage=&sort=&order=&q=&{field}=
//                                     one page: { data, total }, or { data, hasNextPage } for
//                                     posts, which stand in for a backend that can't count. Any
//                                     other param filters any Resource by the Field it names:
//                                     bare, the Field's value written as text equals it exactly
//                                     (eq); repeated, equals one of them (in). With a suffix:
//                                     `name.contains=piz` holds the text, ignoring case;
//                                     `.lt`, `.lte`, `.gt` and `.gte` compare numbers as numbers
//                                     and text (ISO dates) as text. A record without the value
//                                     matches none of them. Any other suffix, or a range bound
//                                     that is no number on a number Field, is a 400. Every
//                                     filter must match (AND). sort
//                                     names any Field to sort by, with order asc (the default) or
//                                     desc (anything else is a 400): numbers as numbers, text and
//                                     ISO dates with a locale compare, stable, and records without
//                                     a value last either way. q searches recipes by their text
//                                     Fields and users by name and email; posts can't be
//                                     searched, and q for them is a 400. The filters and the sort
//                                     apply before the search and the paging. A filter on id works
//                                     the same way, so `id=1&id=2&perPage=2` (the REST Provider's
//                                     getMany) answers the records with those ids, leaving out the
//                                     ids that name none
//   GET  /{resource}/{id}             one record, or a 404. The id is one path segment, decoded,
//                                     and matched against each record's id written as text
//   POST /{resource}                  create a record from the JSON body, with the next id (the
//                                     highest plus one) and the Fields only the backend sets
//                                     (recipes' sourceId, reviewCount and internalNotes, posts'
//                                     viewCount), whatever the body says; answers 201 with the
//                                     created record. A user
//                                     whose email is already taken is a 422 with an issue on email,
//                                     and so is a post whose userId names no user, on userId
//   PUT  /{resource}/{id}             replace a record's editable Fields with the JSON body, keeping
//                                     its id and the Fields no edit can set (the backend's own, and
//                                     users' email, set once on create); a Field missing from the
//                                     body is removed. Answers with the saved record, or a 404. A
//                                     post whose userId names no user is a 422 with an issue on it
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
	},
	posts: postRules
};

/** A post's author must be a user: a post whose `userId` names none gets an issue on it. */
function postRules(body: Record<string, unknown>): { path: string[]; message: string }[] {
	return db.users.some((user) => user.id === body.userId)
		? []
		: [{ path: ['userId'], message: 'No user has this id' }];
}

/**
 * The rules only the backend can check for a record a PUT replaces, by Resource: each returns the
 * issues the PUT is answered with (a 422), or none.
 */
const updateRules: Record<
	string,
	(body: Record<string, unknown>) => { path: string[]; message: string }[]
> = {
	posts: postRules
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

/** Compare two values that are both set: numbers as numbers, anything else as text. */
function compareValues(a: unknown, b: unknown): number {
	if (typeof a === 'number' && typeof b === 'number') return a - b;
	return String(a).localeCompare(String(b));
}

/**
 * The records sorted by the Field `key`, ascending or descending. The sort is stable, and
 * records without a value (missing or null) come last in both orders.
 */
function sortBy(records: Records, key: string, order: 'asc' | 'desc'): Records {
	const direction = order === 'desc' ? -1 : 1;
	const valueOf = (record: Records[number]) => (record as Record<string, unknown>)[key];
	return records.toSorted((a, b) => {
		const [x, y] = [valueOf(a), valueOf(b)];
		const [xMissing, yMissing] = [x === undefined || x === null, y === undefined || y === null];
		if (xMissing || yMissing) return Number(xMissing) - Number(yMissing);
		return compareValues(x, y) * direction;
	});
}

/** The list query's own params; any other names a filter. */
const listQueryKeys = new Set(['page', 'perPage', 'sort', 'order', 'q']);

/** The operators a filter param can name with a suffix, and whether a value passes each. */
const suffixOperators: Record<string, (value: unknown, given: string) => boolean | undefined> = {
	contains: (value, given) =>
		typeof value === 'string' && value.toLowerCase().includes(given.toLowerCase()),
	lt: (value, given) => compareBound(value, given, (order) => order < 0),
	lte: (value, given) => compareBound(value, given, (order) => order <= 0),
	gt: (value, given) => compareBound(value, given, (order) => order > 0),
	gte: (value, given) => compareBound(value, given, (order) => order >= 0)
};

/**
 * Whether a record's value passes a range bound: numbers as numbers, text (ISO dates) as text.
 * A missing value passes no bound, and `undefined` means the bound is no number on a number.
 */
function compareBound(
	value: unknown,
	given: string,
	passes: (order: number) => boolean
): boolean | undefined {
	if (typeof value === 'number') {
		const bound = Number(given);
		if (given.trim() === '' || !Number.isFinite(bound)) return undefined;
		return passes(value - bound);
	}
	if (typeof value !== 'string') return false;
	return passes(value < given ? -1 : value > given ? 1 : 0);
}

/**
 * The records that match every filter in the query, or `undefined` when a filter can't be done
 * (an unknown operator suffix, or a range bound that is no number on a number Field), which the
 * caller answers with a 400. A bare param is `eq`, a repeated one `in`: the record's value written
 * as text must be one of the values given, exactly. A param with a suffix (`name.contains`,
 * `prepTimeMinutes.gte`) applies that operator (`suffixOperators`).
 */
function matchingFilters(records: Records, query: URLSearchParams): Records | undefined {
	const tests: ((record: Record<string, unknown>) => boolean | undefined)[] = [];
	for (const param of new Set(query.keys())) {
		if (listQueryKeys.has(param)) continue;
		const dot = param.indexOf('.');
		if (dot === -1) {
			const values = query.getAll(param);
			tests.push((record) => values.includes(String(record[param])));
			continue;
		}
		const [key, operator] = [param.slice(0, dot), param.slice(dot + 1)];
		if (!Object.hasOwn(suffixOperators, operator)) return undefined;
		const given = query.get(param) ?? '';
		tests.push((record) => suffixOperators[operator](record[key], given));
	}
	const matching: Records = [];
	for (const record of records) {
		const results = tests.map((test) => test(record as Record<string, unknown>));
		if (results.includes(undefined)) return undefined;
		if (results.every(Boolean)) matching.push(record);
	}
	return matching;
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
			let records = matchingFilters(db[name], url.searchParams);
			if (records === undefined) {
				return json({ message: 'A filter has an unknown operator or a bad value' }, 400);
			}
			const sort = url.searchParams.get('sort');
			const order = url.searchParams.get('order') ?? 'asc';
			if (order !== 'asc' && order !== 'desc') {
				return json({ message: 'order must be asc or desc' }, 400);
			}
			if (sort !== null) records = sortBy(records, sort, order);
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
			const issues = updateRules[name]?.(body as Record<string, unknown>) ?? [];
			if (issues.length > 0) return json({ issues }, 422);
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
