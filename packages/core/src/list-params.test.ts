import { describe, expect, it } from 'vitest';
import { listParamsSchema } from '@svelte-admin/core';

const accepts = (input: unknown) => listParamsSchema.safeParse(input).success;

describe('the getList input schema', () => {
	it('accepts a page and a page size', () => {
		expect(listParamsSchema.parse({ page: 3, perPage: 25 })).toEqual({ page: 3, perPage: 25 });
	});

	it('accepts a page size up to the cap of 100', () => {
		expect(accepts({ page: 1, perPage: 100 })).toBe(true);
		expect(accepts({ page: 1, perPage: 101 })).toBe(false);
	});

	it('rejects a page or page size below 1', () => {
		expect(accepts({ page: 0, perPage: 25 })).toBe(false);
		expect(accepts({ page: 1, perPage: 0 })).toBe(false);
	});

	it('rejects fractions and strings, so params are never coerced', () => {
		expect(accepts({ page: 1.5, perPage: 25 })).toBe(false);
		expect(accepts({ page: '1', perPage: 25 })).toBe(false);
	});

	it('rejects a missing param', () => {
		expect(accepts({ page: 1 })).toBe(false);
	});

	it('rejects any undeclared key, so the Provider never sees one', () => {
		expect(accepts({ page: 1, perPage: 25, limit: 100000 })).toBe(false);
	});
});
