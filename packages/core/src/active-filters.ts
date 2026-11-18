// The filters a list is filtered by, each with a readable label and the href that removes it:
// the active filter chips under a list View's toolbar. Shared, pure.
import { datetimeInputValue } from './date-input.ts';
import type { Field, FilterOperator } from './fields.ts';
import { dateInputType, listHref, readListParams, type ListUrlResource } from './list-url.ts';
import type { FilterValue, ListFilter, ListParams } from './provider.ts';

/**
 * One filter the list is filtered by: its described Field, its operator and value (an array of
 * values only for `in`), a readable label such as "Prep time (min) ≥ 10", and the href of the
 * list without it.
 */
export type ActiveFilter = DescribedFilter<ListFilter> & { label: string; href: string };

/** A filter with its described Field in place of the Field's key, keeping each operator's value. */
type DescribedFilter<F extends ListFilter> = F extends ListFilter
	? Omit<F, 'field'> & { field: Field }
	: never;

/**
 * Each filter a list URL names, in the canonical order, whatever its operator and whether or not
 * its Field is hidden, so a person can always see and remove what narrows the list.
 */
export function activeFilters(url: URL, resource: ListUrlResource): ActiveFilter[] {
	const params: ListParams = readListParams(url, resource);
	const filters = params.filters ?? [];
	return filters.flatMap((filter) => {
		const field = resource.fields.find((candidate) => candidate.key === filter.field);
		if (field === undefined) return [];
		const others = filters.filter((other) => other !== filter);
		const paramsWithout = { ...params, page: 1, filters: others.length > 0 ? others : undefined };
		const label = filterLabel(resource, field, filter);
		return [{ ...filter, field, label, href: listHref(url, paramsWithout, resource) }];
	});
}

// The Views' formats: a fixed `en` locale and dates in UTC, so the server and the browser write
// the same label and hydration matches.
const numberFormat = new Intl.NumberFormat('en');
const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });

/** How a label joins a Field's label to the value, by operator: "Name contains piz", "Prep time (min) ≥ 10". */
const OPERATOR_TEXT: Record<FilterOperator, string> = {
	eq: ': ',
	in: ': ',
	contains: ' contains ',
	lt: ' < ',
	lte: ' ≤ ',
	gt: ' > ',
	gte: ' ≥ '
};

/** A filter's label: the Field's label, the operator, and the value (each value of an `in`). */
function filterLabel(resource: ListUrlResource, field: Field, filter: ListFilter): string {
	const text = (value: FilterValue) => valueText(resource, field, value);
	const values = filter.operator === 'in' ? filter.value.map(text).join(', ') : text(filter.value);
	return `${field.label}${OPERATOR_TEXT[filter.operator]}${values}`;
}

/**
 * A filter value as the Views show it: a Reference's id as written, Yes or No for a boolean, a
 * number with the `en` grouping, a date as the list shows it (`Mar 1, 2024`, in UTC), and text and
 * enum members as they are. A datetime adds its time in UTC unless it is midnight, since a filter
 * holds it to the minute.
 */
function valueText(resource: ListUrlResource, field: Field, value: FilterValue): string {
	// An id, as the URL writes it: `1234`, never `1,234`.
	if (field.kind === 'reference') return String(value);
	if (typeof value === 'boolean') return value ? 'Yes' : 'No';
	if (typeof value === 'number') return numberFormat.format(value);
	if (field.kind !== 'date') return String(value);
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value);
	const day = dateFormat.format(date);
	if (dateInputType(resource, field.key) !== 'datetime') return day;
	// The time as the filter input writes it, in UTC: `HH:mm`, with seconds only when they aren't zero.
	const time = datetimeInputValue(date).slice(11);
	return time === '00:00' ? day : `${day}, ${time} UTC`;
}
