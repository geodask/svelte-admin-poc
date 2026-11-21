// The filter state of a list: for a Resource and the list params in its URL, the filter controls
// to offer with their current values, the active filter chips, the hidden inputs the filter form
// and the search form keep, and, from what the filter form holds, the next list params. Every
// decision about one filter's control or chip lives here. Shared and pure: a Reference's control
// gets its picker, and its chip its Record title, from the caller, and so do the chips' hrefs, so
// it imports no Kit or remote module. It formats no value: the Theme writes a chip's text.
import type { Field, FilterOperator } from './fields.ts';
import {
	dateInputType,
	filterInputValue,
	filterParamName,
	listSearchParams,
	readListParams,
	type ListUrlResource
} from './list-url.ts';
import type { FilterValue, ListFilter, ListParams } from './provider.ts';
import type { ReferencePicker } from './reference-picker.ts';

/** One choice of a list View's filter control: a checkbox or a radio button. */
export type FilterOption = {
	/** The value the control sends for it, as the list URL writes it. Empty for "Any". */
	value: string;
	label: string;
	/** Whether the list is filtered by it now. */
	checked: boolean;
};

/**
 * One text, number or date input of a filter control: its name, as the list URL names the filter
 * (`name.contains`, `prepTimeMinutes.gte`), and the value the list is filtered by now, as the URL
 * writes it, or empty when it filters nothing.
 */
export type FilterInput = { name: string; value: string };

/**
 * Which input a text, number or date filter control uses: a text box, a number, a date, or a
 * date and time (a `datetime-local` input, read and written in UTC, as the forms do).
 */
export type FilterInputType = 'text' | 'number' | 'date' | 'datetime';

/**
 * The filter control of one filterable Field, in a list View's filter form. Its inputs are named
 * as the list URL names the filter. `operators` are the ones it sends; a filter with any other
 * operator (text `eq` when the control offers `contains`, `lt`, `gt`) still works from the URL,
 * and the filter form keeps it.
 *
 * - `checkboxes`: one per option, any number of them checked, for an enum Field that allows
 *   `in`. One checked option filters with `eq`, several with `in`, none not at all.
 * - `radio`: one of the options, the first of which is "Any" (no filter, an empty value), for a
 *   boolean Field (Any / Yes / No) or an enum Field that allows only `eq`. It filters with `eq`.
 * - `input`: one input. For a text Field a text box, filtering with `contains` when the Field
 *   allows it, else with `eq` (and, when the list is filtered by an `in` from the URL, one box
 *   per value, so the control owns the `in` too); for a number or date Field that doesn't allow a
 *   range, its one value, filtering with `eq`. Empty, it filters nothing.
 * - `range`: a from and a to input, for a number or date Field that allows `gte` and `lte`.
 *   Either may be left empty, to filter one side only.
 * - `reference`: a choice of the target's records by their Record title, for a Reference, with
 *   the headless picker (`createReferencePicker`) whose current choice is the record the list is
 *   filtered by. It sends the chosen id under the Field's key, filtering with `eq`; its "Any"
 *   choice sends an empty value, which filters nothing.
 */
export type FilterControl = { field: Field; operators: readonly FilterOperator[] } & (
	| {
			type: 'checkboxes' | 'radio';
			/** The name of each of its inputs. */
			name: string;
			options: FilterOption[];
	  }
	| {
			type: 'input';
			input: FilterInputType;
			/**
			 * Its inputs: one, or for an exact-match text box on a Field that allows `in`, one per value
			 * the list is filtered by. They share a name, so they send an `in` while more than one is
			 * filled, and clearing one leaves the others.
			 */
			values: FilterInput[];
	  }
	| { type: 'range'; input: Exclude<FilterInputType, 'text'>; from: FilterInput; to: FilterInput }
	| {
			type: 'reference';
			/** Its input: the Field's key, and the id the list is filtered by now, or empty. */
			current: FilterInput;
			/** The label of the choice that sends an empty value and so filters nothing: "Any". */
			emptyLabel: string;
			/** The headless picker, whose current choice is the id the list is filtered by now. */
			picker: ReferencePicker;
	  }
);

/**
 * Gives a Reference filter's picker: for the Reference Field, and the id the list is filtered by
 * now, as its input writes it, or empty.
 */
export type FilterPickerResolver = (field: Field, current: string) => ReferencePicker;

/**
 * Gives a Reference filter's value its Record title: for the Reference Field and the id the list
 * is filtered by, the target record's Record title, or `undefined` when there is no such record
 * or it can't be looked up. It never rejects.
 */
export type FilterTitleResolver = (field: Field, value: FilterValue) => Promise<string | undefined>;

/** One value of a chip: as the list params hold it, and for a Reference its record's Record title. */
export type FilterChipValue = {
	value: FilterValue;
	/** A Reference's record's Record title, when the record was found. */
	title?: string;
};

