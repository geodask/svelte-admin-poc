// The Provider errors: what a Provider throws to say how an operation failed. Each one reaches
// the user with its meaning and its HTTP status (`serveResource` serves it), so its message is
// shown to the user: keep upstream URLs, ids and backend text out of it. Anything else a Provider
// throws is an unexpected error: it is logged on the server and the user sees only a generic
// message.

/** What every Provider error shares: a message safe to show, and the status it is served with. */
export abstract class ProviderError extends Error {
	abstract readonly status: 400 | 404 | 409;
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
