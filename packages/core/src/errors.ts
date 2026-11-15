// The Provider errors: what a Provider throws to say how an operation failed. Each one reaches
// the user with its meaning and its HTTP status (`serveResource` serves it), so its message is
// shown to the user: keep upstream URLs, ids and backend text out of it. Anything else a Provider
// throws is an unexpected error: it is logged on the server and the user sees only a generic
// message.

/** What every Provider error shares: a message safe to show, and the status it is served with. */
export abstract class ProviderError extends Error {
	abstract readonly status: 400 | 404 | 409 | 422;
}

/** The record doesn't exist (or the backend has no such Resource). Served as a 404. */
export class NotFoundError extends ProviderError {
	override name = 'NotFoundError';
	readonly status = 404;
	constructor(message = 'Not found', options?: ErrorOptions) {
		super(message, options);
	}
}

/** The backend rejected what it was asked for as invalid. Served as a 400. */
export class InvalidInputError extends ProviderError {
	override name = 'InvalidInputError';
	readonly status = 400;
	constructor(message = 'Invalid input', options?: ErrorOptions) {
		super(message, options);
	}
}

/** The operation clashes with the record's current state, e.g. a duplicate. Served as a 409. */
export class ConflictError extends ProviderError {
	override name = 'ConflictError';
	readonly status = 409;
	constructor(message = 'Conflict', options?: ErrorOptions) {
		super(message, options);
	}
}

/**
 * One rule only the backend can check, broken by one Field: the Field's key path (e.g.
 * `['email']`, or `['ingredients', 2, 'name']` for a Field of a row) and the message to show
 * under its input.
 */
export type FieldIssue = { path: (string | number)[]; message: string };

/**
 * The backend rejected a save because of one or more Fields, e.g. a name that is already taken.
 * Each issue shows under the input its path names, exactly where a schema issue would, and the
 * user keeps what they typed. An issue whose path names no input the form shows (or an empty
 * path) shows at the top of the form instead. Its messages reach the user, so keep them safe to
 * show. Meant for `create` and `update`; from a read it is served as a 422.
 *
 * @example
 * throw new FieldError({ path: ['email'], message: 'A user with this email already exists' });
 */
export class FieldError extends ProviderError {
	override name = 'FieldError';
	readonly status = 422;
	readonly issues: readonly FieldIssue[];
	constructor(issues: FieldIssue | readonly FieldIssue[], options?: ErrorOptions) {
		const list = Array.isArray(issues) ? [...issues] : [issues as FieldIssue];
		if (list.length === 0) throw new TypeError('A FieldError needs at least one issue');
		super(list.map((issue) => issue.message).join('\n'), options);
		this.issues = list.map(({ path, message }) => ({ path: [...path], message }));
	}
}
