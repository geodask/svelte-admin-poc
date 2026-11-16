import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DEFAULT_PER_PAGE, defineResource, field, MAX_PER_PAGE } from '@svelte-admin/core';

const schema = z.object({
	id: field(z.number(), { sortable: true }),
	title: z.string(),
	// A hidden Field may still be the default sort.
	createdAt: field(z.iso.datetime(), { hidden: true, sortable: true })
});

/** A posts Resource with the given list settings. */
const posts = (settings: { defaultSort?: unknown; perPage?: unknown }) =>
	// The settings are typed loosely here so the runtime checks can be reached.
	defineResource({ name: 'posts', label: 'Posts', schema, ...(settings as object) });

describe("a Resource's list settings", () => {
	describe('the default sort', () => {
		it('is none unless the Resource sets one', () => {
			expect(posts({}).defaultSort).toBeUndefined();
		});

		it('is kept as set, on a sortable Field, hidden or not', () => {
			expect(posts({ defaultSort: { field: 'id', order: 'desc' } }).defaultSort).toEqual({
				field: 'id',
				order: 'desc'
			});
			expect(posts({ defaultSort: { field: 'createdAt', order: 'asc' } }).defaultSort).toEqual({
				field: 'createdAt',
				order: 'asc'
			});
		});

		it.each([
			['a Field that is not sortable', { field: 'title', order: 'asc' }],
			['a Field the Resource does not have', { field: 'rating', order: 'asc' }]
		])('makes defineResource throw for %s, naming the Resource and the Field', (_, sort) => {
			expect(() => posts({ defaultSort: sort })).toThrow(
				new RegExp(`Resource "posts".*defaultSort.*"${sort.field}".*not sortable`)
			);
		});

		it('makes defineResource throw for an order that is neither asc nor desc', () => {
			expect(() => posts({ defaultSort: { field: 'id', order: 'down' } })).toThrow(
				/Resource "posts".*defaultSort.*"asc" or "desc"/
			);
		});
	});

	describe('the page size', () => {
		it(`is ${DEFAULT_PER_PAGE} unless the Resource sets one`, () => {
			expect(posts({}).perPage).toBe(DEFAULT_PER_PAGE);
		});

		it.each([1, 20, MAX_PER_PAGE])('is kept as set, for %i', (perPage) => {
			expect(posts({ perPage }).perPage).toBe(perPage);
		});

		it.each([0, MAX_PER_PAGE + 1, -5, 2.5, Number.NaN])(
			'makes defineResource throw for %d, naming the Resource and the range',
			(perPage) => {
				expect(() => posts({ perPage })).toThrow(
					new RegExp(`Resource "posts".*perPage.*1 to ${MAX_PER_PAGE}`)
				);
			}
		);
	});
});
