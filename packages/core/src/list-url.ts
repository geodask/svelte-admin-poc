import { z } from 'zod';
import {
	dateInputValue,
	datetimeInputValue,
	readDateInput,
	readDatetimeInput
} from './date-input.ts';
import { unwrap, type Field } from './fields.ts';
import {
	canonicalValues,
	filterableFields,
	filterValueKey,
	filterValueSchema,
	MAX_IN_VALUES,
	pageParamSchemas,
	sortableKeys,
	type ListSchemaResource
} from './list-params.ts';
import type { FilterValue, ListFilter, ListParams, ListSort, SortOrder } from './provider.ts';
import type { Resource } from './resource.ts';

/**
 * A URL param of plain digits that must also pass `schema`, or `fallback` when it is missing
 * or bad. Only digits, so `2e1`, `0x2` and ` 2` are bad rather than read as numbers.
 */
function urlInt(schema: z.ZodInt, fallback: number) {
	return z.string().regex(/^\d+$/).transform(Number).pipe(schema).catch(fallback);
}

/**
 * Values a list param is left out of the encoding at, when they are given: the page, the page
 * size, the order of a sort on any Field, and a whole sort (a Field and its order).
 */
export type ListParamDefaults = {
	page: number;
	perPage: number;
	order: SortOrder;
	sort?: ListSort;
};

/** What the list URL asks of a Resource: what `listParamsSchema` does, and its list settings. */
export type ListUrlResource = ListSchemaResource & ListSettings;

/** A Resource's list settings, which `listHref` leaves out of a URL: its page size and default sort. */
export type ListSettings = Pick<Resource, 'perPage' | 'defaultSort'>;

/**
 * The defaults a Resource's list URL falls back to when it leaves a param out, and so leaves
 * out: page 1, the Resource's page size and its default sort, and an ascending order.
 */
function urlDefaults(resource: ListSettings): ListParamDefaults {
	const { perPage, defaultSort } = resource;
	return { page: 1, perPage, order: 'asc', sort: defaultSort };
}

/** Whether two sorts are the same, or both absent. */
function sameSort(a: ListSort | undefined, b: ListSort | undefined): boolean {
	return a?.field === b?.field && a?.order === b?.order;
}

/**
 * A search worth sending, or `undefined`. A blank one is no search. A real one is kept as
 * typed, spaces included, so a search box that writes the URL never has its text rewritten.
 */
function nonBlank(value: string | null | undefined): string | undefined {
	return value?.trim() ? value : undefined;
}

/**
 * The sort a list View's URL names, or `undefined`: `sort` names a sortable Field (any other, or
 * none, is no sort), ascending unless `order` is `desc`. An `order` without a `sort` means
 * nothing.
 */
function readSort(
	searchParams: URLSearchParams,
	resource: Pick<ListSchemaResource, 'fields'>
): ListSort | undefined {
	const field = searchParams.get('sort');
	if (field === null || !sortableKeys(resource).includes(field)) return undefined;
	return { field, order: searchParams.get('order') === 'desc' ? 'desc' : 'asc' };
}

/** A number as the list URL writes it: a plain decimal, such as `15`, `-5` or `45.5`. */
const PLAIN_DECIMAL = /^-?\d+(\.\d+)?$/;

/**
 * Which type a date Field holds: an ISO datetime string, an ISO date string, or a `Date`. The
 * list URL writes a datetime as a `datetime-local` input does, and the other two as a `date`
 * input does.
 */
function dateType(schema: z.ZodType): 'datetime' | 'date' | 'Date' {
	const type = unwrap(schema);
	if (type instanceof z.ZodISODateTime) return 'datetime';
	return type instanceof z.ZodDate ? 'Date' : 'date';
}

/** The schema of a Resource's Field, by its key. */
function schemaOf(resource: Pick<ListSchemaResource, 'schema'>, field: Field): z.ZodType {
	return resource.schema.shape[field.key] as z.ZodType;
}

/**
 * One filter value as the list URL writes it, read into the Field's type, or `undefined` when it
 * is empty, blank or malformed: text as written; a number as a plain decimal; a boolean as `true`
 * or `false`; an enum member as written (any other text is no member); and a date as the filter
 * input sends it, with the rules the forms use: a datetime as `YYYY-MM-DDTHH:mm` (seconds
 * optional) in UTC, becoming an ISO datetime string, and a date as `YYYY-MM-DD`, becoming an ISO
 * date string or, for `z.date()`, a `Date` at midnight UTC. The value must then be of the
 * Field's base type, as `getList` checks it.
 */
