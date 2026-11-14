// `App.Locals` is declared by SvelteKit, which the core peer-depends on.
/// <reference types="@sveltejs/kit" />

/**
 * What every Provider method receives first: the current request's `fetch` and `locals`.
 * A Provider never calls `getRequestEvent`, so it is a plain function that a test can call
 * with a fake `fetch`.
 */
export type ProviderContext = { fetch: typeof fetch; locals: App.Locals };

/**
 * The validated params `getList` receives. A search comes only for a searchable Resource, never
 * blank and without the spaces around it. Sort and filters come later.
 */
export type ListParams = { page: number; perPage: number; search?: string };

/** One page of records, with a total when the backend can count, or else `hasNextPage`. */
export type ListResult<T> = { data: T[]; total: number } | { data: T[]; hasNextPage: boolean };

/** The type of a record's `id`. */
type IdOfRecord<T> = T extends { id: infer Id } ? Id : never;

/**
 * The adapter that carries out a Resource's data operations against a backend. Its record
 * type must be the Resource schema's output type, and its ids the schema's id type. This is
 * the read half; the write methods come in a later milestone.
 */
export type Provider<T, Id = IdOfRecord<T>> = {
	getList(ctx: ProviderContext, params: ListParams): Promise<ListResult<T>>;
	/**
	 * One record by its id. The id arrives with the schema's id type, never coerced. Build any
	 * URL from it with `idPathSegment`, so a crafted id can't reach a different record.
	 */
	getOne(ctx: ProviderContext, id: Id): Promise<T>;
};
