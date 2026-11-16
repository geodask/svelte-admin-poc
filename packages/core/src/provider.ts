// `App.Locals` is declared by SvelteKit, which the core peer-depends on.
/// <reference types="@sveltejs/kit" />
import type { FieldBrandOf } from './fields.ts';
import type { CreateData, EditData } from './form-spec.ts';
import type { IdOf, RecordOf, Resource } from './resource.ts';

/**
 * What every Provider method receives first: the current request's `fetch` and `locals`.
 * A Provider never calls `getRequestEvent`, so it is a plain function that a test can call
 * with a fake `fetch`.
 */
export type ProviderContext = { fetch: typeof fetch; locals: App.Locals };

/** The direction of a sort: ascending or descending. */
export type SortOrder = 'asc' | 'desc';

/** What a list is sorted by: one Field, by its key, ascending or descending. */
export type ListSort<K extends string = string> = { field: K; order: SortOrder };

/** What `ListParams` asks of a Resource: whether it is searchable, and its schema's Fields. */
export type ListParamsResource = Pick<Resource, 'searchable' | 'schema'>;

/** A Resource's schema shape: each Field's key and its schema. */
type ShapeOf<R extends ListParamsResource> = R['schema']['shape'];

/**
 * The keys of a Resource's sortable Fields (`sortable: true`, read from `field()`'s brand), or
 * `never` when it has none. For a Resource whose Fields TypeScript can't see, any key.
 */
export type SortableKey<R extends ListParamsResource> = string extends keyof ShapeOf<R>
	? string
	: {
			[K in keyof ShapeOf<R>]: [FieldBrandOf<ShapeOf<R>[K], 'sortable'>] extends [true] ? K : never;
		}[keyof ShapeOf<R>] &
			string;

/** A type with its intersections flattened into one object, so it reads (and compares) plainly. */
type Simplify<T> = { [K in keyof T]: T[K] } & {};

/**
 * The validated params a Resource's `getList` receives, typed from the Resource as `CreateData`
 * and `EditData` are: a 1-based page and a page size, plus
 *
 * - only for a searchable Resource, an optional `search`, never blank and without the spaces
 *   around it;
 * - only for a Resource with a sortable Field, an optional `sort`, whose `field` is one of the
 *   sortable Fields' keys. It is absent when the list isn't sorted, never empty.
 *
 * A Resource that isn't searchable has no `search` at all, and one with no sortable Field no
 * `sort`. Without a Resource (or for one TypeScript can't see), either may come or not, and a
 * sort may name any Field. Filters come later.
 */
export type ListParams<R extends ListParamsResource = Resource> = Simplify<
	{ page: number; perPage: number } & (true extends R['searchable']
		? { search?: string }
		: unknown) &
		([SortableKey<R>] extends [never] ? unknown : { sort?: ListSort<SortableKey<R>> })
>;

/** One page of records, with a total when the backend can count, or else `hasNextPage`. */
export type ListResult<T> = { data: T[]; total: number } | { data: T[]; hasNextPage: boolean };

/** The type of a record's `id`. */
type IdOfRecord<T> = T extends { id: infer Id } ? Id : never;

/**
 * The adapter that carries out a Resource's data operations against a backend. Its record
 * type must be the Resource schema's output type, and its ids the schema's id type. `Create` is
 * what `create` receives, `Edit` what `update` receives as its `data`, and `List` what `getList`
 * receives. For a Resource, `serveResource` takes `ResourceProvider<R>`, which leaves out the
 * Fields no form sets and the params the Resource doesn't take; the defaults suit a Resource
 * without read-only or hidden Fields, and a `getList` written against the loose `ListParams`
 * fits any Resource.
 */
export type Provider<
	T,
	Id = IdOfRecord<T>,
	Create = Omit<T, 'id'>,
	Edit = Create,
	List = ListParams
> = {
	getList(ctx: ProviderContext, params: List): Promise<ListResult<T>>;
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

/**
 * The Provider `serveResource` takes for a Resource, and `restProvider(...).for(resource)` returns:
 * its records, ids, `CreateData`, `EditData` and `ListParams`, all typed from the Resource.
 */
export type ResourceProvider<R extends Resource> = Provider<
	RecordOf<R>,
	IdOf<R>,
	CreateData<R>,
	EditData<R>,
	ListParams<R>
>;
