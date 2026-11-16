// The core's hooks for an app's `hooks.server.ts`. Nothing here imports `$app/server`, so this
// entry is plain functions an app (or a test) can call.
import type { HandleServerError } from '@sveltejs/kit/hooks';
import { describeUnexpected, UNEXPECTED_MESSAGE } from './unexpected.ts';

/**
 * The server `handleError` hook. It logs unexpected errors (with their causes) and remote
 * function validation failures, and returns a message that is safe to show: an unexpected error
 * becomes a generic 500, whatever it said. An expected error (one thrown with `error()`, which
 * is how `serveResource` serves a Provider error) or
 * one of Kit's own keeps its status and message and isn't logged.
 *
 * @example
 * // src/hooks.server.ts
 * export { handleError } from '@svelte-admin/core/hooks';
 */
export const handleError: HandleServerError = ({ kind, error, issues, remote }) => {
	if (kind === 'unknown') {
		console.error(describeUnexpected(error));
		return { status: 500, message: UNEXPECTED_MESSAGE };
	}
	if (kind === 'validation') {
		const remoteName = [remote?.name, remote?.file && `(${remote.file})`].filter(Boolean).join(' ');
		const lines = issues.map((issue) => {
			const path = issue.path?.map((key) => (typeof key === 'object' ? key.key : key)).join('.');
			return `  ${path ? `${path}: ` : ''}${issue.message}`;
		});
		console.error(
			`Remote function ${remoteName ? `${remoteName} ` : ''}schema validation failed:\n${lines.join('\n')}`
		);
	}
	return { status: error.status, message: error.message };
};
