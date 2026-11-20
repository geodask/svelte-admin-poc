import { z } from 'zod';
import { FILTER_OPERATORS, unwrap, type Field } from './fields.ts';
import type {
	ExportParams,
	FilterValue,
	ListFilter,
	ListParams,
	ListParamsResource,
	ListSort,
	SortOrder
} from './provider.ts';
import type { Resource } from './resource.ts';

/** The largest page size `getList` accepts. */
export const MAX_PER_PAGE = 100;

/** The page size a list View uses when the URL doesn't name one. */
export const DEFAULT_PER_PAGE = 25;

const pageParams = z.strictObject({
	page: z.int().min(1),
	perPage: z.int().min(1).max(MAX_PER_PAGE)
});

/**
 * A list View leaves a blank search out, so `getList` never receives one. The URL keeps the
 * search as typed, and the Provider gets it without the spaces around it.
 */
const searchSchema = z.string().trim().min(1).optional();

/** The directions a sort can take, as `getList` and the list URL name them. */
const sortOrder = z.enum(['asc', 'desc']) satisfies z.ZodType<SortOrder>;

/** The fewest values an `in` filter carries: with one, it is an `eq`. */
export const MIN_IN_VALUES = 2;

/** The most values an `in` filter carries, so a crafted URL can't make an unbounded request. */
export const MAX_IN_VALUES = 100;

/** What `listParamsSchema` asks of a Resource: what `ListParams` does, and its described Fields. */
export type ListSchemaResource = ListParamsResource & Pick<Resource, 'fields'>;

/**
 * Check a Resource's list settings at startup: a `defaultSort` on a sortable Field, ascending or
 * descending, and a `perPage` from 1 to `MAX_PER_PAGE`. TypeScript catches most of these, but
 * not a Resource whose Fields it can't see, nor a page size out of range.
 */
export function assertListSettings(
	name: string,
	fields: readonly Field[],
	{ defaultSort, perPage }: { defaultSort?: ListSort; perPage: number }
): void {
	if (defaultSort !== undefined) {
		const { field, order } = defaultSort;
		if (!sortableKeys({ fields }).includes(field)) {
			throw new Error(
				`Resource "${name}": its \`defaultSort\` names the Field "${field}", which is not sortable. ` +
					'Mark the Field `sortable: true` with `field()`, or sort by another one.'
			);
		}
		if (!sortOrder.safeParse(order).success) {
			throw new Error(
				`Resource "${name}": its \`defaultSort\` order must be "asc" or "desc", not ${JSON.stringify(order)}.`
			);
		}
	}
	if (!pageParams.shape.perPage.safeParse(perPage).success) {
		throw new Error(
			`Resource "${name}": its \`perPage\` must be a whole number from 1 to ${MAX_PER_PAGE}, not ${perPage}.`
		);
	}
}

/**
 * The params `getList` (or `exportList`) hands its Provider: those it was given, with the
 * Resource's `defaultSort` when they name no sort, so every caller gets the same order.
 */
export function withDefaultSort<P extends object>(
	params: P,
	resource: Pick<Resource, 'defaultSort'>
): P {
	const { defaultSort } = resource;
	// Read loosely: a Resource with no sortable Field has no `sort` in its params at all.
	return (params as { sort?: ListSort }).sort !== undefined || defaultSort === undefined
		? params
		: { ...params, sort: { ...defaultSort } };
}

/** A Resource's filterable Fields, in schema order. */
export function filterableFields(resource: Pick<Resource, 'fields'>): Field[] {
	return resource.fields.filter((field) => field.filterOperators.length > 0);
}

/** A key that tells two filter values apart: equal values, and only they, share one. */
export function filterValueKey(value: FilterValue): string {
	return value instanceof Date ? `date:${value.getTime()}` : `${typeof value}:${String(value)}`;
}

/** The order of two filter values: numbers and dates by size, anything else as text. */
function compareFilterValues(a: FilterValue, b: FilterValue): number {
	const [x, y] = [a, b].map((value) => (value instanceof Date ? value.getTime() : value));
	if (typeof x === 'number' && typeof y === 'number') return x - y;
	const [left, right] = [String(x), String(y)];
	return left < right ? -1 : left > right ? 1 : 0;
}

/** An `in` filter's values in their canonical order: an enum's in its options' order. */
export function canonicalValues<V extends FilterValue>(field: Field, values: readonly V[]): V[] {
	if (field.kind !== 'enum') return values.toSorted(compareFilterValues);
	const { options } = field;
	return values.toSorted((a, b) => options.indexOf(a as string) - options.indexOf(b as string));
}

/**
 * Filters in their canonical form: ordered by their Field's schema order, then by operator
 * (`FILTER_OPERATORS`), with an `in` filter's values in their canonical order, so equal filters
 * compare equal.
 */
export function canonicalFilters<F extends ListFilter>(
	filters: readonly F[],
	resource: Pick<Resource, 'fields'>
): F[] {
	const fieldIndex = (filter: ListFilter) =>
		resource.fields.findIndex((field) => field.key === filter.field);
	const operatorIndex = (filter: ListFilter) => FILTER_OPERATORS.indexOf(filter.operator);
	return filters
		.toSorted((a, b) => fieldIndex(a) - fieldIndex(b) || operatorIndex(a) - operatorIndex(b))
		.map((filter) => {
			const field = resource.fields[fieldIndex(filter)];
			return filter.operator === 'in' && field !== undefined
				? { ...filter, value: canonicalValues(field, filter.value) }
				: filter;
		});
}

