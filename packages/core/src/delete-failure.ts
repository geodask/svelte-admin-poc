import type { DeleteFailure } from './remote.ts';

/**
 * Why a remote delete failed, from what it rejected with: Kit rejects with `{ status, body }`, whose
 * body is the server's safe `{ message }`. `fallback` is the message when it carries none of its
 * own (e.g. no network).
 */
export function readDeleteFailure(failure: unknown, fallback: string): DeleteFailure {
	const { status, body } = (failure ?? {}) as { status?: unknown; body?: { message?: unknown } };
	const message = body?.message;
	return {
		...(typeof status === 'number' ? { status } : {}),
		message: typeof message === 'string' && message ? message : fallback
	};
}
