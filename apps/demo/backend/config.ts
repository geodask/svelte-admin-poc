// Where the demo backend listens. The demo app's server code, the e2e tests and the client
// bundle guard all read it from here.
export const BACKEND_PORT = 4100;
export const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

/**
 * A test-only fault for the demo backend's next resource request(s), sent as the body of
 * `POST /faults`: wait `delayMs` first, then (with a `status`) answer with that status and
 * `{ message }` (or `body`, when given) instead of the records. `path`, when given, limits it to requests for that
 * pathname (e.g. `/recipes`), and `method` to requests with that method (e.g. `PUT`, so the
 * edit View's own read of the record isn't the one that fails). It is used by `times` requests
 * (default 1). Reset clears it.
 */
export type Fault = {
	status?: number;
	message?: string;
	body?: unknown;
	delayMs?: number;
	path?: string;
	method?: string;
	times?: number;
};