function readFilterValue(field: Field, schema: z.ZodType, text: string): FilterValue | undefined {
	if (text.trim() === '') return undefined;
	const value = urlValue(field, schema, text);
	if (value === undefined) return undefined;
	return filterValueSchema(field, schema).safeParse(value).success ? value : undefined;
}

/** A filter value as the list URL writes it, read into the Field's type, before it is checked. */
function urlValue(field: Field, schema: z.ZodType, text: string): FilterValue | undefined {
	switch (field.kind) {
		case 'enum':
			return field.options.find((option) => String(option) === text);
		case 'boolean':
			return text === 'true' ? true : text === 'false' ? false : undefined;
		case 'number':
			return PLAIN_DECIMAL.test(text) ? Number(text) : undefined;
		case 'date': {
			const type = dateType(schema);
			if (type === 'datetime') return readDatetimeInput(text);
			const day = readDateInput(text);
			return type === 'Date' ? day : day && text;
		}
		default:
			return text;
	}
}

/**
 * A filter value on a Resource's Field `key` as the list URL writes it, which is what its filter
 * input sends: a datetime as a `datetime-local` input does, in UTC (`2024-03-01T10:30`), a `Date`
 * as a `date` input does (`2024-03-01`), and anything else as text.
 */
export function urlFilterValue(
	resource: Pick<ListSchemaResource, 'fields' | 'schema'>,
	key: string,
	value: FilterValue
): string {
	if (dateInputType(resource, key) === 'datetime') {
		return datetimeInputValue(value as string | Date);
	}
	return value instanceof Date ? dateInputValue(value) : String(value);
}

/**
 * The input a date filter on a Resource's Field `key` uses: `datetime` (a `datetime-local` input,
 * in UTC) for an ISO datetime Field, else `date`.
 */
export function dateInputType(
	resource: Pick<ListSchemaResource, 'fields' | 'schema'>,
	key: string
): 'date' | 'datetime' {
	const field = resource.fields.find((candidate) => candidate.key === key);
	if (field?.kind !== 'date') return 'date';
	return dateType(schemaOf(resource, field)) === 'datetime' ? 'datetime' : 'date';
}

