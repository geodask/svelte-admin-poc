// Where the demo backend listens. The demo app's server code, the e2e tests and the client
// bundle guard all read it from here.
export const BACKEND_PORT = 4100;
export const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

/**
 * A test-only fault for the demo backend's next resource request(s), sent as the body of
 * `POST /faults`: wait `delayMs` first, then (with a `status`) answer with that status and
 * `{ message }` instead of the records. `path`, when given, limits it to requests for that
 * pathname (e.g. `/recipes`). It is used by `times` requests (default 1). Reset clears it.
 */
export type Fault = {
	status?: number;
	message?: string;
	delayMs?: number;
	path?: string;
	times?: number;
};
