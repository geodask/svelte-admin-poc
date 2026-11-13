// `App.Locals` is declared by SvelteKit, which the core peer-depends on.
/// <reference types="@sveltejs/kit" />

/**
 * What every Provider method receives first: the current request's `fetch` and `locals`.
 * A Provider never calls `getRequestEvent`, so it is a plain function that a test can call
 * with a fake `fetch`.
 */
export type ProviderContext = { fetch: typeof fetch; locals: App.Locals };

import type { z } from 'zod';
import type { listParamsSchema } from './list-params.ts';

/** The validated params `getList` receives. Search, sort and filters come later. */
export type ListParams = z.output<typeof listParamsSchema>;

/** One page of records, with a total when the backend can count, or else `hasNextPage`. */
export type ListResult<T> = { data: T[]; total: number } | { data: T[]; hasNextPage: boolean };

/**
 * The adapter that carries out a Resource's data operations against a backend. Its record
 * type must be the Resource schema's output type. This is the read half's first method;
 * `getOne` and the write methods come in later milestones.
 */
export type Provider<T> = {
	getList(ctx: ProviderContext, params: ListParams): Promise<ListResult<T>>;
};