/** A filter value as the shared encoder writes it: a `Date` as an ISO string, anything else as text. */
function writeFilterValue(value: FilterValue): string {
	return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * The filters a list View's URL names, in their canonical form, or `undefined` for none. A bare
 * param is `eq`, and a repeated one `in` (with one distinct value, `eq`); any other operator is a
 * suffix, as in `name.contains`. Only a filterable Field's params are read, with the operators it
 * allows, and empty or malformed values are dropped. A repeated param on a Field without `in`
 * keeps its first good value, and an `in` its first 100.
 */
function readFilters(
	searchParams: URLSearchParams,
	resource: Pick<ListSchemaResource, 'fields' | 'schema'>
): ListFilter[] | undefined {
	const filters: ListFilter[] = [];
	for (const field of filterableFields(resource)) {
		const { key, filterOperators: operators } = field;
		const schema = schemaOf(resource, field);
		const read = (text: string) => readFilterValue(field, schema, text);
		const values = [
			...new Map(
				searchParams
					.getAll(key)
					.map(read)
					.filter((value) => value !== undefined)
					.map((value) => [filterValueKey(value), value])
			).values()
		];
		const [first] = values;
		if (values.length > 1 && operators.includes('in')) {
			const value = canonicalValues(field, values.slice(0, MAX_IN_VALUES));
			filters.push({ field: key, operator: 'in', value });
		} else if (first !== undefined && operators.includes('eq')) {
			filters.push({ field: key, operator: 'eq', value: first });
		}
		for (const operator of operators) {
			if (operator === 'eq' || operator === 'in') continue;
			const value = read(searchParams.get(`${key}.${operator}`) ?? '');
			if (value !== undefined) filters.push({ field: key, operator, value });
		}
	}
	return filters.length > 0 ? filters : undefined;
}

/**
 * The list params a list View's URL names, with defaults for what it leaves out: page 1, the
 * Resource's page size, and its default sort if it has one. The search is read from `q`, and
 * only for a searchable Resource. The sort is read from `sort` and `order`, and only on a
 * sortable Field. The filters are read from their Fields' own params, and only on filterable
 * Fields (see `readFilters`).
 */
export function readListParams<R extends ListUrlResource>(url: URL, resource: R): ListParams<R> {
	const { searchParams } = url;
	const defaults = urlDefaults(resource);
	const params: ListParams = z
		.object({
			page: urlInt(pageParamSchemas.page, defaults.page),
			perPage: urlInt(pageParamSchemas.perPage, defaults.perPage)
		})
		.parse({
			page: searchParams.get('page') ?? undefined,
			perPage: searchParams.get('perPage') ?? undefined
		});
	const search = resource.searchable ? nonBlank(searchParams.get('q')) : undefined;
	if (search !== undefined) params.search = search;
	const sort = readSort(searchParams, resource) ?? defaults.sort;
	if (sort !== undefined) params.sort = { ...sort };
	const filters = readFilters(searchParams, resource);
	if (filters !== undefined) params.filters = filters;
	// A search only for a searchable Resource, a sort only on a sortable Field, and filters only on
	// filterable ones, as its type says.
	return params as ListParams<R>;
}

/**
 * The one encoding of list params as search params, shared by the list URL and the bundled REST
 * Provider so the two can't drift: `page`, `perPage`, the sort as `sort` and `order`, the search
 * as `q`, then each filter in the order given: `eq` as a bare param (`difficulty=Easy`), `in` as
 * a repeated one (`difficulty=Easy&difficulty=Hard`), and any other operator as a suffix
 * (`name.contains=piz`). Booleans are `true` and `false`, and a `Date` an ISO string. A blank
 * search is never written, nor an `order` without a sort, nor an empty list of filters. Given
 * `defaults`, a param at its default is left out too, as the list URL does (so `order=asc` is
 * never in it, nor the default sort); without them every other param is written, as the REST
 * Provider does, so a backend never has to know the defaults. `readListParams` reads it back.
 */
export function encodeListParams(
	params: ListParams,
	defaults?: ListParamDefaults
): URLSearchParams {
	const encoded = new URLSearchParams();
	if (params.page !== defaults?.page) encoded.set('page', String(params.page));
	if (params.perPage !== defaults?.perPage) encoded.set('perPage', String(params.perPage));
	if (params.sort !== undefined && !sameSort(params.sort, defaults?.sort)) {
		encoded.set('sort', params.sort.field);
		if (params.sort.order !== defaults?.order) encoded.set('order', params.sort.order);
	}
	const q = nonBlank(params.search);
	if (q !== undefined) encoded.set('q', q);
	for (const { field, operator, value } of params.filters ?? []) {
		if (operator === 'in') {
			for (const item of value) encoded.append(field, writeFilterValue(item));
		} else {
			encoded.append(operator === 'eq' ? field : `${field}.${operator}`, writeFilterValue(value));
		}
	}
	return encoded;
}

/** What `listHref` asks of a Resource: its list settings, and its Fields to write filter values by. */
export type ListHrefResource = ListSettings & Pick<ListSchemaResource, 'fields' | 'schema'>;

/**
 * The href of the list at `url`'s path with `params`, for pager, page-size and search links.
 * It keeps the path, so it carries the admin's base path and works the same in a replaced
 * View. Only params that differ from their defaults are written (the Resource's own page size
 * and default sort included, and a blank search is none), and every other search param is
 * dropped. Params with no sort read back with the Resource's default sort. Filter values are
 * written as the filter form sends them: a datetime as `YYYY-MM-DDTHH:mm` in UTC (with seconds
 * only when they aren't zero), and a `Date` as its day, `YYYY-MM-DD`.
 */
export function listHref(url: URL, params: ListParams, resource: ListHrefResource): string {
	const filters = params.filters?.map((filter): ListFilter => {
		const write = (value: FilterValue) => urlFilterValue(resource, filter.field, value);
		return filter.operator === 'in'
			? { ...filter, value: filter.value.map(write) }
			: { ...filter, value: write(filter.value) };
	});
	const query = encodeListParams({ ...params, filters }, urlDefaults(resource)).toString();
	return query ? `${url.pathname}?${query}` : url.pathname;
}

/**
 * Where a list URL should be rewritten to, or `undefined` when it is already clean. A URL is
 * clean when it names only known params with good values that differ from their defaults (the
 * Resource's page size and default sort included), each filter in its canonical form; the order
 * the params are written in doesn't matter. `q` is known only for a searchable Resource, `sort`
 * only on a sortable Field, with `order` only beside it and only as `desc`, and a filter only on
 * a filterable Field, with an operator it allows. The rewrite keeps the path and the hash.
 */
export function listUrlRewrite(url: URL, resource: ListUrlResource): string | undefined {
	const clean = listHref(url, readListParams(url, resource), resource);
	const cleanParams = new URL(clean, url).searchParams;
	cleanParams.sort();
	const params = new URLSearchParams(url.searchParams);
	params.sort();
	return params.toString() === cleanParams.toString() ? undefined : clean + url.hash;
}
