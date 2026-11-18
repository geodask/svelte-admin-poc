// `App.Locals` is declared by SvelteKit, which the core peer-depends on.
/// <reference types="@sveltejs/kit" />
import type { z } from 'zod';
import type {
	FieldBrandOf,
	FilterOperator,
	KIND_OPERATORS,
	RESERVED_LIST_KEYS,
	UnwrappedSchema
} from './fields.ts';
import type { CreateData, EditData, Simplify } from './form-spec.ts';
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

/**
 * The keys of an object schema's sortable Fields (`sortable: true`, read from `field()`'s
 * brand), or `never` when it has none. For a schema whose Fields TypeScript can't see, any key.
 */
export type SchemaSortableKey<S extends Resource['schema']> = string extends keyof S['shape']
	? string
	: {
			[K in keyof S['shape']]: [FieldBrandOf<S['shape'][K], 'sortable'>] extends [true] ? K : never;
		}[keyof S['shape']] &
			string;

/**
 * The keys of a Resource's sortable Fields (`sortable: true`, read from `field()`'s brand), or
 * `never` when it has none. For a Resource whose Fields TypeScript can't see, any key.
 */
export type SortableKey<R extends ListParamsResource> = SchemaSortableKey<R['schema']>;

/** A filter value of any Field, as a filter for a Resource TypeScript can't see may carry. */
export type FilterValue = string | number | boolean | Date;

/**
 * The scalar Kind of an unwrapped Field schema's type, as `detectKind` finds it at runtime, or
 * `never` for any other Kind. An ISO date or datetime string is a date.
 */
type ScalarKindOf<S> = S extends { _zod: { def: { format: 'date' | 'datetime' } } }
	? 'date'
	: S extends { _zod: { def: { type: infer T } } }
		? T extends 'string'
			? 'text'
			: T extends 'number' | 'boolean' | 'date' | 'enum'
				? T
				: never
		: never;

/** The operators a filter on a Field of the scalar Kind of `S` can use, or `never`. */
type KindOperatorsOf<S> = (typeof KIND_OPERATORS)[ScalarKindOf<S> &
	keyof typeof KIND_OPERATORS][number];

/** The operators one `filterable` setting allows, given its Kind's operators. */
type AllowedOperators<B, KindOperators> = B extends true
	? KindOperators
	: B extends readonly (infer O)[]
		? O & KindOperators
		: never;

/**
 * The operators a filter on a Field schema can use: every operator of its Kind for
 * `filterable: true`, those it names (and its Kind has) for a list, and `never` when it isn't
 * filterable.
 */
type FieldFilterOperators<F> = AllowedOperators<
	FieldBrandOf<F, 'filterable'>,
	KindOperatorsOf<UnwrappedSchema<F>>
>;

/** The filters on one Field `K` with values `V`: one member for `in`, one for every other operator. */
type FiltersOn<K extends string, V, O extends FilterOperator> =
	| ('in' extends O ? { field: K; operator: 'in'; value: V[] } : never)
	| ([Exclude<O, 'in'>] extends [never]
			? never
			: { field: K; operator: Exclude<O, 'in'>; value: V });

/** A filter on any Field, with any operator, as a Resource TypeScript can't see may get. */
type LooseFilter = FiltersOn<string, FilterValue, FilterOperator>;

/**
 * One filter of an object schema's list, or `never` when it has no filterable Field. For a schema
 * whose Fields TypeScript can't see, a filter on any Field with any operator.
 */
export type SchemaListFilter<S extends Resource['schema']> = string extends keyof S['shape']
	? LooseFilter
	: {
			[K in keyof S['shape'] & string]: FiltersOn<
				K,
				NonNullable<z.output<S['shape'][K]>>,
				FieldFilterOperators<S['shape'][K]>
			>;
		}[keyof S['shape'] & string];

/**
 * One filter a Resource's `getList` may receive: a filterable Field's key, one of the operators
 * it allows, and a value typed by the Field (its output type without `undefined` or `null`: a
 * string, a number, a boolean, an enum member, or the Field's own date type). `in` carries an
 * array of 2 to 100 distinct values; every other operator one value. `never` for a Resource with
 * no filterable Field. Without a Resource (or for one TypeScript can't see), a filter on any
 * Field with any operator.
 */
export type ListFilter<R extends ListParamsResource = Resource> = SchemaListFilter<R['schema']>;

/** The keys of a Resource's filterable Fields (read from `field()`'s brand), or `never`. */
export type FilterableKey<R extends ListParamsResource> = ListFilter<R>['field'];

/**
 * The keys of an object schema's filterable Fields that the list URL can't hold, being its own
 * params or holding a `.`, or `never`.
 */
export type UnusableFilterKey<S extends Resource['schema']> = string extends keyof S['shape']
	? never
	: Extract<
			SchemaListFilter<S>['field'],
			(typeof RESERVED_LIST_KEYS)[number] | `${string}.${string}`
		>;

/**
 * The validated params a Resource's `getList` receives, typed from the Resource as `CreateData`
 * and `EditData` are: a 1-based page and a page size, plus
 *
 * - only for a searchable Resource, an optional `search`, never blank and without the spaces
 *   around it;
 * - only for a Resource with a sortable Field, an optional `sort`, whose `field` is one of the
 *   sortable Fields' keys. It is absent when the list isn't sorted, never empty. When the
 *   Resource has a `defaultSort`, `serveResource` gives the Provider that sort whenever it is
 *   asked for none.
 *
 * - only for a Resource with a filterable Field, optional `filters` (see `ListFilter`): a flat
 *   list combined with AND, never empty (absent when there are none), with at most one filter per
 *   Field and operator, ordered by the Fields' schema order, then by operator.
 *
 * A Resource that isn't searchable has no `search` at all, one with no sortable Field no `sort`,
 * and one with no filterable Field no `filters`. Without a Resource (or for one TypeScript can't
 * see), any of them may come or not, a sort may name any Field, and a filter any Field and
 * operator.
 */
export type ListParams<R extends ListParamsResource = Resource> = Simplify<
	{ page: number; perPage: number } & (true extends R['searchable']
		? { search?: string }
		: unknown) &
		([SortableKey<R>] extends [never] ? unknown : { sort?: ListSort<SortableKey<R>> }) &
		([ListFilter<R>] extends [never] ? unknown : { filters?: ListFilter<R>[] })
>;

/**
 * What a Resource's `exportList` takes: its `ListParams` without the page and the page size, so
 * the search, the sort and the filters. The export holds every record they match, page after page.
 */
export type ExportParams<R extends ListParamsResource = Resource> = Omit<
	ListParams<R>,
	'page' | 'perPage'
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