/**
 * One filter the list is filtered by, for the active filter chips, as parts the Theme writes the
 * chip's text from (as in "Prep time (min) ≥ 10" or "Author: Ada Lovelace"): its Field, its
 * operator, its values (several only for `in`) and the href of the list without it.
 */
export type FilterChip = {
	field: Field;
	operator: FilterOperator;
	values: FilterChipValue[];
	/**
	 * The href of the list without this filter: at page 1, keeping the search, the sort, the page
	 * size and every other filter.
	 */
	href: string;
};

/**
 * What the filter state takes from its caller, so it stays pure:
 *
 * - `picker`: each Reference filter's picker, e.g. `createReferencePicker` through the admin.
 * - `title`: a Reference filter value's Record title, e.g. through `resolveReference`.
 * - `href`: the href of the list with other params, e.g. the list location's `href`, which
 *   keeps the path of the list the person is on, so the chips carry the admin's base path.
 */
export type FilterStateOptions = {
	picker: FilterPickerResolver;
	title: FilterTitleResolver;
	href: (params: ListParams) => string;
};

/** The filter state of a list: see `FilterState`. `params` are the list params in its URL. */
export function filterState<R extends ListUrlResource>(
	resource: R,
	params: ListParams<R>,
	{ picker, title, href }: FilterStateOptions
): FilterState<R> {
	// Read through the loose `ListParams`, which has every param: a Resource that isn't searchable
	// has no `search` in its own, one with no sortable Field no `sort`, and one with no filterable
	// Field no `filters`.
	const { perPage, sort, search, filters = [] } = params satisfies ListParams as ListParams;

	/** The values the list is filtered by a Field with, by `eq` or `in`, as the URL writes them. */
	function filteredValues(key: string): string[] {
		const values: FilterValue[] = [];
		for (const filter of filters) {
			if (filter.field !== key) continue;
			if (filter.operator === 'eq') values.push(filter.value);
			if (filter.operator === 'in') values.push(...filter.value);
		}
		return values.map((value) => filterInputValue(resource, key, value));
	}

	/** The input of a Field's filter with one operator, and its value now as the URL writes it. */
	function filterInput(field: Field, operator: Exclude<FilterOperator, 'in'>): FilterInput {
		const filter = filters.find(
			(candidate) => candidate.field === field.key && candidate.operator === operator
		);
		return {
			name: filterParamName(field.key, operator),
			value:
				filter === undefined || filter.operator === 'in'
					? ''
					: filterInputValue(resource, field.key, filter.value)
		};
	}

	/** The filter control of a filterable Field, or `undefined` when no stock control fits it. */
	function filterControl(field: Field): FilterControl | undefined {
		const allows = (operator: FilterOperator) => field.filterOperators.includes(operator);
		const values = filteredValues(field.key);
		const option = (value: string, label: string): FilterOption => ({
			value,
			label,
			checked: value === '' ? values.length === 0 : values.includes(value)
		});
		const radio = (options: FilterOption[]): FilterControl => ({
			field,
			operators: ['eq'],
			type: 'radio',
			name: field.key,
			options: [option('', 'Any'), ...options]
		});
		switch (field.kind) {
			case 'boolean':
				return radio([option('true', 'Yes'), option('false', 'No')]);
			case 'enum': {
				const options = field.options.map((value) => option(String(value), String(value)));
				if (!allows('in')) return radio(options);
				return { field, operators: ['eq', 'in'], type: 'checkboxes', name: field.key, options };
			}
			case 'text': {
				const operator = allows('contains') ? 'contains' : allows('eq') ? 'eq' : undefined;
				if (operator === undefined) return undefined;
				if (operator === 'contains' || !allows('in')) {
					const inputs = [filterInput(field, operator)];
					return { field, operators: [operator], type: 'input', input: 'text', values: inputs };
				}
				// Exact matches on a Field that allows `in`: one box per value, so an `in` from the URL
				// shows, and is replaced rather than added to.
				const name = filterParamName(field.key, 'eq');
				const current = values.map((value) => ({ name, value }));
				const inputs = current.length > 0 ? current : [{ name, value: '' }];
				return { field, operators: ['eq', 'in'], type: 'input', input: 'text', values: inputs };
			}
			case 'number':
			case 'date': {
				const input = field.kind === 'number' ? 'number' : dateInputType(field);
				if (allows('gte') && allows('lte')) {
					const [from, to] = [filterInput(field, 'gte'), filterInput(field, 'lte')];
					return { field, operators: ['lte', 'gte'], type: 'range', input, from, to };
				}
				if (!allows('eq')) return undefined;
				const inputs = [filterInput(field, 'eq')];
				return { field, operators: ['eq'], type: 'input', input, values: inputs };
			}
			case 'reference': {
				if (!allows('eq')) return undefined;
				const current = filterInput(field, 'eq');
				return {
					field,
					operators: ['eq'],
					type: 'reference',
					current,
					emptyLabel: 'Any',
					picker: picker(field, current.value)
				};
			}
			default:
				return undefined;
		}
	}

	// One control per filterable Field the list View shows anywhere (`detail`: not hidden).
	const controls = resource.fields
		.filter((field) => field.detail && field.filterOperators.length > 0)
		.map(filterControl)
		.filter((control) => control !== undefined);
	/** Each filter a control sends, as `{field}.{operator}`. */
	const controlled = new Set(
		controls.flatMap((control) =>
			control.operators.map((operator) => `${control.field.key}.${operator}`)
		)
	);
	const uncontrolled = filters.filter(
		({ field, operator }) => !controlled.has(`${field}.${operator}`)
	);

	/** The hidden inputs that keep `kept`, leaving out their defaults. */
	const hiddenInputs = (kept: ListParams): HiddenInput[] => [...listSearchParams(kept, resource)];

	/** A filter's chip, or `undefined` for a filter on a Field the Resource doesn't have. */
	async function chip(filter: ListFilter): Promise<FilterChip | undefined> {
		const field = resource.fields.find((candidate) => candidate.key === filter.field);
		if (field === undefined) return undefined;
		// The href first, before any lookup, so it is written for these params.
		const others = filters.filter((other) => other !== filter);
		const removeHref = href({
			page: 1,
			perPage,
			sort,
			search,
			filters: others.length > 0 ? others : undefined
		});
		const chipValue = async (value: FilterValue): Promise<FilterChipValue> => {
			const found = field.kind === 'reference' ? await title(field, value) : undefined;
			return found === undefined ? { value } : { value, title: found };
		};
		const values = await Promise.all(
			filter.operator === 'in' ? filter.value.map(chipValue) : [chipValue(filter.value)]
		);
		return { field, operator: filter.operator, values, href: removeHref };
	}

	// Made once, when first asked for, so a list that shows no chips looks up no Record title.
	let chips: Promise<FilterChip[]> | undefined;

	return {
		controls,
		get chips(): Promise<FilterChip[]> {
			chips ??= Promise.all(filters.map(chip)).then((all) =>
				all.filter((made) => made !== undefined)
			);
			return chips;
		},
		hidden: {
			filterForm: hiddenInputs({ page: 1, perPage, sort, search, filters: uncontrolled }),
			searchForm: hiddenInputs({ page: 1, perPage, sort, filters })
		},
		nextParams(form: FormData): ListParams<R> {
			const entries = [...form].filter(
				(entry): entry is [string, string] => typeof entry[1] === 'string'
			);
			const url = new URL(`?${new URLSearchParams(entries)}`, BASE);
			return { ...readListParams(url, resource), page: 1 };
		}
	};
}

