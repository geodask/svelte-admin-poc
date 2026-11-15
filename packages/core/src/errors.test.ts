import { describe, expect, it } from 'vitest';
import { FieldError, ProviderError } from '@svelte-admin/core';

describe('FieldError', () => {
	it('holds one issue, with its path and message', () => {
		const failure = new FieldError({
			path: ['email'],
			message: 'A user with this email already exists'
		});

		expect(failure).toBeInstanceOf(ProviderError);
		expect(failure.issues).toEqual([
			{ path: ['email'], message: 'A user with this email already exists' }
		]);
		expect(failure.status).toBe(422);
		expect(failure.message).toBe('A user with this email already exists');
	});

	it('holds several issues, including nested paths', () => {
		const issues = [
			{ path: ['name'], message: 'Taken' },
			{ path: ['ingredients', 2, 'name'], message: 'Unknown ingredient' }
		];

		const failure = new FieldError(issues);

		expect(failure.issues).toEqual(issues);
		expect(failure.message).toBe('Taken\nUnknown ingredient');
	});

	it('keeps its issues when the caller changes the array it passed', () => {
		const issues = [{ path: ['name'], message: 'Taken' }];
		const failure = new FieldError(issues);

		issues[0].path.push('extra');
		issues.push({ path: ['email'], message: 'Also taken' });

		expect(failure.issues).toEqual([{ path: ['name'], message: 'Taken' }]);
	});

	it('refuses an empty list of issues', () => {
		expect(() => new FieldError([])).toThrow(TypeError);
	});
});
