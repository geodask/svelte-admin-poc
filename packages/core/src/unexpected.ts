// How the core reports an unexpected error: the generic message the user sees, and the full
// description the server logs. Shared by the `handleError` hook and the remote functions that
// report a failure instead of throwing it (a bulk delete that stopped partway).

/** What the user sees for an unexpected error, whatever it was. */
export const UNEXPECTED_MESSAGE = 'An unexpected error occurred.';

/** An error's stack (or message) and those of its causes, or the thrown value as text. */
export function describeUnexpected(error: unknown): string {
	const parts: string[] = [];
	let current = error;
	while (current instanceof Error) {
		parts.push(current.stack ?? `${current.name}: ${current.message}`);
		current = current.cause;
	}
	if (current !== undefined) parts.push(String(current));
	return parts.join('\nCaused by: ');
}