/** Any origin: the next params are read from a query only. */
const BASE = 'http://list.invalid/';

/** A hidden input of a GET form: its name and its value. */
export type HiddenInput = [name: string, value: string];

/** The filter state of a list, for a Resource and the list params in its URL. */
export type FilterState<R extends ListUrlResource = ListUrlResource> = {
	/**
	 * The filter controls to offer: one per filterable Field that isn't hidden, in schema order,
	 * for the Fields a stock control fits (see `FilterControl`). Filters on other Fields, and with
	 * operators no control offers, still work from the URL.
	 */
	controls: FilterControl[];
	/**
	 * The active filter chips: one per filter the list is filtered by, in the canonical order,
	 * whatever its operator (including ones no control offers) and whether or not its Field is
	 * hidden, so a person can always see and remove what narrows the list. Empty while no filter
	 * is on. A promise, since a Reference's Record title is looked up; the same one each time.
	 */
	readonly chips: Promise<FilterChip[]>;
	/**
	 * The hidden inputs each GET form keeps, so it works without JavaScript too, never naming the
	 * page (so it starts again at page 1) or a param at its default (the Resource's own page size
	 * and default sort):
	 *
	 * - `filterForm`: the search, the sort, the page size, and each filter no control sends, such
	 *   as one on a hidden Field or with an operator no control offers.
	 * - `searchForm`: the sort, the page size and every filter, beside the search box.
	 */
	hidden: { filterForm: HiddenInput[]; searchForm: HiddenInput[] };
	/**
	 * The list params the filter form names, from what it holds (its controls and hidden inputs),
	 * at page 1. Empty controls filter nothing, and each value is read as the list URL reads it,
	 * through the Field input codec, so one that is no value of its Field is dropped.
	 */
	nextParams(form: FormData): ListParams<R>;
};
