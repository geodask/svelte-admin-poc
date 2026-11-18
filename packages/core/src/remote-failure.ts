import type { RemoteFailure } from './remote.ts';

/**
 * Why a remote command (a delete, an export) failed, from what it rejected with: Kit rejects with `{ status, body }`, whose
 * body is the server's safe `{ message }`. `fallback` is the message when it carries none of its
 * own (e.g. no network).
 */
export function readRemoteFailure(failure: unknown, fallback: string): RemoteFailure {
	const { status, body } = (failure ?? {}) as { status?: unknown; body?: { message?: unknown } };
	const message = body?.message;
	return {
		...(typeof status === 'number' ? { status } : {}),
		message: typeof message === 'string' && message ? message : fallback
	};
}
