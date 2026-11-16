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
 * type must be the Resource schema's output type, and its ids the schema's id type. `Create` is
 * what `create` receives, and `Edit` what `update` receives as its `data`. For a Resource,
 * `serveResource` takes `Provider<RecordOf<R>, IdOf<R>, CreateData<R>, EditData<R>>`, which
 * leave out the Fields no form sets; the defaults suit a Resource without read-only or hidden
 * Fields.
 */
export type Provider<T, Id = IdOfRecord<T>, Create = Omit<T, 'id'>, Edit = Create> = {
	getList(ctx: ProviderContext, params: ListParams): Promise<ListResult<T>>;
	/**
	 * One record by its id. The id arrives with the schema's id type, never coerced. Build any
	 * URL from it with `idPathSegment`, so a crafted id can't reach a different record.
	 */
	getOne(ctx: ProviderContext, id: Id): Promise<T>;
	/**
	 * Create a record. `data` is the record without its id and its read-only and hidden Fields
	 * (`CreateData`), already validated with the Resource schema, so a Provider only forwards it
	 * to the backend and fills in what the backend owns. Return the record the backend saved, with
	 * the id it assigned.
	 */
	// A function-typed member, not a method, so its parameter is checked strictly: a `create` that expects
	// more than the form gives (a read-only Field, say) is rejected.
	create: (ctx: ProviderContext, data: Create) => Promise<T>;
	/**
	 * Replace a record's editable Fields. `data` is the whole editable record (`EditData`: no
	 * id, no read-only, hidden or `'afterCreate'` Field), already validated with the Resource
	 * schema: an optional Field whose key is absent was cleared by the user, so remove its value.
	 * Keep the Fields `data` leaves out as they are. There are no partial patches. Return the
	 * record the backend saved, with the same id.
	 */
	// Function-typed, for the same strict check as `create`.
	update: (ctx: ProviderContext, input: { id: Id; data: Edit }) => Promise<T>;
	/**
	 * Delete one record by its id, which arrives with the schema's id type. Throw
	 * `NotFoundError` for a record that doesn't exist (e.g. one deleted meanwhile), so the user
	 * sees why instead of a generic failure.
	 */
	deleteOne(ctx: ProviderContext, id: Id): Promise<void>;
	/**
	 * Optional: delete many records in one request, for a backend with a bulk route. `ids` holds
	 * one to 1,000 distinct ids, with the schema's id type. Make it all or nothing: when it throws,
	 * the admin reports that none were deleted and keeps them all selected. Without it, a bulk
	 * delete calls `deleteOne` for each id in turn, stopping at the first failure.
	 */
	deleteMany?(ctx: ProviderContext, ids: Id[]): Promise<void>;
};
