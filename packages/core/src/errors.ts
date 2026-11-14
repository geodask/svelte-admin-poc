// The errors a Provider throws to say how an operation failed. Each one reaches the user with
// its meaning and an HTTP status (`serveResource` maps them), so its message is shown to the
// user: keep upstream URLs, ids and backend text out of it. Anything else a Provider throws is
// an unexpected error: it is logged on the server and the user sees only a generic message.

/** The record (or the Resource's collection) doesn't exist. Served as a 404. */
export class NotFoundError extends Error {
	override name = 'NotFoundError';
	constructor(message = 'Not found', options?: ErrorOptions) {
		super(message, options);
	}
}

/** The backend rejected what it was asked for as invalid. Served as a 400. */
export class InvalidInputError extends Error {
	override name = 'InvalidInputError';
	constructor(message = 'Invalid input', options?: ErrorOptions) {
		super(message, options);
	}
}

/** The operation clashes with the record's current state, e.g. a duplicate. Served as a 409. */
export class ConflictError extends Error {
	override name = 'ConflictError';
	constructor(message = 'Conflict', options?: ErrorOptions) {
		super(message, options);
	}
}