/**
 * The schema of one filter value of a Field: its Kind's base type, never the Field's own
 * refinements (a filter value isn't a record value, so `name.contains=piz` is fine on a Field
 * that needs five letters). A date keeps the Field's own type: an ISO date or datetime string,
 * or a `Date`. A Reference's value is an id, so it keeps the Field's own type, which is its
 * target's id type.
 */
export function filterValueSchema(field: Field, schema: z.ZodType): z.ZodType<FilterValue> {
	switch (field.kind) {
		case 'reference':
			return unwrap(schema) as z.ZodType<FilterValue>;
		case 'text':
			return z.string();
		case 'number':
			return z.number();
		case 'boolean':
			return z.boolean();
		case 'enum':
			return z.literal(field.options);
		case 'date': {
			if (field.dateType === 'date') return z.iso.date();
			if (field.dateType === 'Date') return z.date();
			// The Field's own datetime format: whether it takes an offset or no zone, and its
			// precision.
			const { offset, local, precision } = (unwrap(schema) as z.ZodISODateTime)._zod.def;
			return z.iso.datetime({ offset, local, precision });
		}
		default:
			throw new Error(`A ${field.kind} Field can't be filtered.`);
	}
}

/**
 * The schema of a Resource's filters, or `undefined` when it has no filterable Field: a list of
 * one or more filters, each on a filterable Field with an operator it allows and a value of its
 * base type (an array of 2 to 100 distinct ones for `in`), at most one per Field and operator,
 * handed on in their canonical form.
 */
function filtersSchema(resource: ListSchemaResource) {
	const members = filterableFields(resource).flatMap((field) => {
		const value = filterValueSchema(field, resource.schema.shape[field.key] as z.ZodType);
		return field.filterOperators.map((operator) =>
			z.strictObject({
				field: z.literal(field.key),
				operator: z.literal(operator),
				value:
					operator === 'in'
						? z
								.array(value)
								.min(MIN_IN_VALUES)
								.max(MAX_IN_VALUES)
								.refine(
									(values) => new Set(values.map(filterValueKey)).size === values.length,
									'An `in` filter takes distinct values'
								)
						: value
			})
		);
	});
	const [first, ...rest] = members;
	if (first === undefined) return undefined;
	return z
		.array(rest.length === 0 ? first : z.union([first, ...rest]))
		.min(1)
		.refine(
			(filters) =>
				new Set(filters.map(({ field, operator }) => `${field}.${operator}`)).size ===
				filters.length,
			'At most one filter per Field and operator'
		)
		.transform((filters) => canonicalFilters(filters as ListFilter[], resource));
}

/** The keys of a Resource's sortable Fields, in schema order. */
export function sortableKeys(resource: Pick<Resource, 'fields'>): string[] {
	return resource.fields.filter((field) => field.sortable).map((field) => field.key);
}

/**
 * The schema of what a Resource's list is narrowed and ordered by, without the page: a search only
 * when the Resource is searchable, a sort only when it has a sortable Field, and filters only when
 * it has a filterable Field. Strict, like `listParamsSchema`.
 */
function listQuerySchema(resource: ListSchemaResource) {
	// The runtime check matches the type: a search only when the Resource is searchable, and a
	// sort only on a sortable Field.
	const [first, ...rest] = sortableKeys(resource);
	const filters = filtersSchema(resource);
	return z.strictObject({
		...(resource.searchable ? { search: searchSchema } : {}),
		...(first === undefined
			? {}
			: { sort: z.strictObject({ field: z.enum([first, ...rest]), order: sortOrder }).optional() }),
		...(filters === undefined ? {} : { filters: filters.optional() })
	});
}

/**
 * The input schema of a Resource's `getList` query: a page and a page size, plus a search only
 * when the Resource is searchable, a sort only when it has a sortable Field, on one of those
 * Fields, and filters only when it has a filterable Field, on those Fields with the operators
 * they allow. It is strict: an undeclared key (a search included, for a Resource that isn't
 * searchable, a sort for one with no sortable Field, and filters for one with no filterable
 * Field), a sort on any other Field, a filter on any other Field or with another operator, a
 * value of the wrong type, the same Field and operator twice, or an `in` outside 2 to 100
 * distinct values is invalid input, so a Provider never sees one. Nothing is coerced, though the
 * filters are handed on in their canonical form (see `ListParams`). Its input and output are the
 * Resource's `ListParams`, so the remote `getList` built from it is typed from the Resource.
 */
export function listParamsSchema<R extends ListSchemaResource>(
	resource: R
): z.ZodType<ListParams<R>, ListParams<R>> {
	const schema = listQuerySchema(resource).extend(pageParams.shape);
	return schema as unknown as z.ZodType<ListParams<R>, ListParams<R>>;
}

/**
 * The input schema of a Resource's `exportList` command: `listParamsSchema` without the page and
 * the page size, with the same rules for the search, the sort and the filters.
 */
export function exportParamsSchema<R extends ListSchemaResource>(
	resource: R
): z.ZodType<ExportParams<R>, ExportParams<R>> {
	return listQuerySchema(resource) as unknown as z.ZodType<ExportParams<R>, ExportParams<R>>;
}

/** The schemas of the page and the page size, for reading them from a URL. */
export const pageParamSchemas = pageParams.shape;
