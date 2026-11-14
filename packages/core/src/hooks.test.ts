import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { handleError } from '@svelte-admin/core/hooks';

// The hook only passes the event through; no test needs a real one.
const event = {} as RequestEvent;

describe('handleError, for hooks.server.ts', () => {
	let log: MockInstance<typeof console.error>;

	beforeEach(() => {
		log = vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => {
		log.mockRestore();
	});

	/** Everything written to the log, as one string. */
	const logged = () =>
		log.mock.calls
			.flat()
			.map((part) => (part instanceof Error ? (part.stack ?? part.message) : String(part)))
			.join('\n');

	describe('an unexpected error', () => {
		const failure = new Error('REST Provider: GET http://api.internal/recipes failed with 500', {
			cause: new Error('ECONNRESET on shard 3')
		});

		it('returns a safe message with status 500, never the error itself', async () => {
			const result = await handleError({ kind: 'unknown', error: failure, event });

			expect(result).toEqual({ status: 500, message: 'An unexpected error occurred.' });
		});

		it('logs the error and its cause', async () => {
			await handleError({ kind: 'unknown', error: failure, event });

			expect(logged()).toContain('api.internal/recipes failed with 500');
			expect(logged()).toContain('ECONNRESET on shard 3');
		});

		it('logs something thrown that is not an Error', async () => {
			const result = await handleError({ kind: 'unknown', error: 'upstream text', event });

			expect(result).toEqual({ status: 500, message: 'An unexpected error occurred.' });
			expect(logged()).toContain('upstream text');
		});
	});

	describe('a validation failure', () => {
		const issues = [{ message: 'Too big: expected number to be <=100', path: ['perPage'] }];

		it("returns Kit's safe 400 message, not the issues", async () => {
			const result = await handleError({
				kind: 'validation',
				error: { status: 400, message: 'Bad Request' },
				issues,
				remote: { name: 'getList', file: 'src/lib/resources/recipes.remote.ts' },
				event
			});

			expect(result).toEqual({ status: 400, message: 'Bad Request' });
		});

		it('logs the remote function and the issues', async () => {
			await handleError({
				kind: 'validation',
				error: { status: 400, message: 'Bad Request' },
				issues,
				remote: { name: 'getList', file: 'src/lib/resources/recipes.remote.ts' },
				event
			});

			expect(logged()).toContain('getList');
			expect(logged()).toContain('recipes.remote.ts');
			expect(logged()).toContain('Too big: expected number to be <=100');
		});
	});

	describe('an expected error', () => {
		it('keeps the status and message of an error thrown with `error()`, and logs nothing', async () => {
			const result = await handleError({
				kind: 'app',
				error: { status: 404, message: 'Not found' },
				event
			});

			expect(result).toEqual({ status: 404, message: 'Not found' });
			expect(log).not.toHaveBeenCalled();
		});

		it("keeps the status and message of one of Kit's own errors, and logs nothing", async () => {
			const result = await handleError({
				kind: 'framework',
				error: { status: 404, message: 'Not Found' },
				event
			});

			expect(result).toEqual({ status: 404, message: 'Not Found' });
			expect(log).not.toHaveBeenCalled();
		});
	});
});
